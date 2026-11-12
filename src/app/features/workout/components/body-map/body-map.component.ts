import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

export type BodyMapView = 'front' | 'back' | 'both';
export type BodyMapGender = 'male' | 'female';
export type BodyMapAnatomyMode = 'advanced' | 'standard' | 'joints';

export interface MuscleRegion {
  id: string;
  name: string;
  views: Array<'front' | 'back'>;
}

const MUSCLE_REGIONS: Record<string, MuscleRegion> = {
  'neck': { id: 'neck', name: 'Cuello', views: ['front', 'back'] },
  'feet': { id: 'feet', name: 'Pies', views: ['front', 'back'] },
  'groin': { id: 'groin', name: 'Ingle', views: ['front'] },
  'upper-trapezius': { id: 'upper-trapezius', name: 'Trapecio superior', views: ['front', 'back'] },
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
  'posterior-deltoid': { id: 'posterior-deltoid', name: 'Deltoides posterior', views: ['back'] },
  'lower-trapezius': { id: 'lower-trapezius', name: 'Trapecio inferior', views: ['back'] },
  'traps-middle': { id: 'traps-middle', name: 'Trapecio medio', views: ['back'] },
};

@Component({
  selector: 'app-body-map',
  standalone: true,
  templateUrl: './body-map.component.html',
  styleUrls: ['./body-map.component.scss']
})
export class BodyMapComponent implements OnInit, OnChanges {
  /** Mantiene compatibilidad: controla qué orientaciones se renderizan. */
  @Input() viewMode: BodyMapView = 'both';
  /** Sexo inicial configurable desde el componente padre. */
  @Input() defaultGender: BodyMapGender = 'male';
  /** Orientación que se muestra inicialmente en el panel principal. */
  @Input() initialView: 'front' | 'back' = 'front';
  /** Tipo anatómico reservado para los futuros SVG estándar y de articulaciones. */
  @Input() anatomyMode: BodyMapAnatomyMode = 'advanced';
  @Input() selectedMuscleId: string | null = null;
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

  readonly regions = MUSCLE_REGIONS;

  ngOnInit(): void {
    if (this.initialView) {
      this.activeView = this.initialView;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultGender']) {
      // El único recurso gráfico disponible en esta versión es el modelo masculino.
      this.selectedGender = this.defaultGender === 'female' ? 'male' : this.defaultGender;
    }
    if (changes['initialView']) {
      this.activeView = this.initialView;
    }
    if (changes['viewMode'] && this.viewMode !== 'both') {
      this.activeView = this.viewMode;
    }
    if (changes['selectedMuscleId']) {
      if (!this.selectedMuscleId) {
        this.selectedElement?.classList.remove('is-selected');
        this.selectedElement = null;
      } else {
        this.syncSelectedElementClass();
      }
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

  setGender(gender: BodyMapGender): void {
    // Solo existe el SVG masculino avanzado en esta entrega.
    if (gender !== 'male') return;
    this.selectedGender = gender;
    this.genderChanged.emit(gender);
  }

  switchView(view: 'front' | 'back', event?: Event): void {
    const target = event?.target as Element | null;
    if (target?.closest?.('[data-muscle-id]')) {
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

    const regionElement = target.closest<SVGGElement>('[data-muscle-id]');
    if (!regionElement) return;

    this.selectMuscle(regionElement.dataset['muscleId'], regionElement);
  }

  onSvgKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const regionElement = target.closest<SVGGElement>('[data-muscle-id]');
    if (!regionElement) return;

    event.preventDefault();
    this.selectMuscle(regionElement.dataset['muscleId'], regionElement);
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
    this.selectedMuscleId = id;
    this.muscleSelected.emit(region);
    this.onMuscleSelected?.(region);
  }

  private syncSelectedElementClass(): void {
    if (!this.selectedMuscleId) return;
    setTimeout(() => {
      if (!this.selectedMuscleId) return;
      const el = document.querySelector<SVGGElement>(
        `.body-map__figure.is-main [data-muscle-id="${this.selectedMuscleId}"]`
      );
      if (el) {
        this.selectedElement?.classList.remove('is-selected');
        el.classList.add('is-selected');
        this.selectedElement = el;
      }
    }, 0);
  }
}
