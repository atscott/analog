import { describe, expectTypeOf, it } from 'vitest';
import { navigate, injectNavigate } from '../../src/lib/facade/navigation';
import type { NavigateOptionsForMap } from '../../src/lib/types';
import type { ActivatedRoute } from '@angular/router';

// ============================================================================
// Navigation Map Setup
// ============================================================================

interface TestAppNavMap {
  '/': { path: '/' };
  '/about': { path: '/about' };
  '/posts': {
    path: '/posts';
    types?: {
      queryParams?: { page?: number; sort?: 'asc' | 'desc' };
      data?: { posts: string[] };
    };
  };
  '/users/:userId': {
    path: '/users/:userId';
    types?: {
      queryParams?: { tab?: 'info' | 'activity' };
      data?: { id: string; name: string };
    };
  };
  '/users/:userId/settings': { path: '/users/:userId/settings' };
  '/users/:userId/posts/:postId': { path: '/users/:userId/posts/:postId' };
  '/orgs/:orgId/teams/:teamId/members/:memberId': {
    path: '/orgs/:orgId/teams/:teamId/members/:memberId';
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Compile-Time Type Engine for Type-Safe Navigation', () => {
  describe('navigate() compile-time type safety', () => {
    it('accepts static routes without parameters', () => {
      navigate<TestAppNavMap>({ to: '/about' });
      navigate<TestAppNavMap>({
        to: '/about',
        replaceUrl: true,
        state: { fromHome: true },
        fragment: 'section',
        relativeTo: {} as ActivatedRoute,
      });
    });

    it('accepts static routes with typed queryParams options', () => {
      navigate<TestAppNavMap>({
        to: '/posts',
        queryParams: { page: 1, sort: 'asc' },
      });
      navigate<TestAppNavMap>({
        to: '/posts',
        queryParams: {} as Record<string, never>,
      });
    });

    it('rejects invalid queryParams parameter types', () => {
      // @ts-expect-error - Type 'string' is not assignable to type 'number'
      navigate<TestAppNavMap>({ to: '/posts', queryParams: { page: 'first' } });

      // @ts-expect-error - Type '"invalid"' is not assignable to type '"asc" | "desc"'
      navigate<TestAppNavMap>({
        to: '/posts',
        queryParams: { sort: 'invalid' },
      });
    });

    it('strictly enforces mandatory path parameters for parameterized routes', () => {
      navigate<TestAppNavMap>({
        to: '/users/:userId',
        params: { userId: 'u123' },
      });
      navigate<TestAppNavMap>({
        to: '/users/:userId/posts/:postId',
        params: { userId: 'u123', postId: 'p456' },
      });
    });

    it('rejects parameterized route calls when params are completely omitted', () => {
      // @ts-expect-error - Property 'params' is missing in type '{ to: "/users/:userId"; }'
      navigate<TestAppNavMap>({ to: '/users/:userId' });

      // @ts-expect-error - Property 'params' is missing
      navigate<TestAppNavMap>({ to: '/users/:userId/posts/:postId' });
    });

    it('rejects parameterized route calls when params object is empty', () => {
      // @ts-expect-error - Property 'userId' is missing in params
      navigate<TestAppNavMap>({
        to: '/users/:userId',
        params: {} as Record<string, never>,
      });

      // @ts-expect-error - Property 'postId' is missing in params
      navigate<TestAppNavMap>({
        to: '/users/:userId/posts/:postId',
        params: { userId: 'u123' },
      });
    });

    it('supports functional parameter updaters in navigate()', () => {
      navigate<TestAppNavMap>({
        to: '/users/:userId',
        params: (prev) => ({ ...prev, userId: 'u-updated' }),
      });
    });

    it('rejects invalid parameter types', () => {
      // @ts-expect-error - Type 'number' is not assignable to type 'string'
      navigate<TestAppNavMap>({
        to: '/users/:userId',
        params: { userId: 12345 },
      });
    });

    it('rejects unregistered target paths', () => {
      // @ts-expect-error - Type '"/non-existent"' is not assignable to valid route paths
      navigate<TestAppNavMap>({ to: '/non-existent' });

      // @ts-expect-error - Type '"/dashboard"' is not assignable
      navigate<TestAppNavMap>({ to: '/dashboard' });
    });
  });

  describe('injectNavigate() compile-time type safety', () => {
    it('creates a typed navigator function enforcing route params', () => {
      const nav = injectNavigate<TestAppNavMap>();

      nav({ to: '/about' });
      nav({ to: '/users/:userId', params: { userId: 'u-1' } });

      // @ts-expect-error - Property 'params' is missing
      nav({ to: '/users/:userId' });

      // @ts-expect-error - Invalid route path
      nav({ to: '/non-existent' });
    });

    it('supports relative navigation when from route is bound', () => {
      const navFromUser = injectNavigate<'/users/:userId', TestAppNavMap>({
        from: '/users/:userId',
      });

      // Relative to current route
      navFromUser({ to: '.' });
      // Relative to parent
      navFromUser({ to: '..' });
      // Absolute navigation
      navFromUser({ to: '/about' });
    });
  });
});
