import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import {
  WorkoutLog,
  WorkoutSetType,
  WORKOUT_SET_TYPE_LABELS
} from '../../models/workout.models';
import { WorkoutSupabaseService } from '../../services/workout-supabase.service';
import { getEquipmentMeta } from '../exercise-gallery-drawer/equipment-icons';

export interface EditableLogSet {
  set_number: number;
  set_type: WorkoutSetType;
  reps_completed: number;
  weight_used: number;
  weight_unit: 'lb' | 'kg';
  is_completed: boolean;
  rpe?: number | null;
}

export interface EditableLogExercise {
  id?: string;
  exercise_api_id?: string | null;
  is_custom?: boolean;
  exercise_name: string;
  target_muscle?: string | null;
  secondary_muscles?: string[];
  equipment?: string | null;
  media_urls?: string[];
  rest_seconds?: number;
  notes?: string | null;
  image_url?: string;
  gif_url?: string;
  instruction_steps?: string[];
  sets: EditableLogSet[];
}

@Component({
  selector: 'app-workout-log-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './workout-log-edit-modal.component.html'
})
export class WorkoutLogEditModalComponent {
  private readonly workoutService = inject(WorkoutSupabaseService);

  visible = model<boolean>(false);
  log = input<WorkoutLog | null>(null);
  saved = output<WorkoutLog>();

  // Campos editables del entrenamiento
  editRoutineName = signal<string>('');
  editWorkoutDate = signal<string>('');
  editDurationMinutes = signal<number>(45);
  editLocation = signal<string>('');
  editNotes = signal<string>('');
  editVolumeUnit = signal<'lb' | 'kg'>('lb');
  bannerPhotoUrl = signal<string | null>(null);
  editExercises = signal<EditableLogExercise[]>([]);

  // Inspección de ejercicio (Instrucciones + GIF)
  inspectedExercise = signal<EditableLogExercise | null>(null);

  isSaving = signal<boolean>(false);
  saveError = signal<string | null>(null);

  readonly setTypeLabels = WORKOUT_SET_TYPE_LABELS;
  readonly setTypes: WorkoutSetType[] = ['WARMUP', 'WORKING', 'DROPSET', 'FAILURE', 'AMRAP', 'SUPERSET'];

  constructor() {
    effect(
      () => {
        const l = this.log();
        if (l) {
          this.initializeForm(l);
        }
      },
      { allowSignalWrites: true }
    );
  }

  translateMuscleName(raw: string | null | undefined): string {
    if (!raw) return 'General';
    const key = raw.toLowerCase().trim();
    const map: Record<string, string> = {
      abs: 'Abdominales',
      'upper back': 'Espalda Superior',
      'lower back': 'Espalda Baja',
      biceps: 'Bíceps',
      triceps: 'Tríceps',
      chest: 'Pecho',
      pectorals: 'Pectorales',
      delts: 'Deltoides',
      shoulders: 'Hombros',
      lats: 'Dorsales',
      quads: 'Cuádriceps',
      quadriceps: 'Cuádriceps',
      hamstrings: 'Isquiosurales',
      calves: 'Pantorrillas',
      glutes: 'Glúteos',
      forearms: 'Antebrazos',
      traps: 'Trapecios',
      trapezius: 'Trapecios',
      adductors: 'Aductores',
      abductors: 'Abductores',
      neck: 'Cuello',
      cardio: 'Cardio',
      waist: 'Cintura / Core'
    };
    return map[key] || (key.charAt(0).toUpperCase() + key.slice(1));
  }

  translateEquipmentName(raw: string | null | undefined): string {
    if (!raw) return 'Peso Corporal';
    return getEquipmentMeta(raw).label;
  }

  private initializeForm(l: WorkoutLog): void {
    this.editRoutineName.set(l.routine_name || 'Entrenamiento');
    this.editWorkoutDate.set(this.formatDateForInput(l.workout_date));
    this.editDurationMinutes.set(l.duration_minutes || 45);
    this.editLocation.set(l.location || '');
    this.editNotes.set(l.notes || '');
    this.editVolumeUnit.set(l.volume_unit || 'lb');
    this.bannerPhotoUrl.set(l.photo_url || null);
    this.saveError.set(null);

    // Recuperar ejercicios: si l.exercises está vacío o no existe, buscar en workoutService
    let exList = l.exercises || [];
    if (exList.length === 0) {
      const fromService = this.workoutService.workoutLogs().find((item) => item.id === l.id);
      if (fromService?.exercises && fromService.exercises.length > 0) {
        exList = fromService.exercises;
      }
    }

    const exercises: EditableLogExercise[] = exList.map((ex) => ({
      id: ex.id,
      exercise_api_id: ex.exercise_api_id || null,
      is_custom: ex.is_custom ?? true,
      exercise_name: ex.exercise_name,
      target_muscle: ex.target_muscle,
      secondary_muscles: ex.secondary_muscles || [],
      equipment: ex.equipment,
      media_urls: ex.media_urls || [],
      rest_seconds: ex.rest_seconds || 90,
      notes: ex.notes,
      image_url: ex.image_url,
      gif_url: ex.gif_url,
      instruction_steps: ex.instruction_steps,
      sets: (ex.sets || []).map((s, idx) => ({
        set_number: s.set_number || idx + 1,
        set_type: (s.set_type as WorkoutSetType) || 'WORKING',
        reps_completed: s.reps_completed || 0,
        weight_used: s.weight_used || 0,
        weight_unit: s.weight_unit || l.volume_unit || 'lb',
        is_completed: s.is_completed !== false,
        rpe: s.rpe ?? null
      }))
    }));

    this.editExercises.set(exercises);
  }

