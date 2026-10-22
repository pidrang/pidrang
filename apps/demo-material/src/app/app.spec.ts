import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { AppLayout } from './layout/app-layout';

describe('App', () => {
  it('creates the app', async () => {
    TestBed.overrideComponent(App, {
      remove: { imports: [AppLayout] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });
});
