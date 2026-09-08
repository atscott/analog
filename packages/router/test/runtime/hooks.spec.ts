/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  injectParams,
  injectQueryParams,
  injectRouteData,
} from '../../src/lib/facade/hooks';

// ============================================================================
// Test Components
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
  readonly queryParams = injectQueryParams<{ tab?: string; sort?: string }>();
  readonly routeData = injectRouteData<{ role?: string }>();
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
];

// ============================================================================
// Test Suite
// ============================================================================

describe('Route Signal Functions (injectParams, injectQueryParams, injectRouteData)', () => {
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

    it('should accept explicit injector option', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42');
      const compDebugEl = harness.fixture.debugElement.query(
        By.directive(UserDetailComponent),
      );

      const paramsSignal = injectParams({ injector: compDebugEl.injector });
      expect(paramsSignal()).toEqual({ tenantId: 't-1', userId: 'u-42' });
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
  });

  describe('injectRouteData', () => {
    it('should reactively expose route data', async () => {
      await harness.navigateByUrl('/tenants/t-1/users/u-42');
      const comp = getUserDetailComponent();

      expect(comp.routeData()).toEqual({ role: 'admin' });
    });
  });
});
