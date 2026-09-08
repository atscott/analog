import {
  assertInInjectionContext,
  inject,
  Injector,
  Signal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Router,
} from '@angular/router';
import { map, distinctUntilChanged } from 'rxjs';
import type { Resource } from '@angular/core';

import type {
  RegisteredNavigationMap,
  ParamsForPath,
  IsAnyRoute,
} from '../types/register';
import type { ParseParams } from '../types/params';
import type { InferRouteQueryParams } from '../types/query-params';
import type { ExtractResolvedData } from '../types/resources';
import {
  QUERY_PARAMS_VALIDATOR_KEY,
  ROUTE_ID_KEY,
  FULL_PATH_KEY,
  RESOURCES_KEY,
} from './resources';

// ============================================================================
// Types & Options
// ============================================================================

export interface BaseHookOptions {
  /**
   * Optional custom Injector.
   * If provided, the hook can be safely called outside of an active injection context
   * (e.g. within asynchronous callbacks, event handlers, or deferred methods).
   */
  injector?: Injector;
}

export interface InjectParamsOptions<
  TFrom extends string = string,
> extends BaseHookOptions {
  /**
   * Optional route path or ID to scope parameter extraction to a specific route.
   */
  from?: TFrom;
}

export interface InjectQueryParamsOptions<
  TFrom extends string = string,
> extends BaseHookOptions {
  /**
   * Optional route path or ID to scope query parameter validation to a specific route.
   */
  from?: TFrom;
}

export interface GetQueryParamsOptions<
  TFrom extends string = string,
> extends BaseHookOptions {
  /**
   * Optional route path or ID to scope query parameter validation to a specific route.
   */
  from?: TFrom;
}

export interface InjectRouteDataOptions<
  TFrom extends string = string,
> extends BaseHookOptions {
  /**
   * Optional route path or ID to scope data extraction to a specific route.
   */
  from?: TFrom;
}

export interface InjectRouteResourcesOptions<
  TFrom extends string = string,
> extends BaseHookOptions {
  /**
   * Optional route path or ID to scope resource extraction to a specific route.
   */
  from?: TFrom;
}

// ============================================================================
// Type Inference Engine
// ============================================================================

/**
 * Infers strongly typed path parameters from a route path literal or registered navigation map.
 */
export type InferParams<
  TFrom extends string | undefined,
  TFallback = Record<string, string>,
> = [TFrom] extends [string]
  ? [keyof RegisteredNavigationMap] extends [never]
    ? ParseParams<TFrom>
    : string extends keyof RegisteredNavigationMap
      ? ParseParams<TFrom>
      : TFrom extends keyof RegisteredNavigationMap
        ? ParamsForPath<TFrom>
        : ParseParams<TFrom>
  : TFallback;

/**
 * Infers the resolved route data or static route data for a given path.
 */
export type InferRouteData<
  TFrom extends string | undefined,
  TFallback = unknown,
> = [TFrom] extends [string]
  ? TFrom extends keyof RegisteredNavigationMap
    ? IsAnyRoute<RegisteredNavigationMap[TFrom]> extends true
      ? TFallback
      : RegisteredNavigationMap[TFrom] extends {
            types?: { data: infer TData };
          }
        ? TData
        : RegisteredNavigationMap[TFrom] extends {
              resolve?: infer TResolve;
            }
          ? ExtractResolvedData<TResolve>
          : TFallback
    : TFallback
  : TFallback;

/**
 * Infers reactive signal resources for a given path.
 */
export type InferRouteResource<
  TFrom extends string | undefined,
  TFallback = Record<string, Resource<unknown>>,
> = [TFrom] extends [string]
  ? TFrom extends keyof RegisteredNavigationMap
    ? IsAnyRoute<RegisteredNavigationMap[TFrom]> extends true
      ? TFallback
      : RegisteredNavigationMap[TFrom] extends {
            types?: { resources: infer TResources };
          }
        ? TResources
        : RegisteredNavigationMap[TFrom] extends {
              resources?: (
                ctx: any,
              ) => infer TResources | Promise<infer TResources>;
            }
          ? Awaited<TResources>
          : TFallback
    : TFallback
  : TFallback;

