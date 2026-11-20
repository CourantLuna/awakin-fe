import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import * as htmlToImage from 'html-to-image';

import { WorkoutLog, WorkoutLogExercise } from '../../models/workout.models';
import { AthleteProfile } from '../../../../core/services/athlete.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { BodyMapGender } from '../body-map/body-map.component';
import {
  WorkoutMiniBodyMapComponent,
  WorkoutMuscleLegendItem,
  getAwakinSunTone,
  getMuscleCssVariableNames
} from '../body-map/workout-mini-body-map.component';

export type StoryTemplateId =
  | 'bodymap'
  | 'radar'
  | 'exercises'
  | 'grid2x2'
  | 'minimal'
  | 'ritual';

export type StoryAspectRatio = '9:16' | '4:5' | '1:1';
export type StoryCardStyle = 'transparent' | 'glass' | 'dark';

export interface StoryTemplateOption {
  id: StoryTemplateId;
  label: string;
  icon: string;
  description: string;
}

interface RadarPoint {
  label: string;
  value: number;
  angle: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor: string;
}

@Component({
  selector: 'app-workout-story-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    WorkoutMiniBodyMapComponent
  ],
  templateUrl: './workout-story-modal.component.html',
  styleUrls: ['./workout-story-modal.component.scss']
})
export class WorkoutStoryModalComponent implements OnChanges {
  public themeService = inject(ThemeService);

  @Input() visible: boolean = false;
  @Input() log: WorkoutLog | null = null;
  @Input() athlete: AthleteProfile | null = null;
  @Input() gender: BodyMapGender = 'male';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('storyCaptureArea') storyCaptureArea!: ElementRef<HTMLDivElement>;
  @ViewChild('customPhotoFileInput') customPhotoFileInput!: ElementRef<HTMLInputElement>;

  // Templates
  readonly templates: StoryTemplateOption[] = [
    {
      id: 'bodymap',
      label: 'Body Map',
      icon: 'pi pi-user',
      description: 'Músculos estimulados en vista frontal y dorsal'
    },
    {
      id: 'radar',
      label: 'Radar Muscular',
      icon: 'pi pi-compass',
      description: 'Distribución polar de series por grupos musculares'
    },
    {
      id: 'exercises',
      label: 'Ejercicios',
      icon: 'pi pi-list',
      description: 'Lista limpia de ejercicios y series completadas'
    },
    {
      id: 'grid2x2',
      label: 'Grid Métricas',
      icon: 'pi pi-th-large',
      description: 'Duración, volumen, ejercicios y series en 4 bloques'
    },
    {
      id: 'minimal',
      label: 'Minimal Stats',
      icon: 'pi pi-align-center',
      description: 'Estadísticas clave en tipografía elegante y limpia'
    },
    {
      id: 'ritual',
      label: 'Tribu Awakin',
      icon: 'pi pi-shield',
      description: 'Edición oficial de culto con banner de tribu y lema'
    }
  ];

  selectedTemplate = signal<StoryTemplateId>('bodymap');
  aspectRatio = signal<StoryAspectRatio>('9:16');
  cardStyle = signal<StoryCardStyle>('transparent'); // Default: 'Limpio' (sin fondo)
  dimLevel = signal<number>(35); // 0 - 75%
  activeTool = signal<'template' | 'background' | 'ratio' | 'contrast' | 'overlay' | 'transform' | null>(null);

  toggleTool(tool: 'template' | 'background' | 'ratio' | 'contrast' | 'overlay' | 'transform'): void {
    this.activeTool.update((curr) => (curr === tool ? null : tool));
  }

  closeTool(): void {
    this.activeTool.set(null);
  }

  captureBoxStyle = computed(() => {
    switch (this.aspectRatio()) {
      case '4:5':
        return {
          width: 'min(100cqw, calc(100cqh * 4 / 5))',
          height: 'min(100cqh, calc(100cqw * 5 / 4))',
        };
      case '1:1':
        return {
          width: 'min(100cqw, 100cqh)',
          height: 'min(100cqw, 100cqh)',
        };
      case '9:16':
      default:
        return {
          width: 'min(100cqw, calc(100cqh * 9 / 16))',
          height: 'min(100cqh, calc(100cqw * 16 / 9))',
        };
    }
  });

  // Señales reactivas internas vinculadas a los Inputs
  currentLog = signal<WorkoutLog | null>(null);
  currentAthlete = signal<AthleteProfile | null>(null);
  currentGender = signal<BodyMapGender>('male');

