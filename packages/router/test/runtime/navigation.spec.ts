/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  cleanHash,
  injectNavigate,
  interpolatePath,
  navigate,
  resolveRelativePath,
  resolveRouter,
  serializeQueryParams,
} from '../../src/lib/facade/navigation';
import { QUERY_PARAMS_VALIDATOR_KEY } from '../../src/lib/facade/resources';
import { createFileRoute } from '../../src/lib/facade/file-route';
import type { StandardSchemaV1 } from '../../src/lib/types/search';

// ============================================================================
// Test Components
// ============================================================================

@Component({
  standalone: true,
  template: '<div id="home">Home</div>',
})
class HomeComponent {}

@Component({
  standalone: true,
  template: '<div id="users">Users</div>',
})
class UsersComponent {}

@Component({
  standalone: true,
  template: '<div id="user-detail">User Detail</div>',
})
class UserDetailComponent {}

@Component({
  standalone: true,
  template: '<div id="user-posts">User Posts</div>',
})
class UserPostsComponent {}

@Component({
  standalone: true,
  template: '<div id="search">Search</div>',
})
class SearchComponent {}

@Component({
  standalone: true,
  template: '<div id="docs">Docs</div>',
})
class DocsComponent {}

// ============================================================================
// Test Suite
// ============================================================================

