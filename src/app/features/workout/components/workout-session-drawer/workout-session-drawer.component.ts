import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { ExerciseApiService } from '../../services/exercise-api.service';
import { ActiveWorkoutSessionService } from '../../services/active-workout-session.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { AthleteService } from '../../../../core/services/athlete.service';
import { ExerciseSummary } from '../../models/exercises.models';
import {
  ActiveSessionExercise,
  WORKOUT_SET_TYPE_LABELS,
  WorkoutSetType
} from '../../models/workout.models';
import { CustomExerciseModalComponent } from '../custom-exercise-modal/custom-exercise-modal.component';
import { ExerciseGalleryDrawerComponent } from '../exercise-gallery-drawer/exercise-gallery-drawer.component';
import { SetTypeSheetComponent, getCompactSetDisplay } from '../set-type-sheet/set-type-sheet.component';
import {
  WorkoutMiniBodyMapComponent,
  WorkoutMuscleLegendItem,
  getAwakinSunTone
} from '../body-map/workout-mini-body-map.component';
import { getEquipmentMeta } from '../exercise-gallery-drawer/equipment-icons';

@Component({
  selector: 'app-workout-session-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DrawerModule,
    DialogModule,
    CustomExerciseModalComponent,
    ExerciseGalleryDrawerComponent,
    WorkoutMiniBodyMapComponent,
    SetTypeSheetComponent
  ],
  templateUrl: './workout-session-drawer.component.html'
})
export class WorkoutSessionDrawerComponent {
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly themeService = inject(ThemeService);
  private readonly athleteService = inject(AthleteService);
  public readonly activeSession = inject(ActiveWorkoutSessionService);

  readonly setTypeLabels = WORKOUT_SET_TYPE_LABELS;
  readonly setTypes: WorkoutSetType[] = ['WARMUP', 'WORKING', 'DROPSET', 'FAILURE', 'AMRAP', 'SUPERSET'];

  // Modales auxiliares dentro de la sesión
  inspectedExercise = signal<ActiveSessionExercise | null>(null);
  isCustomModalOpen = signal<boolean>(false);
  isBodyMapPickerOpen = signal<boolean>(false);
  isLibraryPickerOpen = signal<boolean>(false);
  setSheetVisible = signal<boolean>(false);
  setSheetTarget = signal<{ exIdx: number; setIdx: number; setType: WorkoutSetType; setNumber: number; canDelete: boolean } | null>(null);

  getCompactSetDisplay = getCompactSetDisplay;

  openSetTypeSheet(exIdx: number, setIdx: number): void {
    const ex = this.activeSession.sessionExercises()[exIdx];
    const s = ex?.sets?.[setIdx];
    if (!s) return;
    this.setSheetTarget.set({
      exIdx,
      setIdx,
      setType: s.set_type || 'WORKING',
      setNumber: s.set_number,
      canDelete: ex.sets.length > 1,
    });
    this.setSheetVisible.set(true);
  }

  onSetTypeSelected(type: WorkoutSetType): void {
    const t = this.setSheetTarget();
    if (!t) return;
    const ex = this.activeSession.sessionExercises()[t.exIdx];
    if (ex?.sets?.[t.setIdx]) {
      ex.sets[t.setIdx].set_type = type;
      this.activeSession.touchExercises();
    }
  }

  onSetDeletedFromSheet(): void {
    const t = this.setSheetTarget();
    if (!t) return;
    this.activeSession.removeSet(t.exIdx, t.setIdx);
  }
  librarySearchQuery = signal<string>('');
  librarySearchResults = signal<ExerciseSummary[]>([]);
  isSearchingLibrary = signal<boolean>(false);
  private librarySearchTimer: any = null;

  athleteGender = computed<'male' | 'female'>(() => {
    const current = this.athleteService.currentAthlete();
    const raw = (current?.gender || current?.sexo || current?.genero || '').toLowerCase().trim();
    return raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino' ? 'female' : 'male';
  });

