import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectParams,
  injectNavigate,
} from '@analogjs/router';

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="docs-title">Documentation</h1>
      <p id="docs-slug">Path: {{ params().slug }}</p>
      <p id="docs-splat">Wildcard splat: {{ params()['**'] }}</p>

      <section>
        <h2>Navigate to Sub-Guides</h2>
        <a
          id="link-doc-install"
          [typedRouterLink]="{
            to: '/docs/**',
            params: { '**': 'getting-started/installation' },
          }"
        >
          Installation Guide
        </a>
        |
        <a
          id="link-doc-routing"
          [typedRouterLink]="{
            to: '/docs/**',
            params: { '**': 'concepts/type-safe-routing' },
          }"
        >
          Routing Concepts Guide
        </a>
      </section>

      <section>
        <h2>Actions</h2>
        <button id="btn-next-doc" (click)="goToNextDoc()">
          Next Guide via Scoped Navigator
        </button>
        |
        <a id="link-home-from-docs" typedRouterLink="/">Back to Home</a>
      </section>
    </div>
  `,
})
export default class DocsPageComponent {
  readonly params = injectParams({ from: '/docs/**' });
  private readonly nav = injectNavigate({ from: '/docs/**' });

  async goToNextDoc() {
    await this.nav({
      to: '/docs/**',
      params: { '**': 'advanced/fine-grained-routing' },
    });
  }
}