describe('Runtime Navigation Engine & Angular Router Bridge (M4)', () => {
  // --------------------------------------------------------------------------
  // 1. Unit Tests: Path Parameter Interpolation
  // --------------------------------------------------------------------------
  describe('interpolatePath', () => {
    it('should interpolate colon-style parameters (:param)', () => {
      const result = interpolatePath('/users/:userId', { userId: '123' });
      expect(result).toBe('/users/123');
    });

    it('should interpolate bracket-style parameters ([param])', () => {
      const result = interpolatePath('/items/[itemId]', { itemId: 'item-99' });
      expect(result).toBe('/items/item-99');
    });

    it('should interpolate multiple parameters in hierarchical paths', () => {
      const result = interpolatePath(
        '/orgs/:orgId/teams/:teamId/members/[memberId]',
        {
          orgId: 'acme',
          teamId: 'core',
          memberId: 'm-7',
        },
      );
      expect(result).toBe('/orgs/acme/teams/core/members/m-7');
    });

    it('should handle catch-all splats (**)', () => {
      const result = interpolatePath('/docs/**', {
        '**': 'getting-started/installation',
      });
      expect(result).toBe('/docs/getting-started/installation');
    });

    it('should handle rest catch-all ([...slug])', () => {
      const result = interpolatePath('/blog/[...slug]', {
        slug: '2026/09/m4-release',
      });
      expect(result).toBe('/blog/2026/09/m4-release');
    });

    it('should handle optional rest catch-all ([[...slug]])', () => {
      expect(interpolatePath('/blog/[[...slug]]', {})).toBe('/blog');
      expect(
        interpolatePath('/blog/[[...slug]]', {
          slug: 'recent/announcements',
        }),
      ).toBe('/blog/recent/announcements');
    });

    it('should URL-encode spaces and special characters in regular params', () => {
      const result = interpolatePath('/search/:query', {
        query: 'analog router & signals',
      });
      expect(result).toBe('/search/analog%20router%20%26%20signals');
    });

    it('should encode slashes in scalar params to prevent URL structure modification', () => {
      const result = interpolatePath('/users/:name', { name: 'admin/root' });
      expect(result).toBe('/users/admin%2Froot');
    });

    it('should preserve segment slashes in splat params while encoding characters within segments', () => {
      const result = interpolatePath('/docs/**', {
        '**': 'intro/getting started',
      });
      expect(result).toBe('/docs/intro/getting%20started');
    });

    it('should throw an informative error when a required parameter is missing', () => {
      expect(() => interpolatePath('/users/:userId', {})).toThrow(
        '[Analog Router] Missing required path parameter "userId" for path "/users/:userId".',
      );
      expect(() => interpolatePath('/items/[itemId]', {})).toThrow(
        '[Analog Router] Missing required path parameter "itemId" for path "/items/[itemId]".',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. Unit Tests: Relative Path Calculus
  // --------------------------------------------------------------------------
  describe('resolveRelativePath', () => {
    it('should return absolute target path as-is', () => {
      expect(resolveRelativePath('/users/:userId', '/dashboard')).toBe(
        '/dashboard',
      );
    });

    it('should resolve "." and "./" as the from path', () => {
      expect(resolveRelativePath('/users', '.')).toBe('/users');
      expect(resolveRelativePath('/users', './')).toBe('/users');
    });

    it('should resolve sibling routes with "./child" or "child"', () => {
      expect(resolveRelativePath('/users/:userId', 'posts')).toBe(
        '/users/:userId/posts',
      );
      expect(resolveRelativePath('/users/:userId', './posts')).toBe(
        '/users/:userId/posts',
      );
    });

    it('should resolve parent routes with ".." and "../"', () => {
      expect(resolveRelativePath('/users/:userId', '..')).toBe('/users');
      expect(resolveRelativePath('/users/:userId', '../')).toBe('/users');
    });

    it('should resolve parent sibling routes with "../sibling"', () => {
      expect(resolveRelativePath('/users/:userId', '../settings')).toBe(
        '/users/settings',
      );
    });

    it('should resolve multi-level parent routes ("../../")', () => {
      expect(resolveRelativePath('/orgs/teams/core', '../../dashboard')).toBe(
        '/orgs/dashboard',
      );
      expect(
        resolveRelativePath('/orgs/:orgId/teams/:teamId', '../../../dashboard'),
      ).toBe('/orgs/dashboard');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Unit Tests: Search Parameter Serialization
  // --------------------------------------------------------------------------
  describe('serializeQueryParams', () => {
    it('should preserve primitives (string, number, boolean)', () => {
      const serialized = serializeQueryParams({
        q: 'analog',
        page: 2,
        active: true,
      });
      expect(serialized).toEqual({ q: 'analog', page: 2, active: true });
    });

    it('should preserve primitive arrays', () => {
      const serialized = serializeQueryParams({ tags: ['angular', 'vite'] });
      expect(serialized).toEqual({ tags: ['angular', 'vite'] });
    });

    it('should JSON-serialize nested objects', () => {
      const serialized = serializeQueryParams({
        filter: { role: 'admin', verified: true },
      });
      expect(serialized).toEqual({
        filter: JSON.stringify({ role: 'admin', verified: true }),
      });
    });

    it('should serialize Date objects to ISO string', () => {
      const now = new Date('2026-09-07T00:00:00.000Z');
      const serialized = serializeQueryParams({ createdAt: now });
      expect(serialized).toEqual({ createdAt: '2026-09-07T00:00:00.000Z' });
    });

    it('should preserve null and omit undefined', () => {
      const serialized = serializeQueryParams({
        keep: 'value',
        clear: null,
        drop: undefined,
      });
      expect(serialized).toEqual({ keep: 'value', clear: null });
    });

    it('should return undefined for empty objects', () => {
      expect(serializeQueryParams({})).toBeUndefined();
      expect(serializeQueryParams(undefined)).toBeUndefined();
      expect(serializeQueryParams(null)).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Runtime Integration Tests with RouterTestingHarness
  // --------------------------------------------------------------------------
  describe('navigate() with RouterTestingHarness', () => {
    let harness: RouterTestingHarness;
    let router: Router;

    beforeEach(async () => {
      const usersRoute = createFileRoute('/users')({
        component: UsersComponent,
      });
      const userDetailRoute = createFileRoute('/users/:userId')({
        id: 'user-detail',
        component: UserDetailComponent,
      });
      const userPostsRoute = createFileRoute('/users/:userId/posts/[postId]')({
        component: UserPostsComponent,
      });
      const docsRoute = createFileRoute('/docs/**')({
        component: DocsComponent,
      });

      const searchSchema: StandardSchemaV1<
        { page?: string; q?: string },
        { page: number; q: string }
      > = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (raw: unknown) => {
            const input = raw as
              | { page?: string; q?: string }
              | null
              | undefined;
            return {
              value: {
                page: Number(input?.page ?? 1),
                q: String(input?.q ?? ''),
              },
            };
          },
        },
      };

      const searchRoute = createFileRoute('/search')({
        component: SearchComponent,
        validateSearch: searchSchema,
      });

      const routes: Routes = [
        { path: '', component: HomeComponent },
        { path: 'sidebar-panel', component: DocsComponent, outlet: 'sidebar' },
        { path: 'users', component: UsersComponent },
        { path: 'users/:userId', component: UserDetailComponent },
        { path: 'users/:userId/posts/:postId', component: UserPostsComponent },
        { path: 'docs/**', component: DocsComponent },
        {
          path: 'search',
          component: SearchComponent,
          data: { [QUERY_PARAMS_VALIDATOR_KEY]: searchSchema },
        },
      ];

      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      router = TestBed.inject(Router);
      harness = await RouterTestingHarness.create();
    });

    it('should navigate to static route with navigate()', async () => {
      await TestBed.runInInjectionContext(async () => {
        const success = await navigate({ to: '/users' });
        expect(success).toBe(true);
      });

      expect(router.url).toBe('/users');
    });

    it('interoperates with named outlets via router.navigate commands without clobbering', async () => {
      // 1. Activate auxiliary outlet outside the type-safe facade
      await router.navigate([{ outlets: { sidebar: ['sidebar-panel'] } }]);
      expect(router.url).toContain('sidebar:sidebar-panel');

      // 2. Navigate primary route via type-safe navigate()
      await TestBed.runInInjectionContext(async () => {
        await navigate({ to: '/users' });
      });

      // 3. Verify type-safe navigate() using commands preserves the auxiliary outlet
      expect(router.url).toBe('/users(sidebar:sidebar-panel)');

      // 4. Contrast with navigateByUrl which clobbers named outlets
      await router.navigateByUrl('/users');
      expect(router.url).toBe('/users'); // sidebar is gone
    });

    it('should navigate with interpolated path parameters', async () => {
      await TestBed.runInInjectionContext(async () => {
        const success = await navigate({
          to: '/users/:userId',
          params: { userId: '42' },
        });
        expect(success).toBe(true);
      });

      expect(router.url).toBe('/users/42');
    });

    it('should navigate with mixed colon and bracket parameters', async () => {
      await TestBed.runInInjectionContext(async () => {
        const success = await navigate({
          to: '/users/:userId/posts/[postId]',
          params: { userId: '42', postId: 'p-1' },
        });
        expect(success).toBe(true);
      });

      expect(router.url).toBe('/users/42/posts/p-1');
    });

    it('should navigate with catch-all splat parameters', async () => {
      await TestBed.runInInjectionContext(async () => {
        const success = await navigate({
          to: '/docs/**',
          params: { '**': 'guides/installation' },
        });
        expect(success).toBe(true);
      });

      expect(router.url).toBe('/docs/guides/installation');
    });

    it('should navigate with query parameters', async () => {
      await TestBed.runInInjectionContext(async () => {
        const success = await navigate({
          to: '/search',
          queryParams: { page: 3, q: 'analog' },
        });
        expect(success).toBe(true);
      });

      expect(router.url).toBe('/search?page=3&q=analog');
    });

    it('should support functional queryParams updater', async () => {
      await harness.navigateByUrl('/search?page=1&q=test');

      await TestBed.runInInjectionContext(async () => {
        await navigate({
          to: '/search',
          queryParams: (prev) => ({
            ...prev,
            page: Number(prev['page'] ?? 1) + 1,
          }),
        });
      });

      expect(router.url).toBe('/search?page=2&q=test');
    });

    it('should support functional params updater', async () => {
      await harness.navigateByUrl('/users/10');

      await TestBed.runInInjectionContext(async () => {
        await navigate({
          to: '/users/:userId',
          params: (prev) => ({
            userId: String(Number(prev['userId']) + 5),
          }),
        });
      });

      expect(router.url).toBe('/users/15');
    });

    it('should accept Angular-standard replaceUrl: true directly', async () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      await TestBed.runInInjectionContext(async () => {
        await navigate({ to: '/users', replaceUrl: true });
      });

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/', 'users'],
        expect.objectContaining({ replaceUrl: true }),
      );
    });

    it('should accept Angular-standard fragment directly', async () => {
      await TestBed.runInInjectionContext(async () => {
        await navigate({ to: '/users', fragment: '#my-fragment' });
      });

      expect(router.url).toBe('/users#my-fragment');
    });

    it('should map state to navigation extras', async () => {
      await harness.navigateByUrl('/');
      const payload = { source: 'test-harness' };

      const navigateSpy = vi.spyOn(router, 'navigate');

      await TestBed.runInInjectionContext(async () => {
        await navigate({ to: '/users', state: payload });
      });

      expect(navigateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ state: payload }),
      );
    });

    it('should forward info, onSameUrlNavigation, and relativeTo to NavigationExtras', async () => {
      await harness.navigateByUrl('/');
      const navigateSpy = vi.spyOn(router, 'navigate');
      const testInfo = { reason: 'user_action' };
      const activeRoute = TestBed.inject(Router).routerState.root;

      await TestBed.runInInjectionContext(async () => {
        await navigate({
          to: '/users',
          info: testInfo,
          onSameUrlNavigation: 'reload',
          relativeTo: activeRoute,
        });
      });

      expect(navigateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          info: testInfo,
          onSameUrlNavigation: 'reload',
          relativeTo: activeRoute,
        }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Runtime Integration Tests: injectNavigate()
  // --------------------------------------------------------------------------
  describe('injectNavigate() with RouterTestingHarness', () => {
    let harness: RouterTestingHarness;
    let router: Router;

    beforeEach(async () => {
      const usersRoute = createFileRoute('/users')({
        id: 'users',
        component: UsersComponent,
      });
      const userDetailRoute = createFileRoute('/users/:userId')({
        id: 'user-detail',
        component: UserDetailComponent,
      });
      const userPostsRoute = createFileRoute('/users/:userId/posts')({
        id: 'user-posts',
        component: UserPostsComponent,
      });

      const routes: Routes = [
        { path: '', component: HomeComponent },
        { path: 'users', component: UsersComponent },
        { path: 'users/:userId', component: UserDetailComponent },
        { path: 'users/:userId/posts', component: UserPostsComponent },
      ];

      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      router = TestBed.inject(Router);
      harness = await RouterTestingHarness.create();
    });

    it('should automatically retain parent parameters when navigating relative route', async () => {
      // 1. Initial navigation to user detail route
      await harness.navigateByUrl('/users/42');
      expect(router.url).toBe('/users/42');

      // 2. Create route-bound navigator for the active route
      let boundNavigate!: ReturnType<typeof injectNavigate>;
      TestBed.runInInjectionContext(() => {
        boundNavigate = injectNavigate({ from: '/users/:userId' });
      });

      // 3. Navigate to relative child route without repeating :userId
      await boundNavigate({ to: './posts' });

      expect(router.url).toBe('/users/42/posts');
    });

    it('should allow overriding retained parent parameters', async () => {
      await harness.navigateByUrl('/users/42');

      let boundNavigate!: ReturnType<typeof injectNavigate>;
      TestBed.runInInjectionContext(() => {
        boundNavigate = injectNavigate({ from: '/users/:userId' });
      });

      // Explicitly override userId to 99
      await boundNavigate({ to: './posts', params: { userId: '99' } });

      expect(router.url).toBe('/users/99/posts');
    });

    it('should navigate to parent route using ".."', async () => {
      await harness.navigateByUrl('/users/42');

      let boundNavigate!: ReturnType<typeof injectNavigate>;
      TestBed.runInInjectionContext(() => {
        boundNavigate = injectNavigate({ from: '/users/:userId' });
      });

      await boundNavigate({ to: '..' });

      expect(router.url).toBe('/users');
    });

    it('should safely execute outside of active injection context', async () => {
      let boundNavigate!: ReturnType<typeof injectNavigate>;
      TestBed.runInInjectionContext(() => {
        boundNavigate = injectNavigate();
      });

      // Invoked outside of runInInjectionContext
      await boundNavigate({ to: '/users' });

      expect(router.url).toBe('/users');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Injection Context Safety
  // --------------------------------------------------------------------------
  describe('Injection Context Safety', () => {
    it('should throw assertion error when navigate() is called outside injection context without injector', async () => {
      expect(() => {
        resolveRouter(navigate);
      }).toThrow();
    });

    it('should resolve router when explicit injector is provided in options', () => {
      TestBed.configureTestingModule({
        providers: [provideRouter([])],
      });

      const injector = TestBed.inject(Injector);
      const resolved = resolveRouter(navigate, { injector });

      expect(resolved).toBeDefined();
      expect(resolved).toBe(TestBed.inject(Router));
    });
  });
});
