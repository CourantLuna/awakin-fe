import { Component, OnInit, signal, computed, inject, effect, untracked, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { WeekCalendarHeaderComponent } from '../../components/week-calendar/week-calendar-header.component';
import { AthleteService } from '../../core/services/athlete.service';
import { AuthService } from '../../core/services/auth.service';
import { WorkoutSupabaseService } from './services/workout-supabase.service';
import { ActiveWorkoutSessionService } from './services/active-workout-session.service';
import { ExerciseApiService } from './services/exercise-api.service';
import { ExerciseSummary } from './models/exercises.models';
import {
  ActiveSessionExercise,
  WEEK_DAY_LABELS,
  WorkoutLog,
  WorkoutPlanRoutine,
  WorkoutRoutine
} from './models/workout.models';
import { ExerciseGalleryDrawerComponent } from './components/exercise-gallery-drawer/exercise-gallery-drawer.component';
import { CustomExerciseModalComponent } from './components/custom-exercise-modal/custom-exercise-modal.component';

@Component({
  selector: 'app-workout-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimeNGModule,
    ChartModule,
    SelectModule,
    DrawerModule,
    DialogModule,
    WeekCalendarHeaderComponent,
    ExerciseGalleryDrawerComponent,
    CustomExerciseModalComponent
  ],
  templateUrl: './workout-user.component.html'
})
export class WorkoutUserComponent implements OnInit {
  @ViewChild(WeekCalendarHeaderComponent) calendar!: WeekCalendarHeaderComponent;

  public athleteService = inject(AthleteService);
  public authService = inject(AuthService);
  public workoutService = inject(WorkoutSupabaseService);
  public activeSession = inject(ActiveWorkoutSessionService);
  private exerciseApi = inject(ExerciseApiService);

  readonly weekDayLabels = WEEK_DAY_LABELS;
  readonly weekDays = [1, 2, 3, 4, 5, 6, 7];

  // Estado del calendario
  currentLabel = signal<string>('Hoy');
  selectedDate = signal<Date>(new Date());

  // Drawers y modales
  isExerciseGalleryOpen = signal<boolean>(false);
  isWeeklyPlanDrawerOpen = signal<boolean>(false);
  isHistoryDrawerOpen = signal<boolean>(false);
  isCreateRoutineModalOpen = signal<boolean>(false);
  isCustomExForBuilderOpen = signal<boolean>(false);

  // Override manual de rutina (cuando el usuario elige otra rutina diferente a la del día)
  selectedRoutineOverrideId = signal<string | null>(null);

  // Builder de nueva rutina
  newRoutineName = signal<string>('');
  newRoutineDescription = signal<string>('');
  newRoutineDay = signal<number | null>(null);
  newRoutineExercises = signal<ActiveSessionExercise[]>([]);
  builderSearchQuery = signal<string>('');
  builderSearchResults = signal<ExerciseSummary[]>([]);
  isSearchingBuilder = signal<boolean>(false);
  isSavingRoutine = signal<boolean>(false);
  private builderSearchTimer: any = null;

  // Atleta activo
  currentAthleteId = computed(() => {
    return (
      this.athleteService.currentAthlete()?.id ||
      this.authService.currentSession()?.avatar?.id ||
      localStorage.getItem('awakin_active_athlete_id') ||
      ''
    );
  });

  streak = computed(() => this.athleteService.currentAthlete()?.streak_days ?? 0);

  // Datos reactivos desde WorkoutSupabaseService
  activePlan = this.workoutService.activePlan;
  availableRoutines = this.workoutService.allRoutines;
  workoutLogs = this.workoutService.workoutLogs;
  isLoadingWorkouts = this.workoutService.isLoading;

  // Día de la semana (1 = Lunes .. 7 = Domingo) de la fecha seleccionada en el calendario
  selectedDayOfWeek = computed(() => {
    const jsDay = this.selectedDate().getDay(); // 0=Dom, 1=Lun .. 6=Sab
    return jsDay === 0 ? 7 : jsDay;
  });

  // Mapa día (1..7) -> WorkoutPlanRoutine del plan activo
  weeklyScheduleMap = computed(() => {
    const map = new Map<number, WorkoutPlanRoutine>();
    const plan = this.activePlan();
    if (plan?.plan_routines) {
      for (const link of plan.plan_routines) {
        if (!map.has(link.day_of_week)) {
          map.set(link.day_of_week, link);
        }
      }
    }
    return map;
  });

  // Rutina asignada por el calendario para el día seleccionado
  scheduledRoutineForDay = computed<WorkoutRoutine | null>(() => {
    const link = this.weeklyScheduleMap().get(this.selectedDayOfWeek());
    return link?.routine || null;
  });

