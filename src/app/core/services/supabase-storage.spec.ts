import { TestBed } from '@angular/core/testing';

import { SupabaseStorage } from './supabase-storage';

describe('SupabaseStorage', () => {
  let service: SupabaseStorage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseStorage);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
