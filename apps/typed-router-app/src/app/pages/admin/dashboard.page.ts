import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectRouteData,
  injectNavigate,
  type RouteMeta,
} from '@analogjs/router';

export const routeMeta: RouteMeta = {
  data: {
    title: 'Admin Dashboard Overview',
    metricsEnabled: true,
  },
};

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <section>
      <h2 id="dashboard-heading">{{ routeData().title }}</h2>
      <p id="dashboard-metrics">
        Metrics Enabled: {{ routeData().metricsEnabled }}
      </p>

      <h3>Sibling & Parent Relative Navigation</h3>
      <a id="link-sibling-settings" typedRouterLink="../settings"
        >Settings (../settings)</a
      >
      |
      <a id="link-sibling-users" typedRouterLink="../users">Users (../users)</a>
      |
      <a id="link-parent-admin" typedRouterLink="..">Parent (..)</a>

      <div>
        <button id="btn-dash-to-settings" (click)="goToSettingsWithState()">
          Go to Settings with State & Fragment
        </button>
        <button id="btn-dash-up" (click)="goUp()">Back to Parent Layout</button>
      </div>
    </section>
  `,
})
export default class AdminDashboardPageComponent {
  readonly routeData = injectRouteData({ from: '/admin/dashboard' });
  private readonly nav = injectNavigate({ from: '/admin/dashboard' });

  async goToSettingsWithState() {
    await this.nav({
      to: '/admin/settings',
      state: { fromDashboard: true, timestamp: Date.now() },
      fragment: 'security',
      replaceUrl: false,
    });
  }

  async goUp() {
    await this.nav({ to: '..' });
  }
}
