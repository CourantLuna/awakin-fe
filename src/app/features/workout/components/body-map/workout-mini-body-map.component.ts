import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodyMapGender } from './body-map.component';
import { BodyMapModelSvgComponent } from './svg/body-map-model-svg.component';
import { ThemeService } from '../../../../core/services/theme.service';

export interface WorkoutMuscleLegendItem {
  muscle: string;
  sets: number;
  color: string;
  levelLabel?: string;
}

/**
 * Mapeo de términos de músculos (español o inglés) a las variables CSS
 * que controlan el sombreado de los grupos musculares del SVG estándar.
 */
export function getMuscleCssVariableNames(rawMuscle: string): string[] {
  const clean = (rawMuscle || '').toLowerCase().trim();
  switch (clean) {
    case 'pecho':
    case 'chest':
    case 'pectorals':
    case 'pectoral':
    case 'pecho superior':
    case 'pecho medio/bajo':
    case 'upper-pectoralis':
    case 'mid-lower-pectoralis':
      return ['--muscle-chest'];

    case 'hombros':
    case 'delts':
    case 'deltoids':
    case 'deltoid':
    case 'shoulders':
      return ['--muscle-front-shoulders', '--muscle-rear-shoulders'];

    case 'hombro anterior':
    case 'front-shoulders':
    case 'anterior-deltoid':
      return ['--muscle-front-shoulders'];

    case 'hombro posterior':
    case 'rear-shoulders':
    case 'posterior-deltoid':
      return ['--muscle-rear-shoulders'];

    case 'hombro lateral':
    case 'lateral-deltoid':
      return ['--muscle-front-shoulders', '--muscle-rear-shoulders'];

    case 'biceps':
    case 'bíceps':
    case 'long-head-bicep':
    case 'short-head-bicep':
      return ['--muscle-biceps'];

    case 'triceps':
    case 'tríceps':
    case 'long-head-triceps':
    case 'lateral-head-triceps':
    case 'medial-head-triceps':
    case 'later-head-triceps':
      return ['--muscle-triceps'];

    case 'dorsales':
    case 'lats':
    case 'latissimus dorsi':
    case 'espalda':
    case 'back':
      return ['--muscle-lats'];

    case 'trapecios':
    case 'traps':
    case 'trapezius':
    case 'espalda alta':
    case 'upper back':
    case 'upper-trapezius':
    case 'lower-trapezius':
    case 'traps-middle':
    case 'scapula':
      return ['--muscle-traps', '--muscle-traps-middle'];

    case 'zona lumbar':
    case 'lumbar':
    case 'lower back':
    case 'lowerback':
    case 'lower-spine':
      return ['--muscle-lowerback'];

    case 'glúteos':
    case 'gluteos':
    case 'glutes':
    case 'gluteus':
    case 'gluteus-maximus':
    case 'gluteus-medius':
      return ['--muscle-glutes'];

    case 'cuádriceps':
    case 'cuadriceps':
    case 'quads':
    case 'quadriceps':
    case 'outer-quadricep':
    case 'inner-quadricep':
    case 'rectus-femoris':
    case 'aductores':
    case 'adductors':
    case 'inner-thigh':
      return ['--muscle-quads'];

    case 'isquiotibiales':
    case 'hamstrings':
    case 'medial-hamstrings':
    case 'lateral-hamstrings':
      return ['--muscle-hamstrings'];

    case 'pantorrillas':
    case 'gemelos':
    case 'calves':
    case 'gastrocnemius':
    case 'soleus':
    case 'tibial':
    case 'tibialis':
      return ['--muscle-calves'];

    case 'abdomen':
    case 'abdominales':
    case 'abs':
    case 'abdominals':
    case 'core':
    case 'upper-abdominals':
    case 'lower-abdominals':
      return ['--muscle-abdominals'];

    case 'oblicuos':
    case 'obliques':
      return ['--muscle-obliques'];

    case 'antebrazos':
    case 'forearms':
    case 'forearm':
    case 'wrist-extensors':
    case 'wrist-flexors':
      return ['--muscle-forearms'];

    default:
      return [];
  }
}

const DEFAULT_AWAKIN_PRIMARY_HEX = '#FE970A';
const DEFAULT_AWAKIN_SECONDARY_HEX = '#E58500';

