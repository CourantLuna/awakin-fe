import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabase.service';
import { AthleteService } from './athlete.service';
import { WorkoutSupabaseService } from '../../features/workout/services/workout-supabase.service';

/**
 * Normaliza cualquier fecha a string 'YYYY-MM-DD' en hora local
 */
export function formatToDateKey(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula la racha de días consecutivos activos
 * Regla:
 * - Si hoy hay actividad: streak = 1 + días consecutivos hacia atrás.
 * - Si hoy no hay actividad, pero ayer sí: la racha de ayer se mantiene viva (en curso).
 * - Si ni hoy ni ayer hay actividad: racha = 0.
 */
export function calculateConsecutiveStreak(activeDates: Set<string>, refDate: Date = new Date()): number {
  if (!activeDates || activeDates.size === 0) return 0;

  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  const todayKey = formatToDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatToDateKey(yesterday);

  let currentCursor: Date;
  let streak = 0;

  if (activeDates.has(todayKey)) {
    streak = 1;
    currentCursor = new Date(yesterday);
  } else if (activeDates.has(yesterdayKey)) {
    streak = 1;
    currentCursor = new Date(yesterday);
    currentCursor.setDate(currentCursor.getDate() - 1);
  } else {
    return 0;
  }

  while (true) {
    const cursorKey = formatToDateKey(currentCursor);
    if (activeDates.has(cursorKey)) {
      streak++;
      currentCursor.setDate(currentCursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

@Injectable({ providedIn: 'root' })
export class StreakService {
  private supabase: SupabaseClient = supabaseClient;
  private athleteService = inject(AthleteService);
  private workoutService = inject(WorkoutSupabaseService);

  // Set reactivo de fechas con actividad real (YYYY-MM-DD)
  public activeDates = signal<Set<string>>(new Set());

  // Racha calculada en días consecutivos
  public currentStreak = computed(() => {
    return calculateConsecutiveStreak(this.activeDates());
  });

  // Saber si hoy ya se cumplió el ritual
  public isTodayCompleted = computed(() => {
    const todayKey = formatToDateKey(new Date());
    return this.activeDates().has(todayKey);
  });

  private lastLoadedAthleteId: string | null = null;

  constructor() {
    // Sincronizar reactivamente cuando cambie el atleta activo
    effect(() => {
      const athlete = this.athleteService.currentAthlete();
      if (athlete?.id && athlete.id !== this.lastLoadedAthleteId) {
        this.lastLoadedAthleteId = athlete.id;
        this.loadAllActivityDates(athlete.id, athlete.email || undefined);
      }
    });

    // Reaccionar a cambios en workoutLogs
    effect(() => {
      const logs = this.workoutService.workoutLogs();
      if (logs && logs.length > 0) {
        this.mergeDates(logs.map((l) => l.workout_date));
      }
    });

    // Reaccionar a cambios en comidas registradas
    effect(() => {
      const records = this.athleteService.currentRecords();
      if (records?.meals && records.meals.length > 0) {
        this.mergeDates(records.meals.map((m) => m.timestamp));
      }
    });

    // Mantener sincronizado streak_days en athleteService
    effect(() => {
      const streak = this.currentStreak();
      const ath = this.athleteService.currentAthlete();
      if (ath && ath.streak_days !== streak) {
        this.athleteService.currentAthlete.update((a) => (a ? { ...a, streak_days: streak } : a));
      }
    });
  }

  /**
   * Carga directa desde Supabase de todas las fechas activas de entrenamiento y nutrición
   */
  public async loadAllActivityDates(athleteId: string, email?: string): Promise<void> {
    if (!athleteId) return;

    const dates = new Set<string>(this.activeDates());

    try {
      // 1. Fechas de entrenamientos
      const { data: wLogs } = await this.supabase
        .from('workout_logs')
        .select('workout_date')
        .eq('athlete_id', athleteId);

      if (wLogs) {
        for (const row of wLogs) {
          const key = formatToDateKey(row.workout_date);
          if (key) dates.add(key);
        }
      }

      // 2. Fechas de comidas registradas
      if (email) {
        const { data: meals } = await this.supabase
          .from('registros_nutricionales_pruebas')
          .select('timestamp')
          .eq('email', email);

        if (meals) {
          for (const m of meals) {
            const key = formatToDateKey(m.timestamp);
            if (key) dates.add(key);
          }
        }
      }

      this.activeDates.set(dates);

      // Si la racha difiere de Supabase athletes, actualizarla en background
      const streak = calculateConsecutiveStreak(dates);
      if (streak !== this.athleteService.currentAthlete()?.streak_days) {
        this.supabase
          .from('athletes')
          .update({ streak_days: streak })
          .eq('id', athleteId)
          .then();
      }
    } catch (err) {
      console.warn('Error cargando fechas de actividad para racha:', err);
    }
  }

  /**
   * Agrega inmediatamente una fecha activa (ej: al registrar un entreno o una comida)
   */
  public addActiveDate(date: Date | string): void {
    const key = formatToDateKey(date);
    if (!key) return;
    this.activeDates.update((set) => {
      const next = new Set(set);
      next.add(key);
      return next;
    });
  }

  private mergeDates(rawDates: (string | Date | undefined)[]): void {
    const current = this.activeDates();
    let hasNew = false;
    const next = new Set(current);

    for (const d of rawDates) {
      if (!d) continue;
      const key = formatToDateKey(d);
      if (key && !next.has(key)) {
        next.add(key);
        hasNew = true;
      }
    }

    if (hasNew) {
      this.activeDates.set(next);
    }
  }
}
