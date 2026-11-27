import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { supabaseClient } from '../../../core/services/supabase.service';
import { compressImage } from '../../../core/helpers/image-compressor.helper';
import { environment } from '../../../../environments/environment';
import { ExerciseApiService } from './exercise-api.service';
import { ExerciseDetail } from '../models/exercises.models';
import {
  WorkoutPlan,
  WorkoutPlanRoutine,
  WorkoutRoutine,
  WorkoutRoutineExercise,
  WorkoutRoutineSet,
  WorkoutLog,
  ActiveSessionExercise,
  WorkoutSetType
} from '../models/workout.models';

export interface SaveWorkoutLogInput {
  athleteId: string;
  planId?: string | null;
  routineId?: string | null;
  routineName: string;
  routineDescription?: string | null;
  workoutDate: Date;
  durationMinutes: number;
  location?: string | null;
  notes?: string | null;
  photoFile?: File | null;
  volumeUnit: 'lb' | 'kg';
  exercises: ActiveSessionExercise[];
}

export interface UpdateWorkoutLogInput {
  logId: string;
  athleteId: string;
  routineName: string;
  routineDescription?: string | null;
  workoutDate: Date | string;
  durationMinutes: number;
  location?: string | null;
  notes?: string | null;
  volumeUnit?: 'lb' | 'kg';
  exercises: Array<{
    exercise_api_id?: string | null;
    is_custom?: boolean;
    exercise_name: string;
    target_muscle?: string | null;
    secondary_muscles?: string[];
    equipment?: string | null;
    media_urls?: string[];
    rest_seconds?: number;
    notes?: string | null;
    sets: Array<{
      set_number: number;
      set_type: WorkoutSetType;
      reps_completed: number;
      weight_used: number;
      weight_unit: 'lb' | 'kg';
      is_completed: boolean;
      rpe?: number | null;
    }>;
  }>;
}

