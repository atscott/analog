/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component, inject, resource, Resource } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanDeactivateFn,
  provideRouter,
  RedirectCommand,
  Router,
  RouterOutlet,
  withRouterResources,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { createFileRoute } from '../../src/lib/facade/file-route';
import {
  injectRouteData,
  injectRouteResources,
} from '../../src/lib/facade/hooks';
import { FULL_PATH_KEY, ROUTE_ID_KEY } from '../../src/lib/facade/resources';
import { provideFileRouter } from '../../src/lib/provide-file-router';
import { createRoutes, type Files } from '../../src/lib/routes';

// ============================================================================
// Test Components
// ============================================================================

@Component({
  standalone: true,
  template: '<div id="item">Item: {{ data().item }}</div>',
})
class ItemComponent {
  readonly data = injectRouteData<{ item: string }>();
}

@Component({
  standalone: true,
  template: '<div id="static">Status: {{ data().status }}</div>',
})
class StaticComponent {
  readonly data = injectRouteData<{ status: string; timestamp: number }>();
}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<div id="parent-layout"><router-outlet /></div>',
})
class ParentLayoutComponent {
  readonly data = injectRouteData<{ parentUser: string }>();
}

@Component({
  standalone: true,
  template: '<div id="child">Child: {{ data().childId }}</div>',
})
class ChildComponent {
  readonly data = injectRouteData<{ childId: string; parentUser?: string }>();
}

@Component({
  standalone: true,
  template: '<div id="login">Login Page</div>',
})
class LoginComponent {}

@Component({
  standalone: true,
  template: '<div id="protected">Protected Page</div>',
})
class ProtectedComponent {}

@Component({
  standalone: true,
  template: '<div id="profile">Profile Loaded</div>',
})
class ProfileComponent {
  readonly resources = injectRouteResources<{
    user: Resource<{ name: string } | undefined>;
  }>();
}

@Component({
  standalone: true,
  template: '<div>Dummy</div>',
})
class DummyComponent {}

// ============================================================================
// Test Suite
// ============================================================================

