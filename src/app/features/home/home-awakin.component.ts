import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AthleteProfile, AthleteService } from '../../core/services/athlete.service';
import { AwakinFeedScope, KinAuthorSummary, KinService } from '../../core/services/kin.service';
import { WorkoutLog } from '../workout/models/workout.models';
import { WorkoutLogCardComponent } from '../workout/components/workout-log-card/workout-log-card.component';
import { WorkoutLogDetailModalComponent } from '../workout/components/workout-log-detail-modal/workout-log-detail-modal.component';
import { WorkoutLogEditModalComponent } from '../workout/components/workout-log-edit-modal/workout-log-edit-modal.component';
import { WorkoutStoryModalComponent } from '../workout/components/workout-story-modal/workout-story-modal.component';
import { BodyMapGender } from '../workout/components/body-map/body-map.component';

@Component({
  selector: 'app-home-awakin.component',
  standalone: true,
  imports: [
    CommonModule,
    WorkoutLogCardComponent,
    WorkoutLogDetailModalComponent,
    WorkoutLogEditModalComponent,
    WorkoutStoryModalComponent,
  ],
  templateUrl: './home-awakin.component.html',
  styleUrl: './home-awakin.component.css',
})
export class HomeAwakinComponent {
  public athleteService = inject(AthleteService);
  public kinService = inject(KinService);

  public activeScope = signal<AwakinFeedScope>('all');
  public selectedWorkoutLog = signal<WorkoutLog | null>(null);
  public selectedWorkoutGender = signal<BodyMapGender | null>(null);
  public showWorkoutDetail = signal<boolean>(false);

  public isWorkoutEditModalOpen = signal<boolean>(false);
  public logToEdit = signal<WorkoutLog | null>(null);
  public isShareWorkoutModalOpen = signal<boolean>(false);
  public shareWorkoutTargetLog = signal<WorkoutLog | null>(null);

  public currentAthleteId = computed(() => this.athleteService.currentAthlete()?.id || '');
  public currentAthleteGender = computed<BodyMapGender>(() => {
    const a = this.athleteService.currentAthlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    return raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino' ? 'female' : 'male';
  });
  public feedItems = computed(() => this.kinService.awakinFeedItems());

  constructor() {
    effect(() => {
      const aid = this.currentAthleteId();
      const scope = this.activeScope();
      if (!aid) return;
      untracked(() => {
        this.kinService.loadAwakinFeed(aid, scope);
      });
    });
  }

  public setScope(scope: AwakinFeedScope): void {
    if (this.activeScope() === scope) return;
    this.activeScope.set(scope);
  }

  public refreshFeed(): void {
    const aid = this.currentAthleteId();
    if (aid) {
      this.kinService.loadAwakinFeed(aid, this.activeScope());
    }
  }

  public openWorkoutDetail(log: WorkoutLog, author?: KinAuthorSummary): void {
    const raw = (author?.gender || author?.sexo || author?.genero || '').toLowerCase().trim();
    const gender: BodyMapGender =
      raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino' ? 'female' : 'male';
    this.selectedWorkoutLog.set(log);
    this.selectedWorkoutGender.set(gender);
    this.showWorkoutDetail.set(true);
  }

  public openWorkoutEditModal(log: WorkoutLog): void {
    this.showWorkoutDetail.set(false);
    this.logToEdit.set(log);
    this.isWorkoutEditModalOpen.set(true);
  }

  public onWorkoutLogSaved(): void {
    this.isWorkoutEditModalOpen.set(false);
    this.logToEdit.set(null);
    this.refreshFeed();
  }

  public openWorkoutStoryModal(log: WorkoutLog): void {
    this.shareWorkoutTargetLog.set(log);
    this.isShareWorkoutModalOpen.set(true);
  }

  public toAthleteProfile(author?: KinAuthorSummary): AthleteProfile | null {
    if (!author) return null;
    return {
      id: author.id,
      email: '',
      username: author.username,
      first_name: author.first_name || undefined,
      last_name: author.last_name || undefined,
      profile_image_url: author.profile_image_url || undefined,
      gender: author.gender || undefined,
      sexo: author.sexo || undefined,
      genero: author.genero || undefined,
      current_level: 1,
      streak_days: 0,
      roles: ['athlete'],
    };
  }
}
