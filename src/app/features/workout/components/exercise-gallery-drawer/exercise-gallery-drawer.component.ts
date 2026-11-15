import { Component, model, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';
import { BodyMapComponent, BodyMapGender, BodyMapAnatomyMode, MuscleRegion } from '../body-map/body-map.component';
import { ExerciseApiService } from '../../services/exercise-api.service';
import { ExerciseSummary, ExerciseDetail } from '../../models/exercises.models';
import { EquipmentMeta, getEquipmentMeta, EQUIPMENT_META_MAP } from './equipment-icons';

@Component({
  selector: 'app-exercise-gallery-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimeNGModule,
    PopoverModule,
    DialogModule,
    BodyMapComponent
  ],
  templateUrl: './exercise-gallery-drawer.component.html'
})
export class ExerciseGalleryDrawerComponent implements OnInit {
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly sanitizer = inject(DomSanitizer);

  isOpen = model<boolean>(false);

  // Estados de Búsqueda y Filtros
  searchQuery = signal<string>('');
  selectedEquipment = signal<string>('all');
  selectedMuscle = signal<MuscleRegion | null>(null);

  // Estados de visualización del mapa corporal
  activeView = signal<'bodymap' | 'list'>('bodymap');
  bodyMapGender = signal<BodyMapGender>('male');
  bodyMapAnatomy = signal<BodyMapAnatomyMode>('advanced');

  // Datos reactivos de la API
  exercises = signal<ExerciseSummary[]>([]);
  totalExercises = signal<number>(0);
  isLoading = signal<boolean>(false);
  hasInitialLoaded = signal<boolean>(false);
  activeDetail = signal<ExerciseDetail | null>(null);
  isDetailModalOpen = signal<boolean>(false);
  isLoadingDetail = signal<boolean>(false);

  // Catálogo dinámico de equipamiento obtenido de GET /api/equipment
  equipmentList = signal<EquipmentMeta[]>([
    getEquipmentMeta('all')
  ]);
  isLoadingEquipment = signal<boolean>(false);

  // Temporizador para debounce de búsqueda
  private searchTimer: any = null;

  constructor() {
    // Si se abre el drawer por primera vez, cargar iniciales
    effect(() => {
      if (this.isOpen()) {
        if (this.equipmentList().length <= 1 && !this.isLoadingEquipment()) {
          this.fetchEquipmentCatalog();
        }
        if (!this.hasInitialLoaded() && !this.isLoading()) {
          this.fetchExercises();
        }
      }
    });
  }

  ngOnInit(): void {
    this.fetchEquipmentCatalog();
  }

  /**
   * Carga dinámica del catálogo de equipamientos desde GET /api/equipment
   */
  fetchEquipmentCatalog(): void {
    this.isLoadingEquipment.set(true);
    this.exerciseApi.getEquipmentList().subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          const totalAll = res.data.reduce((acc, item) => acc + (item.count || 0), 0);
          const mapped: EquipmentMeta[] = [
            {
              value: 'all',
              label: 'Todos los Equipos',
              iconSvg: EQUIPMENT_META_MAP['all'].iconSvg,
              count: totalAll
            },
            ...res.data.map((item) => getEquipmentMeta(item.name, item.count))
          ];
          this.equipmentList.set(mapped);
        }
        this.isLoadingEquipment.set(false);
      },
      error: (err) => {
        console.warn('Error obteniendo catálogo de equipamientos, usando fallback:', err);
        // Fallback enriquecido si falla la red
        const fallbackKeys = Object.keys(EQUIPMENT_META_MAP);
        const fallbackList = fallbackKeys.map(k => getEquipmentMeta(k));
        this.equipmentList.set(fallbackList);
        this.isLoadingEquipment.set(false);
      }
    });
  }

  // Conteo de filtros activos
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.selectedEquipment() && this.selectedEquipment() !== 'all') count++;
    if (this.selectedMuscle()) count++;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  selectedEquipmentMeta = computed(() => {
    const val = this.selectedEquipment();
    const list = this.equipmentList();
    const found = list.find((e) => e.value === val);
    return found || getEquipmentMeta(val);
  });

  selectedEquipmentLabel = computed(() => {
    return this.selectedEquipmentMeta().label;
  });

  sanitizeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Carga ejercicios desde la API basándose en los filtros actuales
   */
  fetchExercises(page = 1): void {
    this.isLoading.set(true);

    const muscle = this.selectedMuscle();
    const query = this.searchQuery().trim();
    const equip = this.selectedEquipment();

    if (muscle) {
      // Búsqueda por región anatómica seleccionada en el Body Map
      this.exerciseApi.getExercisesByBodyMap(
        muscle.id,
        page,
        24,
        equip,
        query || undefined
      ).subscribe({
        next: (res) => {
          this.exercises.set(res.data || []);
          this.totalExercises.set(res.pagination?.total || (res.data ? res.data.length : 0));
          this.hasInitialLoaded.set(true);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error cargando ejercicios por BodyMap:', err);
          this.hasInitialLoaded.set(true);
          this.isLoading.set(false);
        }
      });
    } else {
      // Búsqueda general por texto o equipamiento
      this.exerciseApi.searchExercises({
        search: query || undefined,
        equipment: equip !== 'all' ? equip : undefined,
        page,
        limit: 24
      }).subscribe({
        next: (res) => {
          this.exercises.set(res.data || []);
          this.totalExercises.set(res.pagination?.total || (res.data ? res.data.length : 0));
          this.hasInitialLoaded.set(true);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error buscando ejercicios:', err);
          this.hasInitialLoaded.set(true);
          this.isLoading.set(false);
        }
      });
    }
  }

  // Debounced input search
  onSearchInput(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.fetchExercises();
    }, 350);
  }

  // Handlers del Body Map
  onMuscleSelected(muscle: MuscleRegion): void {
    if (this.selectedMuscle()?.id === muscle.id) {
      this.selectedMuscle.set(null);
    } else {
      this.selectedMuscle.set(muscle);
    }
    this.fetchExercises();
  }

  onMuscleSelectionCleared(): void {
    this.selectedMuscle.set(null);
    this.fetchExercises();
  }

  // Métodos de filtros
  setEquipment(eqValue: string): void {
    this.selectedEquipment.set(eqValue);
    this.fetchExercises();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.fetchExercises();
  }

  clearMuscleFilter(): void {
    this.selectedMuscle.set(null);
    this.fetchExercises();
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.selectedEquipment.set('all');
    this.selectedMuscle.set(null);
    this.fetchExercises();
  }

  // Detalle del Ejercicio
  openExerciseDetail(exercise: ExerciseSummary): void {
    this.isLoadingDetail.set(true);
    // Mostrar versión rápida inicial
    this.activeDetail.set({
      ...exercise,
      instruction_steps: exercise.instruction ? [exercise.instruction] : []
    });
    this.isDetailModalOpen.set(true);

    this.exerciseApi.getExerciseDetail(exercise.id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.activeDetail.set(res.data);
        }
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
      }
    });
  }

  closeDetail(): void {
    this.isDetailModalOpen.set(false);
    this.activeDetail.set(null);
  }

  getMediaUrl(path?: string | null): string {
    return this.exerciseApi.getMediaUrl(path);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
