import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BodyMapGender } from './body-map.component';
import { BodyMapModelSvgComponent } from './svg/body-map-model-svg.component';

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

/**
 * Escala cromática de Awakin Sun (solar) para el mapa de calor por volumen de series:
 * - 80%+ del volumen máximo: Fuego solar concentrado (#EA580C)
 * - 45% - 79% del volumen máximo: Awakin Sun principal (#FE970A)
 * - Menos del 45%: Luz ámbar cálida suave (#FBBF24)
 */
export function getAwakinSunTone(sets: number, maxSets: number): { color: string; levelLabel: string } {
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
export class WorkoutMiniBodyMapComponent implements OnChanges {
  @Input() gender: BodyMapGender = 'male';
  @Input() variant: 'transparent' | 'light' | 'dark' = 'light';
  @Input() showLabels: boolean = true;
  @Input() muscleBreakdown: { muscle: string; sets: number; color?: string }[] = [];

  cssVariables: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    this.updateCssVariables();
  }

  private updateCssVariables(): void {
    const vars: Record<string, string> = {};
    if (!this.muscleBreakdown || this.muscleBreakdown.length === 0) {
      this.cssVariables = vars;
      return;
    }

    const maxSets = Math.max(...this.muscleBreakdown.map((m) => m.sets), 1);

    for (const item of this.muscleBreakdown) {
      const color = item.color || getAwakinSunTone(item.sets, maxSets).color;
      const varNames = getMuscleCssVariableNames(item.muscle);
      for (const varName of varNames) {
        vars[varName] = color;
      }
    }

    this.cssVariables = vars;
  }
}

