import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appDirectory = fileURLToPath(new URL('../../app/', import.meta.url));

function layoutFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return layoutFiles(path);
    return entry.name === '_layout.tsx' ? [path] : [];
  });
}

function childRouteNames(directory: string): Set<string> {
  return new Set(readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return [entry.name];
    if (!entry.isFile() || entry.name === '_layout.tsx' || !['.ts', '.tsx'].includes(extname(entry.name))) return [];
    return [basename(entry.name, extname(entry.name))];
  }));
}

function declaredAnchor(layoutPath: string): string | undefined {
  const source = readFileSync(layoutPath, 'utf8');
  return source.match(/anchor\s*:\s*['"]([^'"]+)['"]/)?.[1];
}

function anchorIsValid(anchor: string | undefined, routes: Set<string>): boolean {
  return !anchor || routes.has(anchor);
}

describe('integridad de layouts Expo Router', () => {
  it('no declara anchors que no existan como rutas hijas', () => {
    const invalid = layoutFiles(appDirectory).flatMap((layoutPath) => {
      const anchor = declaredAnchor(layoutPath);
      const routes = childRouteNames(dirname(layoutPath));
      return anchorIsValid(anchor, routes) ? [] : [{ layoutPath: resolve(layoutPath), anchor, routes: [...routes] }];
    });

    expect(invalid).toEqual([]);
  });

  it('detecta un anchor inválido en una configuración hipotética', () => {
    expect(anchorIsValid('index', new Set(['new', '[id]']))).toBe(false);
    expect(anchorIsValid('index', new Set(['index', 'new']))).toBe(true);
  });

  it('mantiene Clientes y Recepción fuera del navegador Tabs autenticado', () => {
    const appTabsLayout = readFileSync(resolve(appDirectory, '(app)', '_layout.tsx'), 'utf8');

    expect(existsSync(resolve(appDirectory, 'customers', 'new.tsx'))).toBe(true);
    expect(existsSync(resolve(appDirectory, 'intakes', 'new.tsx'))).toBe(true);
    expect(existsSync(resolve(appDirectory, '(app)', 'customers'))).toBe(false);
    expect(existsSync(resolve(appDirectory, '(app)', 'intakes'))).toBe(false);
    expect(appTabsLayout).not.toContain('Tabs.Screen name="customers"');
    expect(appTabsLayout).not.toContain('Tabs.Screen name="intakes"');
  });
});
