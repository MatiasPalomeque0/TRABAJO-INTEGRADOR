import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrationChecksum, normalizeMigrationSql, parseMigrationFilename, unsupportedMigrationFeatures } from '../src/utils/migration-utils.js';

const migrationsPath = fileURLToPath(new URL('../database/migrations/', import.meta.url));

describe('migraciones versionadas', () => {
  it('interpreta nombres versionados y rechaza nombres ambiguos', () => {
    expect(parseMigrationFilename('003_techfix_domain.sql')).toEqual({ version: '003', filename: '003_techfix_domain.sql' });
    expect(() => parseMigrationFilename('techfix.sql')).toThrow();
  });

  it('mantiene el checksum entre finales de línea de Windows y Unix', () => {
    expect(migrationChecksum('SELECT 1;\r\n')).toBe(migrationChecksum('SELECT 1;\n'));
    expect(normalizeMigrationSql('  SELECT 1;  ')).toBe('SELECT 1;\n');
  });

  it('confirma que las migraciones actuales no usan construcciones incompatibles', () => {
    for (const filename of ['001_init.sql', '002_evidence_data.sql', '003_techfix_domain.sql', '004_employee_identity.sql', '005_presential_intake.sql']) {
      const sql = readFileSync(path.join(migrationsPath, filename), 'utf8');
      expect(unsupportedMigrationFeatures(sql), filename).toEqual([]);
    }
  });
});
