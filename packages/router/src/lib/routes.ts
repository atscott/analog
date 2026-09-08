import { computed } from '@angular/core';
import { UrlSegment } from '@angular/router';
import type { Route } from '@angular/router';
import type { UrlMatcher } from '@angular/router';

import type { RouteConfig, RouteExport, RouteMeta } from './models';
import { toRouteConfig } from './route-config';
import { toMarkdownModule } from './markdown-helpers';
import { ENDPOINT_EXTENSION } from './constants';
import { ANALOG_META_KEY } from './endpoints';
import {
  QUERY_PARAMS_VALIDATOR_KEY,
  RESOURCES_KEY,
  ROUTE_ID_KEY,
  FULL_PATH_KEY,
} from './facade/resources';

/**
 * This variable reference is replaced with a glob of all page routes.
 */
export let ANALOG_ROUTE_FILES = {};

/**
 * This variable reference is replaced with a glob of all content routes.
 */
export let ANALOG_CONTENT_ROUTE_FILES = {};

export type Files = Record<string, () => Promise<RouteExport | string>>;

type RawRoute = {
  filename: string | null;
  rawSegment: string;
  ancestorRawSegments: string[];
  segment: string;
  level: number;
  children: RawRoute[];
};

type RawRouteMap = Record<string, RawRoute>;

type RawRouteByLevelMap = Record<number, RawRouteMap>;

/**
 * A function used to parse list of files and create configuration of routes.
 *
 * @param files
 * @returns Array of routes
 */
export function createRoutes(files: Files, debug = false): Route[] {
  const filenames = Object.keys(files);

  if (filenames.length === 0) {
    return [];
  }

  // map filenames to raw routes and group them by level
  const rawRoutesByLevelMap = filenames.reduce((acc, filename) => {
    const rawPath = toRawPath(filename);
    const rawSegments = rawPath.split('/');
    // nesting level starts at 0
    // rawPath: /products => level: 0
    // rawPath: /products/:id => level: 1
    const level = rawSegments.length - 1;
    const rawSegment = rawSegments[level];
    const ancestorRawSegments = rawSegments.slice(0, level);

    return {
      ...acc,
      [level]: {
        ...acc[level],
        [rawPath]: {
          filename,
          rawSegment,
          ancestorRawSegments,
          segment: toSegment(rawSegment),
          level,
          children: [],
        },
      },
    };
  }, {} as RawRouteByLevelMap);

  const allLevels = Object.keys(rawRoutesByLevelMap).map(Number);
  const maxLevel = Math.max(...allLevels);

  // add each raw route to its parent's children array
  for (let level = maxLevel; level > 0; level--) {
    const rawRoutesMap = rawRoutesByLevelMap[level];
    const rawPaths = Object.keys(rawRoutesMap);

    for (const rawPath of rawPaths) {
      const rawRoute = rawRoutesMap[rawPath];
      const parentRawPath = rawRoute.ancestorRawSegments.join('/');
      const parentRawSegmentIndex = rawRoute.ancestorRawSegments.length - 1;
      const parentRawSegment =
        rawRoute.ancestorRawSegments[parentRawSegmentIndex];

      // create the parent level and/or raw route if it does not exist
      // parent route won't exist for nested routes that don't have a layout route
      rawRoutesByLevelMap[level - 1] ||= {};
      rawRoutesByLevelMap[level - 1][parentRawPath] ||= {
        filename: null,
        rawSegment: parentRawSegment,
        ancestorRawSegments: rawRoute.ancestorRawSegments.slice(
          0,
          parentRawSegmentIndex,
        ),
        segment: toSegment(parentRawSegment),
        level: level - 1,
        children: [],
      };

      rawRoutesByLevelMap[level - 1][parentRawPath].children.push(rawRoute);
    }
  }

  // only take raw routes from the root level
  // since they already contain nested routes as their children
  const rootRawRoutesMap = rawRoutesByLevelMap[0];
  const rawRoutes = Object.keys(rootRawRoutesMap).map(
    (segment) => rootRawRoutesMap[segment],
  );
  sortRawRoutes(rawRoutes);

  return toRoutes(rawRoutes, files, debug);
}

function toRawPath(filename: string): string {
  return (
    filename
      .replace(
        // convert to relative path and remove file extension
        /^(?:[a-zA-Z]:[\\/])?(.*?)[\\/](?:routes|pages)[\\/]|(?:[\\/](?:app[\\/](?:routes|pages)|src[\\/]content)[\\/])|(\.page\.(js|ts|analog|ag)$)|(\.(ts|md|analog|ag)$)/g,
        '',
      )
      // [[...slug]] => placeholder (named empty) which is stripped by toSegment
      .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '(opt-$1)')
      .replace(/\[\.{3}.+\]/, '**') // [...not-found] => **
      .replace(/\[([^\]]+)\]/g, ':$1')
  ); // [id] => :id
}

