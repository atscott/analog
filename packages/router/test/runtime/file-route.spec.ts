/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  withRouterResources,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileRoute } from '../../src/lib/facade/file-route';
import { createRoutes, type Files } from '../../src/lib/routes';
import { provideFileRouter } from '../../src/lib/provide-file-router';
import {
  generateRouteTree,
  generateRouteTreeFile,
  sortDiscoveredRoutes,
  normalizeDiscoveredRoutes,
  type DiscoveredRoute,
} from '../../src/lib/generator/route-tree-generator';

// ============================================================================
// Test Components
// ============================================================================

@Component({
  standalone: true,
  template: '<div id="home">Home Page</div>',
})
class HomePageComponent {}

@Component({
  standalone: true,
  template: '<div id="user">User Detail Page</div>',
})
class UserPageComponent {}

@Component({
  standalone: true,
  template: '<div id="team">Team Page</div>',
})
class TeamPageComponent {}

// ============================================================================
// Test Suite
// ============================================================================

describe('File-Based Routing Runtime & Generator (Milestone 5)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // --------------------------------------------------------------------------
  // 1. createFileRoute Facade & Builder Ergonomics
  // --------------------------------------------------------------------------
  describe('createFileRoute Runtime Facade', () => {
    it('should create route definition via curried callable form', () => {
      const route = createFileRoute('/users/:id')({
        component: UserPageComponent,
        resolve: {
          user: ({ params }) => ({ userId: params['id'] }),
        },
      });

      expect(route.path).toBe('/users/:id');
      expect(route.id).toBe('/users/:id');
      expect(route.component).toBe(UserPageComponent);
      expect(typeof route.resolve?.['user']).toBe('function');
    });

    it('should create route definition via options object', () => {
      const resolveFn = async (route: ActivatedRouteSnapshot) => ({
        userId: route.params['id'],
      });
      const searchFn = (raw: Record<string, unknown>) => ({
        tab: String(raw['tab'] ?? 'info'),
      });

      const route = createFileRoute('/users/:id')({
        component: UserPageComponent,
        resolve: { user: resolveFn },
        validateQueryParams: searchFn,
      });

      expect(route.path).toBe('/users/:id');
      expect(route.component).toBe(UserPageComponent);
      expect(route.resolve?.['user']).toBe(resolveFn);
      expect(typeof route.validateQueryParams).toBe('function');
    });

    it('should directly preserve route properties as route metadata', () => {
      const route = createFileRoute('/profile')({
        component: UserPageComponent,
        resolve: {
          user: async () => ({ name: 'Alice' }),
        },
        title: 'Profile Page',
        data: { role: 'admin' },
      });

      expect(route.title).toBe('Profile Page');
      expect(route.data).toEqual({ role: 'admin' });
      expect(route.resolve).toBeDefined();
      expect(typeof route.resolve!['user']).toBe('function');
    });

    it('should support redirect routes with redirectTo and pathMatch', () => {
      const redirectRoute = createFileRoute('/legacy-users')({
        redirectTo: '/users',
        pathMatch: 'full',
      });

      expect(redirectRoute.redirectTo).toBe('/users');
      expect(redirectRoute.pathMatch).toBe('full');
    });

    it('should preserve runGuardsAndResolvers, meta, and resources', () => {
      const resourcesFn = () => ({});
      const metaTags = [{ name: 'description', content: 'Test' }];

      const route = createFileRoute('/dashboard')({
        runGuardsAndResolvers: 'always',
        meta: metaTags,
        resources: resourcesFn as any,
      });

      expect(route.runGuardsAndResolvers).toBe('always');
      expect(route.meta).toBe(metaTags);
      expect(route.resources).toBe(resourcesFn);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Code Generation Engine (generateRouteTree)
  // --------------------------------------------------------------------------
  describe('generateRouteTree Code Generation', () => {
    it('should deterministically sort routes: root, parents before children, index before dynamic, static before param', () => {
      const routes: DiscoveredRoute[] = [
        { id: '/blog/[...slug]' },
        { id: '/blog/intro' },
        { id: '/blog/[category]' },
        { id: '/users/[userId]' },
        { id: '/users' },
        { id: '/users/index', isIndex: true },
        { id: '/about' },
        { id: '/' },
        { id: '/users/[userId]/settings' },
      ];

      const sorted = normalizeDiscoveredRoutes(routes);
      const sortedIds = sorted.map((r) => r.id);

      // Root route must be first
      expect(sortedIds[0]).toBe('/');
      // Static routes before dynamic routes
      expect(sortedIds.indexOf('/about')).toBeLessThan(
        sortedIds.indexOf('/users/[userId]'),
      );
      // Parent /users before child /users/[userId]
      expect(sortedIds.indexOf('/users')).toBeLessThan(
        sortedIds.indexOf('/users/[userId]'),
      );
      // Index /users/ before param /users/[userId]
      expect(sortedIds.indexOf('/users/')).toBeLessThan(
        sortedIds.indexOf('/users/[userId]'),
      );
      // Parent /users/[userId] before nested /users/[userId]/settings
      expect(sortedIds.indexOf('/users/[userId]')).toBeLessThan(
        sortedIds.indexOf('/users/[userId]/settings'),
      );
      // Sibling sorting: static before param, param before wildcard
      expect(sortedIds.indexOf('/blog/intro')).toBeLessThan(
        sortedIds.indexOf('/blog/[category]'),
      );
      expect(sortedIds.indexOf('/blog/[category]')).toBeLessThan(
        sortedIds.indexOf('/blog/[...slug]'),
      );
    });

    it('should emit clean, valid routeTree.gen.ts TypeScript code', () => {
      const routes: DiscoveredRoute[] = [
        {
          id: '/',
          path: '/',
          fullPath: '/',
          parentId: '__root__',
          variableName: 'IndexRoute',
          importPath: './app/pages/index.page',
        },
        {
          id: '/users',
          path: 'users',
          fullPath: '/users',
          parentId: '__root__',
          variableName: 'UsersRoute',
          importPath: './app/pages/users.page',
        },
        {
          id: '/users/:userId',
          path: ':userId',
          fullPath: '/users/:userId',
          parentId: '/users',
          variableName: 'UsersUserIdRoute',
          importPath: './app/pages/users/[userId].page',
        },
      ];

      const generated = generateRouteTree(routes);

      // Verify header and imports
      expect(generated).toContain(
        'This file was automatically generated by Analog Router',
      );
      expect(generated).toContain(
        `import type { Route as IndexRouteImport } from './app/pages/index.page';`,
      );
      expect(generated).toContain(
        `import type { Route as UsersRouteImport } from './app/pages/users.page';`,
      );
      expect(generated).toContain(
        `import type { Route as UsersUserIdRouteImport } from './app/pages/users/[userId].page';`,
      );
      expect(generated).toContain(
        `loadChildren: () => import('./app/pages/index.page')`,
      );
      expect(generated).toContain(
        `loadChildren: () => import('./app/pages/users.page')`,
      );
      expect(generated).toContain(
        `loadChildren: () => import('./app/pages/users/[userId].page')`,
      );

      // Verify bottom-up composition
      expect(generated).toContain('const UsersRouteWithChildren = {');
      expect(generated).toContain('...UsersRoute,');
      expect(generated).toContain('children: [');
      expect(generated).toContain('UsersUserIdRoute');
      expect(generated).toContain('export const routeTree = [');
      expect(generated).toContain('IndexRoute');
      expect(generated).toContain('UsersRouteWithChildren');
      expect(generated).toContain('export const routes = routeTree;');

      // Verify declaration merging augmentation
      expect(generated).toContain(`declare module '@analogjs/router' {`);
      expect(generated).toContain(`interface FileRoutesByPath {`);
      expect(generated).toContain(`'/users/:userId': {`);
      expect(generated).toContain(`route: typeof UsersUserIdRouteImport;`);
      expect(generated).toContain(`interface Register {`);
      expect(generated).toContain(`navigationMap: FileRoutesByFullPath;`);
      expect(generated).toContain(`routeMap: FileRoutesById;`);

      // Verify type exports
      expect(generated).toContain(`export type FileRoutesByFullPath = {`);
      expect(generated).toContain(`export type FileRoutesById = {`);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Disk Operations & Idempotency (generateRouteTreeFile)
  // --------------------------------------------------------------------------
  describe('generateRouteTreeFile Disk Operations', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'analog-routes-test-'),
      );
    });

    afterEach(async () => {
      if (tempDir && fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should discover pages and generate routeTree.gen.ts with idempotency check', async () => {
      const routesDir = path.join(tempDir, 'src/app/pages');
      const generatedPath = path.join(tempDir, 'src/routeTree.gen.ts');

      await fs.promises.mkdir(routesDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(routesDir, 'index.page.ts'),
        `export const Route = createFileRoute('/')({}); export default class Index {}`,
      );
      await fs.promises.mkdir(path.join(routesDir, 'users'), {
        recursive: true,
      });
      await fs.promises.writeFile(
        path.join(routesDir, 'users.page.ts'),
        `export const Route = createFileRoute('/users')({}); export default class Users {}`,
      );
      await fs.promises.writeFile(
        path.join(routesDir, 'users/[id].page.ts'),
        `export const Route = createFileRoute('/users/[id]')({}); export default class UserDetail {}`,
      );

      // First run: should create file and return changed: true
      const run1 = await generateRouteTreeFile({ routesDir, generatedPath });
      expect(run1.changed).toBe(true);
      expect(fs.existsSync(generatedPath)).toBe(true);

      const content1 = await fs.promises.readFile(generatedPath, 'utf8');
      expect(content1).toContain('IndexRoute');
      expect(content1).toContain('UsersRoute');

      // Second run without modifications: should return changed: false
      const run2 = await generateRouteTreeFile({ routesDir, generatedPath });
      expect(run2.changed).toBe(false);
      expect(run2.content).toBe(content1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Live Navigation Integration with provideFileRouter & RouterTestingHarness
  // --------------------------------------------------------------------------
  describe('Live Navigation with provideFileRouter & RouterTestingHarness', () => {
    it('should navigate and execute resolvers through provideFileRouter', async () => {
      const homeRoute = createFileRoute('/')({
        component: HomePageComponent,
        resolve: {
          welcome: () => Promise.resolve({ welcome: 'Hello World' }),
        },
      });

      const userRoute = createFileRoute('/users/:id')({
        component: UserPageComponent,
        resolve: {
          user: (route) => ({
            userId: route.params['id'],
            loadedAt: Date.now(),
          }),
        },
      });

      const files: Files = {
        '/app/pages/index.page.ts': () =>
          Promise.resolve({
            default: HomePageComponent,
            Route: homeRoute,
          }),
        '/app/pages/users.[id].page.ts': () =>
          Promise.resolve({
            default: UserPageComponent,
            Route: userRoute,
          }),
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes, withRouterResources())],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      // Navigate to /
      await harness.navigateByUrl('/');
      expect(router.url).toBe('/');

      const homeSnapshot =
        router.routerState.snapshot.root.firstChild?.firstChild ??
        router.routerState.snapshot.root.firstChild;
      expect(homeSnapshot).toBeDefined();
      expect(homeSnapshot?.data['welcome']).toEqual({
        welcome: 'Hello World',
      });

      // Navigate to /users/42
      await harness.navigateByUrl('/users/42');
      expect(router.url).toBe('/users/42');

      const userSnapshot =
        router.routerState.snapshot.root.firstChild?.firstChild ??
        router.routerState.snapshot.root.firstChild;
      expect(userSnapshot).toBeDefined();
      expect(
        router.routerState.snapshot.root.firstChild?.params['id'] ??
          userSnapshot?.params['id'],
      ).toBe('42');
      expect(userSnapshot?.data['user']).toMatchObject({
        userId: '42',
      });
    });

    it('should resolve route data using route snapshots in child resolvers', async () => {
      let receivedOrg: string | undefined;

      const files: Files = {
        '/app/pages/orgs.[orgId].page.ts': () =>
          Promise.resolve({
            default: HomePageComponent,
            Route: createFileRoute('/orgs/:orgId')({
              resolve: {
                org: (route) => `Org-${route.params['orgId']}`,
              },
            }),
          }),
        '/app/pages/orgs.[orgId]/teams.[teamId].page.ts': () =>
          Promise.resolve({
            default: TeamPageComponent,
            Route: createFileRoute('/orgs/:orgId/teams/:teamId')({
              resolve: {
                team: (route) => {
                  receivedOrg = route.parent?.data['org'];
                  return `Team-${route.params['teamId']}`;
                },
              },
            }),
          }),
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes, withRouterResources())],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/orgs/google/teams/angular');
      expect(router.url).toBe('/orgs/google/teams/angular');
      expect(receivedOrg).toBe('Org-google');
    });

    it('should dynamically load lazy page file modules on live navigation', async () => {
      let lazyModuleLoaded = false;
      const files: Files = {
        '/app/pages/users.[id].page.ts': () => {
          lazyModuleLoaded = true;
          return Promise.resolve({
            default: UserPageComponent,
            Route: createFileRoute('/users/:id')({
              resolve: {
                user: async (route) => ({
                  userId: route.params['id'],
                  name: 'Lazy Loaded User',
                }),
              },
              validateSearch: (raw: Record<string, unknown>) => ({
                tab: String(raw['tab'] ?? 'info'),
              }),
            }),
          });
        },
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes, withRouterResources())],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      expect(lazyModuleLoaded).toBe(false);

      // Navigate to /users/99?tab=details
      await harness.navigateByUrl('/users/99?tab=details');
      expect(router.url).toBe('/users/99?tab=details');
      expect(lazyModuleLoaded).toBe(true);

      const snapshot = router.routerState.snapshot.root.firstChild;
      expect(snapshot).toBeDefined();
      expect(snapshot?.params['id']).toBe('99');
      const innerSnapshot = snapshot?.firstChild ?? snapshot;
      expect(innerSnapshot?.component).toBe(UserPageComponent);
      expect(innerSnapshot?.data['user']).toEqual({
        userId: '99',
        name: 'Lazy Loaded User',
      });
    });
  });

  // --------------------------------------------------------------------------
  // 5. Route Handling & Resource Safety
  // --------------------------------------------------------------------------
  describe('Route Handling & Resource Safety', () => {
    it('should cleanly load page file definitions with createRoutes', async () => {
      const files: Files = {
        '/app/pages/index.page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/')({
              component: HomePageComponent,
            }),
            default: HomePageComponent,
          }),
        '/app/pages/users/[id].page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/users/:id')({
              component: UserPageComponent,
            }),
            default: UserPageComponent,
          }),
      };

      const routes = createRoutes(files);
      expect(routes.length).toBeGreaterThan(0);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/');
      expect(router.url).toBe('/');

      await harness.navigateByUrl('/users/42');
      expect(router.url).toBe('/users/42');
      const userSnapshot =
        router.routerState.snapshot.root.firstChild?.firstChild ??
        router.routerState.snapshot.root.firstChild;
      expect(
        router.routerState.snapshot.root.firstChild?.params['id'] ??
          userSnapshot?.params['id'],
      ).toBe('42');
    });

    it('should correctly execute resolve and queryParams validation on route', async () => {
      const files: Files = {
        '/app/pages/search.page.ts': () =>
          Promise.resolve({
            Route: createFileRoute('/search')({
              component: HomePageComponent,
              validateQueryParams: (raw) => ({ q: String(raw['q'] ?? '') }),
              resolve: {
                query: (route: ActivatedRouteSnapshot) =>
                  route.queryParams['q'],
              },
            }),
            default: HomePageComponent,
          }),
      };

      const routes = createRoutes(files);

      TestBed.configureTestingModule({
        providers: [provideRouter(routes)],
      });

      const router = TestBed.inject(Router);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/search?q=analogjs');
      expect(router.url).toBe('/search?q=analogjs');

      const snapshot =
        router.routerState.snapshot.root.firstChild?.firstChild ??
        router.routerState.snapshot.root.firstChild;
      expect(snapshot?.data['query']).toBe('analogjs');
    });
  });
});
