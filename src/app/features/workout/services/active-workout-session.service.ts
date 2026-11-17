import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { ExerciseApiService } from './exercise-api.service';
import { WorkoutSupabaseService } from './workout-supabase.service';
import { ExerciseSummary } from '../models/exercises.models';
import {
  ActiveSessionExercise,
  ActiveSessionSet,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutSetType
} from '../models/workout.models';

interface PersistedWorkoutSession {
  athleteId: string;
  planId: string | null;
  routineId: string | null;
  routineName: string;
  routineDescription: string | null;
  bannerUrl?: string | null;
  workoutDateIso: string;
  startedAtMs: number;
  restEndAtMs: number | null;
  restTotalSeconds: number;
  volumeUnit: 'lb' | 'kg';
  exercises: ActiveSessionExercise[];
}

const STORAGE_KEY = 'awakin_active_workout_session';

@Injectable({ providedIn: 'root' })
export class ActiveWorkoutSessionService {
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly workoutService = inject(WorkoutSupabaseService);

  // Estado global de la sesión
  public hasActiveSession = signal<boolean>(false);
  public isDrawerOpen = signal<boolean>(false);

  public athleteId = signal<string>('');
  public planId = signal<string | null>(null);
  public routineId = signal<string | null>(null);
  public sessionName = signal<string>('Entrenamiento');
  public sessionDescription = signal<string | null>(null);
  public bannerUrl = signal<string | null>(null);
  public workoutDate = signal<Date>(new Date());
  public startedAtMs = signal<number>(Date.now());
  public volumeUnit = signal<'lb' | 'kg'>('lb');
  public sessionExercises = signal<ActiveSessionExercise[]>([]);

  // Timers en vivo
  public elapsedSeconds = signal<number>(0);
  public restRemaining = signal<number>(0);
  public restTotal = signal<number>(90);
  private restEndAtMs = signal<number | null>(null);
  private tickerInterval: any = null;

