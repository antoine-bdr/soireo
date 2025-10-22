import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { EmailVerificationBannerComponent } from './email-verification-banner.component';

describe('EmailVerificationBannerComponent', () => {
  let component: EmailVerificationBannerComponent;
  let fixture: ComponentFixture<EmailVerificationBannerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [EmailVerificationBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmailVerificationBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