  private formatDateForInput(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return new Date().toISOString().substring(0, 10);
      return d.toISOString().substring(0, 10);
    } catch {
      return new Date().toISOString().substring(0, 10);
    }
  }

  toggleSetCompleted(exIdx: number, setIdx: number): void {
    const list = [...this.editExercises()];
    const ex = list[exIdx];
    if (!ex || !ex.sets[setIdx]) return;
    ex.sets[setIdx].is_completed = !ex.sets[setIdx].is_completed;
    this.editExercises.set(list);
  }

  addSetToExercise(exIdx: number): void {
    const list = [...this.editExercises()];
    const ex = list[exIdx];
    if (!ex) return;

    const lastSet = ex.sets[ex.sets.length - 1];
    const newSetNumber = (ex.sets.length > 0 ? lastSet.set_number : 0) + 1;
    ex.sets.push({
      set_number: newSetNumber,
      set_type: lastSet ? lastSet.set_type : 'WORKING',
      reps_completed: lastSet ? lastSet.reps_completed : 10,
      weight_used: lastSet ? lastSet.weight_used : 0,
      weight_unit: this.editVolumeUnit(),
      is_completed: true,
      rpe: null
    });
    this.editExercises.set(list);
  }

  removeSetFromExercise(exIdx: number, setIdx: number): void {
    const list = [...this.editExercises()];
    const ex = list[exIdx];
    if (!ex) return;
    ex.sets.splice(setIdx, 1);
    ex.sets.forEach((s, i) => (s.set_number = i + 1));
    this.editExercises.set(list);
  }

  addCustomExercise(): void {
    const list = [...this.editExercises()];
    list.push({
      exercise_name: 'Nuevo Ejercicio',
      target_muscle: 'General',
      secondary_muscles: [],
      equipment: 'General',
      media_urls: [],
      rest_seconds: 90,
      notes: null,
      sets: [
        {
          set_number: 1,
          set_type: 'WORKING',
          reps_completed: 10,
          weight_used: 0,
          weight_unit: this.editVolumeUnit(),
          is_completed: true
        }
      ]
    });
    this.editExercises.set(list);
  }

  removeExercise(exIdx: number): void {
    const list = [...this.editExercises()];
    list.splice(exIdx, 1);
    this.editExercises.set(list);
  }

  async saveChanges(): Promise<void> {
    const currentLog = this.log();
    if (!currentLog) return;
    if (this.isSaving()) return;

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      let exercisesToSave = this.editExercises();
      // Failsafe de seguridad: si viene vacío, intentar recuperar del log original o del servicio
      if (exercisesToSave.length === 0) {
        const full = this.workoutService.workoutLogs().find((item) => item.id === currentLog.id);
        const source = (currentLog.exercises && currentLog.exercises.length > 0) ? currentLog.exercises : (full?.exercises || []);
        if (source.length > 0) {
          exercisesToSave = source.map((e) => ({
            exercise_api_id: e.exercise_api_id || null,
            is_custom: e.is_custom ?? true,
            exercise_name: e.exercise_name,
            target_muscle: e.target_muscle,
            secondary_muscles: e.secondary_muscles || [],
            equipment: e.equipment,
            media_urls: e.media_urls || [],
            rest_seconds: e.rest_seconds || 90,
            notes: e.notes,
            image_url: e.image_url,
            gif_url: e.gif_url,
            instruction_steps: e.instruction_steps,
            sets: (e.sets || []).map((s, sIdx) => ({
              set_number: s.set_number || sIdx + 1,
              set_type: (s.set_type as WorkoutSetType) || 'WORKING',
              reps_completed: s.reps_completed || 0,
              weight_used: s.weight_used || 0,
              weight_unit: s.weight_unit || currentLog.volume_unit || 'lb',
              is_completed: s.is_completed !== false,
              rpe: s.rpe ?? null
            }))
          }));
        }
      }

      const updatedLog = await this.workoutService.updateWorkoutLog({
        logId: currentLog.id,
        athleteId: currentLog.athlete_id,
        routineName: currentLog.routine_name || this.editRoutineName().trim() || 'Entrenamiento',
        workoutDate: this.editWorkoutDate(),
        durationMinutes: this.editDurationMinutes(),
        location: this.editLocation().trim() || null,
        notes: this.editNotes().trim() || null,
        volumeUnit: this.editVolumeUnit(),
        exercises: exercisesToSave
      });

      this.saved.emit(updatedLog);
      this.visible.set(false);
    } catch (err: any) {
      this.saveError.set(err.message || 'Error al guardar los cambios del entrenamiento.');
    } finally {
      this.isSaving.set(false);
    }
  }

  closeModal(): void {
    this.visible.set(false);
  }
}

