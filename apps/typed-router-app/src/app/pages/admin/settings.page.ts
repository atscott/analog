import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectRouteData,
  injectNavigate,
  type RouteMeta,
} from '@analogjs/router';

export const routeMeta: RouteMeta = {
  data: {
    requiresAdmin: true,
    role: 'superadmin',
  },
};

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <section>
      <h2>Admin Settings</h2>
      <p id="settings-requires-admin">
        Requires Admin: {{ routeData().requiresAdmin }}
      </p>
      <p id="settings-role">Required Role: {{ routeData().role }}</p>

      <div>
        <a id="link-settings-to-dash" typedRouterLink="../dashboard"
          >Back to Dashboard</a
        >
        |
        <a id="link-settings-up" typedRouterLink="..">Back to Admin Layout</a>
      </div>

      <div style="margin-top: 1rem;">
        <button id="btn-settings-back-dash" (click)="goBackToDashboard()">
          Go to Dashboard via Scoped Navigate
        </button>
      </div>
    </section>
  `,
})
export default class AdminSettingsPageComponent {
  readonly routeData = injectRouteData({ from: '/admin/settings' });
  private readonly nav = injectNavigate({ from: '/admin/settings' });

  async goBackToDashboard() {
    await this.nav({ to: '/admin/dashboard' });
  }
}
