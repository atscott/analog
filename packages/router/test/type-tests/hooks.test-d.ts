import { describe, expectTypeOf, it } from 'vitest';
import {
  InferParams,
  InferQueryParams,
  InferRouteData,
} from '../../src/lib/facade/hooks';
import type { Register } from '../../src/lib/types/register';

declare module '../../src/lib/types/register' {
  interface Register {
    navigationMap: {
      '/users/:userId': {
        path: '/users/:userId';
        types?: {
          params?: { userId: string };
          queryParams?: { tab?: 'info' | 'activity' };
          data?: { id: string; name: string };
        };
      };
      '/posts': {
        path: '/posts';
        types?: {
          queryParams?: { page?: number };
          data?: { posts: string[] };
        };
      };
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
    it('infers query params schema from registered route', () => {
      type Inferred = InferQueryParams<'/users/:userId'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ tab?: 'info' | 'activity' }>();
    });

    it('infers page search schema from /posts', () => {
      type Inferred = InferQueryParams<'/posts'>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ page?: number }>();
    });

    it('falls back to Record<string, any> when from is omitted', () => {
      type Fallback = InferQueryParams<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<Record<string, any>>();
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

    it('falls back to Record<string, any> when from is omitted', () => {
      type Fallback = InferRouteData<undefined>;
      expectTypeOf<Fallback>().toEqualTypeOf<Record<string, any>>();
    });
  });
});
