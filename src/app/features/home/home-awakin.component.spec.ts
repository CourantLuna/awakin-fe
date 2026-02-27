import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeAwakinComponent } from './home-awakin.component';

describe('HomeAwakinComponent', () => {
  let component: HomeAwakinComponent;
  let fixture: ComponentFixture<HomeAwakinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeAwakinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeAwakinComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
