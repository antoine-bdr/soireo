import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FriendSearchPage } from './friend-search.page';

describe('FriendSearchPage', () => {
  let component: FriendSearchPage;
  let fixture: ComponentFixture<FriendSearchPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FriendSearchPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
