import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AthleteProfile, AthleteSearchResult, AthleteService } from '../../core/services/athlete.service';
import { AwakinFeedScope, KinAuthorSummary, KinService } from '../../core/services/kin.service';
import { ThemeService } from '../../core/services/theme.service';
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
    FormsModule,
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
  public themeService = inject(ThemeService);
  private router = inject(Router);

  public activeScope = signal<AwakinFeedScope>('all');
  public selectedWorkoutLog = signal<WorkoutLog | null>(null);
  public selectedWorkoutGender = signal<BodyMapGender | null>(null);
  public showWorkoutDetail = signal<boolean>(false);

  public isWorkoutEditModalOpen = signal<boolean>(false);
  public logToEdit = signal<WorkoutLog | null>(null);
  public isShareWorkoutModalOpen = signal<boolean>(false);
  public shareWorkoutTargetLog = signal<WorkoutLog | null>(null);

  // Búsqueda Global de Perfiles Públicos en Awakin
  public isSearchOpen = signal<boolean>(false);
  public searchQuery = signal<string>('');
  public searchResults = signal<AthleteSearchResult[]>([]);
  public isSearching = signal<boolean>(false);
  public togglingFollowId = signal<string | null>(null);
  private searchDebounceTimer: any = null;

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
      const activeKinId = this.themeService.activeKin()?.id;
      if (!aid) return;
      untracked(() => {
        this.kinService.loadAwakinFeed(aid, scope, activeKinId);
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
      this.kinService.loadAwakinFeed(aid, this.activeScope(), this.themeService.activeKin()?.id);
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

  public toggleSearch(): void {
    const next = !this.isSearchOpen();
    this.isSearchOpen.set(next);
    if (next) {
      this.executeSearch(this.searchQuery());
    }
  }

  public onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch(value);
    }, 250);
  }

  public executeSearch(query: string): void {
    this.isSearching.set(true);
    this.athleteService.searchAthletes(query, this.currentAthleteId()).subscribe({
      next: (list) => {
        this.searchResults.set(list || []);
        this.isSearching.set(false);
      },
      error: () => {
        this.isSearching.set(false);
      },
    });
  }

  public openPublicProfile(identifier?: string | null): void {
    if (!identifier) return;
    this.isSearchOpen.set(false);
    this.router.navigate(['/avatar', identifier]);
  }

  public toggleFollowFromSearch(target: AthleteSearchResult, event: Event): void {
    event.stopPropagation();
    const myId = this.currentAthleteId();
    if (!myId || myId === target.id || this.togglingFollowId()) return;

    this.togglingFollowId.set(target.id);
    const req = target.is_following
      ? this.athleteService.unfollowAthlete(myId, target.id)
      : this.athleteService.followAthlete(myId, target.id);

    req.subscribe({
      next: () => {
        this.searchResults.update((list) =>
          list.map((a) => (a.id === target.id ? { ...a, is_following: !a.is_following } : a))
        );
        this.togglingFollowId.set(null);
        if (this.activeScope() === 'following') {
          this.refreshFeed();
        }
      },
      error: () => {
        this.togglingFollowId.set(null);
      },
    });
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
