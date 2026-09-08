import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectNavigate,
  injectParams,
  injectQueryParams,
  injectRouteData,
  type TypedRouteTo,
} from '@analogjs/router';

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div class="index-container">
      <h1>Analog Typed Router Test App</h1>
      <p id="home-desc">
        Comprehensive end-to-end compile-time and runtime type safety
        demonstration for Angular and AnalogJS routing.
      </p>

      <section>
        <h2>1. Static Navigation Routes</h2>
        <a id="link-about" typedRouterLink="/about">Go to About</a> |
        <a id="link-users" typedRouterLink="/users">Go to Users List</a> |
        <a id="link-admin" typedRouterLink="/admin">Go to Admin Portal</a>
      </section>

      <section>
        <h2>2. Dynamic Single-Parameter Routes (/users/:userId)</h2>
        <a
          id="link-user-1"
          [typedRouterLink]="{ to: '/users/:userId', params: { userId: '1' } }"
          >User 1</a
        >
        |
        <a
          id="link-user-2"
          [typedRouterLink]="{ to: '/users/:userId', params: { userId: '2' } }"
          >User 2</a
        >
        |
        <a
          id="link-user-3"
          typedRouterLink="/users/:userId"
          [params]="{ userId: '3' }"
          >User 3 (split inputs)</a
        >
      </section>

      <section>
        <h2>3. Nested Route Hierarchies (/users/:userId/posts/:postId)</h2>
        <a
          id="link-user-post"
          [typedRouterLink]="{
            to: '/users/:userId/posts/:postId',
            params: { userId: '1', postId: '101' },
          }"
        >
          User 1 Post 101
        </a>
      </section>

      <section>
        <h2>
          4. Deep Multi-Parameter Dynamic Routes
          (/orgs/:orgId/teams/:teamId/members/:memberId)
        </h2>
        <a
          id="link-deep-member"
          [typedRouterLink]="{
            to: '/orgs/:orgId/teams/:teamId/members/:memberId',
            params: { orgId: 'analogjs', teamId: 'core', memberId: '42' },
            queryParams: { view: 'expanded', highlighted: true },
          }"
        >
          Analog Core Member 42
        </a>
      </section>

      <section>
        <h2>5. Nested Layout & Sub-Routes (/admin/*)</h2>
        <a id="link-admin-dash" typedRouterLink="/admin/dashboard"
          >Admin Dashboard</a
        >
        |
        <a id="link-admin-users" typedRouterLink="/admin/users">Admin Users</a>
        |
        <a id="link-admin-settings" typedRouterLink="/admin/settings"
          >Admin Settings</a
        >
      </section>

      <section>
        <h2>6. Complex Query Parameter Schema (/search)</h2>
        <a
          id="link-search-complex"
          [typedRouterLink]="{
            to: '/search',
            queryParams: {
              q: 'vite',
              page: 2,
              sort: 'relevance',
              inStock: true,
              categories: ['bundlers', 'tools'],
            },
          }"
        >
          Complex Search Query
        </a>
      </section>

      <section>
        <h2>7. Catch-All Wildcard Routes (/docs/**)</h2>
        <a
          id="link-docs-deep"
          [typedRouterLink]="{
            to: '/docs/**',
            params: { '**': 'guides/routing/type-safe-navigation' },
          }"
        >
          Documentation Splat
        </a>
      </section>

      <section>
        <h2>8. Programmatic Navigation Buttons</h2>
        <button id="btn-nav-users" (click)="goToUsers()">
          Go to Users List
        </button>
        <button id="btn-nav-user-42" (click)="goToUser42()">
          Go to User 42 (with query tab)
        </button>
        <button id="btn-nav-org-member" (click)="goToOrgMember()">
          Go to Org Team Member (3 dynamic params)
        </button>
      </section>
    </div>
  `,
})
export default class IndexPageComponent {
  private readonly nav = injectNavigate();

  async goToUsers() {
    await this.nav({ to: '/users' });
  }

  async goToUser42() {
    await this.nav({
      to: '/users/:userId',
      params: { userId: '42' },
      queryParams: { tab: 'info' },
    });
  }

  async goToOrgMember() {
    await this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { orgId: 'analogjs', teamId: 'core', memberId: '1' },
      queryParams: { view: 'compact' },
      state: { origin: 'home-page' },
      fragment: 'overview',
    });
  }

  /**
   * Comprehensive Compile-Time Type Verification:
   * Exercises every dimension of the typed router public API and verifies
   * compile-time type errors via @ts-expect-error annotations.
   */
  private compileTimeTypeAssertions() {
    // =========================================================================
    // 1. Positive Type Verification: Programmatic Navigation (injectNavigate)
    // =========================================================================
    this.nav({ to: '/' });
    this.nav({ to: '/about', replaceUrl: true, fragment: 'top' });
    this.nav({ to: '/users' });
    this.nav({ to: '/users/:userId', params: { userId: '10' } });
    this.nav({
      to: '/users/:userId',
      params: { userId: '10' },
      queryParams: { tab: 'info', highlight: true },
    });
    this.nav({
      to: '/users/:userId/posts/:postId',
      params: { userId: '10', postId: '20' },
      queryParams: { edit: true },
    });
    this.nav({
      to: '/search',
      queryParams: {
        q: 'analog',
        page: 2,
        sort: 'relevance',
        inStock: false,
        categories: ['framework', 'tools'],
      },
    });
    this.nav({ to: '/docs/**', params: { '**': 'guides/getting-started' } });
    this.nav({ to: '/admin' });
    this.nav({ to: '/admin/dashboard' });
    this.nav({ to: '/admin/users' });
    this.nav({ to: '/admin/settings' });
    this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { orgId: 'analogjs', teamId: 'core', memberId: '42' },
      queryParams: { view: 'expanded', highlighted: true },
      state: { from: 'compile-time-test' },
      skipLocationChange: false,
    });

    // =========================================================================
    // 2. Positive Type Verification: Scoped Navigators & Parameter Difference Algebra
    // =========================================================================
    const navFromUser = injectNavigate({ from: '/users/:userId' });
    // Child route: userId is optional because it exists in TFrom!
    navFromUser({
      to: '/users/:userId/posts/:postId',
      params: { postId: '99' },
    });
    // Can also pass both if desired:
    navFromUser({
      to: '/users/:userId/posts/:postId',
      params: { userId: '1', postId: '99' },
    });
    // Relative navigation:
    navFromUser({ to: '..' });
    navFromUser({ to: '.' });

    const navFromAdmin = injectNavigate({ from: '/admin' });
    // Relative child routes:
    navFromAdmin({ to: 'dashboard' });
    navFromAdmin({ to: './dashboard' });
    navFromAdmin({ to: 'settings' });
    navFromAdmin({ to: './settings' });
    navFromAdmin({ to: 'users' });
    navFromAdmin({ to: './users' });
    navFromAdmin({ to: '..' });

    // =========================================================================
    // 3. Positive Type Verification: Hook Inference
    // =========================================================================
    const orgParams = injectParams({
      from: '/orgs/:orgId/teams/:teamId/members/:memberId',
    });
    const _orgId: string = orgParams().orgId;
    const _teamId: string = orgParams().teamId;
    const _memberId: string = orgParams().memberId;

    const searchQueryParams = injectQueryParams({ from: '/search' });
    const _q: string | undefined = searchQueryParams().q;
    const _page: number | undefined = searchQueryParams().page;
    const _sort: 'asc' | 'desc' | 'relevance' | undefined =
      searchQueryParams().sort;
    const _inStock: boolean | undefined = searchQueryParams().inStock;
    const _categories: string[] | undefined = searchQueryParams().categories;

    const adminRouteData = injectRouteData({ from: '/admin' });
    const _section: string = adminRouteData().section;
    const _requiresAuth: boolean = adminRouteData().requiresAuth;

    const settingsRouteData = injectRouteData({ from: '/admin/settings' });
    const _requiresAdmin: boolean = settingsRouteData().requiresAdmin;
    const _role: 'superadmin' | 'editor' = settingsRouteData().role;

    // =========================================================================
    // 4. Negative Verification: Unregistered & Typos in Routes
    // =========================================================================
    // @ts-expect-error - Route does not exist in registry
    this.nav({ to: '/non-existent-route' });

    // @ts-expect-error - Route does not exist in registry (typo)
    this.nav({ to: '/usrs' });

    // @ts-expect-error - Scoped navigator from non-existent route
    injectNavigate({ from: '/non-existent-route' });

    // @ts-expect-error - injectParams from non-existent route
    injectParams({ from: '/non-existent-route' });

    // @ts-expect-error - injectQueryParams from non-existent route
    injectQueryParams({ from: '/non-existent-route' });

    // @ts-expect-error - injectRouteData from non-existent route
    injectRouteData({ from: '/non-existent-route' });

    // =========================================================================
    // 5. Negative Verification: Missing Required Parameters
    // =========================================================================
    // @ts-expect-error - Missing required params for /users/:userId
    this.nav({ to: '/users/:userId' });

    // @ts-expect-error - Missing required params for double-param route
    this.nav({ to: '/users/:userId/posts/:postId' });

    // @ts-expect-error - Missing postId on double-param route
    this.nav({ to: '/users/:userId/posts/:postId', params: { userId: '1' } });

    // @ts-expect-error - Missing userId on double-param route (when navigating globally)
    this.nav({ to: '/users/:userId/posts/:postId', params: { postId: '2' } });

    // @ts-expect-error - Missing required params for triple-param route
    this.nav({ to: '/orgs/:orgId/teams/:teamId/members/:memberId' });

    // @ts-expect-error - Missing memberId on triple-param route
    this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { orgId: 'analogjs', teamId: 'core' },
    });

    // @ts-expect-error - Missing orgId and memberId on triple-param route
    this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { teamId: 'core' },
    });

    // @ts-expect-error - Missing wildcard parameter for /docs/**
    this.nav({ to: '/docs/**' });

    // =========================================================================
    // 6. Negative Verification: Invalid Parameter Types
    // =========================================================================
    // @ts-expect-error - userId must be string, not number
    this.nav({ to: '/users/:userId', params: { userId: 12345 } });

    // @ts-expect-error - memberId must be string, not boolean
    this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { orgId: 'a', teamId: 'b', memberId: true },
    });

    // @ts-expect-error - orgId must be string, not object
    this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: { orgId: { name: 'analog' }, teamId: 'b', memberId: '1' },
    });

    // =========================================================================
    // 7. Negative Verification: Query Parameter Schemas
    // =========================================================================
    // @ts-expect-error - page query parameter must be number, not string
    this.nav({ to: '/search', queryParams: { page: 'invalid' } });

    // @ts-expect-error - sort query parameter must be 'asc' | 'desc' | 'relevance', not 'popular'
    this.nav({ to: '/search', queryParams: { sort: 'popular' } });

    // @ts-expect-error - inStock query parameter must be boolean, not string
    this.nav({ to: '/search', queryParams: { inStock: 'yes' } });

    // @ts-expect-error - categories query parameter must be string[], not a number
    this.nav({ to: '/search', queryParams: { categories: 42 } });

    // @ts-expect-error - tab on /users/:userId must be 'info' | 'activity', not 'settings'
    this.nav({
      to: '/users/:userId',
      params: { userId: '1' },
      queryParams: { tab: 'settings' },
    });

    // =========================================================================
    // 8. Negative Verification: Parameter Difference Algebra & Scoped Navigation
    // =========================================================================
    // @ts-expect-error - From /users/:userId, postId is newly introduced and required
    navFromUser({ to: '/users/:userId/posts/:postId', params: {} });

    // @ts-expect-error - From /admin, navigating to /users/:userId requires userId
    navFromAdmin({ to: '/users/:userId' });

    // @ts-expect-error - Navigating to non-existent child from /admin
    navFromAdmin({ to: './non-existent-child' });

    // @ts-expect-error - Navigating to invalid relative sibling syntax via injectNavigate
    navFromAdmin({ to: '../dashboard' });

    // =========================================================================
    // 9. Negative Verification: Declarative TypedRouteTo & Bare Strings
    // =========================================================================
    // @ts-expect-error - Parameterized route requires params, cannot be used as bare string
    const _bareSingleParam: TypedRouteTo = '/users/:userId';

    // @ts-expect-error - Multi-param route requires params, cannot be used as bare string
    const _bareMultiParam: TypedRouteTo =
      '/orgs/:orgId/teams/:teamId/members/:memberId';

    // @ts-expect-error - Wildcard route requires params, cannot be used as bare string
    const _bareWildcard: TypedRouteTo = '/docs/**';

    // @ts-expect-error - Non-existent route cannot be used as bare string
    const _bareInvalid: TypedRouteTo = '/non-existent';

    // @ts-expect-error - TypedRouteTo object missing required params
    const _missingParamObj: TypedRouteTo = { to: '/users/:userId' };

    const _invalidQueryObj: TypedRouteTo = {
      to: '/search',
      // @ts-expect-error - TypedRouteTo object with invalid query params
      queryParams: { sort: 'unsupported' },
    };

    // Suppress unused variable warnings in compiler
    void _orgId;
    void _teamId;
    void _memberId;
    void _q;
    void _page;
    void _sort;
    void _inStock;
    void _categories;
    void _section;
    void _requiresAuth;
    void _requiresAdmin;
    void _role;
    void _bareSingleParam;
    void _bareMultiParam;
    void _bareWildcard;
    void _bareInvalid;
    void _missingParamObj;
    void _invalidQueryObj;
  }
}
