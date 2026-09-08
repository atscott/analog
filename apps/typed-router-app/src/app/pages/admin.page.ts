import { Component } from '@angular/core';
import { RouterOutlet, RouterLinkActive } from '@angular/router';
import {
  TypedRouterLink,
  injectRouteData,
  injectNavigate,
  type RouteMeta,
} from '@analogjs/router';

export const routeMeta: RouteMeta = {
  data: {
    section: 'admin-portal',
    title: 'Admin Console',
    requiresAuth: true,
  },
};

@Component({
  standalone: true,
  imports: [RouterOutlet, TypedRouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <header>
        <h1 id="admin-title">{{ routeData().title }}</h1>
        <span id="admin-section">Section: {{ routeData().section }}</span>
        <span id="admin-auth"
          >Auth Required: {{ routeData().requiresAuth }}</span
        >
      </header>

      <nav class="admin-nav">
        <!-- Relative child routes from /admin -->
        <a
          id="admin-link-dashboard"
          typedRouterLink="./dashboard"
          routerLinkActive="active-tab"
          [routerLinkActiveOptions]="{ exact: true }"
          >Dashboard</a
        >
        |
        <a
          id="admin-link-users"
          typedRouterLink="./users"
          routerLinkActive="active-tab"
          >Users</a
        >
        |
        <a
          id="admin-link-settings"
          typedRouterLink="./settings"
          routerLinkActive="active-tab"
          >Settings</a
        >
        |
        <!-- Relative navigation to parent / root -->
        <a id="admin-link-parent" typedRouterLink="..">Back to Home (..)</a>
      </nav>

      <div class="admin-actions">
        <button id="btn-admin-nav-settings" (click)="goToSettings()">
          Go to Settings via Scoped Navigator
        </button>
      </div>

      <main class="admin-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export default class AdminLayoutComponent {
  readonly routeData = injectRouteData({ from: '/admin' });
  private readonly navFromAdmin = injectNavigate({ from: '/admin' });

  async goToSettings() {
    await this.navFromAdmin({ to: './settings' });
  }
}
