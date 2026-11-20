import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import * as htmlToImage from 'html-to-image';

import { AthleteProfile, KinInfo } from '../../../../core/services/athlete.service';
import { formatQuantity } from '../../../../core/helpers/nutrition-optimizer';

export interface StoryShareData {
  photoUrl: string;
  photoUrls?: string[];
  dateFormatted: string;
  mealTitle: string;
  dishName: string;
  emoji: string;
  portionText: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: any[] | null;
  dishId?: string;
  dishes?: { name: string; portionText: string; kcal: number }[];
  adherence?: string;
}

export function translateMealType(raw?: string | null): string {
  if (!raw) return 'Comida';
  const clean = raw.trim();
  const normalized = clean.toUpperCase().replace(/[-_]/g, ' ');

  switch (normalized) {
    case 'BREAKFAST':
    case 'DESAYUNO':
      return 'Desayuno';
    case 'SNACK AM':
    case 'MEDIA MANANA':
    case 'MEDIA MAÑANA':
    case 'SNACK MAÑANA':
    case 'SNACK MANANA':
      return 'Snack Mañana';
    case 'LUNCH':
    case 'ALMUERZO':
      return 'Almuerzo';
    case 'SNACK PM':
    case 'MERIENDA':
    case 'SNACK TARDE':
      return 'Snack Tarde';
    case 'DINNER':
    case 'CENA':
      return 'Cena';
    case 'SNACK EXTRA':
      return 'Snack Extra';
    case 'DRINK':
    case 'DRINKS':
    case 'BEBIDA':
    case 'BEBIDAS':
      return 'Bebida';
    case 'OTHER':
    case 'OTRO':
      return 'Otro';
    default:
      return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
}

export type FoodStoryTemplateId =
  | 'macroring'
  | 'grid2x2'
  | 'chef'
  | 'ritual'
  | 'minimal'
  | 'adherence';

export type FoodStoryAspectRatio = '9:16' | '4:5' | '1:1';
export type FoodStoryCardStyle = 'transparent' | 'glass' | 'dark';

export interface FoodStoryTemplateOption {
  id: FoodStoryTemplateId;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-food-story-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './food-story-modal.component.html',
  styleUrls: ['./food-story-modal.component.scss'],
})
export class FoodStoryModalComponent implements OnChanges, OnDestroy {
  protected readonly Math = Math;

