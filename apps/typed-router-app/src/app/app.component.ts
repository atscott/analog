import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLinkActive } from '@angular/router';
import { TypedRouterLink } from '@analogjs/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TypedRouterLink, RouterLinkActive],
  template: `
    <header class="app-header">
      <nav class="nav-bar">
        <a
          id="nav-home"
          typedRouterLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          ariaCurrentWhenActive="page"
          >Home</a
        >
        |
        <a
          id="nav-about"
          typedRouterLink="/about"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >About</a
        >
        |
        <a
          id="nav-users"
          typedRouterLink="/users"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Users</a
        >
        |
        <a
          id="nav-search"
          [typedRouterLink]="{
            to: '/search',
            queryParams: { q: 'analog', sort: 'relevance' },
          }"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Search</a
        >
        |
        <a
          id="nav-docs"
          [typedRouterLink]="{
            to: '/docs/**',
            params: { '**': 'getting-started' },
          }"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Docs</a
        >
        |
        <a
          id="nav-admin"
          typedRouterLink="/admin"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Admin</a
        >
        |
        <a
          id="nav-team-member"
          [typedRouterLink]="{
            to: '/orgs/:orgId/teams/:teamId/members/:memberId',
            params: { orgId: 'analogjs', teamId: 'core', memberId: '1' },
            queryParams: { view: 'expanded' },
          }"
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          >Core Member</a
        >
        |
        <!-- Testing nullable link disabling -->
        <a
          id="nav-conditional-about"
          [typedRouterLink]="linksEnabled() ? '/about' : null"
        >
          {{ linksEnabled() ? 'About (Enabled)' : 'About (Disabled via null)' }}
        </a>
        <button id="btn-toggle-nav-links" (click)="toggleLinks()">
          Toggle Nav Link State
        </button>
        |
        <!-- Testing button[typedRouterLink] -->
        <button id="btn-home-link" typedRouterLink="/">Home Button</button>
      </nav>
    </header>

    <main>
      <router-outlet></router-outlet>
    </main>
  `,
})
export class AppComponent {
  readonly linksEnabled = signal(true);

  toggleLinks() {
    this.linksEnabled.update((v) => !v);
  }
}
