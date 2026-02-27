import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KinCommunityComponent } from './kin-community.component';

describe('KinCommunityComponent', () => {
  let component: KinCommunityComponent;
  let fixture: ComponentFixture<KinCommunityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KinCommunityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KinCommunityComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
