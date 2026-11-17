import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import {
  WorkoutLog,
  WorkoutSetType,
  WORKOUT_SET_TYPE_LABELS
} from '../../models/workout.models';
import {
  WorkoutMiniBodyMapComponent,
  WorkoutMuscleLegendItem,
  getAwakinSunTone
} from '../body-map/workout-mini-body-map.component';
import { BodyMapGender } from '../body-map/body-map.component';
import { AthleteService } from '../../../../core/services/athlete.service';

@Component({
  selector: 'app-workout-log-detail-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, WorkoutMiniBodyMapComponent],
  templateUrl: './workout-log-detail-modal.component.html'
})
export class WorkoutLogDetailModalComponent {
  private readonly athleteService = inject(AthleteService);

  visible = model<boolean>(false);
  log = input<WorkoutLog | null>(null);
  gender = input<BodyMapGender | null>(null);

  // Evento opcional para compartir en historia (si la vista padre lo implementa)
  shareStory = output<WorkoutLog>();
  edit = output<WorkoutLog>();

  // Lightbox interno para ampliar la foto del entrenamiento
  isLightboxOpen = signal<boolean>(false);
  lightboxImageUrl = signal<string | null>(null);

  athleteGender = computed<BodyMapGender>(() => {
    if (this.gender()) return this.gender()!;
    const a = this.athleteService.currentAthlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    if (raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino') {
      return 'female';
    }
    return 'male';
  });

  private muscleTranslations: Record<string, string> = {
    chest: 'Pecho',
    pectorals: 'Pecho',
    pectoral: 'Pecho',
    'upper chest': 'Pecho superior',
    'mid-lower-pectoralis': 'Pecho medio/bajo',
    'upper-pectoralis': 'Pecho superior',

    delts: 'Hombros',
    deltoids: 'Hombros',
    deltoid: 'Hombros',
    shoulders: 'Hombros',
    'front-shoulders': 'Hombro anterior',
    'anterior-deltoid': 'Hombro anterior',
    'lateral-deltoid': 'Hombro lateral',
    'posterior-deltoid': 'Hombro posterior',
    'rear-shoulders': 'Hombro posterior',

    back: 'Espalda',
    lats: 'Dorsales',
    'latissimus dorsi': 'Dorsales',
    'upper back': 'Espalda alta',
    'lower back': 'Zona lumbar',
    lowerback: 'Zona lumbar',
    'lower-spine': 'Zona lumbar',
    'upper-spine': 'Columna cervical/torácica',
    traps: 'Trapecios',
    trapezius: 'Trapecios',
    'upper-trapezius': 'Trapecio superior',
    'upper-trapzeius': 'Trapecio superior',
    'traps-middle': 'Trapecio medio',
    'lower-trapezius': 'Trapecio inferior',
    scapula: 'Escápula',
    rhomboids: 'Romboides',

    biceps: 'Bíceps',
    'long-head-bicep': 'Bíceps',
    'short-head-bicep': 'Bíceps',
    triceps: 'Tríceps',
    'medial-head-triceps': 'Tríceps',
    'long-head-triceps': 'Tríceps',
    'lateral-head-triceps': 'Tríceps',
    'later-head-triceps': 'Tríceps',
    forearms: 'Antebrazos',
    forearm: 'Antebrazos',
    'wrist-extensors': 'Antebrazos',
    'wrist-flexors': 'Antebrazos',
    hands: 'Manos',
    wrist: 'Muñecas',
    elbow: 'Codos',

    quads: 'Cuádriceps',
    quadriceps: 'Cuádriceps',
    'outer-quadricep': 'Cuádriceps',
    'inner-quadricep': 'Cuádriceps',
    'rectus-femoris': 'Cuádriceps',
    hamstrings: 'Isquiotibiales',
    'medial-hamstrings': 'Isquiotibiales',
    'lateral-hamstrings': 'Isquiotibiales',
    glutes: 'Glúteos',
    gluteus: 'Glúteos',
    'gluteus-maximus': 'Glúteos',
    'gluteus-medius': 'Glúteos',
    calves: 'Pantorrillas',
    gastrocnemius: 'Pantorrillas',
    soleus: 'Pantorrillas',
    tibialis: 'Tibial',
    'inner-thigh': 'Aductores',
    adductors: 'Aductores',
    abductors: 'Abductores',
    groin: 'Ingle',
    hips: 'Caderas',
    knees: 'Rodillas',
    ankles: 'Tobillos',
    feet: 'Pies',

    abs: 'Abdomen',
    abdominals: 'Abdomen',
    core: 'Core',
    obliques: 'Oblicuos',
    'upper-abdominals': 'Abdomen alto',
    'lower-abdominals': 'Abdomen bajo',

    neck: 'Cuello',
    cardio: 'Cardio',
    general: 'General'
  };

  translateMuscleName(raw: string | null | undefined): string {
    if (!raw) return 'General';
    const clean = raw.trim().toLowerCase().replace(/_/g, '-');
    if (this.muscleTranslations[clean]) {
      return this.muscleTranslations[clean];
    }
    const rawLower = raw.trim().toLowerCase();
    if (this.muscleTranslations[rawLower]) {
      return this.muscleTranslations[rawLower];
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  getExactMuscleBreakdown(log: WorkoutLog | null | undefined): { muscle: string; sets: number }[] {
    if (!log) return [];

    const muscleMap = new Map<string, number>();

    if (log.exercises && log.exercises.length > 0) {
      for (const ex of log.exercises) {
        const completedCount = (ex.sets || []).filter((s) => s.is_completed !== false).length;
        if (completedCount === 0) continue;

        const muscleKey = this.translateMuscleName(ex.target_muscle || 'General');
        muscleMap.set(muscleKey, (muscleMap.get(muscleKey) || 0) + completedCount);
      }
    }

    if (muscleMap.size === 0 && log.sets_by_muscle) {
      for (const [key, count] of Object.entries(log.sets_by_muscle)) {
        if (count > 0) {
          const muscleKey = this.translateMuscleName(key);
          muscleMap.set(muscleKey, (muscleMap.get(muscleKey) || 0) + count);
        }
      }
    }

    return Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
  }

  getExactMuscleBreakdownWithColors(log: WorkoutLog | null | undefined): WorkoutMuscleLegendItem[] {
    const list = this.getExactMuscleBreakdown(log);
    if (list.length === 0) return [];
    const maxSets = Math.max(...list.map((item) => item.sets), 1);
    return list.map((item) => {
      const tone = getAwakinSunTone(item.sets, maxSets);
      return {
        muscle: item.muscle,
        sets: item.sets,
        color: tone.color,
        levelLabel: tone.levelLabel
      };
    });
  }

  getSetTypeInfo(setType?: string): { label: string; short: string; badgeClass: string } {
    if (!setType) {
      return { label: 'Efectiva', short: 'E', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    const key = setType.toUpperCase() as WorkoutSetType;
    return (
      WORKOUT_SET_TYPE_LABELS[key] || {
        label: setType,
        short: setType.charAt(0).toUpperCase(),
        badgeClass: 'bg-stone-100 text-stone-700 border-stone-200'
      }
    );
  }

  closeModal(): void {
    this.visible.set(false);
  }

  openLightbox(url: string | null | undefined): void {
    if (!url) return;
    this.lightboxImageUrl.set(url);
    this.isLightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.isLightboxOpen.set(false);
    this.lightboxImageUrl.set(null);
  }
}