  sessionMuscleBreakdown = computed<WorkoutMuscleLegendItem[]>(() => {
    const exercises = this.activeSession.sessionExercises();
    if (!exercises || exercises.length === 0) return [];
    const map = new Map<string, number>();
    for (const ex of exercises) {
      const setsCount = ex.sets?.length || 1;
      const target = this.translateMuscleName(ex.target_muscle || 'General');
      map.set(target, (map.get(target) || 0) + setsCount);

      const secWeight = Math.max(1, Math.round(setsCount * 0.5));
      for (const sec of ex.secondary_muscles || []) {
        const secKey = this.translateMuscleName(sec);
        if (secKey && secKey !== 'General' && secKey !== target) {
          map.set(secKey, (map.get(secKey) || 0) + secWeight);
        }
      }
    }
    const list = Array.from(map.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
    if (list.length === 0) return [];
    const primary = this.themeService.kinPrimaryColor();
    const secondary = this.themeService.kinSecondaryColor();
    const maxSets = Math.max(...list.map((i) => i.sets), 1);
    return list.map((item) => {
      const tone = getAwakinSunTone(item.sets, maxSets, primary, secondary);
      return {
        muscle: item.muscle,
        sets: item.sets,
        color: tone.color,
        levelLabel: tone.levelLabel
      };
    });
  });

  async onBodyMapExercisePicked(summary: ExerciseSummary): Promise<void> {
    await this.onBodyMapExercisesPicked([summary]);
  }

  async onBodyMapExercisesPicked(summaries: ExerciseSummary[]): Promise<void> {
    for (const s of summaries) {
      await this.activeSession.addLibraryExercise(s);
    }
    this.isBodyMapPickerOpen.set(false);
  }

  isVideoMediaUrl(url?: string | null): boolean {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(url) || url.includes('video');
  }

  getMediaUrl(path?: string | null): string {
    if (!path) return '';
    return this.exerciseApi.getMediaUrl(path);
  }

  getExerciseThumb(ex: ActiveSessionExercise): string | null {
    if (ex.media_urls && ex.media_urls.length > 0) {
      return this.getMediaUrl(ex.media_urls[0]);
    }
    if (ex.image_url) return this.getMediaUrl(ex.image_url);
    return null;
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

  // Confirmación explícita de cancelar sesión
  isCancelConfirmOpen = signal<boolean>(false);

  // Paso de finalización (Guardar Log)
  isFinishStepOpen = signal<boolean>(false);
  finishDurationMinutes = signal<number>(45);
  finishLocation = signal<string>('');
  finishNotes = signal<string>('');
  finishPhotoFile = signal<File | null>(null);
  finishPhotoPreview = signal<string | null>(null);
  isSavingLog = signal<boolean>(false);
  saveError = signal<string | null>(null);

  minimize(): void {
    this.activeSession.minimizeDrawer();
  }

  openCancelConfirm(): void {
    this.isCancelConfirmOpen.set(true);
  }

  confirmCancelSession(): void {
    this.isCancelConfirmOpen.set(false);
    this.isFinishStepOpen.set(false);
    this.finishLocation.set('');
    this.finishNotes.set('');
    this.finishPhotoFile.set(null);
    this.finishPhotoPreview.set(null);
    this.saveError.set(null);
    this.activeSession.cancelSession();
  }

  // Añadir ejercicio desde Librería Awakin
  openLibraryPicker(): void {
    this.isLibraryPickerOpen.set(true);
    if (this.librarySearchResults().length === 0) {
      this.searchLibrary();
    }
  }

  onLibrarySearchInput(): void {
    if (this.librarySearchTimer) clearTimeout(this.librarySearchTimer);
    this.librarySearchTimer = setTimeout(() => this.searchLibrary(), 300);
  }

  searchLibrary(): void {
    this.isSearchingLibrary.set(true);
    this.exerciseApi.searchExercises({
      search: this.librarySearchQuery().trim() || undefined,
      limit: 20
    }).subscribe({
      next: (res) => {
        this.librarySearchResults.set(res.data || []);
        this.isSearchingLibrary.set(false);
      },
      error: () => {
        this.isSearchingLibrary.set(false);
      }
    });
  }

  async addLibraryExercise(summary: ExerciseSummary): Promise<void> {
    await this.activeSession.addLibraryExercise(summary);
    this.isLibraryPickerOpen.set(false);
  }

  onCustomExerciseCreated(ex: ActiveSessionExercise): void {
    this.activeSession.addExercise(ex);
  }

  // Finalizar sesión y guardar en workout_logs
  openFinishStep(): void {
    const mins = Math.max(1, Math.round(this.activeSession.elapsedSeconds() / 60));
    this.finishDurationMinutes.set(mins);
    this.saveError.set(null);
    this.isFinishStepOpen.set(true);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.finishPhotoFile.set(file);
      const reader = new FileReader();
      reader.onload = (e: any) => this.finishPhotoPreview.set(e.target.result);
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.finishPhotoFile.set(null);
    this.finishPhotoPreview.set(null);
  }

  async confirmSaveWorkoutLog(): Promise<void> {
    if (this.isSavingLog()) return;
    this.isSavingLog.set(true);
    this.saveError.set(null);

    try {
      await this.activeSession.finishAndSaveSession({
        durationMinutes: this.finishDurationMinutes(),
        location: this.finishLocation(),
        notes: this.finishNotes(),
        photoFile: this.finishPhotoFile()
      });

      this.isFinishStepOpen.set(false);
      this.finishLocation.set('');
      this.finishNotes.set('');
      this.finishPhotoFile.set(null);
      this.finishPhotoPreview.set(null);
    } catch (err: any) {
      this.saveError.set(err?.message || 'Error guardando entrenamiento.');
    } finally {
      this.isSavingLog.set(false);
    }
  }
}
