import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectParams,
  injectQueryParams,
  injectRouteData,
  injectNavigate,
  type RouteMeta,
} from '@analogjs/router';

export const routeMeta: RouteMeta = {
  data: {
    role: 'core-engineer',
    level: 5,
  },
};

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="member-heading">Team Member Profile</h1>

      <section id="member-params">
        <h2>Path Parameters (Multi-Segment)</h2>
        <p id="param-org">Org: {{ params().orgId }}</p>
        <p id="param-team">Team: {{ params().teamId }}</p>
        <p id="param-member">Member: {{ params().memberId }}</p>
      </section>

      <section id="member-query">
        <h2>Query Parameters</h2>
        <p id="query-view">View Mode: {{ queryParams().view ?? 'default' }}</p>
        <p id="query-highlighted">
          Highlighted: {{ queryParams().highlighted ?? false }}
        </p>
      </section>

      <section id="member-data">
        <h2>Route Data</h2>
        <p id="data-role">Role: {{ routeData().role }}</p>
        <p id="data-level">Level: {{ routeData().level }}</p>
      </section>

      <section>
        <h2>Actions & Navigation</h2>
        <button id="btn-next-member" (click)="goToNextMember()">
          Next Member (Functional Updater)
        </button>
        <button id="btn-toggle-view" (click)="toggleViewMode()">
          Toggle View Mode
        </button>
        <button id="btn-nav-with-extras" (click)="navigateWithExtras()">
          Navigate With Extras (State + Fragment)
        </button>
      </section>

      <section>
        <h2>Relative Links</h2>
        <a id="link-member-parent" typedRouterLink="..">Back to Parent (..)</a>
        |
        <a id="link-home" typedRouterLink="/">Home (Static)</a>
      </section>
    </div>
  `,
})
export default class OrgTeamMemberPageComponent {
  readonly params = injectParams({
    from: '/orgs/:orgId/teams/:teamId/members/:memberId',
  });
  readonly queryParams = injectQueryParams({
    from: '/orgs/:orgId/teams/:teamId/members/:memberId',
  });
  readonly routeData = injectRouteData({
    from: '/orgs/:orgId/teams/:teamId/members/:memberId',
  });
  private readonly nav = injectNavigate({
    from: '/orgs/:orgId/teams/:teamId/members/:memberId',
  });

  async goToNextMember() {
    const currentMember = Number(this.params().memberId || 1);
    await this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: (prev) => ({
        ...prev,
        memberId: String(currentMember + 1),
      }),
    });
  }

  async toggleViewMode() {
    const nextView =
      this.queryParams().view === 'compact' ? 'expanded' : 'compact';
    await this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: {
        orgId: this.params().orgId,
        teamId: this.params().teamId,
        memberId: this.params().memberId,
      },
      queryParams: {
        view: nextView,
      },
      queryParamsHandling: 'merge',
    });
  }

  async navigateWithExtras() {
    await this.nav({
      to: '/orgs/:orgId/teams/:teamId/members/:memberId',
      params: {
        orgId: this.params().orgId,
        teamId: this.params().teamId,
        memberId: this.params().memberId,
      },
      queryParams: {
        highlighted: true,
      },
      fragment: 'overview',
      state: { source: 'member-directory', accessedAt: Date.now() },
      replaceUrl: true,
    });
  }
}
