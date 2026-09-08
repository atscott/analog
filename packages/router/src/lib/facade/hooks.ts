/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { inject, Injector, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, distinctUntilChanged } from 'rxjs';

import type { RegisteredNavigationMap, ParamsForPath } from '../types/register';
import type { NonUndefined, ParseParams } from '../types/params';
import type { RouteQueryParamsForPath, UnwrapRoute } from '../types/navigation';

export interface InjectRouteOptions {
  injector?: Injector;
}

export type BaseHookOptions = InjectRouteOptions;

export interface InjectParamsOptions<
  TFrom extends string = string,
> extends InjectRouteOptions {
  from?: TFrom;
}

export interface InjectQueryParamsOptions<
  TFrom extends string = string,
> extends InjectRouteOptions {
  from?: TFrom;
}

export interface InjectRouteDataOptions<
  TFrom extends string = string,
> extends InjectRouteOptions {
  from?: TFrom;
}

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

export type InferQueryParams<
  TFrom extends string | undefined,
  TFallback = Record<string, any>,
> = [TFrom] extends [string]
  ? [keyof RegisteredNavigationMap] extends [never]
    ? Record<string, any>
    : TFrom extends keyof RegisteredNavigationMap
      ? RouteQueryParamsForPath<TFrom>
      : Record<string, any>
  : TFallback;

export type InferRouteData<
  TFrom extends string | undefined,
  TFallback = Record<string, any>,
> = [TFrom] extends [string]
  ? TFrom extends keyof RegisteredNavigationMap
    ? UnwrapRoute<RegisteredNavigationMap[TFrom]> extends {
        types?: { data?: infer TData };
      }
      ? [NonUndefined<TData>] extends [never]
        ? UnwrapRoute<RegisteredNavigationMap[TFrom]> extends {
            data?: infer TData2;
          }
          ? NonUndefined<TData2>
          : TFallback
        : [NonUndefined<TData>] extends [unknown]
          ? unknown extends NonUndefined<TData>
            ? TFallback
            : NonUndefined<TData>
          : NonUndefined<TData>
      : UnwrapRoute<RegisteredNavigationMap[TFrom]> extends {
            data?: infer TData;
          }
        ? NonUndefined<TData>
        : TFallback
    : TFallback
  : TFallback;

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

function resolveRoute(options?: BaseHookOptions): ActivatedRoute {
  if (options?.injector) {
    return options.injector.get(ActivatedRoute);
  }
  return inject(ActivatedRoute);
}

function getAllParams(route: ActivatedRoute): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const r of route.pathFromRoot ?? [route]) {
    if (r.snapshot?.params) {
      Object.assign(merged, r.snapshot.params);
    }
  }
  return merged;
}

export function injectParams<
  TFrom extends keyof RegisteredNavigationMap,
>(options: { from: TFrom; injector?: Injector }): Signal<InferParams<TFrom>>;
export function injectParams<TParams = Record<string, string>>(options?: {
  from?: undefined;
  injector?: Injector;
}): Signal<TParams>;
export function injectParams(options?: InjectParamsOptions): Signal<any> {
  const route = resolveRoute(options);
  const initialParams = getAllParams(route);

  return toSignal(
    route.params.pipe(
      map(() => getAllParams(route)),
      distinctUntilChanged(shallowEqual),
    ),
    {
      initialValue: initialParams,
      injector: options?.injector,
    },
  );
}

export function injectQueryParams<
  TFrom extends keyof RegisteredNavigationMap,
>(options: {
  from: TFrom;
  injector?: Injector;
}): Signal<InferQueryParams<TFrom>>;
export function injectQueryParams<
  TQueryParams = Record<string, any>,
>(options?: { from?: undefined; injector?: Injector }): Signal<TQueryParams>;
export function injectQueryParams(
  options?: InjectQueryParamsOptions,
): Signal<any> {
  const route = resolveRoute(options);

  return toSignal(route.queryParams, {
    initialValue: route.snapshot?.queryParams ?? {},
    injector: options?.injector,
  });
}

export function injectRouteData<
  TFrom extends keyof RegisteredNavigationMap,
>(options: { from: TFrom; injector?: Injector }): Signal<InferRouteData<TFrom>>;
export function injectRouteData<TData = Record<string, any>>(options?: {
  from?: undefined;
  injector?: Injector;
}): Signal<TData>;
export function injectRouteData(options?: InjectRouteDataOptions): Signal<any> {
  const route = resolveRoute(options);

  return toSignal(route.data, {
    initialValue: route.snapshot?.data ?? {},
    injector: options?.injector,
  });
}
