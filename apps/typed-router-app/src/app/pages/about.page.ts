import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectNavigate,
  injectRouteData,
  type RouteMeta,
} from '@analogjs/router';

export const routeMeta: RouteMeta = {
  data: {
    title: 'About Analog Typed Router',
    section: 'overview',
  },
};

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="about-title">{{ routeData().title }}</h1>
      <p id="about-section">Section: {{ routeData().section }}</p>
      <p id="about-content">
        This is a static route in the typed router test app demonstrating typed
        route data and navigation.
      </p>

      <section>
        <h2>Relative & Static Links</h2>
        <a id="link-back-relative" typedRouterLink="../">Back (Relative)</a> |
        <a id="link-home-static" typedRouterLink="/">Home (Static)</a> |
        <a id="link-admin-static" typedRouterLink="/admin">Admin Layout</a>
      </section>

      <section>
        <h2>Programmatic Navigation with Extras</h2>
        <button id="btn-back-home" (click)="goHome()">
          Back to Home with Fragment
        </button>
      </section>
    </div>
  `,
})
export default class AboutPageComponent {
  readonly routeData = injectRouteData({ from: '/about' });
  private readonly nav = injectNavigate({ from: '/about' });

  async goHome() {
    await this.nav({
      to: '/',
      replaceUrl: true,
      fragment: 'top',
      state: { fromAbout: true },
    });
  }
}
