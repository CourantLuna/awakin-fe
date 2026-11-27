import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewEncapsulation, inject } from '@angular/core';
import { BodyMapModelSvgComponent } from './svg/body-map-model-svg.component';

export type BodyMapView = 'front' | 'back' | 'both';
export type BodyMapGender = 'male' | 'female';
export type BodyMapAnatomyMode = 'advanced' | 'standard' | 'joints';

export interface MuscleRegion {
  id: string;
  name: string;
  views: Array<'front' | 'back'>;
}

const MUSCLE_REGIONS: Record<string, MuscleRegion> = {
  // --- Modelo Avanzado ---
  'neck': { id: 'neck', name: 'Cuello', views: ['front', 'back'] },
  'feet': { id: 'feet', name: 'Pies', views: ['front', 'back'] },
  'groin': { id: 'groin', name: 'Ingle', views: ['front'] },
  'upper-trapezius': { id: 'upper-trapezius', name: 'Trapecio superior', views: ['front', 'back'] },
  'upper-trapzeius': { id: 'upper-trapezius', name: 'Trapecio superior', views: ['front', 'back'] },
  'gastrocnemius': { id: 'gastrocnemius', name: 'Gastrocnemio', views: ['front', 'back'] },
  'tibialis': { id: 'tibialis', name: 'Tibial anterior', views: ['front'] },
  'soleus': { id: 'soleus', name: 'Sóleo', views: ['front', 'back'] },
  'outer-quadricep': { id: 'outer-quadricep', name: 'Cuádriceps lateral', views: ['front'] },
  'rectus-femoris': { id: 'rectus-femoris', name: 'Recto femoral', views: ['front'] },
  'inner-quadricep': { id: 'inner-quadricep', name: 'Cuádriceps medial', views: ['front'] },
  'inner-thigh': { id: 'inner-thigh', name: 'Aductores / muslo interno', views: ['front', 'back'] },
  'wrist-extensors': { id: 'wrist-extensors', name: 'Extensores de muñeca', views: ['front', 'back'] },
  'wrist-flexors': { id: 'wrist-flexors', name: 'Flexores de muñeca', views: ['front', 'back'] },
  'long-head-bicep': { id: 'long-head-bicep', name: 'Bíceps, cabeza larga', views: ['front'] },
  'short-head-bicep': { id: 'short-head-bicep', name: 'Bíceps, cabeza corta', views: ['front'] },
  'obliques': { id: 'obliques', name: 'Oblicuos', views: ['front'] },
  'lower-abdominals': { id: 'lower-abdominals', name: 'Abdominales inferiores', views: ['front'] },
  'upper-abdominals': { id: 'upper-abdominals', name: 'Abdominales superiores', views: ['front'] },
  'mid-lower-pectoralis': { id: 'mid-lower-pectoralis', name: 'Pectoral medio e inferior', views: ['front'] },
  'upper-pectoralis': { id: 'upper-pectoralis', name: 'Pectoral superior', views: ['front'] },
  'anterior-deltoid': { id: 'anterior-deltoid', name: 'Deltoides anterior', views: ['front'] },
  'lateral-deltoid': { id: 'lateral-deltoid', name: 'Deltoides lateral', views: ['front', 'back'] },
  'hands': { id: 'hands', name: 'Manos', views: ['front', 'back'] },
  'medial-hamstrings': { id: 'medial-hamstrings', name: 'Isquiotibiales mediales', views: ['back'] },
  'lateral-hamstrings': { id: 'lateral-hamstrings', name: 'Isquiotibiales laterales', views: ['back'] },
  'gluteus-maximus': { id: 'gluteus-maximus', name: 'Glúteo mayor', views: ['back'] },
  'gluteus-medius': { id: 'gluteus-medius', name: 'Glúteo medio', views: ['back'] },
  'lowerback': { id: 'lowerback', name: 'Zona lumbar', views: ['back'] },
  'lats': { id: 'lats', name: 'Dorsal ancho', views: ['back'] },
  'medial-head-triceps': { id: 'medial-head-triceps', name: 'Tríceps, cabeza medial', views: ['back'] },
  'long-head-triceps': { id: 'long-head-triceps', name: 'Tríceps, cabeza larga', views: ['back'] },
  'lateral-head-triceps': { id: 'lateral-head-triceps', name: 'Tríceps, cabeza lateral', views: ['back'] },
  'later-head-triceps': { id: 'lateral-head-triceps', name: 'Tríceps, cabeza lateral', views: ['back'] },
  'posterior-deltoid': { id: 'posterior-deltoid', name: 'Deltoides posterior', views: ['back'] },
  'lower-trapezius': { id: 'lower-trapezius', name: 'Trapecio inferior', views: ['back'] },
  'traps-middle': { id: 'traps-middle', name: 'Trapecio medio', views: ['back'] },

  // --- Modelo Estándar ---
  'calves': { id: 'calves', name: 'Pantorrillas', views: ['front', 'back'] },
  'quads': { id: 'quads', name: 'Cuádriceps', views: ['front'] },
  'abdominals': { id: 'abdominals', name: 'Abdominales', views: ['front'] },
  'forearms': { id: 'forearms', name: 'Antebrazos', views: ['front', 'back'] },
  'biceps': { id: 'biceps', name: 'Bíceps', views: ['front'] },
  'chest': { id: 'chest', name: 'Pectorales', views: ['front'] },
  'front-shoulders': { id: 'front-shoulders', name: 'Hombros anteriores', views: ['front'] },
  'traps': { id: 'traps', name: 'Trapecios', views: ['front', 'back'] },
  'triceps': { id: 'triceps', name: 'Tríceps', views: ['back'] },
  'hamstrings': { id: 'hamstrings', name: 'Isquiotibiales', views: ['back'] },
  'glutes': { id: 'glutes', name: 'Glúteos', views: ['back'] },
  'rear-shoulders': { id: 'rear-shoulders', name: 'Hombros posteriores', views: ['back'] },

  // --- Articulaciones (Joints) ---
  'shoulders': { id: 'shoulders', name: 'Articulación del hombro', views: ['front', 'back'] },
  'elbow': { id: 'elbow', name: 'Articulación del codo', views: ['front', 'back'] },
  'wrist': { id: 'wrist', name: 'Articulación de la muñeca', views: ['front', 'back'] },
  'hips': { id: 'hips', name: 'Articulación de la cadera', views: ['front'] },
  'knees': { id: 'knees', name: 'Articulación de la rodilla', views: ['front', 'back'] },
  'ankles': { id: 'ankles', name: 'Articulación del tobillo', views: ['front', 'back'] },
  'upper-spine': { id: 'upper-spine', name: 'Columna cervical / torácica', views: ['back'] },
  'lower-spine': { id: 'lower-spine', name: 'Columna lumbar', views: ['back'] },
  'scapula': { id: 'scapula', name: 'Escápula', views: ['back'] },
};