/**
 * Infers validated query parameter schema for a given path.
 */
export type InferQueryParams<
  TFrom extends string | undefined,
  TFallback = Record<string, unknown>,
> = [TFrom] extends [string]
  ? TFrom extends keyof RegisteredNavigationMap
    ? IsAnyRoute<RegisteredNavigationMap[TFrom]> extends true
      ? TFallback
      : RegisteredNavigationMap[TFrom] extends {
            types?: { queryParams: infer TQueryParams };
          }
        ? [unknown] extends [TQueryParams]
          ? InferRouteQueryParams<
              RegisteredNavigationMap[TFrom]
            > extends infer TOut
            ? unknown extends TOut
              ? TFallback
              : TOut
            : TFallback
          : TQueryParams
        : InferRouteQueryParams<
              RegisteredNavigationMap[TFrom]
            > extends infer TOut
          ? unknown extends TOut
            ? TFallback
            : TOut
          : TFallback
    : TFallback
  : TFallback;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolves the active injector, asserting an injection context if explicit injector is omitted.
 */
export function resolveInjector(
  hookName: (...args: any[]) => any,
  options?: BaseHookOptions,
): Injector {
  if (options?.injector) {
    return options.injector;
  }
  assertInInjectionContext(hookName);
  return inject(Injector);
}

function cleanSegment(segment: string): string {
  return segment.replace(/^\/+|\/+$/g, '');
}

function normalizePatternForMatch(p: string): string {
  return cleanSegment(p).replace(/\[([a-zA-Z0-9_-]+)\]/g, ':$1');
}

type RouteLike = ActivatedRoute | ActivatedRouteSnapshot;

function getRouteData(route: RouteLike): any {
  const primary = 'snapshot' in route ? route.snapshot?.data : route.data;
  return primary ?? route.routeConfig?.data;
}

function getRouteId(route: RouteLike): string | undefined {
  const data = getRouteData(route);
  return data?.[ROUTE_ID_KEY] ?? (route.routeConfig as any)?.id;
}

function getRouteFullPath(route: RouteLike): string | undefined {
  const data = getRouteData(route);
  return data?.[FULL_PATH_KEY] ?? (route.routeConfig as any)?.fullPath;
}

/**
 * Checks if an ActivatedRoute or ActivatedRouteSnapshot matches a target path or ID.
 */
export function isRouteMatch(route: RouteLike, target: string): boolean {
  if (!target) return false;
  const config = route.routeConfig;
  const routeData = getRouteData(route);

  if (target === '/' || target === '__root__') {
    return (
      routeData?.[ROUTE_ID_KEY] === '__root__' ||
      (config as any)?.id === '__root__' ||
      ('root' in route && route === (route as any).root) ||
      !route.parent ||
      (!route.parent?.routeConfig &&
        (config?.path === '' ||
          config?.path === '/' ||
          routeData?.[FULL_PATH_KEY] === '/' ||
          (config as any)?.fullPath === '/'))
    );
  }

  if (!config && !routeData) return false;

  const targetClean = cleanSegment(target);
  const targetNorm = normalizePatternForMatch(target);

  const id = getRouteId(route);
  if (typeof id === 'string') {
    if (
      id === target ||
      cleanSegment(id) === targetClean ||
      normalizePatternForMatch(id) === targetNorm
    ) {
      return true;
    }
  }

  const fullPath = getRouteFullPath(route);
  if (typeof fullPath === 'string') {
    if (
      fullPath === target ||
      cleanSegment(fullPath) === targetClean ||
      normalizePatternForMatch(fullPath) === targetNorm
    ) {
      return true;
    }
  }

  if (typeof config?.path === 'string') {
    if (
      config.path === target ||
      cleanSegment(config.path) === targetClean ||
      normalizePatternForMatch(config.path) === targetNorm
    ) {
      return true;
    }
  }

  return false;
}

