import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TypedRouterLink } from '@analogjs/router';

@Component({
  standalone: true,
  imports: [CommonModule, TypedRouterLink],
  template: `
    <div>
      <h1>Users List</h1>
      <ul id="users-list">
        @for (user of users; track user.id) {
          <li>
            <a
              [id]="'user-link-' + user.id"
              [typedRouterLink]="{
                to: '/users/:userId',
                params: { userId: user.id },
              }"
            >
              {{ user.name }}
            </a>
          </li>
        }
      </ul>
    </div>
  `,
})
export default class UsersPageComponent {
  readonly users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ];
}