export interface CreateRoutineInput {
  athleteId: string;
  name: string;
  description?: string | null;
  bannerFile?: File | null;
  planId?: string | null;
  dayOfWeek?: number | null;
  exercises: Array<{
    exercise_api_id?: string | null;
    is_custom: boolean;
    exercise_name?: string | null;
    target_muscle?: string | null;
    secondary_muscles: string[];
    equipment?: string | null;
    rest_seconds: number;
    notes?: string | null;
    sets: Array<{
      set_number: number;
      set_type: WorkoutSetType;
      target_reps: string;
      target_weight?: number | null;
      weight_unit: 'lb' | 'kg';
    }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class WorkoutSupabaseService {
  private readonly http = inject(HttpClient);
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly supabase = supabaseClient;
  private readonly exerciseCache = new Map<string, ExerciseDetail>();

  // Estado reactivo del módulo Workout
  public activePlan = signal<WorkoutPlan | null>(null);
  public allRoutines = signal<WorkoutRoutine[]>([]);
  public workoutLogs = signal<WorkoutLog[]>([]);
  public isLoading = signal<boolean>(false);
  public lastLoadedAthleteId = signal<string | null>(null);

  /**
   * Carga planes asignados, rutinas propias e historial de entrenamientos desde Supabase
   */
  public async loadAthleteWorkoutData(athleteId: string, force = false): Promise<void> {
    if (!athleteId) return;
    if (!force && this.lastLoadedAthleteId() === athleteId && this.allRoutines().length > 0) {
      return;
    }

    this.isLoading.set(true);
    try {
      // 1. Buscar planes asignados al atleta
      const { data: planLinks, error: planLinkErr } = await this.supabase
        .from('workout_plan_athletes')
        .select('plan_id')
        .eq('athlete_id', athleteId)
        .eq('is_active', true);

      if (planLinkErr) {
        console.warn('Error cargando planes del atleta:', planLinkErr.message);
      }

      const planIds = (planLinks || []).map((l: any) => l.plan_id).filter(Boolean);
      let loadedPlan: WorkoutPlan | null = null;
      const planRoutinesMap = new Map<string, WorkoutRoutine>();

      if (planIds.length > 0) {
        const { data: plansData } = await this.supabase
          .from('workout_plans')
          .select(`
            *,
            workout_plan_routines (
              id,
              plan_id,
              routine_id,
              day_of_week,
              sort_order,
              workout_routines (
                *,
                workout_routine_exercises (
                  *,
                  workout_routine_sets (*)
                )
              )
            )
          `)
          .in('id', planIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (plansData && plansData.length > 0) {
          const rawPlan = plansData[0];
          const rawLinks: any[] = rawPlan.workout_plan_routines || [];

          const parsedLinks: WorkoutPlanRoutine[] = rawLinks
            .map((link: any) => {
              const rawRoutine = link.workout_routines;
              const parsedRoutine = rawRoutine
                ? this.normalizeRoutine(rawRoutine, link.day_of_week)
                : undefined;
              if (parsedRoutine) {
                planRoutinesMap.set(parsedRoutine.id, parsedRoutine);
              }
              return {
                id: link.id,
                plan_id: link.plan_id,
                routine_id: link.routine_id,
                day_of_week: link.day_of_week,
                sort_order: link.sort_order ?? 1,
                routine: parsedRoutine
              };
            })
            .sort((a, b) => a.day_of_week - b.day_of_week || a.sort_order - b.sort_order);

          loadedPlan = {
            id: rawPlan.id,
            name: rawPlan.name,
            description: rawPlan.description,
            banner_url: rawPlan.banner_url || null,
            start_date: rawPlan.start_date,
            end_date: rawPlan.end_date,
            created_by: rawPlan.created_by,
            kin_id: rawPlan.kin_id,
            is_active: rawPlan.is_active,
            plan_routines: parsedLinks
          };
        }
      }

      // 2. Cargar también rutinas creadas por el atleta que quizá no estén en el plan
      const { data: ownRoutinesData } = await this.supabase
        .from('workout_routines')
        .select(`
          *,
          workout_routine_exercises (
            *,
            workout_routine_sets (*)
          )
        `)
        .eq('created_by', athleteId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      for (const rawR of ownRoutinesData || []) {
        if (!planRoutinesMap.has(rawR.id)) {
          planRoutinesMap.set(rawR.id, this.normalizeRoutine(rawR, null));
        }
      }

      const routinesList = Array.from(planRoutinesMap.values());

      // 3. Resolver detalles reales desde Exercise API para todos los exercise_api_id
      await this.hydrateRoutinesWithApiDetails(routinesList);

      // Recalcular metadata derivada (músculos foco, duración estimada) tras hidratar API
      routinesList.forEach((r) => this.computeRoutineDerivedMeta(r));

      this.activePlan.set(loadedPlan);
      this.allRoutines.set(routinesList);

      // 4. Cargar historial de entrenamientos (workout_logs)
      await this.loadWorkoutLogs(athleteId);
      this.lastLoadedAthleteId.set(athleteId);
    } catch (err) {
      console.error('Error cargando datos de entrenamiento:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async loadWorkoutLogs(athleteId: string): Promise<void> {
    if (!athleteId) return;
    try {
      const { data, error } = await this.supabase
        .from('workout_logs')
        .select(`
          *,
          workout_log_exercises (
            *,
            workout_log_sets (*)
          )
        `)
        .eq('athlete_id', athleteId)
        .order('workout_date', { ascending: false })
        .limit(40);

      if (error) {
        console.warn('Error cargando workout_logs:', error.message);
        return;
      }

      const normalized: WorkoutLog[] = (data || []).map((log: any) => ({
        ...log,
        sets_by_muscle: log.sets_by_muscle || {},
        exercises: (log.workout_log_exercises || [])
          .map((ex: any) => ({
            ...ex,
            sets: (ex.workout_log_sets || []).sort((a: any, b: any) => a.set_number - b.set_number)
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
      }));

      await this.enrichWorkoutLogsMedia(normalized);

      this.workoutLogs.set(normalized);
    } catch (e) {
      console.warn('Error en loadWorkoutLogs:', e);
    }
  }

  /**
   * Guarda una sesión completada en workout_logs + workout_log_exercises + workout_log_sets
   */
  public async saveWorkoutLog(input: SaveWorkoutLogInput): Promise<WorkoutLog> {
    let photoUrl: string | null = null;
    if (input.photoFile) {
      photoUrl = await this.uploadWorkoutPhoto(input.photoFile, input.athleteId);
    }

    let totalVolume = 0;
    let totalSets = 0;
    const setsByMuscle: Record<string, number> = {};

    for (const ex of input.exercises) {
      const completedSets = ex.sets.filter((s) => s.is_completed);
      if (completedSets.length === 0) continue;

      totalSets += completedSets.length;
      const muscleKey = (ex.target_muscle || 'general').toLowerCase().trim();
      setsByMuscle[muscleKey] = (setsByMuscle[muscleKey] || 0) + completedSets.length;

      for (const s of completedSets) {
        const w = Number(s.weight_used || 0);
        const r = Number(s.reps_completed || 0);
        // Convertir a volumeUnit si difiere
        const weightInUnit =
          s.weight_unit === input.volumeUnit
            ? w
            : input.volumeUnit === 'kg'
              ? w * 0.453592
              : w * 2.20462;
        totalVolume += weightInUnit * r;
      }
    }

    const { data: logRow, error: logErr } = await this.supabase
      .from('workout_logs')
      .insert({
        athlete_id: input.athleteId,
        plan_id: input.planId || null,
        routine_id: input.routineId || null,
        routine_name: input.routineName,
        routine_description: input.routineDescription || null,
        workout_date: input.workoutDate.toISOString(),
        duration_minutes: Math.max(1, Math.round(input.durationMinutes)),
        location: input.location?.trim() || null,
        photo_url: photoUrl,
        total_volume: Math.round(totalVolume * 100) / 100,
        volume_unit: input.volumeUnit,
        total_sets: totalSets,
        sets_by_muscle: setsByMuscle,
        notes: input.notes?.trim() || null
      })
      .select()
      .single();

    if (logErr || !logRow) {
      throw new Error(logErr?.message || 'No se pudo guardar el registro de entrenamiento.');
    }

    // Insertar ejercicios y series ejecutadas
    for (let idx = 0; idx < input.exercises.length; idx++) {
      const ex = input.exercises[idx];
      const { data: exRow, error: exErr } = await this.supabase
        .from('workout_log_exercises')
        .insert({
          log_id: logRow.id,
          exercise_api_id: ex.is_custom ? null : ex.exercise_api_id || null,
          is_custom: ex.is_custom,
          exercise_name: ex.exercise_name,
          target_muscle: ex.target_muscle || null,
          secondary_muscles: ex.secondary_muscles || [],
          equipment: ex.equipment || null,
          media_urls: ex.media_urls || [],
          rest_seconds: ex.rest_seconds,
          notes: ex.notes || null,
          sort_order: idx + 1
        })
        .select()
        .single();

      if (exErr || !exRow) continue;

      if (ex.sets.length > 0) {
        const setsPayload = ex.sets.map((s) => ({
          log_exercise_id: exRow.id,
          set_number: s.set_number,
          set_type: s.set_type,
          reps_completed: Math.max(0, Math.round(Number(s.reps_completed || 0))),
          weight_used: Math.max(0, Number(s.weight_used || 0)),
          weight_unit: s.weight_unit,
          is_completed: s.is_completed
        }));

        await this.supabase.from('workout_log_sets').insert(setsPayload);
      }
    }

    await this.loadWorkoutLogs(input.athleteId);
    const createdLog = this.workoutLogs().find((l) => l.id === logRow.id);
    return createdLog || (logRow as WorkoutLog);
  }

  /**
   * Actualiza un entrenamiento existente en workout_logs + workout_log_exercises + workout_log_sets
   * Conserva intacta la imagen/banner original del coach y el nombre de la rutina si viene fijado
   */
  public async updateWorkoutLog(input: UpdateWorkoutLogInput): Promise<WorkoutLog> {
    const volUnit = input.volumeUnit || 'lb';
    let totalVolume = 0;
    let totalSets = 0;
    const setsByMuscle: Record<string, number> = {};

    for (const ex of input.exercises) {
      const completedSets = (ex.sets || []).filter((s) => s.is_completed !== false);
      if (completedSets.length === 0) continue;

      totalSets += completedSets.length;
      const muscleKey = (ex.target_muscle || 'general').toLowerCase().trim();
      setsByMuscle[muscleKey] = (setsByMuscle[muscleKey] || 0) + completedSets.length;

      for (const s of completedSets) {
        const w = Number(s.weight_used || 0);
        const r = Number(s.reps_completed || 0);
        const weightInUnit =
          s.weight_unit === volUnit
            ? w
            : volUnit === 'kg'
              ? w * 0.453592
              : w * 2.20462;
        totalVolume += weightInUnit * r;
      }
    }

    const isoDate = typeof input.workoutDate === 'string'
      ? (input.workoutDate.includes('T') ? input.workoutDate : new Date(input.workoutDate + 'T12:00:00Z').toISOString())
      : input.workoutDate.toISOString();

    const { data: logRow, error: logErr } = await this.supabase
      .from('workout_logs')
      .update({
        routine_name: input.routineName,
        routine_description: input.routineDescription || null,
        workout_date: isoDate,
        duration_minutes: Math.max(1, Math.round(input.durationMinutes)),
        location: input.location?.trim() || null,
        total_volume: Math.round(totalVolume * 100) / 100,
        volume_unit: volUnit,
        total_sets: totalSets,
        sets_by_muscle: setsByMuscle,
        notes: input.notes?.trim() || null
      })
      .eq('id', input.logId)
      .select()
      .single();

    if (logErr || !logRow) {
      throw new Error(logErr?.message || 'No se pudo actualizar el registro de entrenamiento.');
    }

    // Limpiar ejercicios y series previos de este log para reemplazarlos limpiamente
    const { data: existingExs } = await this.supabase
      .from('workout_log_exercises')
      .select('id')
      .eq('log_id', input.logId);

    if (existingExs && existingExs.length > 0) {
      const exIds = existingExs.map((e: any) => e.id);
      await this.supabase.from('workout_log_sets').delete().in('log_exercise_id', exIds);
      await this.supabase.from('workout_log_exercises').delete().eq('log_id', input.logId);
    }

    // Insertar ejercicios y series actualizados
    for (let idx = 0; idx < input.exercises.length; idx++) {
      const ex = input.exercises[idx];
      const { data: exRow, error: exErr } = await this.supabase
        .from('workout_log_exercises')
        .insert({
          log_id: input.logId,
          exercise_api_id: ex.exercise_api_id || null,
          is_custom: ex.is_custom ?? true,
          exercise_name: ex.exercise_name,
          target_muscle: ex.target_muscle || null,
          secondary_muscles: ex.secondary_muscles || [],
          equipment: ex.equipment || null,
          media_urls: ex.media_urls || [],
          rest_seconds: ex.rest_seconds || 90,
          notes: ex.notes || null,
          sort_order: idx + 1
        })
        .select()
        .single();

      if (exErr || !exRow) {
        console.error('Error insertando workout_log_exercise:', exErr);
        continue;
      }

      if (ex.sets && ex.sets.length > 0) {
        const setsPayload = ex.sets.map((s, sIdx) => ({
          log_exercise_id: exRow.id,
          set_number: s.set_number || sIdx + 1,
          set_type: s.set_type || 'WORKING',
          reps_completed: Math.max(0, Math.round(Number(s.reps_completed || 0))),
          weight_used: Math.max(0, Number(s.weight_used || 0)),
          weight_unit: s.weight_unit || volUnit,
          is_completed: s.is_completed !== false,
          rpe: s.rpe || null
        }));

        const { error: setsErr } = await this.supabase.from('workout_log_sets').insert(setsPayload);
        if (setsErr) {
          console.error('Error insertando workout_log_sets:', setsErr);
        }
      }
    }

    // Recargar la lista global de workout logs del atleta
    await this.loadWorkoutLogs(input.athleteId);

    // Obtener y devolver el registro completo con workout_log_exercises y workout_log_sets
    const { data: fullLogRow, error: fetchErr } = await this.supabase
      .from('workout_logs')
      .select(`
        *,
        workout_log_exercises (
          *,
          workout_log_sets (*)
        )
      `)
      .eq('id', input.logId)
      .single();

    if (!fetchErr && fullLogRow) {
      const normalizedLog: WorkoutLog = {
        ...fullLogRow,
        sets_by_muscle: fullLogRow.sets_by_muscle || {},
        exercises: (fullLogRow.workout_log_exercises || [])
          .map((e: any) => ({
            ...e,
            sets: (e.workout_log_sets || []).sort((a: any, b: any) => a.set_number - b.set_number)
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
      };

      await this.enrichWorkoutLogsMedia([normalizedLog]);

      // Sincronizar en el signal workoutLogs
      this.workoutLogs.update((logs) =>
        logs.map((l) => (l.id === normalizedLog.id ? normalizedLog : l))
      );

      return normalizedLog;
    }

    const reloaded = this.workoutLogs().find((l) => l.id === input.logId);
    return reloaded || (logRow as WorkoutLog);
  }

  /**
   * Crea una nueva rutina en Supabase (soporta ejercicios del API y ejercicios personalizados)
   */
  public async createRoutine(input: CreateRoutineInput): Promise<WorkoutRoutine> {
    let bannerUrl: string | null = null;
    if (input.bannerFile) {
      bannerUrl = await this.uploadRoutineBanner(input.bannerFile, input.athleteId);
    }

    const { data: routineRow, error: rErr } = await this.supabase
      .from('workout_routines')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        banner_url: bannerUrl,
        created_by: input.athleteId,
        is_active: true
      })
      .select()
      .single();

    if (rErr || !routineRow) {
      throw new Error(rErr?.message || 'No se pudo crear la rutina.');
    }

    for (let i = 0; i < input.exercises.length; i++) {
      const ex = input.exercises[i];
      const { data: exRow, error: exErr } = await this.supabase
        .from('workout_routine_exercises')
        .insert({
          routine_id: routineRow.id,
          exercise_api_id: ex.is_custom ? null : ex.exercise_api_id || null,
          is_custom: ex.is_custom,
          exercise_name: ex.is_custom ? ex.exercise_name : null,
          target_muscle: ex.is_custom ? ex.target_muscle : null,
          secondary_muscles: ex.is_custom ? ex.secondary_muscles : [],
          equipment: ex.is_custom ? ex.equipment : null,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes || null,
          sort_order: i + 1
        })
        .select()
        .single();

      if (exErr || !exRow) continue;

      if (ex.sets.length > 0) {
        await this.supabase.from('workout_routine_sets').insert(
          ex.sets.map((s) => ({
            routine_exercise_id: exRow.id,
            set_number: s.set_number,
            set_type: s.set_type,
            target_reps: s.target_reps,
            target_weight: s.target_weight ?? null,
            weight_unit: s.weight_unit
          }))
        );
      }
    }

    if (input.planId && input.dayOfWeek) {
      await this.supabase.from('workout_plan_routines').insert({
        plan_id: input.planId,
        routine_id: routineRow.id,
        day_of_week: input.dayOfWeek,
        sort_order: 1
      });
    }

    await this.loadAthleteWorkoutData(input.athleteId, true);
    const created = this.allRoutines().find((r) => r.id === routineRow.id);
    return created || this.normalizeRoutine(routineRow, input.dayOfWeek ?? null);
  }

  /**
   * Sube un banner a 'routine_banners' y actualiza workout_routines.banner_url en Supabase y en los signals locales
   */
  public async updateRoutineBanner(routineId: string, file: File): Promise<string> {
    const publicUrl = await this.uploadRoutineBanner(file, routineId);
    const { error } = await this.supabase
      .from('workout_routines')
      .update({ banner_url: publicUrl })
      .eq('id', routineId);

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar el banner de la rutina.');
    }

    this.allRoutines.update((list) =>
      list.map((r) => (r.id === routineId ? { ...r, banner_url: publicUrl } : r))
    );

    this.activePlan.update((plan) => {
      if (!plan) return plan;
      return {
        ...plan,
        plan_routines: plan.plan_routines.map((pr) =>
          pr.routine?.id === routineId
            ? { ...pr, routine: { ...pr.routine, banner_url: publicUrl } }
            : pr
        )
      };
    });

    return publicUrl;
  }

  /**
   * Obtiene el detalle de un ejercicio del API usando caché en memoria
   */
  public async getCachedExerciseDetail(apiId: string): Promise<ExerciseDetail | null> {
    if (!apiId) return null;
    if (this.exerciseCache.has(apiId)) {
      return this.exerciseCache.get(apiId)!;
    }
    try {
      const res = await firstValueFrom(this.exerciseApi.getExerciseDetail(apiId));
      if (res?.data) {
        this.exerciseCache.set(apiId, res.data);
        return res.data;
      }
    } catch (e) {
      console.warn(`No se pudo cargar ejercicio ${apiId} del API:`, e);
    }
    return null;
  }

  private normalizeRoutine(raw: any, dayOfWeek: number | null): WorkoutRoutine {
    const exercises: WorkoutRoutineExercise[] = (raw.workout_routine_exercises || [])
      .map((ex: any) => ({
        ...ex,
        secondary_muscles: ex.secondary_muscles || [],
        media_urls: ex.media_urls || [],
        sets: ((ex.workout_routine_sets || []) as WorkoutRoutineSet[]).sort(
          (a, b) => a.set_number - b.set_number
        )
      }))
      .sort((a: WorkoutRoutineExercise, b: WorkoutRoutineExercise) => a.sort_order - b.sort_order);

    const routine: WorkoutRoutine = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      banner_url: raw.banner_url || null,
      created_by: raw.created_by,
      kin_id: raw.kin_id,
      is_active: raw.is_active,
      exercises,
      day_of_week: dayOfWeek
    };
    this.computeRoutineDerivedMeta(routine);
    return routine;
  }

  private async hydrateRoutinesWithApiDetails(routines: WorkoutRoutine[]): Promise<void> {
    const apiIds = new Set<string>();
    for (const r of routines) {
      for (const ex of r.exercises) {
        if (!ex.is_custom && ex.exercise_api_id) {
          apiIds.add(ex.exercise_api_id);
        }
      }
    }

    await Promise.all(Array.from(apiIds).map((id) => this.getCachedExerciseDetail(id)));

    for (const r of routines) {
      for (const ex of r.exercises) {
        if (!ex.is_custom && ex.exercise_api_id) {
          const detail = this.exerciseCache.get(ex.exercise_api_id);
          if (detail) {
            ex.apiDetail = detail;
            ex.exercise_name = ex.exercise_name || detail.name;
            ex.target_muscle = ex.target_muscle || detail.target;
            if (!ex.secondary_muscles || ex.secondary_muscles.length === 0) {
              ex.secondary_muscles = detail.secondary_muscles || [];
            }
            ex.equipment = ex.equipment || detail.equipment;
          }
        }
      }
    }
  }

  public async enrichWorkoutLogsMedia(logs: WorkoutLog[]): Promise<void> {
    const apiIds = new Set<string>();
    for (const log of logs) {
      if (log.exercises) {
        for (const ex of log.exercises) {
          if (ex.exercise_api_id) {
            apiIds.add(ex.exercise_api_id);
          }
        }
      }
    }

    if (apiIds.size > 0) {
      await Promise.all(Array.from(apiIds).map((id) => this.getCachedExerciseDetail(id)));
    }

    const routines = this.allRoutines();

    for (const log of logs) {
      if (!log.exercises) continue;
      for (const ex of log.exercises) {
        let detail = ex.exercise_api_id ? this.exerciseCache.get(ex.exercise_api_id) : null;

        // Si no tiene detail por ID directo, buscar en rutinas cargadas por coincidencia de nombre
        if (!detail && ex.exercise_name) {
          const lowerName = ex.exercise_name.trim().toLowerCase();
          for (const r of routines) {
            const match = r.exercises.find(
              (re) =>
                re.exercise_name?.trim().toLowerCase() === lowerName ||
                re.apiDetail?.name?.trim().toLowerCase() === lowerName
            );
            if (match) {
              if (match.apiDetail) {
                detail = match.apiDetail;
              }
              if (!ex.exercise_api_id && match.exercise_api_id) {
                ex.exercise_api_id = match.exercise_api_id;
              }
              if (!ex.equipment && match.equipment) {
                ex.equipment = match.equipment;
              }
              if (!ex.target_muscle && match.target_muscle) {
                ex.target_muscle = match.target_muscle;
              }
              if ((!ex.secondary_muscles || ex.secondary_muscles.length === 0) && match.secondary_muscles?.length) {
                ex.secondary_muscles = match.secondary_muscles;
              }
              if (!ex.notes && match.notes) {
                ex.notes = match.notes;
              }
              if (!ex.rest_seconds && match.rest_seconds) {
                ex.rest_seconds = match.rest_seconds;
              }
              break;
            }
          }
        }

        if (detail) {
          ex.image_url = detail.image ? this.exerciseApi.getMediaUrl(detail.image) : undefined;
          ex.gif_url = detail.gif_url ? this.exerciseApi.getMediaUrl(detail.gif_url) : undefined;
          ex.instruction_steps = detail.instruction_steps || (detail.instruction ? [detail.instruction] : []);
          if (!ex.equipment) ex.equipment = detail.equipment;
          if (!ex.target_muscle) ex.target_muscle = detail.target;
          if (!ex.secondary_muscles || ex.secondary_muscles.length === 0) {
            ex.secondary_muscles = detail.secondary_muscles || [];
          }
        } else if (ex.media_urls && ex.media_urls.length > 0 && !ex.image_url) {
          ex.image_url = ex.media_urls[0];
        }
      }
    }
  }

  private computeRoutineDerivedMeta(routine: WorkoutRoutine): void {
    let totalSets = 0;
    let totalRestSeconds = 0;
    const muscles = new Set<string>();

    for (const ex of routine.exercises) {
      const setsCount = ex.sets?.length || 0;
      totalSets += setsCount;
      totalRestSeconds += setsCount * (ex.rest_seconds || 75) + setsCount * 40;
      if (ex.target_muscle) {
        muscles.add(ex.target_muscle);
      }
    }

    routine.total_sets = totalSets;
    routine.focus_muscles = Array.from(muscles).slice(0, 4);
    routine.estimated_minutes = Math.max(15, Math.round(totalRestSeconds / 60));
  }

  private async uploadWorkoutPhoto(file: File, athleteId: string): Promise<string> {
    const filename = `workout_${athleteId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    return this.uploadImageToBucket(file, 'workout_photos', `workouts/${athleteId}/${filename}`, filename, 1080);
  }

  private async uploadRoutineBanner(file: File, ownerKey: string): Promise<string> {
    const filename = `banner_${ownerKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    return this.uploadImageToBucket(file, 'routine_banners', `routines/${ownerKey}/${filename}`, filename, 1400);
  }

  private async uploadImageToBucket(
    file: File,
    bucket: string,
    storagePath: string,
    filename: string,
    maxDimension: number
  ): Promise<string> {
    const compressed = await compressImage(file, maxDimension, 0.82);

    let backendDetail: string | null = null;
    try {
      const formData = new FormData();
      formData.append('file', compressed, filename);
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/athletes/upload-media?bucket=${bucket}`, formData)
      );
      if (res?.public_url) {
        return res.public_url;
      }
    } catch (e: any) {
      console.warn(`Backend upload a ${bucket} falló, intentando Supabase directo:`, e);
      backendDetail = e?.error?.detail || e?.message || null;
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(storagePath, compressed, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000'
      });

    if (error) {
      throw new Error(backendDetail || error.message || `No se pudo subir la imagen al bucket '${bucket}'.`);
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(storagePath);
    if (!data?.publicUrl) {
      throw new Error(`No se pudo obtener la URL pública del bucket '${bucket}'.`);
    }
    return data.publicUrl;
  }
}
