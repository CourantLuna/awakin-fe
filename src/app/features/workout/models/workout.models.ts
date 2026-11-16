import { ExerciseDetail } from './exercises.models';

export type WorkoutSetType =
  | 'WARMUP'
  | 'WORKING'
  | 'DROPSET'
  | 'FAILURE'
  | 'AMRAP'
  | 'SUPERSET';

export const WORKOUT_SET_TYPE_LABELS: Record<WorkoutSetType, { label: string; short: string; badgeClass: string }> = {
  WARMUP: { label: 'Calentamiento', short: 'C', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  WORKING: { label: 'Efectiva', short: 'E', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  DROPSET: { label: 'Drop Set', short: 'D', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  FAILURE: { label: 'Al Fallo', short: 'F', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  AMRAP: { label: 'AMRAP', short: 'A', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUPERSET: { label: 'Superserie', short: 'S', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export interface WorkoutRoutineSet {
  id: string;
  routine_exercise_id: string;
  set_number: number;
  set_type: WorkoutSetType;
  target_reps: string;
  target_weight?: number | null;
  weight_unit: 'lb' | 'kg';
  rpe?: number | null;
}

export interface WorkoutRoutineExercise {
  id: string;
  routine_id: string;
  exercise_api_id?: string | null;
  is_custom: boolean;
  exercise_name?: string | null;
  target_muscle?: string | null;
  secondary_muscles: string[];
  equipment?: string | null;
  media_urls: string[];
  rest_seconds: number;
  notes?: string | null;
  sort_order: number;
  sets: WorkoutRoutineSet[];
  // Resuelto en runtime desde ExerciseApiService cuando is_custom === false
  apiDetail?: ExerciseDetail | null;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  kin_id?: string | null;
  is_active: boolean;
  exercises: WorkoutRoutineExercise[];
  // Metadata derivada para UI
  day_of_week?: number | null;
  total_sets?: number;
  focus_muscles?: string[];
  estimated_minutes?: number;
}

export interface WorkoutPlanRoutine {
  id: string;
  plan_id: string;
  routine_id: string;
  day_of_week: number; // 1 (Lunes) .. 7 (Domingo)
  sort_order: number;
  routine?: WorkoutRoutine;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  created_by?: string | null;
  kin_id?: string | null;
  is_active: boolean;
  plan_routines: WorkoutPlanRoutine[];
}

export interface WorkoutLogSet {
  id?: string;
  log_exercise_id?: string;
  set_number: number;
  set_type: WorkoutSetType;
  reps_completed: number;
  weight_used: number;
  weight_unit: 'lb' | 'kg';
  is_completed: boolean;
  rpe?: number | null;
}

export interface WorkoutLogExercise {
  id?: string;
  log_id?: string;
  exercise_api_id?: string | null;
  is_custom: boolean;
  exercise_name: string;
  target_muscle?: string | null;
  secondary_muscles: string[];
  equipment?: string | null;
  media_urls: string[];
  rest_seconds: number;
  notes?: string | null;
  sort_order: number;
  sets: WorkoutLogSet[];
}

export interface WorkoutLog {
  id: string;
  athlete_id: string;
  plan_id?: string | null;
  routine_id?: string | null;
  routine_name: string;
  routine_description?: string | null;
  workout_date: string;
  duration_minutes: number;
  location?: string | null;
  photo_url?: string | null;
  total_volume: number;
  volume_unit: 'lb' | 'kg';
  total_sets: number;
  sets_by_muscle: Record<string, number>;
  notes?: string | null;
  created_at?: string;
  exercises?: WorkoutLogExercise[];
}

export interface ActiveSessionSet {
  set_number: number;
  set_type: WorkoutSetType;
  target_reps: string;
  reps_completed: number;
  weight_used: number;
  weight_unit: 'lb' | 'kg';
  is_completed: boolean;
}

export interface ActiveSessionExercise {
  tempId: string;
  exercise_api_id?: string | null;
  is_custom: boolean;
  exercise_name: string;
  target_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  image_url?: string;
  gif_url?: string;
  instruction_steps?: string[];
  media_urls: string[];
  rest_seconds: number;
  notes?: string | null;
  sets: ActiveSessionSet[];
}

export const WEEK_DAY_LABELS: Record<number, { short: string; name: string }> = {
  1: { short: 'L', name: 'Lunes' },
  2: { short: 'M', name: 'Martes' },
  3: { short: 'X', name: 'Miércoles' },
  4: { short: 'J', name: 'Jueves' },
  5: { short: 'V', name: 'Viernes' },
  6: { short: 'S', name: 'Sábado' },
  7: { short: 'D', name: 'Domingo' },
};