describe('Runtime Resources & Data Loading Bridge (Public API)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Route Data Resolvers & Live Navigation', () => {
    it('should resolve asynchronous route data and expose it via injectRouteData', async () => {
      const itemRoute = createFileRoute('/items/:id')({
        component: ItemComponent,
        resolve: {
          item: (route: ActivatedRouteSnapshot) =>
            Promise.resolve(`Item ${route.params['id']}`),
        },
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [{ ...itemRoute, path: 'items/:id' }],
            withRouterResources(),
          ),
        ],
      });

      const harness = await RouterTestingHarness.create();
      const comp = await harness.navigateByUrl('/items/42', ItemComponent);

      expect(comp.data().item).toBe('Item 42');
    });

    it('should resolve synchronous route data and expose it via injectRouteData', async () => {
      const staticRoute = createFileRoute('/static')({
        component: StaticComponent,
        resolve: {
          status: () => 'ok',
          timestamp: () => 12345,
        },
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [{ ...staticRoute, path: 'static' }],
            withRouterResources(),
          ),
        ],
      });

      const harness = await RouterTestingHarness.create();
      const comp = await harness.navigateByUrl('/static', StaticComponent);

      expect(comp.data().status).toBe('ok');
      expect(comp.data().timestamp).toBe(12345);
    });

    it('should inherit resolved parent data in child route components', async () => {
      const files: Files = {
        '/app/pages/parent.page.ts': () =>
          Promise.resolve({
            default: ParentLayoutComponent,
            Route: createFileRoute('/parent')({
              resolve: {
                parentUser: () => 'admin',
              },
            }),
          }),
        '/app/pages/parent/child.[childId].page.ts': () =>
          Promise.resolve({
            default: ChildComponent,
            Route: createFileRoute('/parent/child/:childId')({
              resolve: {
                childId: (route: ActivatedRouteSnapshot) =>
                  route.params['childId'] ?? '',
              },
            }),
          }),
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes, withRouterResources())],
      });

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/parent/child/c-1');

      const childInstance = harness.fixture.debugElement.query(
        By.directive(ChildComponent),
      ).componentInstance as ChildComponent;

      expect(childInstance.data().childId).toBe('c-1');
      expect(childInstance.data().parentUser).toBe('admin');
    });

    it('should execute resolver and expose resolved data', async () => {
      const resolveRoute = createFileRoute('/resolve-test/:id')({
        component: ItemComponent,
        resolve: {
          item: (r) => `Loaded ${r.params['id']}`,
        },
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [{ ...resolveRoute, path: 'resolve-test/:id' }],
            withRouterResources(),
          ),
        ],
      });

      const harness = await RouterTestingHarness.create();
      const comp = await harness.navigateByUrl(
        '/resolve-test/99',
        ItemComponent,
      );

      expect(comp.data().item).toBe('Loaded 99');
    });
  });

  describe('Route Resources & Live Navigation', () => {
    it('should reactively expose route resources in routed components via injectRouteResources', async () => {
      const profileRoute = createFileRoute('/profile')({
        component: ProfileComponent,
        resources: () => ({
          user: resource({
            loader: () => Promise.resolve({ name: 'Alice' }),
          }),
        }),
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [{ ...profileRoute, path: 'profile' }],
            withRouterResources(),
          ),
        ],
      });

      const harness = await RouterTestingHarness.create();
      const comp = await harness.navigateByUrl('/profile', ProfileComponent);

      expect(comp.resources().user).toBeDefined();
      expect(comp.resources().user.value()).toEqual({ name: 'Alice' });
    });
  });

  describe('Navigation Redirection (RedirectCommand)', () => {
    it('should redirect live navigation when resolver returns a RedirectCommand', async () => {
      const loginRoute = createFileRoute('/login')({
        component: LoginComponent,
      });

      const protectedRoute = createFileRoute('/protected')({
        component: ProtectedComponent,
        resolve: {
          auth: () => {
            const router = inject(Router);
            return new RedirectCommand(router.parseUrl('/login'), {
              replaceUrl: true,
            });
          },
        },
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [
              { ...loginRoute, path: 'login' },
              { ...protectedRoute, path: 'protected' },
            ],
            withRouterResources(),
          ),
        ],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/protected');
      expect(router.url).toBe('/login');
    });

    it('should redirect live navigation when resolver throws a RedirectCommand', async () => {
      const loginRoute = createFileRoute('/login')({
        component: LoginComponent,
      });

      const redirectedRoute = createFileRoute('/dashboard')({
        component: ProtectedComponent,
        resolve: {
          auth: () => {
            const router = inject(Router);
            throw new RedirectCommand(router.parseUrl('/login'), {
              replaceUrl: true,
            });
          },
        },
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter(
            [
              { ...loginRoute, path: 'login' },
              { ...redirectedRoute, path: 'dashboard' },
            ],
            withRouterResources(),
          ),
        ],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/dashboard');
      expect(router.url).toBe('/login');
    });
  });

  describe('FileRoute & Resource Integration in createRoutes', () => {
    it('should dynamically load lazy page file modules during live navigation', async () => {
      let pageModuleLoaded = false;
      const files: Files = {
        '/app/pages/feature.page.ts': () => {
          pageModuleLoaded = true;
          return Promise.resolve({
            Route: createFileRoute('/feature')({
              resolve: { childId: () => 'detail-42' },
            }),
            default: ChildComponent,
          });
        },
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      expect(pageModuleLoaded).toBe(false);
      await harness.navigateByUrl('/feature');
      expect(router.url).toBe('/feature');
      expect(pageModuleLoaded).toBe(true);

      const childInstance = harness.fixture.debugElement.query(
        By.directive(ChildComponent),
      ).componentInstance as ChildComponent;
      expect(childInstance.data().childId).toBe('detail-42');
    });

    it('should provide reactive Signals matching Angular ResourceContext in fallback', async () => {
      let capturedCtx: any;
      const files: Files = {
        '/app/pages/test-resources.page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/test-resources')({
              component: DummyComponent,
              resources: (ctx) => {
                capturedCtx = ctx;
                return {};
              },
            }),
            default: DummyComponent,
          }),
      };

      const routes = createRoutes(files);
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/test-resources');

      TestBed.runInInjectionContext(() => {
        injectRouteResources({ from: '/test-resources' });
      });

      expect(capturedCtx).toBeDefined();
      expect(typeof capturedCtx.params).toBe('function'); // Signal
      expect(typeof capturedCtx.queryParams).toBe('function'); // Signal
      expect(typeof capturedCtx.fragment).toBe('function'); // Signal
      expect(typeof capturedCtx.data).toBe('function'); // Signal
      expect(typeof capturedCtx.resources).toBe('function'); // Signal
      expect(capturedCtx.routeConfig).toBeDefined();
    });

    it('should reactively coerce and validate ctx.queryParams() inside route.resources', async () => {
      let capturedCtx: any;
      const files: Files = {
        '/app/pages/search.page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/search')({
              component: DummyComponent,
              validateQueryParams: (raw) => ({
                page: Number(raw['page'] ?? 1),
                sort: (raw['sort'] as string) ?? 'asc',
              }),
              resources: (ctx) => {
                capturedCtx = ctx;
                return {};
              },
            }),
            default: DummyComponent,
          }),
      };

      const routes = createRoutes(files);
      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/search?page=42&sort=desc');

      TestBed.runInInjectionContext(() => {
        injectRouteResources({ from: '/search' });
      });

      expect(capturedCtx).toBeDefined();
      expect(typeof capturedCtx.queryParams).toBe('function');
      expect(capturedCtx.queryParams()).toEqual({ page: 42, sort: 'desc' });
    });

    it('should wrap route.resources so ctx.queryParams() evaluates validated query params with withRouterResources', async () => {
      let queryParamsValue: any;
      const files: Files = {
        '/app/pages/products.page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/products')({
              component: DummyComponent,
              validateQueryParams: (raw) => ({
                limit: Number(raw['limit'] ?? 10),
              }),
              resources: (ctx) => {
                queryParamsValue = ctx.queryParams();
                return {};
              },
            }),
            default: DummyComponent,
          }),
      };

      const routes = createRoutes(files);
      const childRoutes = await (routes[0].loadChildren as any)();
      const routeResourcesFn = childRoutes[0].resources;
      expect(routeResourcesFn).toBeDefined();

      const fakeCtx = {
        params: () => ({}),
        queryParams: () => ({ limit: '50' }),
        fragment: () => null,
        data: () => ({}),
        resources: () => ({}),
        routeConfig: childRoutes[0],
      };

      routeResourcesFn(fakeCtx);
      expect(queryParamsValue).toEqual({ limit: 50 });
    });
  });

  describe('withRouterResources Provider & Feature Integration', () => {
    it('provideFileRouter should configure router providers', () => {
      TestBed.configureTestingModule({
        providers: [provideFileRouter()],
      });

      const router = TestBed.inject(Router);
      expect(router).toBeDefined();
    });
  });
});