function isDirectRouteMatch(route: RouteLike, target: string): boolean {
  if (!target) return false;
  const config = route.routeConfig;
  const routeData = getRouteData(route);

  if (target === '/' || target === '__root__') {
    return (
      routeData?.[ROUTE_ID_KEY] === '__root__' ||
      (config as any)?.id === '__root__' ||
      ('root' in route && route === (route as any).root) ||
      !route.parent ||
      (!route.parent?.routeConfig &&
        (config?.path === '' ||
          config?.path === '/' ||
          routeData?.[FULL_PATH_KEY] === '/' ||
          (config as any)?.fullPath === '/'))
    );
  }

  if (!config && !routeData) return false;

  const targetClean = cleanSegment(target);

  // 1. Match by route ID
  const id = getRouteId(route);
  if (typeof id === 'string') {
    if (id === target || cleanSegment(id) === targetClean) {
      return true;
    }
  }

  // 2. Match by local route path segment (e.g. 'users', 'dashboard')
  // Only non-empty segment paths, and only when target does not start with '/' (i.e. not fullPath)
  if (typeof config?.path === 'string' && config.path !== '') {
    if (
      config.path === target ||
      (!target.startsWith('/') && cleanSegment(config.path) === targetClean)
    ) {
      return true;
    }
  }

  return false;
}

function isDescendantRouteMatch(route: RouteLike, target: string): boolean {
  if (!target || target === '/' || target === '__root__') return false;
  const config = route.routeConfig;
  const routeData = getRouteData(route);
  if (!config && !routeData) return false;

  const targetNorm = normalizePatternForMatch(target);
  const fullPath = getRouteFullPath(route);
  if (typeof fullPath === 'string') {
    const cleanFull = normalizePatternForMatch(fullPath);
    if (cleanFull.startsWith(targetNorm + '/')) {
      return true;
    }
  }

  if (typeof config?.path === 'string') {
    const cleanPath = normalizePatternForMatch(config.path);
    if (cleanPath.startsWith(targetNorm + '/')) {
      return true;
    }
  }

  return false;
}

function searchRouteTreeForDescendant(
  node: ActivatedRoute,
  target: string,
): ActivatedRoute | null {
  for (const child of node.children ?? []) {
    const found = searchRouteTreeForDescendant(child, target);
    if (found) {
      return found;
    }
  }
  if (isDescendantRouteMatch(node, target)) {
    return node;
  }
  return null;
}

function searchRouteTree(
  node: ActivatedRoute,
  target: string,
): ActivatedRoute | null {
  for (const child of node.children ?? []) {
    const found = searchRouteTree(child, target);
    if (found) {
      return found;
    }
  }
  if (isRouteMatch(node, target)) {
    return node;
  }
  return null;
}

function searchSnapshotTreeForDescendant(
  node: ActivatedRouteSnapshot,
  target: string,
): ActivatedRouteSnapshot | null {
  for (const child of node.children ?? []) {
    const found = searchSnapshotTreeForDescendant(child, target);
    if (found) {
      return found;
    }
  }
  if (isDescendantRouteMatch(node, target)) {
    return node;
  }
  return null;
}

function searchSnapshotTree(
  node: ActivatedRouteSnapshot,
  target: string,
): ActivatedRouteSnapshot | null {
  for (const child of node.children ?? []) {
    const found = searchSnapshotTree(child, target);
    if (found) {
      return found;
    }
  }
  if (isRouteMatch(node, target)) {
    return node;
  }
  return null;
}

/**
 * Finds the matching ActivatedRouteSnapshot from pathFromRoot or the active snapshot tree.
 */
export function findRouteSnapshot(
  currentSnapshot: ActivatedRouteSnapshot,
  from?: string,
): ActivatedRouteSnapshot {
  if (!from) {
    return currentSnapshot;
  }

  const pathFromRoot = currentSnapshot.pathFromRoot ?? [currentSnapshot];

  // 1. Pass 1: Direct ID or local path segment match (leaf to root)
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isDirectRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  // 2. Pass 2: FullPath or general match (leaf to root)
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  // 3. Pass 3: Search entire snapshot tree from root if available
  const root = currentSnapshot.root ?? pathFromRoot[0];
  if (root) {
    const found = searchSnapshotTree(root, from);
    if (found) {
      return found;
    }
  }

  // 3.5. Pass 3.5: Descendant match along pathFromRoot or tree
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isDescendantRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  if (root) {
    const found = searchSnapshotTreeForDescendant(root, from);
    if (found) {
      return found;
    }
  }

  // 4. Pass 4: Fallback to currentSnapshot
  return currentSnapshot;
}

