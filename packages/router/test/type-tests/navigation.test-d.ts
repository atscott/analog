/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { describe, expectTypeOf, it } from 'vitest';
import type { FileRouteDefinition } from '../../src/lib/types/file-routes';
import type {
  ResolveRelativePath,
  NavigateOptionsForMap,
  RelativeOptionsForMap,
  MakeDifferenceOptional,
} from '../../src/lib/types';

// ============================================================================
// Navigation Map Setup & Declaration Merging Simulation
// ============================================================================

interface TestAppNavMap {
  '/': FileRouteDefinition<'/', 'root-route'>;
  '/about': FileRouteDefinition<'/about', 'about-route'>;
  '/posts': FileRouteDefinition<
    '/posts',
    'posts-list',
    unknown,
    { page?: number; sort?: 'asc' | 'desc' },
    { posts: string[] }
  >;
  '/users/:userId': FileRouteDefinition<
    '/users/:userId',
    'user-detail',
    unknown,
    { tab?: 'info' | 'activity' },
    { id: string; name: string }
  >;
  '/users/:userId/settings': FileRouteDefinition<
    '/users/:userId/settings',
    'user-settings'
  >;
  '/users/:userId/posts/:postId': FileRouteDefinition<
    '/users/:userId/posts/:postId',
    'user-post-detail'
  >;
  '/orgs/:orgId/teams/:teamId/members/:memberId': FileRouteDefinition<
    '/orgs/:orgId/teams/:teamId/members/:memberId',
    'org-member'
  >;
}

declare function testNavigate(
  options: NavigateOptionsForMap<TestAppNavMap>,
): Promise<boolean>;

declare function testInjectNavigate<
  TFrom extends keyof TestAppNavMap & string,
>(options: {
  from: TFrom;
}): (options: RelativeOptionsForMap<TFrom, TestAppNavMap>) => Promise<boolean>;

// ============================================================================
// Test Suites
// ============================================================================

