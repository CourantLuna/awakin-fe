import { Component, model, signal, computed, inject, input, output, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { PopoverModule } from 'primeng/popover';
import { DialogModule } from 'primeng/dialog';
import { BodyMapComponent, BodyMapGender, BodyMapAnatomyMode, MuscleRegion } from '../body-map/body-map.component';
import { ExerciseApiService } from '../../services/exercise-api.service';
import { ExerciseSummary, ExerciseDetail } from '../../models/exercises.models';
import { EquipmentMeta, getEquipmentMeta, EQUIPMENT_META_MAP } from './equipment-icons';
import { AthleteService } from '../../../../core/services/athlete.service';

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
export class ExerciseGalleryDrawerComponent implements OnInit, OnDestroy {
  private readonly exerciseApi = inject(ExerciseApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly athleteService = inject(AthleteService);

  isOpen = model<boolean>(false);
  selectionMode = input<boolean>(false);
  exercisePicked = output<ExerciseSummary>();
  exercisesPicked = output<ExerciseSummary[]>();
  selectedExercises = signal<ExerciseSummary[]>([]);

  // Estados de Búsqueda y Filtros
  searchQuery = signal<string>('');
  selectedEquipments = signal<string[]>([]);
  selectedMuscles = signal<MuscleRegion[]>([]);
  selectedMuscleIds = computed(() => this.selectedMuscles().map((m) => m.id));

  // Estados de visualización del mapa corporal
  activeView = signal<'bodymap' | 'list'>('bodymap');
  bodyMapGender = signal<BodyMapGender>('male');
  bodyMapAnatomy = signal<BodyMapAnatomyMode>('advanced');

  // Datos reactivos de la API
  exercises = signal<ExerciseSummary[]>([]);
  totalExercises = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(24);
  hasMorePages = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  hasInitialLoaded = signal<boolean>(false);
  showScrollTop = signal<boolean>(false);
  activeDetail = signal<ExerciseDetail | null>(null);
  isDetailModalOpen = signal<boolean>(false);
  isLoadingDetail = signal<boolean>(false);

  // Catálogo dinámico de equipamiento obtenido de GET /api/equipment
  equipmentList = signal<EquipmentMeta[]>([
    getEquipmentMeta('all')
  ]);
  isLoadingEquipment = signal<boolean>(false);

  bodyMapBgUrl(): string | null {
    return this.athleteService.currentAthlete()?.kin?.body_map_bg_url || null;
  }

  // Temporizador para debounce de búsqueda y scroll listener
  private searchTimer: any = null;
  private scrollListenerRemover: (() => void) | null = null;

  constructor() {
    // Sincronizar género del mapa corporal con el género del atleta autenticado
    effect(() => {
      const current = this.athleteService.currentAthlete();
      if (current) {
        const raw = (current.gender || current.sexo || current.genero || '').toLowerCase().trim();
        const isFemale = raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino';
        this.bodyMapGender.set(isFemale ? 'female' : 'male');
      }
    });

    // Si se abre el drawer por primera vez, cargar iniciales y vincular listener de scroll
    effect(() => {
      if (this.isOpen()) {
        if (this.equipmentList().length <= 1 && !this.isLoadingEquipment()) {
          this.fetchEquipmentCatalog();
        }
        if (!this.hasInitialLoaded() && !this.isLoading()) {
          this.fetchExercises();
        }
        this.attachScrollListener();
      } else {
        this.detachScrollListener();
        this.showScrollTop.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.fetchEquipmentCatalog();
  }

  ngOnDestroy(): void {
    this.detachScrollListener();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  private attachScrollListener(): void {
    setTimeout(() => {
      const drawerContent = document.querySelector('.p-drawer-content');
      if (drawerContent && !this.scrollListenerRemover) {
        const handler = (e: Event) => this.onScroll(e);
        drawerContent.addEventListener('scroll', handler, { passive: true });
        this.scrollListenerRemover = () => drawerContent.removeEventListener('scroll', handler);
      }
    }, 150);
  }

  private detachScrollListener(): void {
    if (this.scrollListenerRemover) {
      this.scrollListenerRemover();
      this.scrollListenerRemover = null;
    }
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
    count += this.selectedEquipments().length;
    count += this.selectedMuscles().length;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  isEquipmentSelected(val: string): boolean {
    const vals = this.selectedEquipments();
    return val === 'all' ? vals.length === 0 : vals.includes(val);
  }

  getEquipmentMetaLabel(val: string): EquipmentMeta {
    return this.equipmentList().find((e) => e.value === val) || getEquipmentMeta(val);
  }

  totalPages = computed(() => {
    const total = this.totalExercises();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  // Ventana de páginas visibles para paginación numerada
  visiblePages = computed(() => {
    const current = this.currentPage();
    const total = this.totalPages();
    const delta = 2; // Cantidad a los lados
    const pages: number[] = [];

    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  selectedEquipmentMeta = computed(() => {
    const vals = this.selectedEquipments();
    if (vals.length === 1) {
      return this.equipmentList().find((e) => e.value === vals[0]) || getEquipmentMeta(vals[0]);
    }
    return getEquipmentMeta('all');
  });

  selectedEquipmentLabel = computed(() => {
    const vals = this.selectedEquipments();
    if (vals.length === 0) return 'Todos los Equipos';
    if (vals.length === 1) return this.selectedEquipmentMeta().label;
    return `${vals.length} equipos`;
  });

  sanitizeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Carga ejercicios desde la API basándose en los filtros actuales
   * @param page Página a consultar (por defecto 1)
   * @param append Si es true, añade los ejercicios a la lista existente (paginación infinita)
   */
  fetchExercises(page = 1, append = false): void {
    if (append) {
      this.isLoadingMore.set(true);
    } else {
      this.isLoading.set(true);
      this.currentPage.set(1);
    }

    const muscles = this.selectedMuscles();
    const query = this.searchQuery().trim();
    const equips = this.selectedEquipments();
    const limit = this.pageSize();

    const handleSuccess = (res: any) => {
      const incoming: ExerciseSummary[] = res.data || [];
      const total = res.pagination?.total ?? incoming.length;
      const totalPages = res.pagination?.totalPages ?? Math.ceil(total / limit);

      if (append) {
        const existingIds = new Set(this.exercises().map(e => e.id));
        const filteredNew = incoming.filter(e => !existingIds.has(e.id));
        this.exercises.set([...this.exercises(), ...filteredNew]);
      } else {
        this.exercises.set(incoming);
      }

      this.totalExercises.set(total);
      this.currentPage.set(page);
      this.hasMorePages.set(page < totalPages);
      this.hasInitialLoaded.set(true);
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
    };

    const handleError = (err: any) => {
      console.error('Error cargando ejercicios:', err);
      this.hasInitialLoaded.set(true);
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
    };

    if (muscles.length <= 1 && equips.length <= 1) {
      const muscle = muscles[0];
      const equip = equips[0] || 'all';
      if (muscle) {
        this.exerciseApi.getExercisesByBodyMap(
          muscle.id,
          page,
          limit,
          equip,
          query || undefined
        ).subscribe({ next: handleSuccess, error: handleError });
      } else {
        this.exerciseApi.searchExercises({
          search: query || undefined,
          equipment: equip !== 'all' ? equip : undefined,
          page,
          limit
        }).subscribe({ next: handleSuccess, error: handleError });
      }
      return;
    }

    const muscleIds = muscles.length > 0 ? muscles.map((m) => m.id) : [null];
    const equipVals = equips.length > 0 ? equips : ['all'];
    const requests = muscleIds.flatMap((mId) =>
      equipVals.map((eqVal) =>
        (mId
          ? this.exerciseApi.getExercisesByBodyMap(mId, 1, limit, eqVal, query || undefined)
          : this.exerciseApi.searchExercises({
              search: query || undefined,
              equipment: eqVal !== 'all' ? eqVal : undefined,
              page: 1,
              limit
            })
        ).pipe(catchError(() => of(null)))
      )
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const seen = new Set<string>();
        const merged: ExerciseSummary[] = [];
        for (const r of responses) {
          for (const ex of r?.data || []) {
            if (!seen.has(ex.id)) {
              seen.add(ex.id);
              merged.push(ex);
            }
          }
        }
        this.exercises.set(merged);
        this.totalExercises.set(merged.length);
        this.currentPage.set(1);
        this.hasMorePages.set(false);
        this.hasInitialLoaded.set(true);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      },
      error: handleError
    });
  }

  /**
   * Carga la siguiente página de ejercicios
   */
  loadMoreExercises(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMorePages()) return;
    const nextPage = this.currentPage() + 1;
    this.fetchExercises(nextPage, true);
  }

  /**
   * Navega a una página específica (reemplazando los resultados y haciendo scroll al top)
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage() || this.isLoading()) {
      return;
    }
    this.fetchExercises(page, false);
    this.scrollToTop();
  }

  /**
   * Listener de scroll para mostrar u ocultar el FAB Scroll-To-Top
   */
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target) {
      this.showScrollTop.set(target.scrollTop > 350);
    }
  }

  /**
   * Desplaza suavemente el contenedor con scroll al inicio
   */
  scrollToTop(): void {
    // Buscar el contenedor scrollable del p-drawer
    const drawerContent = document.querySelector('.p-drawer-content');
    if (drawerContent) {
      drawerContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const current = [...this.selectedMuscles()];
    const idx = current.findIndex((m) => m.id === muscle.id);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(muscle);
    }
    this.selectedMuscles.set(current);
    this.fetchExercises();
  }

  onMuscleSelectionCleared(): void {
    this.selectedMuscles.set([]);
    this.fetchExercises();
  }

  removeMuscleFilter(id: string): void {
    this.selectedMuscles.set(this.selectedMuscles().filter((m) => m.id !== id));
    this.fetchExercises();
  }

  // Métodos de filtros
  setEquipment(eqValue: string): void {
    if (eqValue === 'all') {
      this.selectedEquipments.set([]);
    } else {
      const current = [...this.selectedEquipments()];
      const idx = current.indexOf(eqValue);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(eqValue);
      this.selectedEquipments.set(current);
    }
    this.fetchExercises();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.fetchExercises();
  }

  clearMuscleFilter(): void {
    this.selectedMuscles.set([]);
    this.fetchExercises();
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.selectedEquipments.set([]);
    this.selectedMuscles.set([]);
    this.fetchExercises();
  }

  isExerciseSelected(id: string): boolean {
    return this.selectedExercises().some((e) => e.id === id);
  }

  clearSelectedExercises(): void {
    this.selectedExercises.set([]);
  }

  confirmSelectedExercises(): void {
    const list = this.selectedExercises();
    if (list.length === 0) return;
    this.exercisesPicked.emit(list);
    this.selectedExercises.set([]);
    this.close();
  }

  // Detalle del Ejercicio
  openExerciseDetail(exercise: ExerciseSummary): void {
    if (this.selectionMode()) {
      const current = [...this.selectedExercises()];
      const idx = current.findIndex((e) => e.id === exercise.id);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(exercise);
      this.selectedExercises.set(current);
      return;
    }
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
