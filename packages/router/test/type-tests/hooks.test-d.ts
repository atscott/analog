import { describe, expectTypeOf, it } from 'vitest';
import type { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import type { Signal, Resource } from '@angular/core';
import {
  injectParams,
  injectQueryParams,
  getQueryParams,
  injectRouteData,
  injectRouteResources,
  injectRoute,
  InferParams,
  InferQueryParams,
  InferRouteData,
  InferRouteResource,
  InjectedRoute,
} from '../../src/lib/facade/hooks';
import type { Register } from '../../src/lib/types/register';
import type { FileRouteDefinition } from '../../src/lib/types/file-routes';

declare module '../../src/lib/types/register' {
  interface Register {
    navigationMap: {
      '/users/:userId': FileRouteDefinition<
        '/users/:userId',
        'users-detail',
        unknown,
        { tab?: 'info' | 'activity' },
        { id: string; name: string },
        { userDetails: Resource<{ id: string; name: string }> }
      >;
      '/posts': FileRouteDefinition<
        '/posts',
        'posts-list',
        unknown,
        { page?: number },
        { posts: string[] }
      >;
    };
  }
}

describe('Signal Route Hooks Compile-Time Type Engine', () => {
  describe('injectParams Type Inference', () => {
    it('infers exact params when from matches registered route', () => {
      type Inferred = InferParams<'/users/:userId'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ userId: string }>();
    });

    it('parses params from path literal when route is unaugmented', () => {
      type Parsed = InferParams<'/orgs/:orgId/teams/:teamId/items/[itemId]'>;
      expectTypeOf<Parsed>().toEqualTypeOf<{
        orgId: string;
        teamId: string;
        itemId: string;
      }>();
    });

    it('falls back to Record<string, string> when from is omitted', () => {
      type Fallback = InferParams<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<Record<string, string>>();
    });
  });

  describe('injectQueryParams Type Inference', () => {
    it('infers validated search schema from registered route', () => {
      type Inferred = InferQueryParams<'/users/:userId'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ tab?: 'info' | 'activity' }>();
    });

    it('infers page search schema from /posts', () => {
      type Inferred = InferQueryParams<'/posts'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ page?: number }>();
    });

    it('falls back to Record<string, unknown> when from is omitted', () => {
      type Fallback = InferQueryParams<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<Record<string, unknown>>();
    });
  });

  describe('getQueryParams Type Inference', () => {
    it('infers validated query params from registered route when passing route snapshot and { from }', () => {
      const snapshot = {} as ActivatedRouteSnapshot;
      const params = getQueryParams(snapshot, { from: '/users/:userId' });
      expectTypeOf(params).toEqualTypeOf<{ tab?: 'info' | 'activity' }>();
    });

    it('infers validated query params when calling with { from } in injection context', () => {
      const params = getQueryParams({ from: '/posts' });
      expectTypeOf(params).toEqualTypeOf<{ page?: number }>();
    });

    it('falls back to Record<string, unknown> when route snapshot is passed without from or generic', () => {
      const snapshot = {} as ActivatedRouteSnapshot;
      const params = getQueryParams(snapshot);
      expectTypeOf(params).toEqualTypeOf<Record<string, unknown>>();
    });

    it('accepts explicit generic parameter when passing route snapshot', () => {
      const snapshot = {} as ActivatedRouteSnapshot;
      const params = getQueryParams<{ custom: string }>(snapshot);
      expectTypeOf(params).toEqualTypeOf<{ custom: string }>();
    });

    it('accepts explicit generic parameter in injection context without args', () => {
      const params = getQueryParams<{ custom: string }>();
      expectTypeOf(params).toEqualTypeOf<{ custom: string }>();
    });
  });

  describe('injectRouteData Type Inference', () => {
    it('infers route data type from registered route', () => {
      type Inferred = InferRouteData<'/users/:userId'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ id: string; name: string }>();
    });

    it('infers list route data from /posts', () => {
      type Inferred = InferRouteData<'/posts'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ posts: string[] }>();
    });

    it('falls back to unknown when from is omitted', () => {
      type Fallback = InferRouteData<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<unknown>();
    });
  });

  describe('injectRouteResources Type Inference', () => {
    it('infers resource map from registered route', () => {
      type Inferred = InferRouteResource<'/users/:userId'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{
        userDetails: Resource<{ id: string; name: string }>;
      }>();
    });

    it('falls back to Record<string, Resource<unknown>> when omitted', () => {
      type Fallback = InferRouteResource<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<
        Record<string, Resource<unknown>>
      >();
    });
  });

  describe('injectRoute Composite Return Type', () => {
    it('infers composite signals and route instance from registered path', () => {
      type Composite = InjectedRoute<
        InferRouteData<'/users/:userId'>,
        InferRouteResource<'/users/:userId'>,
        InferParams<'/users/:userId'>,
        InferQueryParams<'/users/:userId'>
      >;

      expectTypeOf<Composite['params']>().toEqualTypeOf<
        Signal<{ userId: string }>
      >();
      expectTypeOf<Composite['queryParams']>().toEqualTypeOf<
        Signal<{ tab?: 'info' | 'activity' }>
      >();
      expectTypeOf<Composite['data']>().toEqualTypeOf<
        Signal<{ id: string; name: string }>
      >();
      expectTypeOf<Composite['resources']>().toEqualTypeOf<
        Signal<{ userDetails: Resource<{ id: string; name: string }> }>
      >();
      expectTypeOf<Composite['route']>().toEqualTypeOf<ActivatedRoute>();
    });
  });
});
