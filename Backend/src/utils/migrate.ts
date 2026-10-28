import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { env } from '../config/env.js';
import { migrationChecksum, normalizeMigrationSql, parseMigrationFilename, unsupportedMigrationFeatures, type MigrationFileInfo } from './migration-utils.js';

const migrationsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../database/migrations');

type Migration = MigrationFileInfo & {
  sql: string;
  checksum: string;
};

type AppliedMigration = RowDataPacket & {
  version: string;
  filename: string;
  checksum: string;
};

type MysqlErrorLike = {
  code?: string;
  errno?: number;
  sqlState?: string;
  message?: string;
};

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(identifier)) {
    throw new Error('DB_NAME solo puede contener letras, números, guion bajo o signo $.');
  }

  return `\`${identifier}\``;
}

function createPool(database?: string, multipleStatements = false): Pool {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ...(database ? { database } : {}),
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    multipleStatements,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    dateStrings: true
  });
}

function describeError(error: unknown): string {
  const candidate = (error ?? {}) as MysqlErrorLike;
  const details = [candidate.code, candidate.errno ? `errno=${candidate.errno}` : undefined, candidate.sqlState ? `sqlState=${candidate.sqlState}` : undefined]
    .filter(Boolean)
    .join(', ');
  const message = candidate.message ?? 'error desconocido';
  return details ? `${message} (${details})` : message;
}

async function loadMigrations(): Promise<Migration[]> {
  const filenames = (await readdir(migrationsPath)).filter((filename) => filename.endsWith('.sql')).sort();
  const seenVersions = new Set<string>();
  const migrations: Migration[] = [];

  for (const filename of filenames) {
    const info = parseMigrationFilename(filename);
    if (seenVersions.has(info.version)) {
      throw new Error(`Hay más de una migración para la versión ${info.version}.`);
    }
    seenVersions.add(info.version);

    const sql = normalizeMigrationSql(await readFile(path.join(migrationsPath, filename), 'utf8'));
    const unsupportedFeatures = unsupportedMigrationFeatures(sql);
    if (unsupportedFeatures.length > 0) {
      throw new Error(`La migración ${filename} contiene construcciones no compatibles con este runner: ${unsupportedFeatures.join(', ')}.`);
    }

    migrations.push({ ...info, sql, checksum: migrationChecksum(sql) });
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version, undefined, { numeric: true }) || left.filename.localeCompare(right.filename));
  return migrations;
}

async function ensureDatabaseExists(): Promise<void> {
  const adminPool = createPool();
  try {
    const [rows] = await adminPool.query<RowDataPacket[]>(
      'SELECT SCHEMA_NAME AS schemaName FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [env.DB_NAME]
    );

    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${quoteIdentifier(env.DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`[migrations] Base de datos "${env.DB_NAME}" creada.`);
    }
  } catch (error) {
    throw new Error(`No se pudo verificar o crear la base "${env.DB_NAME}": ${describeError(error)}`);
  } finally {
    await adminPool.end();
  }
}

async function runMigrations(): Promise<void> {
  const allMigrations = await loadMigrations();
  const migrationLimit = process.env.MIGRATIONS_MAX_VERSION?.trim();
  if (migrationLimit && !/^\d+$/.test(migrationLimit)) {
    throw new Error('MIGRATIONS_MAX_VERSION debe ser una versión numérica, por ejemplo 006.');
  }
  const migrations = migrationLimit
    ? allMigrations.filter((migration) => Number(migration.version) <= Number(migrationLimit))
    : allMigrations;
  if (migrations.length === 0) {
    throw new Error(`No se encontraron migraciones SQL en ${migrationsPath}.`);
  }
  if (migrationLimit) console.log(`[migrations] Ejecución limitada hasta la versión ${migrationLimit}; las posteriores no se ejecutarán.`);

  await ensureDatabaseExists();
  const migrationPool = createPool(env.DB_NAME, true);
  const connection = await migrationPool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) NOT NULL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [appliedRows] = await connection.query<AppliedMigration[]>(
      'SELECT version, filename, checksum FROM schema_migrations ORDER BY version'
    );
    const appliedByVersion = new Map(appliedRows.map((migration) => [migration.version, migration]));
    const knownVersions = new Set(migrations.map((migration) => migration.version));
    const removedMigrations = appliedRows.filter((migration) => !knownVersions.has(migration.version));

    if (removedMigrations.length > 0) {
      throw new Error(`La base registra migraciones ausentes en el código: ${removedMigrations.map((migration) => migration.filename).join(', ')}.`);
    }

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      const applied = appliedByVersion.get(migration.version);
      if (applied) {
        if (applied.filename !== migration.filename) {
          throw new Error(`La versión ${migration.version} cambió de nombre: la base registra "${applied.filename}" y el código contiene "${migration.filename}".`);
        }
        if (applied.checksum !== migration.checksum) {
          throw new Error(`La migración aplicada ${migration.filename} fue modificada. Restaurá el archivo original o creá una nueva versión; no se ejecutará ninguna migración posterior.`);
        }
        skippedCount += 1;
        console.log(`[migrations] omitida ${migration.filename}: ya aplicada y checksum válido.`);
        continue;
      }

      try {
        await connection.query(migration.sql);
        await connection.execute(
          'INSERT INTO schema_migrations (version, filename, checksum) VALUES (?, ?, ?)',
          [migration.version, migration.filename, migration.checksum]
        );
        appliedCount += 1;
        console.log(`[migrations] aplicada ${migration.filename}.`);
      } catch (error) {
        throw new Error(`Falló la migración ${migration.filename}: ${describeError(error)}. La versión no fue registrada como completada y se detuvieron las siguientes. Revisá el estado de la base antes de reintentar.`);
      }
    }

    console.log(`[migrations] Finalizado: ${appliedCount} nuevas, ${skippedCount} omitidas.`);
  } finally {
    connection.release();
    await migrationPool.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error(`[migrations] ERROR: ${error instanceof Error ? error.message : 'error desconocido'}`);
  process.exitCode = 1;
});
