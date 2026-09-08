/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { assertInInjectionContext, inject, Injector } from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationExtras,
  Router,
} from '@angular/router';

import type { RegisteredNavigationMap } from '../types/register';
import type {
  NavigateOptions,
  NavigateOptionsForMap,
  RelativeNavigateOptionsForRoute,
  RouteBoundNavigator,
  GlobalNavigator,
} from '../types/navigation';
import { parseQueryParamsWith } from '../types/query-params';
import { QUERY_PARAMS_VALIDATOR_KEY, FULL_PATH_KEY } from './resources';
import { findActivatedRoute, BaseHookOptions } from './hooks';

// ============================================================================
// Core Helper & Utility Functions
// ============================================================================

/**
 * Strips a leading '#' from a URL fragment if present.
 */
export function cleanHash(hash?: string | null): string | undefined {
  if (!hash) return undefined;
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

/**
 * Resolves a destination path relative to a base 'from' path.
 *
 * Supports:
 * - Absolute paths: '/users', '/posts'
 * - Current directory: '.', './', './posts'
 * - Parent directory: '..', '../', '../settings'
 * - Multi-level parent directory: '../../dashboard'
 * - Descendant paths: 'posts', 'posts/:postId'
 */
export function resolveRelativePath(from: string, to: string): string {
  if (to.startsWith('/')) {
    return to;
  }
  if (to === '.' || to === './') {
    const clean = from.replace(/^\/+|\/+$/g, '');
    return clean ? `/${clean}` : '/';
  }

  const cleanFrom = from.replace(/^\/+|\/+$/g, '');
  const fromSegments = cleanFrom ? cleanFrom.split('/') : [];
  const toSegments = to.split('/').filter(Boolean);

  for (const seg of toSegments) {
    if (seg === '..') {
      if (fromSegments.length > 0) {
        fromSegments.pop();
      }
    } else if (seg === '.') {
      // Stay on current segment
    } else {
      fromSegments.push(seg);
    }
  }

  return '/' + fromSegments.join('/');
}

/**
 * Encodes a catch-all / splat parameter value by preserving segment separators ('/').
 */
export function encodeSplatParam(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * Encodes a single path segment parameter. Slashes are encoded to prevent URL structure manipulation.
 */
export function encodePathParam(value: unknown): string {
  if (value === undefined || value === null) return '';
  return encodeURIComponent(String(value));
}

/**
 * Interpolates parameter values into a route path pattern.
 *
 * Supports:
 * - Colon parameters: `:param`
 * - Bracket parameters: `[param]`
 * - Optional catch-all: `[[...param]]`
 * - Catch-all / Wildcard: `[...param]`, `**`
 *
 * Enforces URL safety:
 * - Scalar parameters encode slashes to prevent route structure manipulation.
 * - Splat parameters preserve slashes while encoding special characters within sub-segments.
 * - Missing required parameters throw an informative Error.
 */
export function interpolatePath(
  pathPattern: string,
  params: Record<string, unknown> = {},
): string {
  if (!pathPattern || pathPattern === '/' || pathPattern === '') {
    return '/';
  }

  const hasLeadingSlash = pathPattern.startsWith('/');
  const rawSegments = pathPattern.split('/').filter(Boolean);
  const resultSegments: string[] = [];

  for (const segment of rawSegments) {
    // 1. Wildcard: **
    if (segment === '**') {
      const val = params['**'];
      if (val !== undefined && val !== null && val !== '') {
        resultSegments.push(encodeSplatParam(val));
      }
      continue;
    }

    // 2. Optional catch-all: [[...param]]
    const optCatchAllMatch = segment.match(/^\[\[\.\.\.([a-zA-Z0-9_-]+)\]\]$/);
    if (optCatchAllMatch) {
      const paramName = optCatchAllMatch[1];
      const val = params[paramName];
      if (val !== undefined && val !== null && val !== '') {
        resultSegments.push(encodeSplatParam(val));
      }
      continue;
    }

    // 3. Catch-all: [...param]
    const reqCatchAllMatch = segment.match(/^\[\.\.\.([a-zA-Z0-9_-]+)\]$/);
    if (reqCatchAllMatch) {
      const paramName = reqCatchAllMatch[1];
      const val = params[paramName];
      if (val !== undefined && val !== null && val !== '') {
        resultSegments.push(encodeSplatParam(val));
      }
      continue;
    }

    // 4. Required Single Parameters (Full Segment): :param or [param]
    const reqColonMatch = segment.match(/^:([a-zA-Z0-9_-]+)$/);
    const reqBracketMatch = segment.match(/^\[([a-zA-Z0-9_-]+)\]$/);
    const paramName = reqColonMatch
      ? reqColonMatch[1]
      : reqBracketMatch
        ? reqBracketMatch[1]
        : null;

    if (paramName) {
      const val = params[paramName];
      if (val === undefined || val === null || val === '') {
        throw new Error(
          `[Analog Router] Missing required path parameter "${paramName}" for path "${pathPattern}".`,
        );
      }
      resultSegments.push(encodePathParam(val));
      continue;
    }

    // 5. Static Segment
    resultSegments.push(segment);
  }

  const joined = resultSegments.join('/');
  return hasLeadingSlash ? `/${joined}` : joined || '/';
}

/**
 * Converts a search parameter object into an Angular Router queryParams record.
 *
 * Rules:
 * - Retains primitives (string, number, boolean).
 * - Retains arrays of primitives.
 * - JSON-stringifies complex nested objects and object arrays.
 * - Converts Dates to ISO strings.
 * - Preserves null (for query parameter removal under 'merge' mode).
 * - Omits undefined.
 */
export function serializeQueryParams(
  search: unknown,
): Record<string, any> | undefined {
  if (search === undefined || search === null) {
    return undefined;
  }
  if (typeof search !== 'object') {
    return undefined;
  }

  const queryParams: Record<string, any> = {};
  const entries = Object.entries(search as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      queryParams[key] = null;
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      queryParams[key] = value;
      continue;
    }
    if (value instanceof Date) {
      queryParams[key] = value.toISOString();
      continue;
    }
    if (Array.isArray(value)) {
      const isPrimitiveArray = value.every(
        (v) =>
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean' ||
          v instanceof Date,
      );
      if (isPrimitiveArray) {
        queryParams[key] = value.map((v) =>
          v instanceof Date ? v.toISOString() : v,
        );
      } else {
        queryParams[key] = JSON.stringify(value);
      }
      continue;
    }
    if (typeof value === 'object') {
      queryParams[key] = JSON.stringify(value);
      continue;
    }
  }

  return Object.keys(queryParams).length > 0 ? queryParams : undefined;
}

/**
 * Safely decodes a URI component, returning the original string if decoding fails.
 */
export function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Converts a concrete URL pathname into Angular Router command segments.
 */
export function pathToCommands(path: string): any[] {
  if (!path || path === '/') {
    return ['/'];
  }
  const isAbsolute = path.startsWith('/');
  const segments = path.split('/').filter(Boolean).map(safeDecodeURIComponent);
  return isAbsolute ? ['/', ...segments] : segments;
}

/**
 * Traverses the router snapshot tree and collects active parameters from root to leaf.
 */
export function getActiveParams(router: Router): Record<string, string> {
  const merged: Record<string, string> = {};
  let current: ActivatedRouteSnapshot | null =
    router.routerState?.snapshot?.root ?? null;
  while (current) {
    if (current.params) {
      Object.assign(merged, current.params);
    }
    current = current.firstChild;
  }
  return merged;
}

/**
 * Extracts all inherited parameters along the path from root to route.
 */
export function extractAllParams(
  route: ActivatedRoute,
  latestParams?: Record<string, string>,
): Record<string, string> {
  const pathFromRoot = route.pathFromRoot ?? [route];
  const merged: Record<string, string> = {};
  for (const r of pathFromRoot) {
    if (r === route && latestParams) {
      Object.assign(merged, latestParams);
    } else if (r.snapshot?.params) {
      Object.assign(merged, r.snapshot.params);
    }
  }
  return merged;
}

/**
 * Resolves the active Angular Router instance with injection context validation.
 */
export function resolveRouter(
  fn: (...args: any[]) => any,
  options?: BaseHookOptions,
): Router {
  if (options?.injector) {
    return options.injector.get(Router);
  }
  assertInInjectionContext(fn);
  return inject(Router);
}

// ============================================================================
// Public Navigation APIs
// ============================================================================

/**
 * Executes a type-safe navigation to a target route destination.
 *
 * Handles:
 * - Interpolating path parameters (:param, $param, [param], wildcards, splats).
 * - Resolving relative navigation ('.', '..', './', '../').
 * - Serializing search parameters into Angular queryParams.
 * - Mapping navigation options (replace -> replaceUrl, state -> state, hash -> fragment).
 * - Injection context safety via active injection context or explicit options.injector.
 */
export async function navigate<TNavMap = RegisteredNavigationMap>(
  options: NavigateOptionsForMap<TNavMap>,
  executionOptions?: BaseHookOptions,
): Promise<boolean>;
export async function navigate<
  TTo extends string,
  TFrom extends string | undefined = undefined,
  TParams = unknown,
  TQueryParams = unknown,
>(
  options: NavigateOptions<TTo, TFrom, TParams, TQueryParams>,
  executionOptions?: BaseHookOptions,
): Promise<boolean>;
export async function navigate(
  options: any,
  executionOptions?: BaseHookOptions,
): Promise<boolean> {
  const opts = { ...options, ...executionOptions };
  const router = resolveRouter(navigate, opts);
  const injector = opts.injector ?? (router as any)['injector'];
  const currentRoute =
    opts.relativeTo ??
    injector?.get(ActivatedRoute, null, { optional: true }) ??
    null;

  // 1. Separate path, query, and hash from target string if present
  let targetTo: string = opts.to;
  let embeddedHash: string | undefined;
  let embeddedQuery: Record<string, string> | undefined;

  if (targetTo.includes('#')) {
    const [pathPart, hashPart] = targetTo.split('#');
    targetTo = pathPart;
    embeddedHash = hashPart;
  }

  if (targetTo.includes('?')) {
    const [pathPart, queryPart] = targetTo.split('?');
    targetTo = pathPart;
    if (queryPart) {
      embeddedQuery = {};
      const params = new URLSearchParams(queryPart);
      params.forEach((val, key) => {
        embeddedQuery![key] = val;
      });
    }
  }

  // 2. Resolve relative path against 'from' route or active route
  let concretePattern = targetTo;
  let targetRoute: ActivatedRoute | null = null;

  if (opts.from) {
    if (currentRoute) {
      targetRoute = findActivatedRoute(currentRoute, router, opts.from);
    }
    const fromRouteData =
      targetRoute?.snapshot?.data ?? targetRoute?.routeConfig?.data;
    const targetFullPath =
      fromRouteData?.[FULL_PATH_KEY] ??
      (targetRoute?.routeConfig as any)?.fullPath;
    const fromPath = opts.from.startsWith('/')
      ? opts.from
      : (targetFullPath ?? targetRoute?.routeConfig?.path ?? opts.from);
    concretePattern = resolveRelativePath(fromPath, targetTo);
  } else if (!targetTo.startsWith('/')) {
    const activeRouteData =
      currentRoute?.snapshot?.data ?? currentRoute?.snapshot?.routeConfig?.data;
    const currentPath =
      activeRouteData?.[FULL_PATH_KEY] ??
      (currentRoute?.snapshot?.routeConfig as any)?.fullPath ??
      currentRoute?.snapshot?.routeConfig?.path ??
      '/';
    concretePattern = resolveRelativePath(currentPath, targetTo);
  }

  // 3. Resolve path parameters
  let resolvedParams: Record<string, any> = {};

  const activeParams = getActiveParams(router);

  if (typeof opts.params === 'function') {
    const currentActiveParams = targetRoute
      ? { ...activeParams, ...extractAllParams(targetRoute) }
      : activeParams;
    resolvedParams = opts.params(currentActiveParams);
  } else if (opts.params) {
    resolvedParams = { ...opts.params };
  }

  // Automatic parent param retention for route-bound navigation
  if (opts.from) {
    const retainedParams = targetRoute
      ? { ...activeParams, ...extractAllParams(targetRoute) }
      : activeParams;
    resolvedParams = { ...retainedParams, ...resolvedParams };
  }

  // 4. Interpolate parameters into concrete path
  const finalPath = interpolatePath(concretePattern, resolvedParams);

  // 5. Resolve and validate query parameters
  let resolvedQueryParams = opts.queryParams;
  if (typeof resolvedQueryParams === 'function') {
    const currentQuery = router.routerState?.snapshot?.root?.queryParams ?? {};
    resolvedQueryParams = resolvedQueryParams(currentQuery);
  }

  if (embeddedQuery) {
    resolvedQueryParams = { ...embeddedQuery, ...(resolvedQueryParams as any) };
  }

  // Standard Schema validation if route data defines validateQueryParams
  const targetData =
    targetRoute?.snapshot?.data ?? targetRoute?.routeConfig?.data;
  const validator = targetData?.[QUERY_PARAMS_VALIDATOR_KEY];
  if (
    validator &&
    resolvedQueryParams &&
    typeof resolvedQueryParams === 'object'
  ) {
    resolvedQueryParams = parseQueryParamsWith(validator, resolvedQueryParams);
  }

  const queryParams = serializeQueryParams(resolvedQueryParams);

  // 6. Build NavigationExtras matching Angular's NavigationExtras contract
  const finalHash = cleanHash(opts.fragment ?? embeddedHash);
  const extras: NavigationExtras = {
    queryParams,
    queryParamsHandling: opts.queryParamsHandling,
    fragment: finalHash,
    preserveFragment: opts.preserveFragment,
    replaceUrl: opts.replaceUrl ?? false,
    state: opts.state as any,
    skipLocationChange: opts.skipLocationChange,
    info: opts.info,
    onSameUrlNavigation: opts.onSameUrlNavigation,
    relativeTo: opts.relativeTo,
  };

  // 7. Execute Angular Router transition
  const commands = pathToCommands(finalPath);
  return router.navigate(commands, extras);
}

/**
 * Creates a route-bound navigator function.
 *
 * Captures the Angular Router and active route at creation time, automatically
 * retaining parent route parameters when navigating relative paths.
 *
 * The returned navigator can be safely executed outside of an injection context
 * (e.g. in deferred methods, event handlers, or async promises).
 */
export function injectNavigate<
  TFrom extends keyof TNavMap & string,
  TNavMap = RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): RouteBoundNavigator<TFrom, TNavMap>;
export function injectNavigate<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): (
  options: RelativeNavigateOptionsForRoute<TFrom, any, any, any, any>,
) => Promise<boolean>;
export function injectNavigate<TNavMap = RegisteredNavigationMap>(options?: {
  from?: undefined;
  injector?: Injector;
}): GlobalNavigator<TNavMap>;
export function injectNavigate(options?: {
  from?: string;
  injector?: Injector;
}): any {
  const router = resolveRouter(injectNavigate, options);
  const injector = options?.injector ?? (router as any)['injector'];
  const from = options?.from;

  return (navOptions: any) => {
    return navigate(
      {
        ...navOptions,
        from: navOptions.from ?? from,
        injector: navOptions.injector ?? injector,
      },
      { injector: navOptions.injector ?? injector },
    );
  };
}