  private readonly boundTouchStart = (e: TouchEvent) => this.handleNativeTouchStart(e);
  private readonly boundTouchMove = (e: TouchEvent) => this.handleNativeTouchMove(e);
  private readonly boundTouchEnd = (e: TouchEvent) => this.handleNativeTouchEnd(e);

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', this.boundTouchStart, { passive: false });
      document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
      document.addEventListener('touchend', this.boundTouchEnd, { passive: true });
      document.addEventListener('touchcancel', this.boundTouchEnd, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('touchstart', this.boundTouchStart);
      document.removeEventListener('touchmove', this.boundTouchMove);
      document.removeEventListener('touchend', this.boundTouchEnd);
      document.removeEventListener('touchcancel', this.boundTouchEnd);
    }
  }

  @Input() visible: boolean = false;
  @Input() storyData: StoryShareData | null = null;
  @Input() athlete: AthleteProfile | null = null;
  @Input() athleteKin: KinInfo | null | undefined = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  @Output() shareFeed = new EventEmitter<Blob>();

  @ViewChild('storyCaptureArea') storyCaptureArea!: ElementRef<HTMLDivElement>;

  // Variantes de plantillas para historias de comida
  readonly templates: FoodStoryTemplateOption[] = [
    {
      id: 'macroring',
      label: 'Anillo de Macros',
      icon: 'pi pi-chart-pie',
      description: 'Donut polar de distribución de macronutrientes con calorías centrales',
    },
    {
      id: 'grid2x2',
      label: '4 Métricas',
      icon: 'pi pi-th-large',
      description: 'Calorías, proteína, carbohidratos y grasas en 4 bloques estilizados',
    },
    {
      id: 'chef',
      label: 'Platillos & Receta',
      icon: 'pi pi-list',
      description: 'Lista de alimentos, porciones e ingredientes con barra de macros',
    },
    {
      id: 'ritual',
      label: 'Tribu Awakin',
      icon: 'pi pi-shield',
      description: 'Edición oficial de culto: emblema de tribu, lema sagrado y macros',
    },
    {
      id: 'minimal',
      label: 'Sticker Minimal',
      icon: 'pi pi-tag',
      description: 'Sticker flotante estético ultra limpio para destacar tu comida',
    },
    {
      id: 'adherence',
      label: '100% En El Plan',
      icon: 'pi pi-check-circle',
      description: 'Sello oficial de disciplina y cumplimiento estricto del protocolo',
    },
  ];

  selectedTemplate = signal<FoodStoryTemplateId>('macroring');
  aspectRatio = signal<FoodStoryAspectRatio>('9:16');
  cardStyle = signal<FoodStoryCardStyle>('transparent'); // Default: 'Limpio' (directo sobre la foto)
  dimLevel = signal<number>(25); // 0 - 75%
  activeTool = signal<'template' | 'ratio' | 'contrast' | 'overlay' | 'transform' | null>(null);

  toggleTool(tool: 'template' | 'ratio' | 'contrast' | 'overlay' | 'transform'): void {
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

  // Señales reactivas internas
  currentData = signal<StoryShareData | null>(null);
  currentAthlete = signal<AthleteProfile | null>(null);
  currentKin = signal<KinInfo | null>(null);

  // Drag & Zoom Controls (30% a 125%)
  overlayScale = signal<number>(0.88);
  overlayPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  isActivelyGesturing = signal<boolean>(false);
  isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private initialPos = { x: 0, y: 0 };

  // Pinch-to-zoom en mobile
  private initialPinchDistance = 0;
  private initialPinchScale = 1;
  private initialPinchCenter = { x: 0, y: 0 };

  // Toggle de ingredientes en template 'chef'
  showIngredientsList = signal<boolean>(false);

  // Export State
  isExporting = signal<boolean>(false);
  exportAction = signal<'download' | 'share' | 'feed' | null>(null);
  exportSuccessMessage = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['storyData']) {
      this.currentData.set(this.storyData);
    }
    if (changes['athlete']) {
      this.currentAthlete.set(this.athlete);
    }
    if (changes['athleteKin']) {
      this.currentKin.set(this.athleteKin || null);
    }
    if (changes['visible'] && this.visible) {
      this.resetEditorState();
    }
  }

  resetEditorState(): void {
    this.currentData.set(this.storyData);
    this.currentAthlete.set(this.athlete);
    this.currentKin.set(this.athleteKin || this.athlete?.kin || null);
    this.overlayScale.set(0.88);
    this.overlayPosition.set({ x: 0, y: 0 });
    this.cardStyle.set('transparent');
    this.dimLevel.set(25);
    this.showIngredientsList.set(false);
    this.exportSuccessMessage.set(null);
    this.activeTool.set(null);
  }

  closeModal(): void {
    this.activeTool.set(null);
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }

  protected readonly translateMealType = translateMealType;

  formattedMealTitle = computed(() => {
    return translateMealType(this.currentData()?.mealTitle);
  });

  // Fondo activo (siempre la foto real de la comida)
  activeBackgroundUrl = computed(() => {
    return this.currentData()?.photoUrl || null;
  });

  hasMultiplePhotos = computed(() => {
    const urls = this.currentData()?.photoUrls;
    return !!(urls && urls.length > 1);
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
    return '@awakin.athlete';
  });

  kinTeam = computed<KinInfo | null>(() => {
    return this.currentKin() || this.currentAthlete()?.kin || null;
  });

  // Cálculos precisos de distribución de macros (%) para el Anillo y Barras
  macroDistribution = computed(() => {
    const d = this.currentData();
    const p = Math.max(0, Number(d?.protein || 0));
    const c = Math.max(0, Number(d?.carbs || 0));
    const f = Math.max(0, Number(d?.fat || 0));

    const pKcal = p * 4;
    const cKcal = c * 4;
    const fKcal = f * 9;
    const totalCal = pKcal + cKcal + fKcal;

    if (totalCal <= 0) {
      return {
        proteinPct: 33,
        carbsPct: 34,
        fatPct: 33,
        circumference: 339.292,
        pDash: 111.96,
        cDash: 115.35,
        fDash: 111.96,
        pOffset: 0,
        cOffset: -111.96,
        fOffset: -227.31,
      };
    }

    const proteinPct = Math.round((pKcal / totalCal) * 100);
    const carbsPct = Math.round((cKcal / totalCal) * 100);
    const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

    // C = 2 * PI * r (r = 54 -> C = 339.292)
    const C = 339.292;
    const pDash = (proteinPct / 100) * C;
    const cDash = (carbsPct / 100) * C;
    const fDash = (fatPct / 100) * C;

    const pOffset = 0;
    const cOffset = -pDash;
    const fOffset = -(pDash + cDash);

    return {
      proteinPct,
      carbsPct,
      fatPct,
      circumference: C,
      pDash,
      cDash,
      fDash,
      pOffset,
      cOffset,
      fOffset,
    };
  });

  formatQty(q: any, unit?: string, mode?: string): string {
    return formatQuantity(q, unit, mode);
  }

  // --- Controles de Escala / Zoom (30% a 125%) ---
  zoomIn(): void {
    const next = Math.min(1.25, Math.round((this.overlayScale() + 0.05) * 100) / 100);
    this.overlayScale.set(next);
  }

  zoomOut(): void {
    const next = Math.max(0.30, Math.round((this.overlayScale() - 0.05) * 100) / 100);
    this.overlayScale.set(next);
  }

  setZoom(val: any): void {
    const num = Number(val);
    if (!isNaN(num)) {
      this.overlayScale.set(Math.max(0.30, Math.min(1.25, num)));
    }
  }

  alignTop(): void {
    this.overlayPosition.set({ x: 0, y: -90 });
  }

  alignCenter(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  alignBottom(): void {
    this.overlayPosition.set({ x: 0, y: 90 });
  }

  resetPosition(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
    this.overlayScale.set(0.88);
  }

  // Zoom con rueda del ratón en desktop
  onWheelZoom(event: WheelEvent): void {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.04 : -0.04;
    const next = Math.max(0.30, Math.min(1.25, Math.round((this.overlayScale() + delta) * 100) / 100));
    this.overlayScale.set(next);
  }

    // --- Drag & Drop del Overlay Card (Mouse en Desktop + Touch No-Pasivo en Móvil) ---
    onDragStart(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if(target.closest('button, input, select, a')) return;

        this.isDragging = true;
        this.isActivelyGesturing.set(true);
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.initialPos = { ...this.overlayPosition() };
        if(event.cancelable) event.preventDefault();
      }

  onDragMove(event: MouseEvent): void {
        if (!this.isDragging) return;
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        const maxShiftX = 160;
        const maxShiftY = 240;
        this.overlayPosition.set({
          x: Math.max(-maxShiftX, Math.min(maxShiftX, this.initialPos.x + deltaX)),
          y: Math.max(-maxShiftY, Math.min(maxShiftY, this.initialPos.y + deltaY)),
        });
      }

  onDragEnd(): void {
        this.isDragging = false;
        this.initialPinchDistance = 0;
        this.isActivelyGesturing.set(false);
      }

  private handleNativeTouchStart(event: TouchEvent): void {
        if (!this.visible || !this.storyCaptureArea?.nativeElement) return;
        const target = event.target as HTMLElement | null;
        if (!target || target.closest('button, input, select, a')) return;

        const draggableEl = target.closest('.story-draggable-layer');
        if (!draggableEl || !this.storyCaptureArea.nativeElement.contains(draggableEl)) return;

        if (event.touches.length >= 2) {
          const t1 = event.touches[0];
          const t2 = event.touches[1];
          this.initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          this.initialPinchScale = this.overlayScale();
          this.initialPinchCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2,
          };
          this.initialPos = { ...this.overlayPosition() };
          this.isDragging = false;
          this.isActivelyGesturing.set(true);
          if (event.cancelable) event.preventDefault();
          return;
        }

        if (event.touches.length === 1) {
          this.isDragging = true;
          this.initialPinchDistance = 0;
          this.isActivelyGesturing.set(true);
          this.dragStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          this.initialPos = { ...this.overlayPosition() };
          if (event.cancelable) event.preventDefault();
        }
      }

  private handleNativeTouchMove(event: TouchEvent): void {
        if (!this.visible || (!this.isDragging && this.initialPinchDistance <= 0)) return;

      if (event.touches.length >= 2 && this.initialPinchDistance > 0) {
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = currentDistance / this.initialPinchDistance;
        const newScale = Math.max(0.30, Math.min(1.25, this.initialPinchScale * factor));
        this.overlayScale.set(Math.round(newScale * 100) / 100);

        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const maxShiftX = 160;
        const maxShiftY = 240;
        this.overlayPosition.set({
          x: Math.max(-maxShiftX, Math.min(maxShiftX, this.initialPos.x + (midX - this.initialPinchCenter.x))),
          y: Math.max(-maxShiftY, Math.min(maxShiftY, this.initialPos.y + (midY - this.initialPinchCenter.y))),
        });
        if (event.cancelable) event.preventDefault();
        return;
      }

      if (event.touches.length === 1 && this.isDragging) {
        const deltaX = event.touches[0].clientX - this.dragStart.x;
        const deltaY = event.touches[0].clientY - this.dragStart.y;
        const maxShiftX = 160;
        const maxShiftY = 240;
        this.overlayPosition.set({
          x: Math.max(-maxShiftX, Math.min(maxShiftX, this.initialPos.x + deltaX)),
          y: Math.max(-maxShiftY, Math.min(maxShiftY, this.initialPos.y + deltaY)),
        });
        if (event.cancelable) event.preventDefault();
      }
    }

      private handleNativeTouchEnd(event: TouchEvent): void {
        if (!this.isDragging && this.initialPinchDistance <= 0) return;

        if (event.touches && event.touches.length === 1 && this.initialPinchDistance > 0) {
          this.initialPinchDistance = 0;
          this.isDragging = true;
          this.dragStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          this.initialPos = { ...this.overlayPosition() };
          return;
        }

        if (!event.touches || event.touches.length === 0) {
          this.onDragEnd();
        }
      }

  // --- Exportación a Imagen PNG de Alta Resolución ---
  async exportStory(action: 'download' | 'share' | 'feed'): Promise<void> {
        if (this.isExporting() || !this.storyCaptureArea) return;

        this.isExporting.set(true);
        this.exportAction.set(action);

        try {
          const element = this.storyCaptureArea.nativeElement;

          const renderOptions = {
            quality: 0.95,
            pixelRatio: 3,
            cacheBust: true,
            backgroundColor: '#0C0A09',
          };

          // Fix para Safari/WebKit: primer render calienta el contexto
          const isWebKit =
            /Safari|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
            !/Chrome|CriOS/i.test(navigator.userAgent);
          if (isWebKit) {
            try {
              await htmlToImage.toPng(element, renderOptions);
            } catch { }
          }

          const dataUrl = await htmlToImage.toPng(element, renderOptions);
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const filename = `awakin-comida-${Date.now()}.png`;

          if (action === 'download') {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.exportSuccessMessage.set('¡Historia guardada en tu dispositivo!');
            setTimeout(() => this.exportSuccessMessage.set(null), 3500);
          } else if (action === 'feed') {
            this.shareFeed.emit(blob);
          } else if (action === 'share') {
            const data = this.currentData();
            const mealTitle = this.formattedMealTitle();
            const shareText = `🍽️ Mi nutrición en Awakin Protocol:\n${mealTitle}: ${data?.dishName}\n🔥 ${data?.kcal} kcal | ${data?.protein}g P | ${data?.carbs}g C | ${data?.fat}g G\n⚡ Únete a la tribu en Awakin`;

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const file = new File([blob], filename, { type: 'image/png' });

            if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: 'Awakin Nutrition Story',
                  text: shareText,
                });
                this.exportSuccessMessage.set('¡Compartido con éxito!');
                setTimeout(() => this.exportSuccessMessage.set(null), 3500);
              } catch (e: any) {
                if (e.name !== 'AbortError') {
                  console.error('Error al compartir nativamente:', e);
                }
              }
            } else {
              // Fallback a descarga directa
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              this.exportSuccessMessage.set('¡Historia descargada!');
              setTimeout(() => this.exportSuccessMessage.set(null), 3500);
            }
          }
        } catch (err) {
          console.error('Error exportando historia de comida:', err);
          this.exportSuccessMessage.set('Error al generar la imagen. Intenta nuevamente.');
          setTimeout(() => this.exportSuccessMessage.set(null), 4000);
        } finally {
          this.isExporting.set(false);
          this.exportAction.set(null);
        }
      }
    }