  // Gesto táctil pinch-to-zoom en mobile
  private initialPinchDistance = 0;
  private initialPinchScale = 1;

  // Fondo
  backgroundMode = signal<'auto' | 'custom' | 'dark'>('auto');
  customPhotoUrl = signal<string | null>(null);

  // Drag & Zoom Controls: rango 30% a 100%
  overlayScale = signal<number>(0.85); // 0.30 a 1.00
  overlayPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private initialPos = { x: 0, y: 0 };

  // Export State
  isExporting = signal<boolean>(false);
  exportAction = signal<'download' | 'share' | null>(null);

  // Fecha del entrenamiento formateada en estilo moderno y aesthetic
  workoutDateFormatted = computed(() => {
    const log = this.currentLog();
    const raw = log?.workout_date || log?.created_at;
    const d = raw ? new Date(raw) : new Date();
    if (isNaN(d.getTime())) {
      return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    }
    const day = d.getDate();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const month = months[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  });

  // Computed Properties reactivas
  activeBackgroundUrl = computed(() => {
    const mode = this.backgroundMode();
    if (mode === 'dark') return null;
    if (mode === 'custom' && this.customPhotoUrl()) return this.customPhotoUrl();
    if (this.customPhotoUrl()) return this.customPhotoUrl();
    return this.currentLog()?.photo_url || null;
  });

  hasAnyPhoto = computed(() => {
    return !!(this.customPhotoUrl() || this.currentLog()?.photo_url);
  });

  aspectRatioClass = computed(() => {
    switch (this.aspectRatio()) {
      case '4:5':
        return 'aspect-[4/5]';
      case '1:1':
        return 'aspect-square';
      case '9:16':
      default:
        return 'aspect-[9/16]';
    }
  });

  athleteDisplayName = computed(() => {
    const ath = this.currentAthlete();
    const fullName = `${ath?.first_name || ''} ${ath?.last_name || ''}`.trim();
    if (fullName) return fullName;
    if (ath?.username) return `@${ath.username}`;
    return 'Atleta Awakin';
  });

  athleteHandle = computed(() => {
    const ath = this.currentAthlete();
    if (ath?.username) return `@${ath.username}`;
    if (ath?.first_name) return `@${ath.first_name.toLowerCase().replace(/\s+/g, '')}`;
    return '@awakinapp';
  });

  routineTitle = computed(() => {
    const name = this.currentLog()?.routine_name?.trim();
    if (name && !name.toLowerCase().includes('entrenamiento del d')) {
      return name;
    }
    return this.workoutDateFormatted();
  });

  formattedDuration = computed(() => {
    const mins = Math.max(1, Math.round(this.currentLog()?.duration_minutes || 0));
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${mins} min`;
  });

  formattedVolume = computed(() => {
    const vol = Math.round(this.currentLog()?.total_volume || 0);
    const unit = this.currentLog()?.volume_unit || 'lb';
    return `${vol.toLocaleString('en-US')} ${unit}`;
  });

  totalSets = computed(() => {
    return this.currentLog()?.total_sets || 0;
  });

  totalExercises = computed(() => {
    return this.currentLog()?.exercises?.length || 0;
  });

  muscleBreakdown = computed<WorkoutMuscleLegendItem[]>(() => {
    const log = this.currentLog();
    if (!log) return [];

    const muscleMap = new Map<string, number>();

    // 1. Contar desde los ejercicios del log
    if (log.exercises && log.exercises.length > 0) {
      for (const ex of log.exercises) {
        let completedCount = (ex.sets || []).filter((s: any) => s.is_completed !== false).length;
        if (completedCount === 0) {
          completedCount = ex.sets?.length || 1;
        }
        const rawTarget = ex.target_muscle || (ex as any).muscle || (ex as any).body_part || 'General';
        const key = this.translateMuscle(rawTarget);
        if (key && key !== 'General') {
          muscleMap.set(key, (muscleMap.get(key) || 0) + completedCount);
        }
      }
    }

    // 2. Si no había ejercicios cargados o el map quedó vacío, usar sets_by_muscle
    if (muscleMap.size === 0 && log.sets_by_muscle) {
      for (const [k, v] of Object.entries(log.sets_by_muscle)) {
        const val = Number(v || 0);
        if (val > 0) {
          const key = this.translateMuscle(k);
          if (key && key !== 'General') {
            muscleMap.set(key, (muscleMap.get(key) || 0) + val);
          }
        }
      }
    }

    // 3. Fallback inteligente según el nombre de la rutina si aún está vacío
    if (muscleMap.size === 0 && log.routine_name) {
      const rn = log.routine_name.toLowerCase();
      if (rn.includes('glúteo') || rn.includes('gluteo') || rn.includes('glute')) muscleMap.set('Glúteos', 4);
      if (rn.includes('femoral') || rn.includes('isquio') || rn.includes('hamstring')) muscleMap.set('Isquiotibiales', 4);
      if (rn.includes('cuádricep') || rn.includes('cuadricep') || rn.includes('quad')) muscleMap.set('Cuádriceps', 4);
      if (rn.includes('pecho') || rn.includes('chest') || rn.includes('pec')) muscleMap.set('Pecho', 4);
      if (rn.includes('espalda') || rn.includes('back') || rn.includes('dorsal') || rn.includes('lat')) muscleMap.set('Dorsales', 4);
      if (rn.includes('hombro') || rn.includes('shoulder') || rn.includes('delt')) muscleMap.set('Hombros', 4);
      if (rn.includes('brazo') || rn.includes('bicep') || rn.includes('tricep')) {
        muscleMap.set('Bíceps', 3);
        muscleMap.set('Tríceps', 3);
      }
      if (rn.includes('pantorrilla') || rn.includes('gemelo') || rn.includes('calf')) muscleMap.set('Pantorrillas', 3);
      if (rn.includes('core') || rn.includes('ab') || rn.includes('oblicuo')) muscleMap.set('Abdomen', 3);
      if (rn.includes('leg') || rn.includes('pierna')) {
        muscleMap.set('Cuádriceps', 4);
        muscleMap.set('Glúteos', 4);
      }
    }

    const list = Array.from(muscleMap.entries()).map(([muscle, sets]) => ({ muscle, sets }));
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

  // Radar Chart Data Calculation
  radarChartData = computed(() => {
    const log = this.currentLog();
    const buckets: Record<string, number> = {
      Espalda: 0,
      Piernas: 0,
      Pecho: 0,
      Brazos: 0,
      Core: 0,
      Hombros: 0
    };

    const byMuscle = log?.sets_by_muscle || {};
    for (const [rawMuscle, sets] of Object.entries(byMuscle)) {
      const m = rawMuscle.toLowerCase();
      const val = Number(sets || 0);
      if (m.includes('lat') || m.includes('back') || m.includes('espalda') || m.includes('trap') || m.includes('rhomb')) {
        buckets['Espalda'] += val;
      } else if (m.includes('glute') || m.includes('quad') || m.includes('ham') || m.includes('calv') || m.includes('pierna') || m.includes('cuádriceps') || m.includes('glúteo')) {
        buckets['Piernas'] += val;
      } else if (m.includes('pec') || m.includes('chest') || m.includes('pecho')) {
        buckets['Pecho'] += val;
      } else if (m.includes('bicep') || m.includes('tricep') || m.includes('forearm') || m.includes('brazo')) {
        buckets['Brazos'] += val;
      } else if (m.includes('core') || m.includes('ab') || m.includes('waist') || m.includes('abdominal')) {
        buckets['Core'] += val;
      } else if (m.includes('delt') || m.includes('shoulder') || m.includes('hombro')) {
        buckets['Hombros'] += val;
      }
    }

    if (log?.exercises) {
      for (const ex of log.exercises) {
        let completed = (ex.sets || []).filter((s: any) => s.is_completed !== false).length;
        if (completed === 0) completed = ex.sets?.length || 1;
        const m = (ex.target_muscle || '').toLowerCase();
        if (m.includes('lat') || m.includes('back') || m.includes('espalda') || m.includes('trap')) buckets['Espalda'] += completed;
        else if (m.includes('glute') || m.includes('quad') || m.includes('ham') || m.includes('calv') || m.includes('pierna') || m.includes('cuádriceps') || m.includes('glúteo')) buckets['Piernas'] += completed;
        else if (m.includes('pec') || m.includes('chest') || m.includes('pecho')) buckets['Pecho'] += completed;
        else if (m.includes('bicep') || m.includes('tricep') || m.includes('forearm') || m.includes('brazo')) buckets['Brazos'] += completed;
        else if (m.includes('core') || m.includes('ab') || m.includes('waist') || m.includes('abdominal')) buckets['Core'] += completed;
        else if (m.includes('delt') || m.includes('shoulder') || m.includes('hombro')) buckets['Hombros'] += completed;
      }
    }

    const order = ['Espalda', 'Piernas', 'Pecho', 'Brazos', 'Core', 'Hombros'];
    const maxVal = Math.max(...order.map((k) => buckets[k]), 1);

    const size = 260;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 85;

    const points: RadarPoint[] = order.map((label, idx) => {
      const deg = -90 + idx * 60;
      const rad = (deg * Math.PI) / 180;
      const val = buckets[label] || 0;
      const ratio = val > 0 ? Math.max(0.12, Math.min(1.0, val / maxVal)) : 0.08;

      const x = cx + radius * ratio * Math.cos(rad);
      const y = cy + radius * ratio * Math.sin(rad);

      const labelDist = radius + 26;
      const labelX = cx + labelDist * Math.cos(rad);
      const labelY = cy + labelDist * Math.sin(rad) + 4;

      let anchor = 'middle';
      if (Math.cos(rad) > 0.3) anchor = 'start';
      else if (Math.cos(rad) < -0.3) anchor = 'end';

      return {
        label,
        value: val,
        angle: deg,
        x,
        y,
        labelX,
        labelY,
        anchor
      };
    });

    const polygonPoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const rings = [0.33, 0.66, 1.0].map((rRatio) => {
      const ringPts = order.map((_, idx) => {
        const deg = -90 + idx * 60;
        const rad = (deg * Math.PI) / 180;
        const rx = cx + radius * rRatio * Math.cos(rad);
        const ry = cy + radius * rRatio * Math.sin(rad);
        return `${rx.toFixed(1)},${ry.toFixed(1)}`;
      });
      return ringPts.join(' ');
    });

    const spokes = order.map((_, idx) => {
      const deg = -90 + idx * 60;
      const rad = (deg * Math.PI) / 180;
      return {
        x2: cx + radius * Math.cos(rad),
        y2: cy + radius * Math.sin(rad)
      };
    });

    return {
      size,
      cx,
      cy,
      rings,
      spokes,
      points,
      polygonPoints,
      hasData: Object.values(buckets).some((v) => v > 0)
    };
  });

  // Lista de ejercicios formateada con series
  formattedExercises = computed(() => {
    const list = this.currentLog()?.exercises || [];
    return list.slice(0, 6).map((ex: WorkoutLogExercise) => {
      const completed = (ex.sets || []).filter((s: any) => s.is_completed !== false).length || ex.sets?.length || 1;
      return {
        name: ex.exercise_name,
        setsCount: completed,
        targetMuscle: ex.target_muscle
      };
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['log']) {
      this.currentLog.set(this.log);
      if (this.log?.photo_url) {
        this.backgroundMode.set('auto');
      } else {
        this.backgroundMode.set('dark');
      }
    }
    if (changes['athlete']) {
      this.currentAthlete.set(this.athlete);
    }
    if (changes['gender']) {
      this.currentGender.set(this.gender);
    }
    if (changes['visible'] && this.visible) {
      this.resetEditorState();
    }
  }

  resetEditorState(): void {
    this.currentLog.set(this.log);
    this.currentAthlete.set(this.athlete);
    this.currentGender.set(this.gender);
    this.overlayScale.set(0.85);
    this.overlayPosition.set({ x: 0, y: 0 });
    this.customPhotoUrl.set(null);
    this.cardStyle.set('transparent');
    this.activeTool.set(null);
    if (this.log?.photo_url) {
      this.backgroundMode.set('auto');
    } else {
      this.backgroundMode.set('dark');
    }
  }

  closeModal(): void {
    this.activeTool.set(null);
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }

  // --- Manejo de Fondo e Imágenes ---
  onSelectPhotoClick(): void {
    if (this.customPhotoFileInput) {
      this.customPhotoFileInput.nativeElement.click();
    }
  }

  onCustomPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.customPhotoUrl.set(e.target?.result as string);
        this.backgroundMode.set('custom');
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  setDarkBackground(): void {
    this.backgroundMode.set('dark');
  }

  setOriginalLogPhoto(): void {
    if (this.log?.photo_url) {
      this.backgroundMode.set('auto');
      this.customPhotoUrl.set(null);
    }
  }

  // --- Controles de Escala / Zoom (30% a 105%) ---
  zoomIn(): void {
    const next = Math.min(1.05, Math.round((this.overlayScale() + 0.05) * 100) / 100);
    this.overlayScale.set(next);
  }

  zoomOut(): void {
    const next = Math.max(0.30, Math.round((this.overlayScale() - 0.05) * 100) / 100);
    this.overlayScale.set(next);
  }

  setZoom(val: any): void {
    const num = Number(val);
    if (!isNaN(num)) {
      this.overlayScale.set(Math.max(0.30, Math.min(1.05, num)));
    }
  }

  // Zoom interactivo con rueda del ratón (Mouse Scroll Wheel)
  onWheelZoom(event: WheelEvent): void {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.04 : -0.04;
    const next = Math.max(0.30, Math.min(1.05, Math.round((this.overlayScale() + delta) * 100) / 100));
    this.overlayScale.set(next);
  }

  alignTop(): void {
    this.overlayPosition.set({ x: 0, y: -80 });
  }

  alignCenter(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  alignBottom(): void {
    this.overlayPosition.set({ x: 0, y: 80 });
  }

  resetPosition(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
    this.overlayScale.set(0.85);
  }

  // --- Drag & Drop del Overlay Card (Mouse & Touch con Pinch-to-Zoom para mobile) ---
  onDragStart(event: MouseEvent | TouchEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, a')) return;

    if ('touches' in event) {
      if (event.touches.length === 2) {
        // Gesto de pellizco (Pinch-to-zoom en móvil)
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        this.initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        this.initialPinchScale = this.overlayScale();
        this.isDragging = false;
        event.preventDefault();
        return;
      }
      if (event.touches.length === 1) {
        this.isDragging = true;
        this.dragStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        this.initialPos = { ...this.overlayPosition() };
        event.preventDefault();
      }
    } else {
      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.initialPos = { ...this.overlayPosition() };
      event.preventDefault();
    }
  }

  onDragMove(event: MouseEvent | TouchEvent): void {
    if ('touches' in event) {
      if (event.touches.length === 2 && this.initialPinchDistance > 0) {
        // Pinch-to-zoom activo en móvil
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = currentDistance / this.initialPinchDistance;
        const newScale = Math.max(0.30, Math.min(1.0, this.initialPinchScale * factor));
        this.overlayScale.set(Math.round(newScale * 100) / 100);
        event.preventDefault();
        return;
      }
      if (event.touches.length === 1 && this.isDragging) {
        const deltaX = event.touches[0].clientX - this.dragStart.x;
        const deltaY = event.touches[0].clientY - this.dragStart.y;
        const maxShiftX = 140;
        const maxShiftY = 180;
        this.overlayPosition.set({
          x: Math.max(-maxShiftX, Math.min(maxShiftX, this.initialPos.x + deltaX)),
          y: Math.max(-maxShiftY, Math.min(maxShiftY, this.initialPos.y + deltaY))
        });
        event.preventDefault();
      }
    } else if (this.isDragging) {
      const deltaX = event.clientX - this.dragStart.x;
      const deltaY = event.clientY - this.dragStart.y;
      const maxShiftX = 140;
      const maxShiftY = 180;
      this.overlayPosition.set({
        x: Math.max(-maxShiftX, Math.min(maxShiftX, this.initialPos.x + deltaX)),
        y: Math.max(-maxShiftY, Math.min(maxShiftY, this.initialPos.y + deltaY))
      });
    }
  }

  onDragEnd(): void {
    this.isDragging = false;
    this.initialPinchDistance = 0;
  }

  // --- Exportación a Imagen PNG de Alta Resolución (Soporta OKLCH nativamente) ---
  async exportStory(action: 'download' | 'share'): Promise<void> {
    if (this.isExporting() || !this.storyCaptureArea) return;

    this.isExporting.set(true);
    this.exportAction.set(action);

    try {
      const element = this.storyCaptureArea.nativeElement;

      // Inyectar atributos SVG nativos antes de exportar para que foreignObject conserve colores y oculte articulaciones
      this.prepareSvgForExport(element);

      const renderOptions = {
        quality: 0.95,
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#0C0A09'
      };

      // Fix para Safari/WebKit: primer render calienta el foreignObject
      const isWebKit = /Safari|iPhone|iPad|iPod/i.test(navigator.userAgent) && !/Chrome|CriOS/i.test(navigator.userAgent);
      if (isWebKit) {
        try {
          await htmlToImage.toPng(element, renderOptions);
        } catch {}
      }

      const dataUrl = await htmlToImage.toPng(element, renderOptions);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = `awakin-workout-${Date.now()}.png`;

      if (action === 'download') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Entrenamiento Awakin',
            text: `¡Completé mi sesión: ${this.routineTitle()} con Awakin!`
          });
        } else {
          // Fallback descarga
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = filename;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.error('Error exportando historia:', err);
    } finally {
      this.isExporting.set(false);
      this.exportAction.set(null);
    }
  }

  private prepareSvgForExport(container: HTMLElement): void {
    if (!container) return;

    // 1. Ocultar todas las articulaciones (joints) forzosamente
    const joints = container.querySelectorAll<SVGGraphicsElement>(
      '.joints, [data-muscle-id="shoulders"], [data-muscle-id="hips"], [data-muscle-id="knees"], [data-muscle-id="ankles"], [data-muscle-id="wrist"], [data-muscle-id="elbow"], [data-muscle-id="upper-spine"], [data-muscle-id="scapula"], [data-muscle-id="lower-spine"]'
    );
    joints.forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('display', 'none');
    });

    // 2. Mapear colores de los músculos
    const breakdown = this.muscleBreakdown();
    const maxSets = Math.max(...breakdown.map((m) => m.sets), 1);
    const muscleColorMap = new Map<string, string>();
    const kinPrimary = this.themeService.kinPrimaryColor();
    const kinSecondary = this.themeService.kinSecondaryColor();

    for (const item of breakdown) {
      const color =
        item.color || getAwakinSunTone(item.sets, maxSets, kinPrimary, kinSecondary).color;
      const varNames = getMuscleCssVariableNames(item.muscle);
      for (const vName of varNames) {
        const id = vName.replace('--muscle-', '');
        muscleColorMap.set(id, color);
      }
    }

    const defaultMuscleFill = 'rgba(255, 255, 255, 0.42)';

    // 3. Inyectar fill nativo en cada región muscular y sus paths
    const regions = container.querySelectorAll<SVGGraphicsElement>('.body-map__region:not(.joints)');
    regions.forEach((region) => {
      const id = region.getAttribute('data-muscle-id') || region.id;
      const fill = (id && muscleColorMap.get(id)) || defaultMuscleFill;

      region.setAttribute('fill', fill);
      region.style.fill = fill;
      region.style.color = fill;

      const paths = region.querySelectorAll<SVGPathElement>('path');
      paths.forEach((p) => {
        p.setAttribute('fill', fill);
        p.style.fill = fill;
      });
    });

    // 4. Inyectar silueta del cuerpo y todas las líneas de contorno con stroke visible explícito
    const strokeColor = 'rgba(255, 255, 255, 0.88)';
    const contourElements = container.querySelectorAll<SVGGraphicsElement>(
      '.body-map__model path, .body-map__model line, [id*="body"] path, [id*="body"] line, path[fill="none"], line[fill="none"], path[stroke], line[stroke]'
    );
    contourElements.forEach((el) => {
      el.setAttribute('fill', 'none');
      el.style.fill = 'none';
      el.setAttribute('stroke', strokeColor);
      el.style.stroke = strokeColor;
    });
  }

  private translateMuscle(raw: string): string {
    const clean = (raw || '').toLowerCase().trim();
    if (clean.includes('chest') || clean.includes('pecho')) return 'Pecho';
    if (clean.includes('quad') || clean.includes('cuádriceps') || clean.includes('cuadriceps')) return 'Cuádriceps';
    if (clean.includes('glute') || clean.includes('glúteo') || clean.includes('gluteo')) return 'Glúteos';
    if (clean.includes('hamstring') || clean.includes('isquio') || clean.includes('femoral')) return 'Isquiotibiales';
    if (clean.includes('back') || clean.includes('espalda') || clean.includes('dorsal')) return 'Dorsales';
    if (clean.includes('trap') || clean.includes('trapecio')) return 'Trapecios';
    if (clean.includes('shoulder') || clean.includes('hombro') || clean.includes('delt')) return 'Hombros';
    if (clean.includes('bicep') || clean.includes('bíceps')) return 'Bíceps';
    if (clean.includes('tricep') || clean.includes('tríceps')) return 'Tríceps';
    if (clean.includes('calf') || clean.includes('calves') || clean.includes('pantorrilla') || clean.includes('gemelo')) return 'Pantorrillas';
    if (clean.includes('ab') || clean.includes('core') || clean.includes('oblicuo')) return 'Abdomen';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}