  // Rutina activa mostrada en la Hero Card (override manual si existe, sino la del día)
  activeDisplayedRoutine = computed<WorkoutRoutine | null>(() => {
    const overrideId = this.selectedRoutineOverrideId();
    if (overrideId) {
      const found = this.availableRoutines().find((r) => r.id === overrideId);
      if (found) return found;
    }
    return this.scheduledRoutineForDay();
  });

  // ID enlazado al dropdown p-select
  selectedRoutineId = computed(() => this.activeDisplayedRoutine()?.id || null);

  // Log de entrenamiento registrado en la fecha seleccionada
  logForSelectedDate = computed<WorkoutLog | null>(() => {
    const sel = this.selectedDate();
    const ymd = `${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}-${String(sel.getDate()).padStart(2, '0')}`;
    return (
      this.workoutLogs().find((log) => {
        const d = new Date(log.workout_date);
        const logYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return logYmd === ymd;
      }) || null
    );
  });

  // Radar Chart dinámico de Carga Muscular Semanal (últimos 7 días de workout_logs)
  radarData = computed(() => {
    const logs = this.workoutLogs();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const buckets: Record<string, number> = {
      Pecho: 0,
      Espalda: 0,
      Piernas: 0,
      Hombros: 0,
      Brazos: 0,
      Core: 0
    };

    for (const log of logs) {
      if (new Date(log.workout_date).getTime() < sevenDaysAgo) continue;
      const byMuscle = log.sets_by_muscle || {};
      for (const [rawMuscle, sets] of Object.entries(byMuscle)) {
        const m = rawMuscle.toLowerCase();
        const val = Number(sets || 0);
        if (m.includes('pec') || m.includes('chest') || m.includes('pecho')) buckets['Pecho'] += val;
        else if (m.includes('lat') || m.includes('back') || m.includes('espalda') || m.includes('trap') || m.includes('rhomb')) buckets['Espalda'] += val;
        else if (m.includes('glute') || m.includes('quad') || m.includes('ham') || m.includes('calv') || m.includes('pierna') || m.includes('cuádriceps') || m.includes('glúteo')) buckets['Piernas'] += val;
        else if (m.includes('delt') || m.includes('shoulder') || m.includes('hombro')) buckets['Hombros'] += val;
        else if (m.includes('bicep') || m.includes('tricep') || m.includes('forearm') || m.includes('brazo')) buckets['Brazos'] += val;
        else if (m.includes('core') || m.includes('ab') || m.includes('waist')) buckets['Core'] += val;
      }
    }

    const values = Object.values(buckets);
    const hasAnyData = values.some((v) => v > 0);
    const colorSun = '#FE970A';
    const colorSunLight = 'rgba(254, 151, 10, 0.22)';

    return {
      labels: Object.keys(buckets),
      datasets: [
        {
          label: 'Series (últimos 7 días)',
          backgroundColor: colorSunLight,
          borderColor: colorSun,
          pointBackgroundColor: colorSun,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: colorSun,
          data: hasAnyData ? values : [0, 0, 0, 0, 0, 0]
        }
      ]
    };
  });

  radarOptions = {
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        grid: { color: '#e7e5e4' },
        pointLabels: {
          color: '#57534e',
          font: { family: 'ui-sans-serif', size: 10, weight: 'bold' }
        },
        ticks: { display: false }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  constructor() {
    effect(() => {
      const athleteId = this.currentAthleteId();
      if (!athleteId) return;
      untracked(() => {
        this.workoutService.loadAthleteWorkoutData(athleteId);
      });
    });
  }

  ngOnInit(): void {
    const athleteId = this.currentAthleteId();
    if (athleteId) {
      this.workoutService.loadAthleteWorkoutData(athleteId);
    }
  }

  // Navegación del calendario
  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    // Al cambiar de día en el calendario, volver a la rutina asignada a ese día
    this.selectedRoutineOverrideId.set(null);
  }

  updateLabel(label: string): void {
    this.currentLabel.set(label);
  }

  handleTopBtnAction(): void {
    this.calendar.goToToday();
  }

  toggleCalendarViewMode(): void {
    this.calendar.toggleViewMode();
  }

  // Cambiar rutina manualmente desde el dropdown o desde el Plan Semanal
  onRoutineChange(newId: string): void {
    this.selectedRoutineOverrideId.set(newId);
  }

  selectPlanDayRoutine(dayNumber: number): void {
    const link = this.weeklyScheduleMap().get(dayNumber);
    if (link?.routine) {
      this.selectedRoutineOverrideId.set(link.routine.id);
    }
  }

