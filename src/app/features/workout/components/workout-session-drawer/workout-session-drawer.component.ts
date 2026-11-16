import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { ExerciseApiService } from '../../services/exercise-api.service';
import { ActiveWorkoutSessionService } from '../../services/active-workout-session.service';
import { ExerciseSummary } from '../../models/exercises.models';
import {
  ActiveSessionExercise,
  WORKOUT_SET_TYPE_LABELS,
  WorkoutSetType
} from '../../models/workout.models';
import { CustomExerciseModalComponent } from '../custom-exercise-modal/custom-exercise-modal.component';

@Component({
  selector: 'app-workout-session-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, DrawerModule, DialogModule, CustomExerciseModalComponent],
  templateUrl: './workout-session-drawer.component.html'
})
export class WorkoutSessionDrawerComponent {
  private readonly exerciseApi = inject(ExerciseApiService);
  public readonly activeSession = inject(ActiveWorkoutSessionService);

  readonly setTypeLabels = WORKOUT_SET_TYPE_LABELS;
  readonly setTypes: WorkoutSetType[] = ['WARMUP', 'WORKING', 'DROPSET', 'FAILURE', 'AMRAP', 'SUPERSET'];

  // Modales auxiliares dentro de la sesión
  inspectedExercise = signal<ActiveSessionExercise | null>(null);
  isCustomModalOpen = signal<boolean>(false);
  isLibraryPickerOpen = signal<boolean>(false);
  librarySearchQuery = signal<string>('');
  librarySearchResults = signal<ExerciseSummary[]>([]);
  isSearchingLibrary = signal<boolean>(false);
  private librarySearchTimer: any = null;

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
