/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Route metadata contract for route discovery and code generation.
 */
export interface DiscoveredRoute {
  /** Relative route file path from routes dir, e.g. 'users/[userId].page.ts' */
  filePath?: string;
  /** Relative import path, e.g. './app/pages/users/[userId].page' */
  importPath?: string;
  /** Unique Route ID, e.g. '/users/:userId' or '/users/[userId]' or '/' */
  id: string;
  /** Inferred segment path, e.g. ':userId' or '/' or 'about' */
  path?: string;
  /** Canonical full path, e.g. '/users/:userId' or '/about' */
  fullPath?: string;
  /** Parent route ID */
  parentId?: string;
  /** Is index route */
  isIndex?: boolean;
  /** Is layout route */
  isLayout?: boolean;
  /** Inferred identifier name */
  variableName?: string;
}

export interface GenerateRouteTreeFileOptions {
  routesDir: string;
  generatedPath: string;
}

/**
 * Normalizes a raw segment into an identifier word.
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Generates a valid TypeScript variable name for a route.
 */
export function deriveVariableName(routeId: string, isIndex?: boolean): string {
  if (routeId === '/' || routeId === '') {
    return 'IndexRoute';
  }

  const clean = routeId.replace(/^\/+|\/+$/g, '');
  const pascal = toPascalCase(clean);

  if (isIndex && !pascal.endsWith('Index')) {
    return `${pascal}IndexRoute`;
  }
  return `${pascal}Route`;
}

/**
 * Converts dot-separated path segments into slashes while preserving catch-alls.
 */
export function convertDotsToSlashes(str: string): string {
  return str
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '___OPT_CATCHALL_$1___')
    .replace(/\[\.\.\.([^\]]+)\]/g, '___REQ_CATCHALL_$1___')
    .replace(/\./g, '/')
    .replace(/___OPT_CATCHALL_([^\]]+)___/g, '[[...$1]]')
    .replace(/___REQ_CATCHALL_([^\]]+)___/g, '[...$1]');
}

/**
 * Normalizes dynamic param patterns in path strings:
 * - `[param]` -> `:param`
 * - `[...slug]` -> `**`
 * - `[[...slug]]` -> `[[...slug]]`
 */
export function normalizeParamSegment(
  seg: string,
  mode: 'id' | 'path' | 'fullPath',
): string {
  if (mode === 'id') {
    return seg
      .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '[[...$1]]')
      .replace(/\[\.\.\.([^\]]+)\]/g, ':$1')
      .replace(/\[([^\]]+)\]/g, ':$1');
  }
  if (mode === 'path') {
    return seg
      .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '[[...$1]]')
      .replace(/\[\.\.\.([^\]]+)\]/g, '**')
      .replace(/\[([^\]]+)\]/g, ':$1');
  }
  // fullPath
  return seg
    .replace(/\(.*?\)\/?/g, '') // remove route groups from URL
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '[[...$1]]')
    .replace(/\[\.\.\.([^\]]+)\]/g, '**')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

/**
 * Scores a route segment for sorting:
 * 0: static
 * 1: dynamic param (:param or [param])
 * 2: wildcard (** or [...slug])
 */
function getSegmentScore(seg: string): number {
  if (seg.includes('**') || seg.includes('...') || seg.includes('slug')) {
    return 2;
  }
  if (seg.startsWith(':') || (seg.startsWith('[') && seg.endsWith(']'))) {
    return 1;
  }
  return 0;
}

/**
 * Deterministically sorts discovered routes:
 * 1. Root route first
 * 2. Parents before children (depth & ancestor prefix)
 * 3. Index routes before dynamic/param siblings
 * 4. Static segments before param segments, param before wildcard
 * 5. Alphabetical tiebreak on route ID
 */
