import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Route metadata contract for route discovery and code generation.
 */
export interface DiscoveredRoute {
  /** Relative route file path from routes dir, e.g. 'users/[userId].page.ts' */
  filePath?: string;
  /** Relative import path from routeTree.gen.ts, e.g. './app/pages/users/[userId].page' */
  importPath?: string;
  /** Unique Route ID, e.g. '/users/$userId' or '/users/[userId]' or '/' */
  id: string;
  /** Inferred segment path, e.g. ':userId' or '/' or 'about' */
  path?: string;
  /** Canonical full path, e.g. '/users/:userId' or '/about' */
  fullPath?: string;
  /** Parent route ID, e.g. '__root__' or '/users' */
  parentId?: string;
  /** Is index route */
  isIndex?: boolean;
  /** Is layout route */
  isLayout?: boolean;
  /** Inferred identifier name in generated file, e.g. 'UsersUserIdRoute' */
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
  if (routeId === '/' || routeId === '__root__' || routeId === '') {
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
 * Normalizes dynamic param patterns in path strings:
 * - `[param]` -> `:param`
 * - `[...slug]` -> `**`
 */
export function normalizeParamSegment(
  seg: string,
  mode: 'id' | 'path' | 'fullPath',
): string {
  if (mode === 'id') {
    return seg
      .replace(/\[\.\.\.([^\]]+)\]/g, ':$1')
      .replace(/\[([^\]]+)\]/g, ':$1');
  }
  if (mode === 'path') {
    return seg
      .replace(/\[\.\.\.([^\]]+)\]/g, '**')
      .replace(/\[([^\]]+)\]/g, ':$1');
  }
  // fullPath
  return seg
    .replace(/\(.*?\)\/?/g, '') // remove route groups from URL
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
    if (a.id === '/' || a.id === '__root__') return -1;
    if (b.id === '/' || b.id === '__root__') return 1;

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
      if (id === '/' || id === '__root__') {
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
      if (id === '/' || id === '__root__') {
        fullPath = '/';
      } else {
        const segs = id.split('/').filter(Boolean);
        const mapped = segs.map((s) => normalizeParamSegment(s, 'fullPath'));
        const joined = `/${mapped.join('/')}`.replace(/\/+/g, '/');
        fullPath = isIndex && !joined.endsWith('/') ? `${joined}/` : joined;
      }
    }

    let parentId = r.parentId;
    if (parentId === undefined) {
      if (id === '/' || id === '__root__') {
        parentId = '__root__';
      } else {
        const segs = id.split('/').filter(Boolean);
        if (segs.length <= 1) {
          parentId = '__root__';
        } else {
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
 * Generates the full string content of routeTree.gen.ts.
 * Pure deterministic string templating with 0 external dependencies.
 */
export function generateRouteTree(routes: DiscoveredRoute[]): string {
  const normalizedRoutes = normalizeDiscoveredRoutes(routes);

  // Map route IDs to route records
  const routeMap = new Map<string, DiscoveredRoute>();
  for (const r of normalizedRoutes) {
    routeMap.set(r.id, r);
  }

  // Group children by parentId
  const childrenByParent = new Map<string, DiscoveredRoute[]>();
  for (const r of normalizedRoutes) {
    const pId = r.parentId ?? '__root__';
    if (!childrenByParent.has(pId)) {
      childrenByParent.set(pId, []);
    }
    childrenByParent.get(pId)!.push(r);
  }

  // Identify parents with children, sorted deepest first (bottom-up assembly)
  const parentsWithChildren = normalizedRoutes
    .filter((r) => childrenByParent.has(r.id))
    .sort((a, b) => {
      const depthA = a.id.split('/').filter(Boolean).length;
      const depthB = b.id.split('/').filter(Boolean).length;
      return depthB - depthA;
    });

  // Track which routes have WithChildren variants
  const hasWithChildren = new Set<string>();
  for (const p of parentsWithChildren) {
    hasWithChildren.add(p.id);
  }

  // 1. Imports
  const importLines: string[] = [
    `/* eslint-disable */`,
    `// @ts-nocheck`,
    `// noinspection JSUnusedGlobalSymbols`,
    `// This file was automatically generated by Analog Router.`,
    `// You should NOT make any changes in this file as it will be overwritten.`,
    ``,
    `// Route Imports`,
  ];

  for (const r of normalizedRoutes) {
    importLines.push(
      `import type { Route as ${r.variableName}Import } from '${r.importPath}';`,
    );
  }

  // 2. Route Definitions
  const createUpdateLines: string[] = [``, `// Route Definitions`];

  for (const r of normalizedRoutes) {
    createUpdateLines.push(
      `export const ${r.variableName} = {`,
      `  id: '${r.id}',`,
      `  path: '${r.path}',`,
      `  loadChildren: () => import('${r.importPath}'),`,
      `};`,
      ``,
    );
  }

  // 3. Bottom-up Assembly
  const assemblyLines: string[] = [`// Route Tree Assembly`];

  for (const parent of parentsWithChildren) {
    const children = childrenByParent.get(parent.id) ?? [];
    const childVarNames = children.map((c) =>
      hasWithChildren.has(c.id)
        ? `${c.variableName}WithChildren`
        : c.variableName,
    );

    assemblyLines.push(
      `const ${parent.variableName}WithChildren = {`,
      `  ...${parent.variableName},`,
      `  children: [`,
      `    ${childVarNames.join(',\n    ')},`,
      `  ],`,
      `};`,
      ``,
    );
  }

  // Top-level root children
  const rootChildren = childrenByParent.get('__root__') ?? [];
  // Also collect any route whose parentId does not exist in routeMap
  for (const r of normalizedRoutes) {
    if (
      r.parentId !== '__root__' &&
      (!r.parentId || !routeMap.has(r.parentId))
    ) {
      if (!rootChildren.includes(r)) {
        rootChildren.push(r);
      }
    }
  }

  const rootChildVarNames = rootChildren.map((c) =>
    hasWithChildren.has(c.id)
      ? `${c.variableName}WithChildren`
      : c.variableName,
  );

  assemblyLines.push(
    `export const routeTree = [`,
    `  ${rootChildVarNames.join(',\n  ')},`,
    `];`,
    ``,
    `export const routes = routeTree;`,
  );

  // 4. Module Augmentation
  const augmentationLines: string[] = [
    ``,
    `// Module Augmentation`,
    `declare module '@analogjs/router' {`,
    `  interface FileRoutesByPath {`,
  ];

  for (const r of normalizedRoutes) {
    augmentationLines.push(
      `    '${r.id}': {`,
      `      id: '${r.id}';`,
      `      path: '${r.path}';`,
      `      fullPath: '${r.fullPath}';`,
      `      route: typeof ${r.variableName}Import;`,
      `    };`,
    );
  }

  augmentationLines.push(
    `  }`,
    ``,
    `  interface Register {`,
    `    navigationMap: FileRoutesByFullPath;`,
    `    routeMap: FileRoutesById;`,
    `  }`,
    `}`,
    ``,
  );

  // 5. Type Exports
  const typeExportLines: string[] = [`export type FileRoutesByFullPath = {`];

  // De-duplicate fullPaths
  const seenFullPaths = new Set<string>();
  for (const r of normalizedRoutes) {
    const fp = r.fullPath!;
    if (!seenFullPaths.has(fp)) {
      seenFullPaths.add(fp);
      typeExportLines.push(`  '${fp}': typeof ${r.variableName}Import;`);
    }
  }
  typeExportLines.push(`};`, ``, `export type FileRoutesById = {`);

  const seenIds = new Set<string>();
  for (const r of normalizedRoutes) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      typeExportLines.push(`  '${r.id}': typeof ${r.variableName}Import;`);
    }
  }
  typeExportLines.push(`};`, ``);

  return [
    ...importLines,
    ...createUpdateLines,
    ...assemblyLines,
    ...augmentationLines,
    ...typeExportLines,
  ].join('\n');
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
        entry.name === 'routeTree.gen.ts'
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

        // Derive Route ID
        const cleanRel = relFromRoutes.replace(
          /\.page\.(ts|analog|ag|js)$|\.(ts|js|analog|ag|md)$/,
          '',
        );

        let id = `/${cleanRel}`;
        const isIndex = cleanRel === 'index' || cleanRel.endsWith('/index');
        if (cleanRel === 'index') {
          id = '/';
        } else if (isIndex) {
          id = `/${cleanRel.replace(/\/index$/, '/')}`;
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
 * Generates routeTree.gen.ts with atomic write, idempotency check,
 * and watcher self-exclusion.
 */
export async function generateRouteTreeFile(
  options: GenerateRouteTreeFileOptions,
): Promise<{ changed: boolean; content: string }> {
  const { routesDir, generatedPath } = options;

  // Guard 1: Self-exclusion
  const normGenerated = path.resolve(generatedPath);
  const normRoutesDir = path.resolve(routesDir);
  if (
    normGenerated.startsWith(normRoutesDir) &&
    normGenerated.endsWith('routeTree.gen.ts')
  ) {
    // If generatedPath is placed inside routesDir, discovery already filters it
  }

  const routes = await discoverRouteFiles(routesDir, generatedPath);
  const content = generateRouteTree(routes);

  // Guard 2: Content idempotency check
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

  // Guard 3: Atomic file write via temporary file
  const tmpFile = `${normGenerated}.tmp.${process.pid}.${Date.now()}`;
  await fs.promises.writeFile(tmpFile, content, 'utf8');
  await fs.promises.rename(tmpFile, normGenerated);

  return { changed: true, content };
}