function toSegment(rawSegment: string): string {
  return rawSegment
    .replace(/index|\(.*?\)/g, '') // replace named empty segments
    .replace(/\.|\/+/g, '/') // replace dots with slashes and remove redundant slashes
    .replace(/^\/+|\/+$/g, ''); // remove trailing slashes
}

function createOptionalCatchAllMatcher(paramName: string): UrlMatcher {
  return (segments) => {
    if (segments.length === 0) {
      return null;
    }
    const joined = segments.map((s) => s.path).join('/');
    return {
      consumed: segments,
      posParams: { [paramName]: new UrlSegment(joined, {}) },
    };
  };
}

function toRoutes(rawRoutes: RawRoute[], files: Files, debug = false): Route[] {
  const routes: Route[] = [];

  for (const rawRoute of rawRoutes) {
    const children: Route[] | undefined =
      rawRoute.children.length > 0
        ? toRoutes(rawRoute.children, files, debug)
        : undefined;
    let module: (() => Promise<RouteExport>) | undefined = undefined;
    let analogMeta: { endpoint: string; endpointKey: string } | undefined =
      undefined;

    if (rawRoute.filename) {
      const isMarkdownFile = rawRoute.filename.endsWith('.md');

      if (!debug) {
        module = isMarkdownFile
          ? toMarkdownModule(files[rawRoute.filename] as () => Promise<string>)
          : (files[rawRoute.filename] as () => Promise<RouteExport>);
      }

      const endpointKey = rawRoute.filename.replace(
        /\.page\.(ts|analog|ag)$/,
        ENDPOINT_EXTENSION,
      );

      // get endpoint path
      const rawEndpoint = rawRoute.filename
        .replace(/\.page\.(ts|analog|ag)$/, '')
        .replace(/\[\[\.\.\..+\]\]/, '**')
        .replace(/\[\.{3}.+\]/, '**') // [...not-found] => **
        .replace(/^(.*?)\/pages/, '/pages');

      // replace periods, remove (index) paths
      const endpoint = (rawEndpoint || '')
        .replace(/\./g, '/')
        .replace(/\/\((.*?)\)$/, '/-$1-');

      analogMeta = {
        endpoint,
        endpointKey,
      };
    }

    // Detect Next.js-style optional catch-all at this node: [[...param]]
    const optCatchAllMatch = rawRoute.filename?.match(/\[\[\.\.\.([^\]]+)\]\]/);
    const optCatchAllParam = optCatchAllMatch ? optCatchAllMatch[1] : null;

    type DebugRoute = Route & {
      filename?: string | null | undefined;
      isLayout?: boolean;
    };

    const route: Route & { meta?: typeof analogMeta } & DebugRoute = module
      ? {
          path: rawRoute.segment,
          loadChildren: () =>
            module!().then((m: any) => {
              const rawRouteDef =
                m.Route &&
                (typeof m.Route === 'object' || typeof m.Route === 'function')
                  ? m.Route
                  : m.default &&
                      (typeof m.default === 'object' ||
                        typeof m.default === 'function') &&
                      ('resolve' in m.default ||
                        'resources' in m.default ||
                        'validateQueryParams' in m.default ||
                        'validateSearch' in m.default ||
                        'path' in m.default ||
                        'id' in m.default)
                    ? m.default
                    : m.routeMeta &&
                        (typeof m.routeMeta === 'object' ||
                          typeof m.routeMeta === 'function')
                      ? m.routeMeta
                      : null;

              const fileRouteDef = rawRouteDef;

              const resolvedComponent = fileRouteDef?.component ?? m.default;

              const resolvedLoadComponent =
                fileRouteDef?.loadComponent ?? undefined;

              if (import.meta.env.DEV) {
                const hasModuleDefault =
                  !!resolvedComponent || !!resolvedLoadComponent;
                const hasRedirect =
                  !!m.routeMeta?.redirectTo || !!fileRouteDef?.redirectTo;

                if (!hasModuleDefault && !hasRedirect) {
                  console.warn(
                    `[Analog] Missing default export at ${rawRoute.filename}`,
                  );
                }
              }

              const effectiveRouteMeta: RouteMeta | undefined =
                typeof fileRouteDef === 'function'
                  ? fileRouteDef()
                  : (fileRouteDef ??
                    (typeof m.routeMeta === 'function'
                      ? m.routeMeta()
                      : m.routeMeta));

              const routeConfig = toRouteConfig(effectiveRouteMeta);

              const routeId =
                fileRouteDef?.id ??
                (rawRoute.filename
                  ? `/${toRawPath(rawRoute.filename)}`
                  : rawRoute.segment);
              const fullPath =
                fileRouteDef?.fullPath ??
                (rawRoute.filename
                  ? `/${toRawPath(rawRoute.filename).replace(/\(.*?\)\/?/g, '')}`.replace(
                      /\/+/g,
                      '/',
                    )
                  : undefined);

              const isFacadeRoute = Boolean(
                m?.Route ||
                (m?.default &&
                  typeof m.default === 'object' &&
                  ('resolve' in m.default ||
                    'resources' in m.default ||
                    'validateQueryParams' in m.default)),
              );
              const validator =
                fileRouteDef?.validateQueryParams ??
                (effectiveRouteMeta as any)?.validateQueryParams;
              const rawResources =
                fileRouteDef?.resources ??
                (effectiveRouteMeta as any)?.resources;

              const routeResources = rawResources
                ? (ctx: any) => {
                    const queryParams = validator
                      ? computed(() =>
                          validator(
                            typeof ctx.queryParams === 'function'
                              ? ctx.queryParams()
                              : (ctx.queryParams ?? {}),
                          ),
                        )
                      : ctx.queryParams;
                    return rawResources({ ...ctx, queryParams });
                  }
                : undefined;

              const baseChildData = isFacadeRoute
                ? {
                    ...(routeConfig.data ?? {}),
                    ...(fileRouteDef?.data ?? {}),
                    ...(routeId !== undefined
                      ? { [ROUTE_ID_KEY]: routeId }
                      : {}),
                    ...(fullPath !== undefined
                      ? { [FULL_PATH_KEY]: fullPath }
                      : {}),
                    ...(validator
                      ? {
                          [QUERY_PARAMS_VALIDATOR_KEY]: validator,
                        }
                      : {}),
                    ...(routeResources
                      ? { [RESOURCES_KEY]: routeResources }
                      : {}),
                  }
                : routeConfig.data;

              const { path: _routeConfigPath, ...cleanRouteConfig } =
                (routeConfig ?? {}) as RouteConfig & { path?: string };

              const baseChild = {
                path: '',
                ...(resolvedComponent ? { component: resolvedComponent } : {}),
                ...(resolvedLoadComponent
                  ? { loadComponent: resolvedLoadComponent }
                  : {}),
                ...cleanRouteConfig,
                ...(baseChildData !== undefined ? { data: baseChildData } : {}),
                ...(fileRouteDef && routeId !== undefined
                  ? { id: routeId }
                  : {}),
                ...((fileRouteDef && fullPath !== undefined
                  ? { fullPath }
                  : {}) as any),
                ...(cleanRouteConfig.resolve || fileRouteDef?.resolve
                  ? {
                      resolve: {
                        ...(cleanRouteConfig.resolve ?? {}),
                        ...(fileRouteDef?.resolve ?? {}),
                      },
                    }
                  : {}),
                ...(routeResources ? { resources: routeResources } : {}),
                children,
                [ANALOG_META_KEY]: analogMeta,
              };

              const { path: _basePath, ...baseChildWithoutPath } = baseChild;

              // Base route first so static matches win, then optional catch-all matcher
              return [
                {
                  ...baseChild,
                },
                ...(optCatchAllParam
                  ? [
                      {
                        matcher:
                          createOptionalCatchAllMatcher(optCatchAllParam),
                        ...baseChildWithoutPath,
                      },
                    ]
                  : []),
              ];
            }),
        }
      : {
          path: rawRoute.segment,
          ...(debug
            ? {
                filename: rawRoute.filename ? rawRoute.filename : undefined,
                isLayout: children && children.length > 0 ? true : false,
              }
            : {}),
          children,
        };

    routes.push(route);
  }

  return routes;
}

function sortRawRoutes(rawRoutes: RawRoute[]): void {
  rawRoutes.sort((a, b) => {
    let segmentA = deprioritizeSegment(a.segment);
    let segmentB = deprioritizeSegment(b.segment);

    // prioritize routes with fewer children
    if (a.children.length > b.children.length) {
      segmentA = `~${segmentA}`;
    } else if (a.children.length < b.children.length) {
      segmentB = `~${segmentB}`;
    }

    return segmentA > segmentB ? 1 : -1;
  });

  for (const rawRoute of rawRoutes) {
    sortRawRoutes(rawRoute.children);
  }
}

function deprioritizeSegment(segment: string): string {
  // deprioritize param and wildcard segments
  return segment.replace(':', '~~').replace('**', '~~~~');
}

export const routes: Route[] = createRoutes({
  ...ANALOG_ROUTE_FILES,
  ...ANALOG_CONTENT_ROUTE_FILES,
});