/**
 * Finds the matching ActivatedRoute from pathFromRoot or the active router state tree.
 */
export function findActivatedRoute(
  currentRoute: ActivatedRoute,
  router: Router | null,
  from?: string,
): ActivatedRoute {
  if (!from) {
    return currentRoute;
  }

  const pathFromRoot = currentRoute.pathFromRoot ?? [currentRoute];

  // 1. Pass 1: Direct ID or local path segment match (leaf to root)
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isDirectRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  // 2. Pass 2: FullPath or general match (leaf to root)
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  // 3. Pass 3: Search entire router state tree if router is available
  if (router?.routerState?.root) {
    const found = searchRouteTree(router.routerState.root, from);
    if (found) {
      return found;
    }
  }

  // 3.5. Pass 3.5: Descendant match along pathFromRoot or router state tree
  for (let i = pathFromRoot.length - 1; i >= 0; i--) {
    const candidate = pathFromRoot[i];
    if (isDescendantRouteMatch(candidate, from)) {
      return candidate;
    }
  }

  if (router?.routerState?.root) {
    const found = searchRouteTreeForDescendant(router.routerState.root, from);
    if (found) {
      return found;
    }
  }

  // 4. Pass 4: Fallback to currentRoute
  return currentRoute;
}

function shallowEqual(
  a: Record<string, any> | undefined | null,
  b: Record<string, any> | undefined | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function extractAllParams(
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

function parseRouteQueryParams(
  route: ActivatedRoute | ActivatedRouteSnapshot,
  raw: Record<string, unknown>,
): any {
  const validator =
    'snapshot' in route
      ? (route.snapshot?.data?.[QUERY_PARAMS_VALIDATOR_KEY] ??
        route.routeConfig?.data?.[QUERY_PARAMS_VALIDATOR_KEY])
      : (route.data?.[QUERY_PARAMS_VALIDATOR_KEY] ??
        route.routeConfig?.data?.[QUERY_PARAMS_VALIDATOR_KEY]);

  if (validator) {
    if (typeof validator === 'function') {
      return validator(raw);
    }
    if (typeof (validator as any).parse === 'function') {
      return (validator as any).parse(raw);
    }
  }
  return raw;
}

function isActivatedRouteSnapshot(value: any): value is ActivatedRouteSnapshot {
  return (
    value instanceof ActivatedRouteSnapshot ||
    (value != null &&
      !('snapshot' in value) &&
      'queryParams' in value &&
      ('data' in value || 'routeConfig' in value || 'params' in value))
  );
}

function isActivatedRoute(value: any): value is ActivatedRoute {
  return (
    value instanceof ActivatedRoute ||
    (value != null && 'snapshot' in value && 'queryParams' in value)
  );
}

function isRouteOrSnapshot(
  value: any,
): value is ActivatedRoute | ActivatedRouteSnapshot {
  return isActivatedRouteSnapshot(value) || isActivatedRoute(value);
}

function extractRouteData(data: Record<string, any>): any {
  return data;
}

// ============================================================================
// Public Signal Hooks
// ============================================================================

/**
 * Reactively exposes route path parameters as an Angular Signal.
 *
 * When `from` is specified, automatically infers parameter names and types
 * from the registered route definition or path literal.
 */
export function injectParams<
  TFrom extends keyof RegisteredNavigationMap,
>(options: { from: TFrom; injector?: Injector }): Signal<InferParams<TFrom>>;
export function injectParams<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferParams<TFrom>>;
export function injectParams<TParams = Record<string, string>>(options?: {
  from?: undefined;
  injector?: Injector;
}): Signal<TParams>;
export function injectParams(options?: InjectParamsOptions): Signal<any> {
  const injector = resolveInjector(injectParams, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);

  const initialParams = extractAllParams(targetRoute);

  return toSignal(
    targetRoute.params.pipe(
      map((params) => extractAllParams(targetRoute, params)),
      distinctUntilChanged((prev, next) => shallowEqual(prev, next)),
    ),
    {
      initialValue: initialParams,
      injector,
    },
  );
}

/**
 * Reactively exposes validated query parameters as an Angular Signal.
 *
 * When `from` is specified, infers the validated query parameters schema output type.
 */
export function injectQueryParams<
  TFrom extends keyof RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferQueryParams<TFrom>>;
export function injectQueryParams<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferQueryParams<TFrom>>;
export function injectQueryParams<
  TQueryParams = Record<string, unknown>,
>(options?: { from?: undefined; injector?: Injector }): Signal<TQueryParams>;
export function injectQueryParams(
  options?: InjectQueryParamsOptions,
): Signal<any> {
  const injector = resolveInjector(injectQueryParams, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);

  const initialQueryParams = parseRouteQueryParams(
    targetRoute,
    targetRoute.snapshot?.queryParams ?? {},
  );

  return toSignal(
    targetRoute.queryParams.pipe(
      map((params) => parseRouteQueryParams(targetRoute, params)),
      distinctUntilChanged((prev, next) => shallowEqual(prev, next)),
    ),
    {
      initialValue: initialQueryParams,
      injector,
    },
  );
}

/**
 * Synchronously retrieves validated query parameters for a route snapshot or current route.
 *
 * Can be called inside resolvers (`ResolveFn`), guards (`CanActivateFn`), or components.
 * If a route snapshot is passed, validation runs directly against the snapshot's query parameters.
 * If omitted, retrieves the active route from the injection context.
 */
export function getQueryParams<TFrom extends keyof RegisteredNavigationMap>(
  route: ActivatedRouteSnapshot | ActivatedRoute,
  options: { from: TFrom; injector?: Injector },
): InferQueryParams<TFrom>;
export function getQueryParams<TFrom extends string>(
  route: ActivatedRouteSnapshot | ActivatedRoute,
  options: { from: TFrom; injector?: Injector },
): InferQueryParams<TFrom>;
export function getQueryParams<TQueryParams = Record<string, unknown>>(
  route: ActivatedRouteSnapshot | ActivatedRoute,
  options?: GetQueryParamsOptions,
): TQueryParams;
export function getQueryParams<
  TFrom extends keyof RegisteredNavigationMap,
>(options: { from: TFrom; injector?: Injector }): InferQueryParams<TFrom>;
export function getQueryParams<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): InferQueryParams<TFrom>;
export function getQueryParams<TQueryParams = Record<string, unknown>>(
  options?: GetQueryParamsOptions,
): TQueryParams;
export function getQueryParams(
  routeOrOptions?:
    | ActivatedRouteSnapshot
    | ActivatedRoute
    | GetQueryParamsOptions,
  maybeOptions?: GetQueryParamsOptions,
): any {
  let route: ActivatedRouteSnapshot | ActivatedRoute | undefined;
  let options: GetQueryParamsOptions | undefined;

  if (isRouteOrSnapshot(routeOrOptions)) {
    route = routeOrOptions;
    options = maybeOptions;
  } else {
    options = routeOrOptions;
  }

  if (route) {
    if (isActivatedRouteSnapshot(route)) {
      const targetSnapshot = options?.from
        ? findRouteSnapshot(route, options.from)
        : route;
      const raw = targetSnapshot.queryParams ?? route.queryParams ?? {};
      return parseRouteQueryParams(targetSnapshot, raw);
    }

    const router =
      options?.injector?.get(Router, null, { optional: true }) ?? null;
    const targetRoute = options?.from
      ? findActivatedRoute(route, router, options.from)
      : route;
    const raw = targetRoute.snapshot?.queryParams ?? {};
    return parseRouteQueryParams(targetRoute, raw);
  }

  const injector = resolveInjector(getQueryParams, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);
  const raw = targetRoute.snapshot?.queryParams ?? {};
  return parseRouteQueryParams(targetRoute, raw);
}

/**
 * Reactively exposes resolved route data or static route data as an Angular Signal.
 */
export function injectRouteData<
  TFrom extends keyof RegisteredNavigationMap,
>(options: { from: TFrom; injector?: Injector }): Signal<InferRouteData<TFrom>>;
export function injectRouteData<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferRouteData<TFrom>>;
export function injectRouteData<TData = unknown>(options?: {
  from?: undefined;
  injector?: Injector;
}): Signal<TData>;
export function injectRouteData(options?: InjectRouteDataOptions): Signal<any> {
  const injector = resolveInjector(injectRouteData, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);

  const initialData = extractRouteData(targetRoute.snapshot?.data ?? {});

  return toSignal(
    targetRoute.data.pipe(map((data) => extractRouteData(data))),
    {
      initialValue: initialData,
      injector,
    },
  );
}

/**
 * Reactively exposes upstream Angular Router reactive resources (`ActivatedRoute.resources`)
 * as an Angular Signal.
 */
export function injectRouteResources<
  TFrom extends keyof RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferRouteResource<TFrom>>;
export function injectRouteResources<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferRouteResource<TFrom>>;
export function injectRouteResources<
  TResources = Record<string, Resource<unknown>>,
>(options?: { from?: undefined; injector?: Injector }): Signal<TResources>;
export function injectRouteResources(
  options?: InjectRouteResourcesOptions,
): Signal<any> {
  const injector = resolveInjector(injectRouteResources, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);

  if ((targetRoute as any).resources) {
    return (targetRoute as any).resources as Signal<any>;
  }

  const routeConfigResources =
    targetRoute.snapshot?.data?.[RESOURCES_KEY] ??
    targetRoute.routeConfig?.data?.[RESOURCES_KEY] ??
    (targetRoute.routeConfig as any)?.resources;
  if (routeConfigResources && typeof routeConfigResources === 'function') {
    const executed = routeConfigResources({
      params: signal(targetRoute.snapshot?.params ?? {}),
      queryParams: signal(targetRoute.snapshot?.queryParams ?? {}),
      fragment: signal(targetRoute.snapshot?.fragment ?? null),
      data: signal(targetRoute.snapshot?.data ?? {}),
      resources: signal({}),
      routeConfig: targetRoute.routeConfig,
    });
    return signal(executed) as Signal<any>;
  }

  // Graceful fallback for environments or test mocks where withRouterResources() is omitted
  return signal({}) as Signal<any>;
}

// ============================================================================
// Composite Hook: injectRoute
// ============================================================================

export interface InjectedRoute<
  TData = unknown,
  TResources = Record<string, Resource<unknown>>,
  TParams = Record<string, string>,
  TQueryParams = Record<string, unknown>,
> {
  data: Signal<TData>;
  resources: Signal<TResources>;
  params: Signal<TParams>;
  queryParams: Signal<TQueryParams>;
  route: ActivatedRoute;
}

/**
 * Combined route facade hook providing reactive access to data, resources,
 * params, queryParams, and the ActivatedRoute instance.
 */
export function injectRoute<
  TFrom extends keyof RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): InjectedRoute<
  InferRouteData<TFrom>,
  InferRouteResource<TFrom>,
  InferParams<TFrom>,
  InferQueryParams<TFrom>
>;
export function injectRoute<TFrom extends string>(options: {
  from: TFrom;
  injector?: Injector;
}): InjectedRoute<
  InferRouteData<TFrom>,
  InferRouteResource<TFrom>,
  InferParams<TFrom>,
  InferQueryParams<TFrom>
>;
export function injectRoute<
  TData = unknown,
  TResources = Record<string, Resource<unknown>>,
  TParams = Record<string, string>,
  TQueryParams = Record<string, unknown>,
>(options?: {
  from?: undefined;
  injector?: Injector;
}): InjectedRoute<TData, TResources, TParams, TQueryParams>;
export function injectRoute(options?: {
  from?: string;
  injector?: Injector;
}): InjectedRoute<any, any, any, any> {
  const injector = resolveInjector(injectRoute, options);
  const currentRoute = injector.get(ActivatedRoute);
  const router = injector.get(Router, null, { optional: true });
  const targetRoute = findActivatedRoute(currentRoute, router, options?.from);

  const routeOptions: any = { ...options, injector };

  return {
    data: injectRouteData(routeOptions),
    resources: injectRouteResources(routeOptions),
    params: injectParams(routeOptions),
    queryParams: injectQueryParams(routeOptions),
    route: targetRoute,
  };
}
