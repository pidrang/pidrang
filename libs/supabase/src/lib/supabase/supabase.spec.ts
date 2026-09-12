import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Supabase } from './supabase';

describe('Supabase', () => {
  let component: Supabase;
  let fixture: ComponentFixture<Supabase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Supabase],
    }).compileComponents();

    fixture = TestBed.createComponent(Supabase);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
