/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component, Injector, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterOutlet,
  type Routes,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getQueryParams,
  injectParams,
  injectQueryParams,
  injectRouteData,
  injectRouteResources,
  injectRoute,
  resolveInjector,
} from '../../src/lib/facade/hooks';
import {
  QUERY_PARAMS_VALIDATOR_KEY,
  RESOURCES_KEY,
} from '../../src/lib/facade/resources';

// ============================================================================
// Test Components (User Perspective)
// ============================================================================

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div id="tenant-layout">
      Tenant: {{ tenantParams().tenantId }}
      <router-outlet />
    </div>
  `,
})
class TenantLayoutComponent {
  readonly tenantParams = injectParams<{ tenantId: string }>();
}

@Component({
  standalone: true,
  template: `
    <div id="user-detail">
      User: {{ params().userId }} Tenant: {{ params().tenantId }}
    </div>
  `,
})
class UserDetailComponent {
  readonly params = injectParams<{ tenantId: string; userId: string }>();
  readonly scopedTenantParams = injectParams({ from: '/tenants/:tenantId' });
  readonly queryParams = injectQueryParams<{ tab?: string; sort?: string }>();
  readonly routeData = injectRouteData<{ role?: string }>();
  readonly route = injectRoute();
}

@Component({
  standalone: true,
  template: '<div id="items">Items</div>',
})
class ItemsComponent {
  readonly queryParams = injectQueryParams<{ page: number; q: string }>();
}

interface ProfileResources {
  profile: { value: Signal<{ user: string }> };
}

@Component({
  standalone: true,
  template: '<div id="profile">Profile</div>',
})
class ProfileComponent {
  readonly resources = injectRouteResources<ProfileResources>();
}

// ============================================================================
// Route Configuration
// ============================================================================

const routes: Routes = [
  {
    path: 'tenants/:tenantId',
    component: TenantLayoutComponent,
    children: [
      {
        path: 'users/:userId',
        component: UserDetailComponent,
        data: { role: 'admin' },
      },
    ],
  },
  {
    path: 'items',
    component: ItemsComponent,
    data: {
      [QUERY_PARAMS_VALIDATOR_KEY]: (raw: Record<string, unknown>) => ({
        page: Number(raw['page'] ?? 1),
        q: String(raw['q'] ?? ''),
      }),
    },
  },
  {
    path: 'profile',
    component: ProfileComponent,
    data: {
      [RESOURCES_KEY]: () => ({
        profile: { value: signal({ user: 'Alice' }) },
      }),
    },
  },
];

// ============================================================================
// Test Suite
// ============================================================================

describe('Route Signal Hooks (Public API)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
    harness = await RouterTestingHarness.create();
  });

  function getUserDetailComponent(): UserDetailComponent {
    return harness.fixture.debugElement.query(By.directive(UserDetailComponent))
      .componentInstance;
  }

  describe('injectParams', () => {
    it('should reactively expose current route parameters and inherited parent parameters', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42');
      const comp = getUserDetailComponent();

      expect(comp.params()).toEqual({ tenantId: 't-1', userId: 'u-42' });

      // Navigate to a different user on the same tenant
      await harness.navigateByUrl('/tenants/t-1/users/u-99');
      expect(comp.params()).toEqual({ tenantId: 't-1', userId: 'u-99' });
    });

    it('should scope parameters to an ancestor route when `from` is specified', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42');
      const comp = getUserDetailComponent();

      expect(comp.scopedTenantParams()).toEqual({ tenantId: 't-1' });
    });
  });

  describe('injectQueryParams', () => {
    it('should reactively expose query parameters', async () => {
      await harness.navigateByUrl(
        '/tenants/t-1/users/u-42?tab=details&sort=desc',
      );
      const comp = getUserDetailComponent();

      expect(comp.queryParams()).toEqual({ tab: 'details', sort: 'desc' });

      // Navigate with updated query parameters
      await harness.navigateByUrl(
        '/tenants/t-1/users/u-42?tab=settings&sort=asc',
      );
      expect(comp.queryParams()).toEqual({ tab: 'settings', sort: 'asc' });
    });

    it('should apply query parameter validation when validator is configured on route', async () => {
      const comp = await harness.navigateByUrl(
        '/items?page=4&q=analog',
        ItemsComponent,
      );

      expect(comp.queryParams()).toEqual({ page: 4, q: 'analog' });

      await harness.navigateByUrl('/items?page=10&q=router');
      expect(comp.queryParams()).toEqual({ page: 10, q: 'router' });
    });
  });

  describe('getQueryParams', () => {
    it('should synchronously retrieve and validate query parameters from ActivatedRouteSnapshot', async () => {
      await harness.navigateByUrl('/items?page=7&q=test');
      const router = TestBed.inject(Router);
      const snapshot = router.routerState.snapshot.root.firstChild!;

      const params = getQueryParams<{ page: number; q: string }>(snapshot);
      expect(params).toEqual({ page: 7, q: 'test' });
    });

    it('should synchronously retrieve query parameters using { from } route scoping on ActivatedRouteSnapshot', async () => {
      await harness.navigateByUrl('/items?page=12&q=scoped');
      const router = TestBed.inject(Router);
      const rootSnapshot = router.routerState.snapshot.root;

      const params = getQueryParams<{ page: number; q: string }>(rootSnapshot, {
        from: 'items',
      });
      expect(params).toEqual({ page: 12, q: 'scoped' });
    });

    it('should work inside a resolver function with ActivatedRouteSnapshot', async () => {
      let resolvedQueryParams: any;
      const resolverRoute: Routes = [
        {
          path: 'resolve-test',
          component: ItemsComponent,
          data: {
            [QUERY_PARAMS_VALIDATOR_KEY]: (raw: Record<string, unknown>) => ({
              filter: String(raw['filter'] ?? 'all'),
              count: Number(raw['count'] ?? 0),
            }),
          },
          resolve: {
            data: (route: ActivatedRouteSnapshot) => {
              resolvedQueryParams = getQueryParams(route);
              return resolvedQueryParams;
            },
          },
        },
      ];

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter(resolverRoute)],
      });
      const localHarness = await RouterTestingHarness.create();
      await localHarness.navigateByUrl('/resolve-test?filter=active&count=5');

      expect(resolvedQueryParams).toEqual({ filter: 'active', count: 5 });
    });

    it('should work inside a guard function with ActivatedRouteSnapshot', async () => {
      let guardQueryParams: any;
      const guardRoute: Routes = [
        {
          path: 'guard-test',
          component: ItemsComponent,
          data: {
            [QUERY_PARAMS_VALIDATOR_KEY]: (raw: Record<string, unknown>) => ({
              authorized: raw['token'] === 'secret',
            }),
          },
          canActivate: [
            (route: ActivatedRouteSnapshot) => {
              guardQueryParams = getQueryParams(route);
              return guardQueryParams.authorized;
            },
          ],
        },
      ];

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter(guardRoute)],
      });
      const localHarness = await RouterTestingHarness.create();
      await localHarness.navigateByUrl('/guard-test?token=secret');

      expect(guardQueryParams).toEqual({ authorized: true });
    });

    it('should synchronously retrieve query parameters in injection context with from scoping', async () => {
      await harness.navigateByUrl('/items?page=3&q=injection');

      TestBed.runInInjectionContext(() => {
        const params = getQueryParams<{ page: number; q: string }>({
          from: 'items',
        });
        expect(params).toEqual({ page: 3, q: 'injection' });
      });
    });

    it('should synchronously retrieve raw query parameters when called at root without validator', async () => {
      await harness.navigateByUrl('/items?page=3&q=injection');

      TestBed.runInInjectionContext(() => {
        const params = getQueryParams();
        expect(params).toEqual({ page: '3', q: 'injection' });
      });
    });

    it('should synchronously retrieve query parameters with explicit injector option and from scoping', async () => {
      await harness.navigateByUrl('/items?page=9&q=injector-opt');

      const params = getQueryParams<{ page: number; q: string }>({
        from: 'items',
        injector: TestBed.inject(Injector),
      });
      expect(params).toEqual({ page: 9, q: 'injector-opt' });
    });
  });

  describe('injectRouteData', () => {
    it('should reactively expose static and resolved route data', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42');
      const comp = getUserDetailComponent();

      expect(comp.routeData()).toEqual({ role: 'admin' });
    });
  });

  describe('injectRouteResources', () => {
    it('should reactively expose route resources', async () => {
      const comp = await harness.navigateByUrl('/profile', ProfileComponent);

      expect(comp.resources()).toBeDefined();
      expect(comp.resources().profile.value()).toEqual({ user: 'Alice' });
    });
  });

  describe('injectRoute', () => {
    it('should expose combined composite facade with params, queryParams, data, and ActivatedRoute', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42?tab=activity');
      const comp = getUserDetailComponent();

      expect(comp.route.params()).toEqual({ tenantId: 't-1', userId: 'u-42' });
      expect(comp.route.queryParams()).toEqual({ tab: 'activity' });
      expect(comp.route.data()).toEqual({ role: 'admin' });
      expect(comp.route.route).toBeDefined();
      expect(comp.route.route.snapshot.params['userId']).toBe('u-42');
    });
  });

  describe('resolveInjector', () => {
    it('should throw when called outside injection context without options', () => {
      expect(() => {
        resolveInjector(resolveInjector);
      }).toThrow();
    });

    it('should return explicit injector when passed in options', () => {
      const customInjector = Injector.create({ providers: [] });
      const resolved = resolveInjector(resolveInjector, {
        injector: customInjector,
      });
      expect(resolved).toBe(customInjector);
    });
  });
});