function parseColorToRgb(color: string): [number, number, number] | null {
  const clean = (color || '').trim();
  if (!clean) return null;

  if (clean.startsWith('#')) {
    let hex = clean.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return [r, g, b];
      }
    }
  }

  const rgbMatch = clean.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)/i);
  if (rgbMatch) {
    return [
      Math.round(Number(rgbMatch[1])),
      Math.round(Number(rgbMatch[2])),
      Math.round(Number(rgbMatch[3]))
    ];
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColorsHex(colorA: string, colorB: string, weightA: number): string {
  const rgbA = parseColorToRgb(colorA);
  const rgbB = parseColorToRgb(colorB);
  if (!rgbA) return colorB;
  if (!rgbB) return rgbToHex(rgbA[0], rgbA[1], rgbA[2]);

  const w = Math.max(0, Math.min(1, weightA));
  const r = rgbA[0] * w + rgbB[0] * (1 - w);
  const g = rgbA[1] * w + rgbB[1] * (1 - w);
  const b = rgbA[2] * w + rgbB[2] * (1 - w);
  return rgbToHex(r, g, b);
}

function normalizeToHex(color: string | undefined | null, fallback: string): string {
  if (!color) return fallback;
  const rgb = parseColorToRgb(color);
  return rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : fallback;
}

function readActiveKinColors(
  customPrimary?: string,
  customSecondary?: string
): { primary: string; secondary: string } {
  let rawPrimary = customPrimary?.trim();
  let rawSecondary = customSecondary?.trim();

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (!rawPrimary) {
      rawPrimary =
        root.style.getPropertyValue('--kin-primary').trim() ||
        getComputedStyle(root).getPropertyValue('--kin-primary').trim();
    }
    if (!rawSecondary) {
      rawSecondary =
        root.style.getPropertyValue('--kin-secondary').trim() ||
        getComputedStyle(root).getPropertyValue('--kin-secondary').trim();
    }
  }

  const primary = normalizeToHex(rawPrimary, DEFAULT_AWAKIN_PRIMARY_HEX);
  const secondary = normalizeToHex(rawSecondary || rawPrimary, DEFAULT_AWAKIN_SECONDARY_HEX);
  return { primary, secondary };
}

/**
 * Escala cromática dinámica para el mapa de calor por volumen de series:
 * - Si no hay colores de Kin personalizados, conserva la escala solar de Awakin:
 *   Alto (#EA580C), Medio (#FE970A), Suave (#FBBF24).
 * - Si hay Kin activo, deriva 3 tonos armónicos desde `--kin-primary` y `--kin-secondary`.
 */
export function getAwakinSunTone(
  sets: number,
  maxSets: number,
  customPrimary?: string,
  customSecondary?: string
): { color: string; levelLabel: string } {
  const { primary, secondary } = readActiveKinColors(customPrimary, customSecondary);
  const isDefaultAwakin =
    primary === DEFAULT_AWAKIN_PRIMARY_HEX && secondary === DEFAULT_AWAKIN_SECONDARY_HEX;

  if (isDefaultAwakin) {
    if (maxSets <= 0 || sets <= 0) {
      return { color: '#FE970A', levelLabel: 'Activo' };
    }
    const ratio = sets / maxSets;
    if (ratio >= 0.75) {
      return { color: '#EA580C', levelLabel: 'Alto' };
    } else if (ratio >= 0.4) {
      return { color: '#FE970A', levelLabel: 'Medio' };
    } else {
      return { color: '#FBBF24', levelLabel: 'Suave' };
    }
  }

  if (maxSets <= 0 || sets <= 0) {
    return { color: primary, levelLabel: 'Activo' };
  }

  const ratio = sets / maxSets;
  if (ratio >= 0.75) {
    return {
      color: mixColorsHex(mixColorsHex(primary, secondary, 0.75), '#111827', 0.76),
      levelLabel: 'Alto'
    };
  } else if (ratio >= 0.4) {
    return { color: primary, levelLabel: 'Medio' };
  } else {
    return { color: mixColorsHex(secondary, '#FFFFFF', 0.62), levelLabel: 'Suave' };
  }
}

