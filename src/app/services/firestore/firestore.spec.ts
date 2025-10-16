import { TestBed } from '@angular/core/testing';

import { Firestore } from './firestore';

describe('Firestore', () => {
  let service: Firestore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Firestore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
