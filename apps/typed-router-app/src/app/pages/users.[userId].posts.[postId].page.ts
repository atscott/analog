import { Component } from '@angular/core';
import { TypedRouterLink, injectParams } from '@analogjs/router';

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="post-title">User Post</h1>
      <p id="post-user-id">User: {{ params().userId }}</p>
      <p id="post-id">Post: {{ params().postId }}</p>

      <a
        id="link-back-user"
        [typedRouterLink]="{
          to: '/users/:userId',
          params: { userId: params().userId },
        }"
      >
        Back to User {{ params().userId }}
      </a>
    </div>
  `,
})
export default class UserPostPageComponent {
  readonly params = injectParams({ from: '/users/:userId/posts/:postId' });
}
