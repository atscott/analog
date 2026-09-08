/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { assertInInjectionContext, inject, Injector } from '@angular/core';
import {
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
import type { InjectRouteOptions } from './hooks';

/**
 * Strips a leading '#' from a URL fragment if present.
 */
export function cleanHash(hash?: string | null): string | undefined {
  if (!hash) return undefined;
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

/**
 * Resolves a destination path relative to a base 'from' path.
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
 * Encodes a single path segment parameter.
 */
export function encodePathParam(value: unknown): string {
  if (value === undefined || value === null) return '';
  return encodeURIComponent(String(value));
}

/**
 * Interpolates parameter values into a route path pattern.
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

    // 4. Required Single Parameters: :param or [param]
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
 */
export function serializeQueryParams(
  search: unknown,
): Record<string, any> | undefined {
  if (search === undefined || search === null || typeof search !== 'object') {
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
    queryParams[key] = value;
  }

  return Object.keys(queryParams).length > 0 ? queryParams : undefined;
}

/**
 * Safely decodes a URI component.
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
 * Resolves the active Angular Router instance with injection context validation.
 */
export function resolveRouter(
  fn: (...args: any[]) => any,
  options?: InjectRouteOptions,
): Router {
  if (options?.injector) {
    return options.injector.get(Router);
  }
  assertInInjectionContext(fn);
  return inject(Router);
}

/**
 * Executes a type-safe navigation to a target route destination.
 *
 * @internal
 * @deprecated Use `injectNavigate()` instead. In Angular, navigation is typically invoked from
 * event handlers where no injection context exists. `injectNavigate()` captures the router and
 * injector at injection time and returns a callable navigator function.
 */
export async function navigate<TNavMap = RegisteredNavigationMap>(
  options: NavigateOptionsForMap<TNavMap>,
  executionOptions?: InjectRouteOptions,
): Promise<boolean>;
export async function navigate<
  TTo extends string,
  TFrom extends string | undefined = undefined,
  TParams = unknown,
  TQueryParams = unknown,
>(
  options: NavigateOptions<TTo, TFrom, TParams, TQueryParams>,
  executionOptions?: InjectRouteOptions,
): Promise<boolean>;
export async function navigate(
  options: any,
  executionOptions?: InjectRouteOptions,
): Promise<boolean> {
  const opts = { ...options, ...executionOptions };
  const router = resolveRouter(navigate, opts);

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

  function getAllSnapshotParams(router: Router): Record<string, string> {
    const merged: Record<string, string> = {};
    function walk(snapshot: ActivatedRouteSnapshot | null | undefined) {
      if (!snapshot) return;
      if (snapshot.params) {
        Object.assign(merged, snapshot.params);
      }
      for (const child of snapshot.children) {
        walk(child);
      }
    }
    walk(router.routerState?.snapshot?.root);
    return merged;
  }

  // Resolve relative path if 'from' is specified
  let concretePattern = targetTo;
  if (opts.from && !targetTo.startsWith('/')) {
    concretePattern = resolveRelativePath(opts.from, targetTo);
  }

  const currentParams = getAllSnapshotParams(router);

  // Resolve path parameters
  let resolvedParams: Record<string, any> = {};
  if (typeof opts.params === 'function') {
    resolvedParams = opts.params(currentParams);
  } else if (opts.params) {
    resolvedParams = opts.from
      ? { ...currentParams, ...opts.params }
      : { ...opts.params };
  } else if (opts.from) {
    resolvedParams = { ...currentParams };
  }

  // Interpolate parameters into concrete path
  const finalPath = interpolatePath(concretePattern, resolvedParams);

  // Resolve query parameters
  let resolvedQueryParams = opts.queryParams;
  if (typeof resolvedQueryParams === 'function') {
    const currentQuery = router.routerState?.snapshot?.root?.queryParams ?? {};
    resolvedQueryParams = resolvedQueryParams(currentQuery);
  }

  if (embeddedQuery) {
    resolvedQueryParams = { ...embeddedQuery, ...(resolvedQueryParams as any) };
  }

  const queryParams = serializeQueryParams(resolvedQueryParams);

  // Build NavigationExtras matching Angular's NavigationExtras contract
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

  const commands = pathToCommands(finalPath);
  return router.navigate(commands, extras);
}

/**
 * Creates a route-bound navigator function.
 */
export function injectNavigate<
  TFrom extends keyof TNavMap & string,
  TNavMap = RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): RouteBoundNavigator<TFrom, TNavMap>;
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
