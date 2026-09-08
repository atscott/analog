import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TypedRouterLink } from '@analogjs/router';

@Component({
  standalone: true,
  imports: [CommonModule, TypedRouterLink],
  template: `
    <section>
      <h2>Admin User Management</h2>
      <ul id="admin-user-list">
        @for (u of adminUsers; track u.id) {
          <li>
            <span>{{ u.name }} (Role: {{ u.role }})</span>
            |
            <!-- Link to deep multi-parameter dynamic route -->
            <a
              [id]="'link-team-member-' + u.id"
              [typedRouterLink]="{
                to: '/orgs/:orgId/teams/:teamId/members/:memberId',
                params: { orgId: 'analogjs', teamId: 'core', memberId: u.id },
                queryParams: { view: 'expanded', highlighted: true },
              }"
            >
              Org Member Profile
            </a>
            |
            <!-- Link to user detail route -->
            <a
              [id]="'link-user-detail-' + u.id"
              [typedRouterLink]="{
                to: '/users/:userId',
                params: { userId: u.id },
                queryParams: { tab: 'activity' },
              }"
            >
              User Detail
            </a>
          </li>
        }
      </ul>

      <p>
        <a id="link-back-dash" typedRouterLink="../dashboard"
          >Back to Dashboard</a
        >
      </p>
    </section>
  `,
})
export default class AdminUsersPageComponent {
  readonly adminUsers = [
    { id: '1', name: 'Alice Admin', role: 'admin' },
    { id: '2', name: 'Bob Maintainer', role: 'maintainer' },
  ];
}
