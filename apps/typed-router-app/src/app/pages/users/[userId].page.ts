import { Component, signal } from '@angular/core';
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
    title: 'User Profile & Activity',
    section: 'accounts',
  },
};

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="user-heading">{{ routeData().title }}</h1>
      <p id="user-section">Section: {{ routeData().section }}</p>
      <p id="user-id-display">User ID: {{ params().userId }}</p>
      <p id="user-tab-display">
        Current Tab: {{ queryParams().tab ?? 'none' }}
      </p>

      <section>
        <h2>Switch Tab</h2>
        <a
          id="tab-info-link"
          [typedRouterLink]="{
            to: '/users/:userId',
            params: { userId: params().userId },
            queryParams: { tab: 'info' },
          }"
          >Info Tab</a
        >
        |
        <a
          id="tab-activity-link"
          [typedRouterLink]="{
            to: '/users/:userId',
            params: { userId: params().userId },
            queryParams: { tab: 'activity' },
          }"
          >Activity Tab</a
        >
      </section>

      <section>
        <h2>Parameter Difference Algebra: Navigate to Child Post</h2>
        <!-- Navigate to /users/:userId/posts/:postId where userId is inferred/inherited from current route context -->
        <button id="btn-to-post-101" (click)="goToChildPost('101')">
          Go to Post 101 (Only postId required)
        </button>
        <button id="btn-to-post-functional" (click)="goToChildPostFunctional()">
          Go to Post 202 (Functional Updater)
        </button>
      </section>

      <section>
        <h2>Nullable / Conditional Link Disabling</h2>
        <a
          id="link-conditional-post"
          [typedRouterLink]="
            canViewPost()
              ? {
                  to: '/users/:userId/posts/:postId',
                  params: { userId: params().userId, postId: '99' },
                }
              : null
          "
        >
          {{ canViewPost() ? 'View Post 99 (Active)' : 'Post 99 (Disabled)' }}
        </a>
        <button id="btn-toggle-permission" (click)="togglePermission()">
          Toggle Permission
        </button>
      </section>

      <section>
        <h2>Relative Navigation</h2>
        <a id="link-parent-users" typedRouterLink="..">Back to Users (..)</a> |
        <button id="btn-nav-parent" (click)="goUp()">
          Back via injectNavigate
        </button>
        <button id="btn-next-user" (click)="nextUser()">
          Next User (Functional Updater)
        </button>
      </section>
    </div>
  `,
})
export default class UserDetailPageComponent {
  readonly params = injectParams({ from: '/users/:userId' });
  readonly queryParams = injectQueryParams({ from: '/users/:userId' });
  readonly routeData = injectRouteData({ from: '/users/:userId' });
  private readonly navFromUser = injectNavigate({ from: '/users/:userId' });

  readonly canViewPost = signal(true);

  togglePermission() {
    this.canViewPost.update((v) => !v);
  }

  async goToChildPost(postId: string) {
    // Parameter Difference Algebra:
    // Navigating from '/users/:userId' to '/users/:userId/posts/:postId'
    // only requires `postId` because `userId` is in `TFrom`!
    await this.navFromUser({
      to: '/users/:userId/posts/:postId',
      params: { postId },
    });
  }

  async goToChildPostFunctional() {
    await this.navFromUser({
      to: '/users/:userId/posts/:postId',
      params: (prev) => ({
        postId: '202',
      }),
    });
  }

  async goUp() {
    await this.navFromUser({ to: '..' });
  }

  async nextUser() {
    const currentId = Number(this.params().userId || 1);
    await this.navFromUser({
      to: '/users/:userId',
      params: (prev) => ({ ...prev, userId: String(currentId + 1) }),
    });
  }
}