@Component({
  selector: 'app-workout-mini-body-map',
  standalone: true,
  imports: [CommonModule, BodyMapModelSvgComponent],
  template: `
    <div
      class="mini-body-map-wrapper select-none shrink-0 transition-all"
      [ngClass]="[
        variant === 'transparent' ? 'mini-body-map--transparent shadow-none p-0' : '',
        variant === 'dark' ? 'mini-body-map--dark shadow-md text-white p-1 sm:p-1.5 rounded-2xl' : '',
        variant === 'light' ? 'mini-body-map--light shadow-2xs text-stone-800 p-1 sm:p-1.5 rounded-2xl' : '',
        showLabels ? 'gap-2 sm:gap-3' : 'gap-1.5'
      ]"
      [ngStyle]="cssVariables">

      <!-- Vista Frontal -->
      <div class="mini-body-map__figure-col">
        @if (showLabels) {
        <span class="mini-body-map__label"
          [ngClass]="variant === 'light' ? 'text-stone-400' : 'text-white/60'">Frontal</span>
        }
        <div class="mini-body-map__svg-box">
          <app-body-map-model-svg
            [gender]="gender"
            anatomyMode="standard"
            view="front"
            [isJointsMode]="false" />
        </div>
      </div>

      <!-- Divisor vertical sutil solo cuando hay labels -->
      @if (showLabels) {
      <div class="mini-body-map__divider"
        [ngClass]="variant === 'light' ? 'bg-stone-200/90' : 'bg-white/20'"></div>
      }

      <!-- Vista Posterior -->
      <div class="mini-body-map__figure-col">
        @if (showLabels) {
        <span class="mini-body-map__label"
          [ngClass]="variant === 'light' ? 'text-stone-400' : 'text-white/60'">Posterior</span>
        }
        <div class="mini-body-map__svg-box">
          <app-body-map-model-svg
            [gender]="gender"
            anatomyMode="standard"
            view="back"
            [isJointsMode]="false" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-self: stretch;
      height: 100%;
      min-height: 48px;
    }

    .mini-body-map-wrapper {
      display: inline-flex;
      align-items: stretch;
      height: 100%;
      width: auto;
    }

    .mini-body-map__figure-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 0;
    }

    .mini-body-map__label {
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
      line-height: 1;
      flex-shrink: 0;
    }

    .mini-body-map__svg-box {
      flex: 1 1 0%;
      height: 100%;
      min-height: 0;
      aspect-ratio: 660 / 1206;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }

    .mini-body-map__divider {
      width: 1px;
      height: 75%;
      align-self: center;
      flex-shrink: 0;
    }

    .mini-body-map-wrapper.mini-body-map--light {
      --body-map-muscle: #e2e8f0;
      --bodymap-stroke: 148 163 184;
    }

    html.dark .mini-body-map-wrapper.mini-body-map--light {
      --body-map-muscle: rgba(255, 255, 255, 0.16);
      --bodymap-stroke: 255 255 255 / 0.45;
    }

    .mini-body-map-wrapper.mini-body-map--dark {
      --body-map-muscle: rgba(255, 255, 255, 0.22);
      --bodymap-stroke: 255 255 255 / 0.55;
    }

    .mini-body-map-wrapper.mini-body-map--transparent {
      --body-map-muscle: rgba(255, 255, 255, 0.42);
      --bodymap-stroke: 255 255 255 / 0.85;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.85));
    }

    .mini-body-map-wrapper app-body-map-model-svg {
      display: contents;
    }

    .mini-body-map-wrapper .body-map__svg {
      display: block;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      overflow: visible;
      pointer-events: none;
      user-select: none;
    }

    .mini-body-map-wrapper .body-map__region {
      color: var(--body-map-muscle);
      transition: color 250ms ease;
    }

    .mini-body-map-wrapper .body-map__region path {
      fill: currentColor;
    }

    /* Reglas CSS para colorear los músculos sombreados mediante variables CSS */
    .mini-body-map-wrapper [data-muscle-id="chest"] { color: var(--muscle-chest, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="front-shoulders"] { color: var(--muscle-front-shoulders, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="rear-shoulders"] { color: var(--muscle-rear-shoulders, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="biceps"] { color: var(--muscle-biceps, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="triceps"] { color: var(--muscle-triceps, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="lats"] { color: var(--muscle-lats, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="traps"] { color: var(--muscle-traps, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="traps-middle"] { color: var(--muscle-traps-middle, var(--muscle-traps, var(--body-map-muscle))) !important; }
    .mini-body-map-wrapper [data-muscle-id="lowerback"] { color: var(--muscle-lowerback, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="glutes"] { color: var(--muscle-glutes, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="quads"] { color: var(--muscle-quads, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="hamstrings"] { color: var(--muscle-hamstrings, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="calves"] { color: var(--muscle-calves, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="abdominals"] { color: var(--muscle-abdominals, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="obliques"] { color: var(--muscle-obliques, var(--body-map-muscle)) !important; }
    .mini-body-map-wrapper [data-muscle-id="forearms"] { color: var(--muscle-forearms, var(--body-map-muscle)) !important; }
  `],
  encapsulation: ViewEncapsulation.None
})
export class WorkoutMiniBodyMapComponent implements OnChanges, AfterViewInit {
  public themeService = inject(ThemeService);

