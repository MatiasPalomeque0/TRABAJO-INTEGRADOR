import { createHash } from 'node:crypto';

export type MigrationFileInfo = {
  version: string;
  filename: string;
};

const filenamePattern = /^(\d+)[-_].+\.sql$/i;

/** Normaliza finales de línea para que el checksum sea estable entre Windows y Unix. */
export function normalizeMigrationSql(sql: string): string {
  const normalized = sql.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  return normalized.length > 0 ? `${normalized}\n` : '';
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(normalizeMigrationSql(sql), 'utf8').digest('hex');
}

export function parseMigrationFilename(filename: string): MigrationFileInfo {
  const match = filenamePattern.exec(filename);
  if (!match) {
    throw new Error(`Nombre de migración inválido: "${filename}". Usá el formato NNN_descripcion.sql.`);
  }

  return { version: match[1], filename };
}

/**
 * El runner ejecuta cada archivo completo. Estas construcciones requieren un parser
 * específico de delimitadores y no deben llegar accidentalmente a este flujo.
 */
export function unsupportedMigrationFeatures(sql: string): string[] {
  const features: Array<[string, RegExp]> = [
    ['USE', /^\s*USE\s+/im],
    ['CREATE DATABASE', /^\s*CREATE\s+DATABASE\b/im],
    ['DELIMITER', /^\s*DELIMITER\b/im],
    ['stored procedure/function/trigger/event', /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i]
  ];

  return features.filter(([, pattern]) => pattern.test(sql)).map(([feature]) => feature);
}