export function sortDiscoveredRoutes(
  routes: DiscoveredRoute[],
): DiscoveredRoute[] {
  return [...routes].sort((a, b) => {
    // 1. Root route always first
    if (a.id === '/') return -1;
    if (b.id === '/') return 1;

    // 2. Parents before children (ancestor prefix)
    const aNorm = a.id.endsWith('/') ? a.id.slice(0, -1) : a.id;
    const bNorm = b.id.endsWith('/') ? b.id.slice(0, -1) : b.id;

    if (bNorm.startsWith(aNorm + '/')) return -1;
    if (aNorm.startsWith(bNorm + '/')) return 1;

    // 3. Segment depth
    const aSegs = a.id.split('/').filter(Boolean);
    const bSegs = b.id.split('/').filter(Boolean);
    if (aSegs.length !== bSegs.length) {
      return aSegs.length - bSegs.length;
    }

    // Compare segment by segment
    for (let i = 0; i < aSegs.length; i++) {
      const segA = aSegs[i];
      const segB = bSegs[i];
      if (segA === segB) continue;

      // Index before dynamic
      const isIndexA = segA === 'index' || a.isIndex;
      const isIndexB = segB === 'index' || b.isIndex;
      if (isIndexA !== isIndexB) return isIndexA ? -1 : 1;

      // Static before param, param before wildcard
      const scoreA = getSegmentScore(segA);
      const scoreB = getSegmentScore(segB);
      if (scoreA !== scoreB) return scoreA - scoreB;

      // Segment alphabetical
      const cmp = segA.localeCompare(segB);
      if (cmp !== 0) return cmp;
    }

    // Index before dynamic at same level
    if (a.isIndex && !b.isIndex) return -1;
    if (!a.isIndex && b.isIndex) return 1;

    // 5. Alphabetical tiebreak on ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Normalizes discovered route records into complete, well-formed entries.
 */
export function normalizeDiscoveredRoutes(
  routes: DiscoveredRoute[],
): DiscoveredRoute[] {
  const normalized: DiscoveredRoute[] = routes.map((r) => {
    let id = r.id;
    if (!id.startsWith('/')) {
      id = `/${id}`;
    }

    const isIndex =
      r.isIndex ?? (id === '/' || id.endsWith('/') || id.endsWith('/index'));

    let path = r.path;
    if (path === undefined) {
      if (id === '/') {
        path = '/';
      } else if (isIndex) {
        path = '/';
      } else {
        const segs = id.split('/').filter(Boolean);
        const lastSeg = segs[segs.length - 1];
        path = normalizeParamSegment(lastSeg, 'path');
      }
    }

    let fullPath = r.fullPath;
    if (fullPath === undefined) {
      if (id === '/') {
        fullPath = '/';
      } else {
        const segs = id.split('/').filter(Boolean);
        const mapped = segs
          .map((s) => normalizeParamSegment(s, 'fullPath'))
          .filter((s) => s !== '' && s !== 'index');
        const joined = `/${mapped.join('/')}`.replace(/\/+/g, '/');
        fullPath = joined || '/';
      }
    }

    let parentId = r.parentId;
    if (parentId === undefined) {
      if (id !== '/') {
        const segs = id.split('/').filter(Boolean);
        if (segs.length > 1) {
          const parentSegments = segs.slice(0, -1);
          parentId = `/${parentSegments.join('/')}`;
        }
      }
    }

    const variableName = r.variableName ?? deriveVariableName(id, isIndex);
    const importPath =
      r.importPath ?? `./app/pages${id === '/' ? '/index' : id}.page`;

    return {
      ...r,
      id,
      path,
      fullPath,
      parentId,
      isIndex,
      variableName,
      importPath,
    };
  });

  return sortDiscoveredRoutes(normalized);
}

/**
 * Generates the full string content of route type declarations.
 * Pure deterministic string templating for TypeScript declaration merging.
 */
export function generateRouteTree(routes: DiscoveredRoute[]): string {
  const normalizedRoutes = normalizeDiscoveredRoutes(routes);

  const lines: string[] = [
    `/* eslint-disable */`,
    `// @ts-nocheck`,
    `// noinspection JSUnusedGlobalSymbols`,
    `// This file was automatically generated by Analog Router.`,
    `// You should NOT make any changes in this file as it will be overwritten.`,
    ``,
    `declare module '@analogjs/router' {`,
    `  interface FileRoutesByPath {`,
  ];

  for (const r of normalizedRoutes) {
    lines.push(
      `    '${r.id}': {`,
      `      id: '${r.id}';`,
      `      path: '${r.path}';`,
      `      fullPath: '${r.fullPath}';`,
      `    };`,
    );
  }

  lines.push(
    `  }`,
    ``,
    `  interface Register {`,
    `    navigationMap: FileRoutesByFullPath;`,
    `  }`,
    `}`,
    ``,
    `export type FileRoutesByFullPath = {`,
  );

  const seenFullPaths = new Set<string>();
  for (const r of normalizedRoutes) {
    const fp = r.fullPath!;
    if (!seenFullPaths.has(fp)) {
      seenFullPaths.add(fp);
      lines.push(`  '${fp}': FileRoutesByPath['${r.id}'];`);
    }
  }

  lines.push(`};`, ``);

  return lines.join('\n');
}

/**
 * Recursively discovers page files in routesDir.
 */
export async function discoverRouteFiles(
  routesDir: string,
  generatedPath: string,
): Promise<DiscoveredRoute[]> {
  const discovered: DiscoveredRoute[] = [];

  if (!fs.existsSync(routesDir)) {
    return discovered;
  }

  const generatedDir = path.dirname(path.resolve(generatedPath));

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullEntryPath = path.join(dir, entry.name);

      // Guard against generated file itself and hidden directories
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
        continue;
      }
      if (
        fullEntryPath === path.resolve(generatedPath) ||
        entry.name.endsWith('.gen.ts')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullEntryPath);
      } else if (entry.isFile()) {
        const isPage =
          /\.page\.(ts|analog|ag|js)$/.test(entry.name) ||
          entry.name.endsWith('.md') ||
          (entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.spec.ts') &&
            !entry.name.endsWith('.d.ts'));

        if (!isPage) continue;

        const relFromRoutes = path
          .relative(routesDir, fullEntryPath)
          .replace(/\\/g, '/');

        // Relative import from generated file directory
        let relImport = path
          .relative(generatedDir, fullEntryPath)
          .replace(/\\/g, '/')
          .replace(/\.(ts|js|analog|ag|md)$/, '');

        if (!relImport.startsWith('.')) {
          relImport = `./${relImport}`;
        }

        // Derive Route ID, converting dots to slashes as segment separators
        const rawClean = relFromRoutes.replace(
          /\.page\.(ts|analog|ag|js)$|\.(ts|js|analog|ag|md)$/,
          '',
        );
        const cleanRel = convertDotsToSlashes(rawClean);

        let id = `/${cleanRel}`;
        const isIndex = cleanRel === 'index' || cleanRel.endsWith('/index');
        if (cleanRel === 'index') {
          id = '/';
        } else if (isIndex) {
          id = `/${cleanRel.replace(/\/index$/, '')}`;
        }

        discovered.push({
          filePath: relFromRoutes,
          importPath: relImport,
          id,
          isIndex,
        });
      }
    }
  }

  await walk(routesDir);
  return normalizeDiscoveredRoutes(discovered);
}

/**
 * Generates route type declarations with atomic write and idempotency check.
 */
export async function generateRouteTreeFile(
  options: GenerateRouteTreeFileOptions,
): Promise<{ changed: boolean; content: string }> {
  const { routesDir, generatedPath } = options;

  const normGenerated = path.resolve(generatedPath);
  const routes = await discoverRouteFiles(routesDir, generatedPath);
  const content = generateRouteTree(routes);

  // Content idempotency check
  try {
    if (fs.existsSync(normGenerated)) {
      const existingContent = await fs.promises.readFile(normGenerated, 'utf8');
      if (existingContent === content) {
        return { changed: false, content };
      }
    }
  } catch {
    // Proceed to write if read fails
  }

  // Ensure parent directory exists
  await fs.promises.mkdir(path.dirname(normGenerated), { recursive: true });

  // Atomic file write via temporary file
  const tmpFile = `${normGenerated}.tmp.${process.pid}.${Date.now()}`;
  await fs.promises.writeFile(tmpFile, content, 'utf8');
  await fs.promises.rename(tmpFile, normGenerated);

  return { changed: true, content };
}
