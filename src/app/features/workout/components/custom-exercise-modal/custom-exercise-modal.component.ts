import { Component, computed, inject, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { BodyMapComponent, BodyMapGender, MuscleRegion } from '../body-map/body-map.component';
import { ActiveSessionExercise } from '../../models/workout.models';
import { AthleteService } from '../../../../core/services/athlete.service';

export interface CustomExercisePayload {
  exercise_name: string;
  target_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  rest_seconds: number;
  notes?: string;
}

@Component({
  selector: 'app-custom-exercise-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, BodyMapComponent],
  templateUrl: './custom-exercise-modal.component.html'
})
export class CustomExerciseModalComponent {
  private readonly athleteService = inject(AthleteService);

  isOpen = model<boolean>(false);
  onCreated = output<ActiveSessionExercise>();

  athleteGender = computed<BodyMapGender>(() => {
    const a = this.athleteService.currentAthlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    return (raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino') ? 'female' : 'male';
  });

  name = signal<string>('');
  equipment = signal<string>('body weight');
  restSeconds = signal<number>(90);
  notes = signal<string>('');

  // Selección anatómica en BodyMap
  selectionStep = signal<'target' | 'secondary'>('target');
  targetMuscle = signal<string>('');
  secondaryMuscles = signal<string[]>([]);

  equipmentOptions = [
    { label: 'Peso Corporal', value: 'body weight' },
    { label: 'Mancuernas', value: 'dumbbell' },
    { label: 'Barra', value: 'barbell' },
    { label: 'Poleas / Cables', value: 'cable' },
    { label: 'Máquina', value: 'leverage machine' },
    { label: 'Kettlebell', value: 'kettlebell' },
    { label: 'Banda Elástica', value: 'band' },
    { label: 'Otro', value: 'weighted' }
  ];

  onMuscleClicked(region: MuscleRegion): void {
    const label = region.name || region.id;
    if (this.selectionStep() === 'target') {
      this.targetMuscle.set(label);
      // Quitar de secundarios si estaba ahí
      this.secondaryMuscles.update((list) => list.filter((m) => m !== label));
    } else {
      if (label === this.targetMuscle()) return;
      this.secondaryMuscles.update((list) =>
        list.includes(label) ? list.filter((m) => m !== label) : [...list, label]
      );
    }
  }

  removeSecondary(muscle: string): void {
    this.secondaryMuscles.update((list) => list.filter((m) => m !== muscle));
  }

  canSave(): boolean {
    return this.name().trim().length >= 2 && this.targetMuscle().trim().length > 0;
  }

  save(): void {
    if (!this.canSave()) return;

    const exercise: ActiveSessionExercise = {
      tempId: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      exercise_api_id: null,
      is_custom: true,
      exercise_name: this.name().trim(),
      target_muscle: this.targetMuscle(),
      secondary_muscles: this.secondaryMuscles(),
      equipment: this.equipment(),
      media_urls: [],
      rest_seconds: Math.max(15, Number(this.restSeconds() || 90)),
      notes: this.notes().trim() || null,
      sets: [
        { set_number: 1, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 2, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 3, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false }
      ]
    };

    this.onCreated.emit(exercise);
    this.resetAndClose();
  }

  resetAndClose(): void {
    this.name.set('');
    this.targetMuscle.set('');
    this.secondaryMuscles.set([]);
    this.notes.set('');
    this.selectionStep.set('target');
    this.isOpen.set(false);
  }
}