describe('Compile-Time Type Engine for Type-Safe Navigation', () => {
  describe('Feature 14: Compile-Time Safe Navigation (navigate)', () => {
    it('accepts static routes without parameters', () => {
      testNavigate({ to: '/about' });
      testNavigate({
        to: '/about',
        replaceUrl: true,
        state: { fromHome: true },
        fragment: 'section',
      });
    });

    it('accepts static routes with typed queryParams options', () => {
      testNavigate({ to: '/posts', queryParams: { page: 1, sort: 'asc' } });
      testNavigate({ to: '/posts', queryParams: {} as Record<string, never> });
    });

    it('rejects invalid queryParams parameter types', () => {
      // @ts-expect-error - Type 'string' is not assignable to type 'number'
      testNavigate({ to: '/posts', queryParams: { page: 'first' } });

      // @ts-expect-error - Type '"invalid"' is not assignable to type '"asc" | "desc"'
      testNavigate({ to: '/posts', queryParams: { sort: 'invalid' } });
    });

    it('strictly enforces mandatory path parameters for parameterized routes', () => {
      testNavigate({ to: '/users/:userId', params: { userId: 'u123' } });
      testNavigate({
        to: '/users/:userId/posts/:postId',
        params: { userId: 'u123', postId: 'p456' },
      });
    });

    it('rejects parameterized route calls when params are completely omitted', () => {
      // @ts-expect-error - Property 'params' is missing in type '{ to: "/users/:userId"; }'
      testNavigate({ to: '/users/:userId' });

      // @ts-expect-error - Property 'params' is missing
      testNavigate({ to: '/users/:userId/posts/:postId' });
    });

    it('rejects parameterized route calls when params object is empty', () => {
      // @ts-expect-error - Property 'userId' is missing in '{}'
      testNavigate({
        to: '/users/:userId',
        params: {} as Record<string, never>,
      });

      // @ts-expect-error - Property 'postId' is missing
      testNavigate({
        to: '/users/:userId/posts/:postId',
        params: { userId: 'u123' },
      });
    });

    it('rejects invalid parameter types', () => {
      // @ts-expect-error - Type 'number' is not assignable to type 'string'
      testNavigate({ to: '/users/:userId', params: { userId: 12345 } });
    });

    it('rejects unregistered target paths', () => {
      // @ts-expect-error - Type '"/non-existent"' is not assignable to valid route paths
      testNavigate({ to: '/non-existent' });

      // @ts-expect-error - Type '"/dashboard"' is not assignable
      testNavigate({ to: '/dashboard' });
    });
  });

  describe('Feature 15: Relative Path Algebra (ResolveRelativePath)', () => {
    it('resolves current path identity (. and ./)', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', '.'>
      >().toEqualTypeOf<'/users/:userId'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', './'>
      >().toEqualTypeOf<'/users/:userId'>();
    });

    it('resolves child relative paths (bare and dot-slash)', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', 'posts/:postId'>
      >().toEqualTypeOf<'/users/:userId/posts/:postId'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', './posts/:postId'>
      >().toEqualTypeOf<'/users/:userId/posts/:postId'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', 'settings'>
      >().toEqualTypeOf<'/users/:userId/settings'>();
    });

    it('resolves single-level parent path (.. and ../)', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '..'>
      >().toEqualTypeOf<'/users/:userId/posts'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../'>
      >().toEqualTypeOf<'/users/:userId/posts'>();
    });

    it('resolves multi-level parent paths (../.. and ../../..)', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../..'>
      >().toEqualTypeOf<'/users/:userId'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../../..'>
      >().toEqualTypeOf<'/users'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../../../..'>
      >().toEqualTypeOf<'/'>();
    });

    it('clamps safely at root when popping beyond root level', () => {
      expectTypeOf<ResolveRelativePath<'/', '..'>>().toEqualTypeOf<'/'>();
      expectTypeOf<
        ResolveRelativePath<'/about', '../..'>
      >().toEqualTypeOf<'/'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', '../../../../..'>
      >().toEqualTypeOf<'/'>();
    });

    it('resolves parent sibling paths (../sibling and ../../other)', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../settings'>
      >().toEqualTypeOf<'/users/:userId/posts/settings'>();
      expectTypeOf<
        ResolveRelativePath<'/users/:userId/posts/:postId', '../../settings'>
      >().toEqualTypeOf<'/users/:userId/settings'>();
    });

    it('preserves absolute paths by ignoring origin from', () => {
      expectTypeOf<
        ResolveRelativePath<'/users/:userId', '/about'>
      >().toEqualTypeOf<'/about'>();
      expectTypeOf<
        ResolveRelativePath<'/orgs/:orgId', '/posts'>
      >().toEqualTypeOf<'/posts'>();
    });
  });

  describe('Feature 16: Route-Bound Navigator & Parent Param Retention', () => {
    it('provides automatic parent param retention when navigating to child routes', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      // Parent parameter (userId) is preserved from current route; only postId is required
      navFromUser({
        to: 'posts/:postId',
        params: { postId: 'p999' },
      });

      // Permitted to explicitly override parent parameter if desired
      navFromUser({
        to: 'posts/:postId',
        params: { userId: 'custom-u', postId: 'p999' },
      });
    });

    it('makes params optional when navigating to self or sibling sharing all params', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      // Self navigation has zero new required parameters
      navFromUser({ to: '.' });
      navFromUser({ to: './' });

      // Sibling /users/:userId/settings has all parameters satisfied by parent
      navFromUser({ to: 'settings' });
    });

    it('rejects relative navigation when non-retained child parameters are omitted', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      // @ts-expect-error - Property 'params' is missing (postId is required)
      navFromUser({ to: 'posts/:postId' });

      // @ts-expect-error - Property 'postId' is missing in '{ userId: string }'
      navFromUser({ to: 'posts/:postId', params: { userId: 'u1' } });
    });

    it('rejects invalid relative targets', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      // @ts-expect-error - 'invalid-child' is not a valid route target
      navFromUser({ to: 'invalid-child' });
    });

    it('supports navigating to absolute routes from route-bound navigator', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      navFromUser({ to: '/about' });
      navFromUser({ to: '/posts', queryParams: { page: 3 } });
    });
  });

  describe('Feature 17: Functional Parameter Updaters', () => {
    it('infers typed prev parameter and validates returned parameters on self navigation', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      navFromUser({
        to: '.',
        params: (prev) => {
          expectTypeOf(prev).toEqualTypeOf<{ userId: string }>();
          return { userId: `${prev.userId}-updated` };
        },
      });
    });

    it('infers typed prev parameter and accepts partial updates retaining parent params on child navigation', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      navFromUser({
        to: 'posts/:postId',
        params: (prev) => {
          expectTypeOf(prev).toEqualTypeOf<{ userId: string }>();
          return { postId: `post-for-${prev.userId}` };
        },
      });
    });

    it('rejects functional parameter updaters returning invalid parameter types', () => {
      const navFromUser = testInjectNavigate({ from: '/users/:userId' });

      // @ts-expect-error - Type 'number' is not assignable to type 'string'
      navFromUser({
        to: '.',
        params: (_prev) => ({ userId: 9999 }),
      });
    });
  });

  describe('MakeDifferenceOptional Utility', () => {
    it('makes shared parameters optional while preserving unique required parameters', () => {
      type From = { userId: string };
      type To = { userId: string; postId: string };
      type Diff = MakeDifferenceOptional<From, To>;

      expectTypeOf<Diff>().toEqualTypeOf<{ postId: string; userId?: string }>();
    });

    it('makes all parameters optional when target parameters are a subset of origin', () => {
      type From = { orgId: string; teamId: string };
      type To = { orgId: string };
      type Diff = MakeDifferenceOptional<From, To>;

      expectTypeOf<Diff>().toEqualTypeOf<{ orgId?: string }>();
    });

    it('retains all required parameters when origin shares no parameters with target', () => {
      type From = { userId: string };
      type To = { orgId: string };
      type Diff = MakeDifferenceOptional<From, To>;

      expectTypeOf<Diff>().toEqualTypeOf<{ orgId: string }>();
    });
  });
});
