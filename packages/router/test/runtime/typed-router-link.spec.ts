/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLinkActive } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypedRouterLink } from '../../src/lib/facade/router-link';

@Component({
  standalone: true,
  template: '<div id="about-page">About Page</div>',
})
class AboutComponent {}

@Component({
  standalone: true,
  template: '<div id="user-page">User Page</div>',
})
class UserComponent {}

@Component({
  standalone: true,
  template: '<div id="post-page">Post Page</div>',
})
class PostComponent {}

@Component({
  standalone: true,
  imports: [TypedRouterLink, RouterLinkActive],
  template: `
    <a id="static-link" typedRouterLink="/about">About</a>
    <a
      id="composite-link"
      [typedRouterLink]="{
        to: '/users/:userId',
        params: { userId: '123' },
      }"
      >User</a
    >
    <a
      id="post-link"
      [typedRouterLink]="{ to: '/posts/:slug', params: { slug: 'my-post' } }"
      >Post</a
    >
    <a
      id="separate-link"
      [typedRouterLink]="'/users/:userId'"
      [params]="{ userId: '456' }"
      >User 456</a
    >
    <a id="disabled-link" [typedRouterLink]="null">Disabled</a>
    <button id="button-link" typedRouterLink="/about">Button Link</button>

    <!-- Active State Testing with standard Angular RouterLinkActive -->
    <a
      id="active-link"
      typedRouterLink="/about"
      routerLinkActive="active-nav"
      ariaCurrentWhenActive="page"
      [routerLinkActiveOptions]="{ exact: true }"
      #rla="routerLinkActive"
      >Active About</a
    >

    <!-- Angular standard input parity -->
    <a id="fragment-link" typedRouterLink="/about" fragment="my-section"
      >Section Link</a
    >
    <a id="replace-url-link" typedRouterLink="/about" [replaceUrl]="true"
      >Replace Link</a
    >
  `,
})
class TestHostComponent {}

describe('TypedRouterLink Runtime Behavior', () => {
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([
          { path: 'about', component: AboutComponent },
          { path: 'users/:userId', component: UserComponent },
          { path: 'posts/:slug', component: PostComponent },
        ]),
      ],
    });

    router = TestBed.inject(Router);
  });

  it('renders correct href on anchor elements', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const staticLink = fixture.debugElement.query(
      By.css('#static-link'),
    ).nativeElement;
    expect(staticLink.getAttribute('href')).toBe('/about');

    const compositeLink = fixture.debugElement.query(
      By.css('#composite-link'),
    ).nativeElement;
    expect(compositeLink.getAttribute('href')).toBe('/users/123');

    const postLink = fixture.debugElement.query(
      By.css('#post-link'),
    ).nativeElement;
    expect(postLink.getAttribute('href')).toBe('/posts/my-post');

    const separateLink = fixture.debugElement.query(
      By.css('#separate-link'),
    ).nativeElement;
    expect(separateLink.getAttribute('href')).toBe('/users/456');
  });

  it('suppresses href and click action when typedRouterLink is null or undefined', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    const disabledLink = fixture.debugElement.query(By.css('#disabled-link'));

    expect(disabledLink.nativeElement.getAttribute('href')).toBeNull();

    disabledLink.nativeElement.click();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('updates href reactively when inputs change', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const compositeEl = fixture.debugElement.query(By.css('#composite-link'));
    const dir = compositeEl.injector.get(TypedRouterLink);

    dir.typedRouterLink = { to: '/users/:userId', params: { userId: '999' } };
    fixture.detectChanges();

    expect(compositeEl.nativeElement.getAttribute('href')).toBe('/users/999');
  });

  it('manages active class and aria-current with standard Angular RouterLinkActive', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const activeEl = fixture.debugElement.query(
      By.css('#active-link'),
    ).nativeElement;

    // Initially router is at '/', not '/about'
    expect(activeEl.classList.contains('active-nav')).toBe(false);
    expect(activeEl.getAttribute('aria-current')).toBeNull();

    // Navigate to '/about'
    await router.navigateByUrl('/about');
    fixture.detectChanges();

    expect(activeEl.classList.contains('active-nav')).toBe(true);
    expect(activeEl.getAttribute('aria-current')).toBe('page');
  });
});