@Component({
  selector: 'app-body-map',
  standalone: true,
  imports: [BodyMapModelSvgComponent],
  templateUrl: './body-map.component.html',
  styleUrls: ['./body-map.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BodyMapComponent implements OnInit, OnChanges {
  /** Mantiene compatibilidad: controla qué orientaciones se renderizan. */
  @Input() viewMode: BodyMapView = 'both';
  /** Sexo inicial configurable desde el componente padre. */
  @Input() defaultGender: BodyMapGender = 'male';
  /** Orientación que se muestra inicialmente en el panel principal. */
  @Input() initialView: 'front' | 'back' = 'front';
  /** Tipo anatómico: advanced, standard o joints. */
  @Input() anatomyMode: BodyMapAnatomyMode = 'advanced';
  @Input() selectedMuscleId: string | null = null;
  @Input() selectedMuscleIds: string[] = [];
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Función callback opcional que puede pasarse como Input */
  @Input() onMuscleSelected?: (muscle: MuscleRegion) => void;
  /** Permite forzar o anular la visualización del overlay flotante con el nombre del músculo */
  @Input() showMuscleOverlay?: boolean;

  selectedGender: BodyMapGender = 'male';
  activeView: 'front' | 'back' = 'front';

  @Output() muscleSelected = new EventEmitter<MuscleRegion>();
  @Output() selectionCleared = new EventEmitter<void>();
  @Output() genderChanged = new EventEmitter<BodyMapGender>();
  @Output() viewChanged = new EventEmitter<'front' | 'back'>();
  @Output() anatomyModeChanged = new EventEmitter<BodyMapAnatomyMode>();

  readonly regions = MUSCLE_REGIONS;
  lastMuscleMode: 'advanced' | 'standard' = 'advanced';

  ngOnInit(): void {
    if (this.initialView) {
      this.activeView = this.initialView;
    }
    if (this.defaultGender) {
      this.selectedGender = this.defaultGender;
    }
    if (this.anatomyMode === 'standard' || this.anatomyMode === 'advanced') {
      this.lastMuscleMode = this.anatomyMode;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultGender']) {
      this.selectedGender = this.defaultGender;
    }
    if (changes['initialView']) {
      this.activeView = this.initialView;
    }
    if (changes['viewMode'] && this.viewMode !== 'both') {
      this.activeView = this.viewMode;
    }
    if (changes['anatomyMode'] && (this.anatomyMode === 'standard' || this.anatomyMode === 'advanced')) {
      this.lastMuscleMode = this.anatomyMode;
    }
    if (changes['selectedMuscleId'] || changes['selectedMuscleIds']) {
      this.syncSelectedElementClass();
    }
  }

  get hasMuscleSelectedHandler(): boolean {
    return !!this.onMuscleSelected || this.muscleSelected.observed;
  }

  get shouldShowOverlay(): boolean {
    if (this.showMuscleOverlay !== undefined) {
      return this.showMuscleOverlay;
    }
    return !this.hasMuscleSelectedHandler;
  }

  get isJointsMode(): boolean {
    return this.anatomyMode === 'joints';
  }

  get isStandardMode(): boolean {
    return this.anatomyMode === 'standard';
  }

  get isAdvancedMode(): boolean {
    return this.anatomyMode === 'advanced';
  }

  get currentMuscleModeLabel(): string {
    return (this.anatomyMode === 'standard' || (this.anatomyMode === 'joints' && this.lastMuscleMode === 'standard'))
      ? 'Estándar'
      : 'Avanzado';
  }

  toggleGender(): void {
    const nextGender: BodyMapGender = this.selectedGender === 'male' ? 'female' : 'male';
    this.setGender(nextGender);
  }

  setGender(gender: BodyMapGender): void {
    this.selectedGender = gender;
    this.genderChanged.emit(gender);
    this.syncSelectedElementClass();
  }

  toggleAnatomyMode(): void {
    const nextMode: 'advanced' | 'standard' =
      this.anatomyMode === 'standard'
        ? 'advanced'
        : (this.anatomyMode === 'advanced'
            ? 'standard'
            : (this.lastMuscleMode === 'advanced' ? 'standard' : 'advanced'));
    this.lastMuscleMode = nextMode;
    this.setAnatomyMode(nextMode);
  }

  setAnatomyMode(mode: BodyMapAnatomyMode): void {
    if (mode === 'advanced' || mode === 'standard') {
      this.lastMuscleMode = mode;
    }
    this.anatomyMode = mode;
    this.anatomyModeChanged.emit(mode);
    this.syncSelectedElementClass();
  }

  toggleJoints(): void {
    if (this.anatomyMode === 'joints') {
      this.setAnatomyMode(this.lastMuscleMode);
    } else {
      this.lastMuscleMode = this.anatomyMode === 'standard' ? 'standard' : 'advanced';
      this.setAnatomyMode('joints');
    }
  }

  switchView(view: 'front' | 'back', event?: Event): void {
    const target = event?.target as Element | null;
    if (target?.closest?.('[data-muscle-id], .bodymap, .joints')) {
      return;
    }
    if (view === this.activeView) return;
    event?.preventDefault();
    event?.stopPropagation();
    this.activeView = view;
    this.viewChanged.emit(view);
    this.syncSelectedElementClass();
  }

  get showFront(): boolean {
    return this.viewMode !== 'back';
  }

  get showBack(): boolean {
    return this.viewMode !== 'front';
  }

  get selectedRegion(): MuscleRegion | null {
    return this.selectedMuscleId ? MUSCLE_REGIONS[this.selectedMuscleId] ?? null : null;
  }

  onSvgClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const regionElement = target.closest<SVGGElement>('[data-muscle-id], .bodymap, .joints');
    if (!regionElement) return;

    const id = regionElement.dataset['muscleId'] || regionElement.id;
    if (!id || id === 'body') return;

    this.selectMuscle(id, regionElement);
  }

  onSvgKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const regionElement = target.closest<SVGGElement>('[data-muscle-id], .bodymap, .joints');
    if (!regionElement) return;

    const id = regionElement.dataset['muscleId'] || regionElement.id;
    if (!id || id === 'body') return;

    event.preventDefault();
    this.selectMuscle(id, regionElement);
  }

  clearSelection(): void {
    this.selectedElement?.classList.remove('is-selected');
    this.selectedElement = null;
    this.selectedMuscleId = null;
    this.selectionCleared.emit();
  }

  private selectedElement: SVGGElement | null = null;

  private selectMuscle(id: string | undefined, element: SVGGElement): void {
    if (!id) return;
    const region = MUSCLE_REGIONS[id];
    if (!region) return;

    this.selectedElement?.classList.remove('is-selected');
    element.classList.add('is-selected');
    this.selectedElement = element;
    this.selectedMuscleId = region.id;
    this.muscleSelected.emit(region);
    this.onMuscleSelected?.(region);
  }

  private syncSelectedElementClass(): void {
    setTimeout(() => {
      const root = this.elementRef.nativeElement;
      root.querySelectorAll('.body-map__region.is-selected').forEach((el) => el.classList.remove('is-selected'));
      const ids = this.selectedMuscleIds?.length
        ? this.selectedMuscleIds
        : this.selectedMuscleId
          ? [this.selectedMuscleId]
          : [];
      for (const id of ids) {
        root.querySelectorAll<SVGGElement>(`[data-muscle-id="${id}"]`).forEach((el) => {
          el.classList.add('is-selected');
        });
      }
    }, 0);
  }
}
