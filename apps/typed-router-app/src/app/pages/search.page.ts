import { Component } from '@angular/core';
import {
  TypedRouterLink,
  injectQueryParams,
  injectNavigate,
} from '@analogjs/router';

@Component({
  standalone: true,
  imports: [TypedRouterLink],
  template: `
    <div>
      <h1 id="search-title">Search Page</h1>

      <div id="search-current-params">
        <p id="search-query">Query: {{ queryParams().q ?? 'none' }}</p>
        <p id="search-page">Page: {{ queryParams().page ?? 1 }}</p>
        <p id="search-sort">Sort: {{ queryParams().sort ?? 'default' }}</p>
        <p id="search-in-stock">
          In Stock Only: {{ queryParams().inStock ?? false }}
        </p>
        <p id="search-categories">
          Categories: {{ queryParams().categories?.join(', ') ?? 'none' }}
        </p>
      </div>

      <section>
        <h2>Functional Query Parameter Updaters</h2>
        <button id="btn-next-page" (click)="nextPage()">
          Next Page (page + 1)
        </button>
        <button id="btn-toggle-sort" (click)="toggleSort()">
          Toggle Sort (relevance / asc)
        </button>
        <button id="btn-toggle-stock" (click)="toggleInStock()">
          Toggle In Stock
        </button>
        <button id="btn-merge-categories" (click)="addCategory()">
          Add Category (merge)
        </button>
      </section>

      <section>
        <h2>Declarative Typed Links with Query Params</h2>
        <a
          id="link-search-popular"
          [typedRouterLink]="{
            to: '/search',
            queryParams: {
              q: 'angular',
              page: 1,
              sort: 'relevance',
              inStock: true,
              categories: ['frontend', 'tools'],
            },
          }"
        >
          Search Popular Angular Tools
        </a>
        |
        <a
          id="link-search-sorted"
          [typedRouterLink]="{
            to: '/search',
            queryParams: { q: 'analog', sort: 'desc' },
          }"
        >
          Search Analog (Sort Desc)
        </a>
      </section>
    </div>
  `,
})
export default class SearchPageComponent {
  private readonly nav = injectNavigate({ from: '/search' });
  readonly queryParams = injectQueryParams({ from: '/search' });

  async nextPage() {
    const currentPage = Number(this.queryParams().page ?? 1);
    await this.nav({
      to: '/search',
      queryParams: (prev) => ({
        ...prev,
        page: currentPage + 1,
      }),
    });
  }

  async toggleSort() {
    const currentSort = this.queryParams().sort;
    const nextSort = currentSort === 'asc' ? 'desc' : 'asc';
    await this.nav({
      to: '/search',
      queryParams: (prev) => ({
        ...prev,
        sort: nextSort,
      }),
    });
  }

  async toggleInStock() {
    const currentInStock = this.queryParams().inStock ?? false;
    await this.nav({
      to: '/search',
      queryParams: (prev) => ({
        ...prev,
        inStock: !currentInStock,
      }),
    });
  }

  async addCategory() {
    const current = this.queryParams().categories ?? [];
    await this.nav({
      to: '/search',
      queryParams: {
        categories: [...current, 'new-category'],
      },
      queryParamsHandling: 'merge',
    });
  }
}