  constructor() {
    this.restoreFromStorage();

    // Persistir automáticamente cada cambio mientras exista sesión activa
    effect(() => {
      if (!this.hasActiveSession()) return;
      const snapshot: PersistedWorkoutSession = {
        athleteId: this.athleteId(),
        planId: this.planId(),
        routineId: this.routineId(),
        routineName: this.sessionName(),
        routineDescription: this.sessionDescription(),
        bannerUrl: this.bannerUrl(),
        workoutDateIso: this.workoutDate().toISOString(),
        startedAtMs: this.startedAtMs(),
        restEndAtMs: this.restEndAtMs(),
        restTotalSeconds: this.restTotal(),
        volumeUnit: this.volumeUnit(),
        exercises: this.sessionExercises()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (e) {
        console.warn('No se pudo persistir sesión en localStorage:', e);
      }
    });
  }

  // Métricas en vivo
  public completedSetsCount = computed(() =>
    this.sessionExercises().reduce((acc, ex) => acc + ex.sets.filter((s) => s.is_completed).length, 0)
  );

  public totalSetsCount = computed(() =>
    this.sessionExercises().reduce((acc, ex) => acc + ex.sets.length, 0)
  );

  public liveTotalVolume = computed(() => {
    const unit = this.volumeUnit();
    let total = 0;
    for (const ex of this.sessionExercises()) {
      for (const s of ex.sets) {
        if (!s.is_completed) continue;
        const w = Number(s.weight_used || 0);
        const r = Number(s.reps_completed || 0);
        const weightInUnit = s.weight_unit === unit ? w : unit === 'kg' ? w * 0.453592 : w * 2.20462;
        total += weightInUnit * r;
      }
    }
    return Math.round(total);
  });

  public liveSetsByMuscle = computed(() => {
    const map: Record<string, number> = {};
    for (const ex of this.sessionExercises()) {
      const count = ex.sets.filter((s) => s.is_completed).length;
      if (count > 0) {
        const key = (ex.target_muscle || 'general').toLowerCase().trim();
        map[key] = (map[key] || 0) + count;
      }
    }
    return Object.entries(map).map(([muscle, sets]) => ({ muscle, sets }));
  });

  public formattedElapsed = computed(() => {
    const sec = this.elapsedSeconds();
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  });

  public formattedRest = computed(() => {
    const sec = this.restRemaining();
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  });

  /**
   * Inicia una nueva sesión o reabre la existente si el usuario ya tenía una abierta
   */
  public startSession(params: {
    athleteId: string;
    planId?: string | null;
    routine?: WorkoutRoutine | null;
    workoutDate?: Date;
  }): void {
    // Si ya hay una sesión activa, simplemente reabrir el drawer sin borrar progreso
    if (this.hasActiveSession()) {
      this.isDrawerOpen.set(true);
      return;
    }

    const r = params.routine || null;
    this.athleteId.set(params.athleteId);
    this.planId.set(params.planId || null);
    this.routineId.set(r?.id || null);
    this.workoutDate.set(params.workoutDate || new Date());
    this.startedAtMs.set(Date.now());
    this.restEndAtMs.set(null);
    this.restRemaining.set(0);
    this.elapsedSeconds.set(0);

    if (r) {
      this.sessionName.set(r.name);
      this.sessionDescription.set(r.description || null);
      this.bannerUrl.set(r.banner_url || null);

      const mapped: ActiveSessionExercise[] = r.exercises.map((ex, idx) => {
        const detail = ex.apiDetail;
        const sets: ActiveSessionSet[] = (ex.sets && ex.sets.length > 0
          ? ex.sets
          : [{ id: '', routine_exercise_id: ex.id, set_number: 1, set_type: 'WORKING' as WorkoutSetType, target_reps: '10', weight_unit: 'lb' as const }]
        ).map((s) => {
          const parsedReps = parseInt(String(s.target_reps || '10').split('-')[0], 10) || 10;
          return {
            set_number: s.set_number,
            set_type: s.set_type || 'WORKING',
            target_reps: s.target_reps || '10',
            reps_completed: parsedReps,
            weight_used: Number(s.target_weight || 0),
            weight_unit: s.weight_unit || 'lb',
            is_completed: false
          };
        });

        return {
          tempId: ex.id || `ex_${idx}`,
          exercise_api_id: ex.exercise_api_id || null,
          is_custom: ex.is_custom,
          exercise_name: ex.exercise_name || detail?.name || `Ejercicio ${ex.exercise_api_id || idx + 1}`,
          target_muscle: ex.target_muscle || detail?.target || 'general',
          secondary_muscles: ex.secondary_muscles?.length ? ex.secondary_muscles : (detail?.secondary_muscles || []),
          equipment: ex.equipment || detail?.equipment || 'body weight',
          image_url: detail?.image ? this.exerciseApi.getMediaUrl(detail.image) : undefined,
          gif_url: detail?.gif_url ? this.exerciseApi.getMediaUrl(detail.gif_url) : undefined,
          instruction_steps: detail?.instruction_steps || (detail?.instruction ? [detail.instruction] : []),
          media_urls: ex.media_urls || [],
          rest_seconds: ex.rest_seconds || 90,
          notes: ex.notes || null,
          sets
        };
      });

      this.sessionExercises.set(mapped);
    } else {
      this.sessionName.set('Entrenamiento Libre');
      this.sessionDescription.set('Sesión personalizada sin plantilla');
      this.bannerUrl.set(null);
      this.sessionExercises.set([]);
    }

    this.hasActiveSession.set(true);
    this.isDrawerOpen.set(true);
    this.startTicker();
  }

  public minimizeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  public reopenDrawer(): void {
    if (this.hasActiveSession()) {
      this.isDrawerOpen.set(true);
    }
  }

  /**
   * Única vía explícita para descartar/cancelar la sesión activa sin guardar
   */
  public cancelSession(): void {
    this.clearSessionState();
  }

  /**
   * Guarda el entrenamiento en Supabase y cierra la sesión activa
   */
  public async finishAndSaveSession(params: {
    durationMinutes: number;
    location?: string | null;
    notes?: string | null;
    photoFile?: File | null;
  }): Promise<WorkoutLog> {
    const saved = await this.workoutService.saveWorkoutLog({
      athleteId: this.athleteId(),
      planId: this.planId(),
      routineId: this.routineId(),
      routineName: this.sessionName(),
      routineDescription: this.sessionDescription(),
      workoutDate: this.workoutDate(),
      durationMinutes: params.durationMinutes,
      location: params.location,
      notes: params.notes,
      photoFile: params.photoFile,
      volumeUnit: this.volumeUnit(),
      exercises: this.sessionExercises()
    });

    this.clearSessionState();
    return saved;
  }

  // Gestión de series y ejercicios
  public toggleSetCompleted(exIndex: number, setIndex: number): void {
    this.sessionExercises.update((list) =>
      list.map((ex, i) => {
        if (i !== exIndex) return ex;
        const sets = ex.sets.map((s, j) => {
          if (j !== setIndex) return s;
          const nextCompleted = !s.is_completed;
          if (nextCompleted) {
            this.startRestTimer(ex.rest_seconds || 90);
          }
          return { ...s, is_completed: nextCompleted };
        });
        return { ...ex, sets };
      })
    );
  }

  public addSet(exIndex: number): void {
    this.sessionExercises.update((list) =>
      list.map((ex, i) => {
        if (i !== exIndex) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: ActiveSessionSet = {
          set_number: ex.sets.length + 1,
          set_type: 'WORKING',
          target_reps: lastSet?.target_reps || '10',
          reps_completed: lastSet?.reps_completed ?? 10,
          weight_used: lastSet?.weight_used ?? 0,
          weight_unit: lastSet?.weight_unit || this.volumeUnit(),
          is_completed: false
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  }

  public removeSet(exIndex: number, setIndex: number): void {
    this.sessionExercises.update((list) =>
      list.map((ex, i) => {
        if (i !== exIndex || ex.sets.length <= 1) return ex;
        const filtered = ex.sets
          .filter((_, j) => j !== setIndex)
          .map((s, idx) => ({ ...s, set_number: idx + 1 }));
        return { ...ex, sets: filtered };
      })
    );
  }

  public removeExercise(exIndex: number): void {
    this.sessionExercises.update((list) => list.filter((_, i) => i !== exIndex));
  }

  public addExercise(ex: ActiveSessionExercise): void {
    this.sessionExercises.update((list) => [...list, ex]);
  }

  public touchExercises(): void {
    this.sessionExercises.update((list) => [...list]);
  }

  public async addLibraryExercise(summary: ExerciseSummary): Promise<void> {
    const detail = await this.workoutService.getCachedExerciseDetail(summary.id);
    const ex: ActiveSessionExercise = {
      tempId: `lib_${summary.id}_${Date.now()}`,
      exercise_api_id: summary.id,
      is_custom: false,
      exercise_name: detail?.name || summary.name,
      target_muscle: detail?.target || summary.target,
      secondary_muscles: detail?.secondary_muscles || summary.secondary_muscles || [],
      equipment: detail?.equipment || summary.equipment,
      image_url: this.exerciseApi.getMediaUrl(detail?.image || summary.image),
      gif_url: this.exerciseApi.getMediaUrl(detail?.gif_url || summary.gif_url),
      instruction_steps: detail?.instruction_steps || (detail?.instruction ? [detail.instruction] : []),
      media_urls: [],
      rest_seconds: 90,
      notes: null,
      sets: [
        { set_number: 1, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: this.volumeUnit(), is_completed: false },
        { set_number: 2, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: this.volumeUnit(), is_completed: false },
        { set_number: 3, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: this.volumeUnit(), is_completed: false }
      ]
    };
    this.addExercise(ex);
  }

  // Control de descanso
  public startRestTimer(seconds: number): void {
    if (seconds <= 0) return;
    this.restTotal.set(seconds);
    this.restEndAtMs.set(Date.now() + seconds * 1000);
    this.restRemaining.set(seconds);
  }

  public adjustRest(deltaSeconds: number): void {
    const currentEnd = this.restEndAtMs();
    if (!currentEnd) return;
    const nextEnd = currentEnd + deltaSeconds * 1000;
    if (nextEnd <= Date.now()) {
      this.skipRest();
    } else {
      this.restEndAtMs.set(nextEnd);
      this.restRemaining.set(Math.ceil((nextEnd - Date.now()) / 1000));
    }
  }

  public skipRest(): void {
    this.restEndAtMs.set(null);
    this.restRemaining.set(0);
  }

  private startTicker(): void {
    this.stopTicker();
    this.updateTimers();
    this.tickerInterval = setInterval(() => this.updateTimers(), 1000);
  }

  private stopTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  private updateTimers(): void {
    const now = Date.now();
    this.elapsedSeconds.set(Math.max(0, Math.floor((now - this.startedAtMs()) / 1000)));

    const restEnd = this.restEndAtMs();
    if (restEnd) {
      const rem = Math.ceil((restEnd - now) / 1000);
      if (rem <= 0) {
        this.restEndAtMs.set(null);
        this.restRemaining.set(0);
      } else {
        this.restRemaining.set(rem);
      }
    }
  }

  private restoreFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedWorkoutSession;
      if (!parsed || !parsed.athleteId || !parsed.startedAtMs) return;

      this.athleteId.set(parsed.athleteId);
      this.planId.set(parsed.planId || null);
      this.routineId.set(parsed.routineId || null);
      this.sessionName.set(parsed.routineName || 'Entrenamiento');
      this.sessionDescription.set(parsed.routineDescription || null);
      this.bannerUrl.set(parsed.bannerUrl || null);
      this.workoutDate.set(parsed.workoutDateIso ? new Date(parsed.workoutDateIso) : new Date());
      this.startedAtMs.set(parsed.startedAtMs);
      this.restEndAtMs.set(parsed.restEndAtMs || null);
      this.restTotal.set(parsed.restTotalSeconds || 90);
      this.volumeUnit.set(parsed.volumeUnit || 'lb');
      this.sessionExercises.set(parsed.exercises || []);

      this.hasActiveSession.set(true);
      this.isDrawerOpen.set(false); // Al recargar app, aparece minimizada encima del navbar bottom
      this.startTicker();
    } catch (e) {
      console.warn('Error restaurando sesión activa:', e);
    }
  }

  private clearSessionState(): void {
    this.stopTicker();
    this.hasActiveSession.set(false);
    this.isDrawerOpen.set(false);
    this.sessionName.set('Entrenamiento');
    this.sessionDescription.set(null);
    this.bannerUrl.set(null);
    this.sessionExercises.set([]);
    this.restEndAtMs.set(null);
    this.restRemaining.set(0);
    this.elapsedSeconds.set(0);
    localStorage.removeItem(STORAGE_KEY);
  }
}
