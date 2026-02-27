import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutUserComponent } from './workout-user.component';

describe('WorkoutUserComponent', () => {
  let component: WorkoutUserComponent;
  let fixture: ComponentFixture<WorkoutUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutUserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutUserComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