  @Input() gender: BodyMapGender = 'male';
  @Input() variant: 'transparent' | 'light' | 'dark' = 'light';
  @Input() showLabels: boolean = true;
  @Input() muscleBreakdown: { muscle: string; sets: number; color?: string }[] = [];

  cssVariables: Record<string, string> = {};

  constructor(private elementRef: ElementRef<HTMLElement>) {
    effect(() => {
      this.themeService.kinPrimaryColor();
      this.themeService.kinSecondaryColor();
      this.themeService.isDarkMode();
      this.updateCssVariables();
      setTimeout(() => this.syncSvgVisuals(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.syncSvgVisuals();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.updateCssVariables();
    setTimeout(() => this.syncSvgVisuals(), 0);
  }

  public syncSvgVisuals(): void {
    const root = this.elementRef?.nativeElement;
    if (!root) return;

    // 1. Ocultar todas las articulaciones (joints) forzosamente con atributos nativos SVG
    const joints = root.querySelectorAll<SVGGraphicsElement>(
      '.joints, [data-muscle-id="shoulders"], [data-muscle-id="hips"], [data-muscle-id="knees"], [data-muscle-id="ankles"], [data-muscle-id="wrist"], [data-muscle-id="elbow"], [data-muscle-id="upper-spine"], [data-muscle-id="scapula"], [data-muscle-id="lower-spine"]'
    );
    joints.forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('display', 'none');
    });

    // 2. Mapear colores de los músculos estimulados
    const breakdown = this.muscleBreakdown || [];
    const maxSets = Math.max(...breakdown.map((m) => m.sets), 1);
    const muscleColorMap = new Map<string, string>();
    const kinPrimary = this.themeService.kinPrimaryColor();
    const kinSecondary = this.themeService.kinSecondaryColor();

    for (const item of breakdown) {
      const color =
        getAwakinSunTone(item.sets, maxSets, kinPrimary, kinSecondary).color || item.color || '#FE970A';
      const varNames = getMuscleCssVariableNames(item.muscle);
      for (const vName of varNames) {
        const id = vName.replace('--muscle-', '');
        muscleColorMap.set(id, color);
      }
    }

    const isLightOnDark = this.variant === 'light' && this.themeService.isDarkMode();
    const defaultMuscleFill = this.variant === 'light'
      ? (isLightOnDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1')
      : 'rgba(255, 255, 255, 0.35)';

    // 3. Pintar cada región muscular directamente con atributo fill y style.fill nativos
    const regions = root.querySelectorAll<SVGGraphicsElement>('.body-map__region:not(.joints)');
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

    // 4. Silueta del cuerpo y todas las líneas de contorno con stroke visible explícito
    const strokeColor = this.variant === 'light'
      ? (isLightOnDark ? 'rgba(255, 255, 255, 0.45)' : '#94a3b8')
      : 'rgba(255, 255, 255, 0.85)';
    const contourElements = root.querySelectorAll<SVGGraphicsElement>(
      '.body-map__model path, .body-map__model line, [id*="body"] path, [id*="body"] line, path[fill="none"], line[fill="none"], path[stroke], line[stroke]'
    );
    contourElements.forEach((el) => {
      el.setAttribute('fill', 'none');
      el.style.fill = 'none';
      el.setAttribute('stroke', strokeColor);
      el.style.stroke = strokeColor;
    });
  }

  private updateCssVariables(): void {
    const vars: Record<string, string> = {};
    if (!this.muscleBreakdown || this.muscleBreakdown.length === 0) {
      this.cssVariables = vars;
      return;
    }

    const maxSets = Math.max(...this.muscleBreakdown.map((m) => m.sets), 1);
    const kinPrimary = this.themeService.kinPrimaryColor();
    const kinSecondary = this.themeService.kinSecondaryColor();

    for (const item of this.muscleBreakdown) {
      const color =
        getAwakinSunTone(item.sets, maxSets, kinPrimary, kinSecondary).color || item.color || '#FE970A';
      const varNames = getMuscleCssVariableNames(item.muscle);
      for (const varName of varNames) {
        vars[varName] = color;
      }
    }

    this.cssVariables = vars;
  }
}