  // Iniciar sesión de entrenamiento
  startWorkout(routine?: WorkoutRoutine | null): void {
    const target = routine !== undefined ? routine : this.activeDisplayedRoutine();
    if (this.activeSession.hasActiveSession() && target && this.activeSession.routineId() === target.id) {
      this.activeSession.reopenDrawer();
      return;
    }
    this.activeSession.startSession({
      athleteId: this.currentAthleteId(),
      planId: this.activePlan()?.id || null,
      routine: target,
      workoutDate: this.selectedDate()
    });
  }

  startFreeWorkout(): void {
    if (this.activeSession.hasActiveSession() && !this.activeSession.routineId()) {
      this.activeSession.reopenDrawer();
      return;
    }
    this.activeSession.startSession({
      athleteId: this.currentAthleteId(),
      planId: this.activePlan()?.id || null,
      routine: null,
      workoutDate: this.selectedDate()
    });
  }

  openExerciseGallery(): void {
    this.isExerciseGalleryOpen.set(true);
  }

  // ==========================================
  // BUILDER DE NUEVA RUTINA
  // ==========================================
  openCreateRoutineModal(): void {
    this.newRoutineName.set('');
    this.newRoutineDescription.set('');
    this.newRoutineDay.set(this.selectedDayOfWeek());
    this.newRoutineExercises.set([]);
    this.isCreateRoutineModalOpen.set(true);
    if (this.builderSearchResults().length === 0) {
      this.searchBuilderExercises();
    }
  }

  onBuilderSearchInput(): void {
    if (this.builderSearchTimer) clearTimeout(this.builderSearchTimer);
    this.builderSearchTimer = setTimeout(() => this.searchBuilderExercises(), 300);
  }

  searchBuilderExercises(): void {
    this.isSearchingBuilder.set(true);
    this.exerciseApi.searchExercises({
      search: this.builderSearchQuery().trim() || undefined,
      limit: 12
    }).subscribe({
      next: (res) => {
        this.builderSearchResults.set(res.data || []);
        this.isSearchingBuilder.set(false);
      },
      error: () => {
        this.isSearchingBuilder.set(false);
      }
    });
  }

  async addBuilderLibraryExercise(item: ExerciseSummary): Promise<void> {
    const detail = await this.workoutService.getCachedExerciseDetail(item.id);
    const ex: ActiveSessionExercise = {
      tempId: `b_${item.id}_${Date.now()}`,
      exercise_api_id: item.id,
      is_custom: false,
      exercise_name: detail?.name || item.name,
      target_muscle: detail?.target || item.target,
      secondary_muscles: detail?.secondary_muscles || item.secondary_muscles || [],
      equipment: detail?.equipment || item.equipment,
      image_url: this.exerciseApi.getMediaUrl(detail?.image || item.image),
      media_urls: [],
      rest_seconds: 90,
      notes: null,
      sets: [
        { set_number: 1, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 2, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 3, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false }
      ]
    };
    this.newRoutineExercises.update((list) => [...list, ex]);
  }

  onBuilderCustomExerciseCreated(ex: ActiveSessionExercise): void {
    this.newRoutineExercises.update((list) => [...list, ex]);
  }

  removeBuilderExercise(idx: number): void {
    this.newRoutineExercises.update((list) => list.filter((_, i) => i !== idx));
  }

  async saveNewRoutine(): Promise<void> {
    const athleteId = this.currentAthleteId();
    if (!athleteId || !this.newRoutineName().trim() || this.newRoutineExercises().length === 0 || this.isSavingRoutine()) {
      return;
    }

    this.isSavingRoutine.set(true);
    try {
      const created = await this.workoutService.createRoutine({
        athleteId,
        name: this.newRoutineName(),
        description: this.newRoutineDescription(),
        planId: this.activePlan()?.id || null,
        dayOfWeek: this.newRoutineDay(),
        exercises: this.newRoutineExercises().map((ex) => ({
          exercise_api_id: ex.exercise_api_id,
          is_custom: ex.is_custom,
          exercise_name: ex.exercise_name,
          target_muscle: ex.target_muscle,
          secondary_muscles: ex.secondary_muscles,
          equipment: ex.equipment,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            set_type: s.set_type,
            target_reps: s.target_reps,
            weight_unit: s.weight_unit
          }))
        }))
      });
      this.selectedRoutineOverrideId.set(created.id);
      this.isCreateRoutineModalOpen.set(false);
    } catch (e) {
      console.error('Error creando rutina:', e);
    } finally {
      this.isSavingRoutine.set(false);
    }
  }

  formatLogDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  }

  getMuscleEntries(setsByMuscle: Record<string, number> | undefined): Array<{ muscle: string; sets: number }> {
    if (!setsByMuscle) return [];
    return Object.entries(setsByMuscle).map(([muscle, sets]) => ({ muscle, sets }));
  }
}
