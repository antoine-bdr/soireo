import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterModalComponent } from './filter-modal.component';

describe('FilterModalPage', () => {
  let component: FilterModalComponent;
  let fixture: ComponentFixture<FilterModalComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FilterModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
