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
import { AthleteProfile } from '../../../../core/services/athlete.service';
import { WorkoutLog } from '../../models/workout.models';
import { BodyMapGender } from '../body-map/body-map.component';
import {
  WorkoutMiniBodyMapComponent,
  WorkoutMuscleLegendItem,
  getAwakinSunTone,
} from '../body-map/workout-mini-body-map.component';

export type MuscleLoadRange = '7d' | '14d' | '30d' | 'year';
export type MuscleLoadTemplateId = 'heatmap' | 'radar' | 'volume' | 'trend';
export type MuscleLoadRatio = '9:16' | '4:5' | '1:1';
export type MuscleLoadCardStyle = 'transparent' | 'glass' | 'dark';
type MuscleLoadTool = 'template' | 'range' | 'photo' | 'ratio' | 'contrast' | 'overlay' | 'transform';

@Component({
  selector: 'app-muscle-load-story-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, WorkoutMiniBodyMapComponent],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [blockScroll]="true" [draggable]="false" [resizable]="false"
      [closable]="false" [showHeader]="false" [dismissableMask]="true" appendTo="body" (onHide)="closeModal()"
      [style]="{ width: '96vw', maxWidth: '440px', borderRadius: '14px' }"
      styleClass="overflow-hidden shadow-2xl border border-stone-200 bg-white rounded-xl [&_.p-dialog-content]:!p-0 [&_.p-dialog-content]:!overflow-hidden">

      <div class="bg-white text-stone-900 flex flex-col h-[84dvh] max-h-[84dvh] w-full overflow-hidden rounded-xl">
        <!-- Header del Editor (Fijo arriba) -->
        <div class="px-4 py-2.5 border-b border-stone-100 bg-white flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-7 h-7 rounded-xl bg-awakin-sun/10 border border-awakin-sun/25 flex items-center justify-center shrink-0">
              <img src="/icons/workout-active.png" alt="Awakin Workout" class="w-4 h-4 object-contain" />
            </div>
            <h3 class="text-xs font-black uppercase tracking-wider text-stone-900 truncate">Reporte Carga Muscular</h3>
          </div>
          <button type="button" (click)="closeModal()"
            class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <!-- Escenario Principal Sin Scroll -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-3 bg-stone-100/70 overflow-hidden"
          (click)="closeTool()">

          <div class="w-full h-full flex items-center justify-center pr-11 sm:pr-12" style="container-type: size;">
            <div class="overflow-hidden rounded-none shadow-md bg-stone-950 shrink-0" [ngStyle]="captureBoxStyle()">
              <div #reportCaptureArea
                class="story-preview-container relative overflow-hidden rounded-none border-0 shadow-none bg-[#0C0A09] flex flex-col justify-center items-center w-full h-full transition-all"
                style="border-radius: 0px !important; border: 0 !important; box-shadow: none !important;"
                (wheel)="onWheelZoom($event)">

                <!-- 1. FONDO: FOTO DEL USUARIO O DARK RITUAL AWAKIN -->
                @if (customBgUrl(); as bg) {
                <img [src]="bg" alt="Fondo Reporte"
                  class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                  [style.background]="'rgba(12, 10, 9, ' + (dimLevel() / 100) + ')'"></div>
                <div
                  class="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none">
                </div>
                } @else {
                <div class="absolute inset-0 bg-[#0C0A09] pointer-events-none">
                  <div
                    class="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(254,151,10,0.24)_0%,rgba(12,10,9,0.96)_72%)]">
                  </div>
                  <div class="absolute inset-0 opacity-[0.05]"
                    style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 16px 16px;">
                  </div>
                </div>
                }

                <!-- 2. CAPA OVERLAY ARRASTRABLE Y ESCALABLE -->
                <div
                  class="muscle-load-draggable relative z-20 w-full h-full flex items-center justify-center px-3 select-none touch-none"
                  (mousedown)="onDragStart($event)" (wheel)="onWheelZoom($event)" (document:mousemove)="onDragMove($event)"
                  (document:mouseup)="onDragEnd()">

                  <div class="w-full ease-out will-change-transform" [class.transition-transform]="!isActivelyGesturing()"
                    [style.transform]="'translate(' + overlayPosition().x + 'px, ' + overlayPosition().y + 'px) scale(' + overlayScale() + ')'"
                    [style.transformOrigin]="'center center'">

                    <div class="w-full rounded-2xl p-3 select-none transition-all text-white" [ngClass]="{
                        'bg-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]': cardStyle() === 'transparent',
                        'backdrop-blur-md bg-stone-950/75 border border-white/15 shadow-2xl': cardStyle() === 'glass',
                        'bg-stone-950/95 border border-awakin-sun/35 shadow-2xl': cardStyle() === 'dark'
                      }">

                      <!-- CABECERA CON AVATAR DEL USUARIO + RANGO -->
                      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15">
                        <div class="flex items-center gap-2 min-w-0">
                          @if (safeUserAvatar(); as av) {
                          <img [src]="av" [alt]="athleteDisplayName()"
                            class="w-8 h-8 rounded-full object-cover border-2 border-awakin-sun/80 shrink-0 shadow-md" />
                          } @else {
                          <div class="w-8 h-8 rounded-full bg-awakin-sun/20 border border-awakin-sun/50 text-awakin-sun font-black text-xs flex items-center justify-center shrink-0">
                            {{ athleteInitials() }}
                          </div>
                          }
                          <div class="min-w-0 text-left">
                            <div class="text-[10px] font-black uppercase tracking-tight text-white truncate leading-tight">
                              {{ athleteDisplayName() }}
                            </div>
                            <div class="text-[8px] font-bold text-stone-300 truncate">
                              &#64;{{ currentAthlete()?.username || 'atleta' }}
                            </div>
                          </div>
                        </div>

                        <span
                          class="px-2 py-0.5 rounded-full bg-awakin-sun/20 border border-awakin-sun/40 text-awakin-sun text-[8px] font-black uppercase tracking-widest shrink-0">
                          {{ rangeTitle() }}
                        </span>
                      </div>

                      <!-- ========================================================== -->
                      <!-- VARIANTE 1: MAPA MUSCULAR (BODY MAP + LEYENDA + KPIs)      -->
                      <!-- ========================================================== -->
                      @if (selectedTemplate() === 'heatmap') {
                      <div class="space-y-1.5 text-center">
                        <div class="text-[9px] font-black uppercase tracking-[0.2em] text-stone-200">
                          CARGA MUSCULAR
                        </div>

                        <div class="h-40 sm:h-48 w-full flex items-center justify-center py-0.5">
                          <app-workout-mini-body-map [gender]="currentGender()" variant="transparent" [showLabels]="false"
                            [muscleBreakdown]="muscleBreakdown()" class="h-full w-auto" />
                        </div>

                        @if (muscleBreakdown().length > 0) {
                        <div class="flex flex-col items-center justify-center gap-1 py-0.5">
                          @for (m of muscleBreakdown().slice(0, 4); track m.muscle) {
                          <div
                            class="inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black/55 text-stone-100 border border-white/15">
                            <span class="w-2 h-2 rounded-full shrink-0" [style.backgroundColor]="m.color || '#FE970A'"></span>
                            <span class="tracking-wider">{{ m.muscle }}: <span class="text-awakin-sun">{{ m.sets }} Series</span></span>
                          </div>
                          }
                        </div>
                        }
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- VARIANTE 2: RADAR MUSCULAR (SVG POLAR 6 EJES)              -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'radar') {
                      @let radar = radarSvgData();
                      <div class="space-y-1.5 text-center">
                        <div class="text-[9px] font-black uppercase tracking-[0.2em] text-awakin-sun">
                          RADAR MUSCULAR · 6 EJES
                        </div>

                        <div class="w-full flex items-center justify-center py-0.5">
                          <svg viewBox="0 0 220 200" class="w-48 sm:w-52 h-auto overflow-visible">
                            <!-- Anillos guía -->
                            @for (ring of radar.rings; track $index) {
                            <polygon [attr.points]="ring" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1" />
                            }
                            <!-- Ejes -->
                            @for (axis of radar.axes; track axis.label) {
                            <line x1="110" y1="100" [attr.x2]="axis.x2" [attr.y2]="axis.y2"
                              stroke="rgba(255,255,255,0.14)" stroke-width="1" />
                            }
                            <!-- Polígono de datos con brillo -->
                            <polygon [attr.points]="radar.dataPoints" fill="rgba(254,151,10,0.32)" stroke="#FE970A"
                              stroke-width="2.2" stroke-linejoin="round" />
                            @for (pt of radar.dots; track $index) {
                            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.2" fill="#FE970A" stroke="#fff" stroke-width="1.2" />
                            }
                            <!-- Etiquetas -->
                            @for (axis of radar.axes; track axis.label) {
                            <text [attr.x]="axis.lx" [attr.y]="axis.ly" text-anchor="middle" dominant-baseline="middle"
                              fill="#F5F5F4" font-size="8.5" font-weight="900">
                              {{ axis.label }} ({{ axis.value }})
                            </text>
                            }
                          </svg>
                        </div>
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- VARIANTE 3: VOLUMEN LEVANTADO (SVG BAR CHART)              -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'volume') {
                      @let vol = volumeSvgData();
                      <div class="space-y-2 text-center">
                        <div>
                          <div class="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-400">
                            VOLUMEN TOTAL LEVANTADO
                          </div>
                          <div class="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums leading-tight mt-0.5">
                            {{ summary().volume | number:'1.0-0' }}
                            <span class="text-xs font-black text-emerald-400 uppercase">{{ summary().unit }}</span>
                          </div>
                        </div>

                        <div class="w-full px-1 py-1 rounded-xl bg-black/35 border border-white/10">
                          @if (vol.bars.length > 0) {
                          <svg viewBox="0 0 240 105" class="w-full h-24 overflow-visible">
                            <defs>
                              <linearGradient id="awakinVolGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#10B981" />
                                <stop offset="100%" stop-color="#047857" stop-opacity="0.45" />
                              </linearGradient>
                              <linearGradient id="awakinVolPeak" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#FE970A" />
                                <stop offset="100%" stop-color="#EA580C" stop-opacity="0.6" />
                              </linearGradient>
                            </defs>
                            <line x1="8" y1="84" x2="232" y2="84" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                            @for (b of vol.bars; track $index) {
                            <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4"
                              [attr.fill]="b.isPeak ? 'url(#awakinVolPeak)' : 'url(#awakinVolGrad)'" />
                            <text [attr.x]="b.cx" [attr.y]="b.y - 4" text-anchor="middle"
                              [attr.fill]="b.isPeak ? '#FBBF24' : '#D6D3D1'" font-size="7" font-weight="900">
                              {{ b.shortVal }}
                            </text>
                            <text [attr.x]="b.cx" y="96" text-anchor="middle" fill="#A8A29E" font-size="6.5" font-weight="700">
                              {{ b.label }}
                            </text>
                            }
                          </svg>
                          } @else {
                          <div class="py-6 text-[10px] text-stone-400">Sin sesiones registradas en este período</div>
                          }
                        </div>
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- VARIANTE 4: SERIES Y CONSISTENCIA (SVG AREA/LINE CHART)    -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'trend') {
                      @let tr = trendSvgData();
                      <div class="space-y-2 text-center">
                        <div>
                          <div class="text-[8px] font-black uppercase tracking-[0.22em] text-awakin-sun">
                            SERIES EFECTIVAS · CONSISTENCIA
                          </div>
                          <div class="text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums leading-tight mt-0.5">
                            {{ summary().sets }}
                            <span class="text-xs font-black text-awakin-sun uppercase">SERIES</span>
                          </div>
                        </div>

                        <div class="w-full px-1 py-1 rounded-xl bg-black/35 border border-white/10">
                          @if (tr.points.length > 0) {
                          <svg viewBox="0 0 240 105" class="w-full h-24 overflow-visible">
                            <defs>
                              <linearGradient id="awakinTrendArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#FE970A" stop-opacity="0.45" />
                                <stop offset="100%" stop-color="#FE970A" stop-opacity="0.02" />
                              </linearGradient>
                            </defs>
                            <line x1="12" y1="84" x2="228" y2="84" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                            @if (tr.areaPath) {
                            <path [attr.d]="tr.areaPath" fill="url(#awakinTrendArea)" />
                            }
                            @if (tr.linePath) {
                            <path [attr.d]="tr.linePath" fill="none" stroke="#FE970A" stroke-width="2.5"
                              stroke-linecap="round" stroke-linejoin="round" />
                            }
                            @for (pt of tr.points; track $index) {
                            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.4" fill="#FE970A" stroke="#fff" stroke-width="1.3" />
                            <text [attr.x]="pt.x" [attr.y]="pt.y - 7" text-anchor="middle" fill="#FFF" font-size="7.5" font-weight="900">
                              {{ pt.value }}
                            </text>
                            <text [attr.x]="pt.x" y="96" text-anchor="middle" fill="#A8A29E" font-size="6.5" font-weight="700">
                              {{ pt.label }}
                            </text>
                            }
                          </svg>
                          } @else {
                          <div class="py-6 text-[10px] text-stone-400">Sin series registradas en este período</div>
                          }
                        </div>

                        @if (muscleBreakdown()[0]; as topM) {
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-awakin-sun/15 border border-awakin-sun/35 text-[9px] font-black uppercase text-awakin-sun">
                          <span>Músculo Top: {{ topM.muscle }} ({{ topM.sets }} series)</span>
                        </div>
                        }
                      </div>
                      }

                      <!-- FILA DE 4 KPIs RESUMEN DEL PERÍODO -->
                      <div class="grid grid-cols-4 gap-1 pt-2 mt-2 border-t border-white/15 text-center">
                        <div>
                          <div class="text-[7px] font-bold text-stone-300 uppercase tracking-wider">Sesiones</div>
                          <div class="text-[11px] font-black text-white tabular-nums">{{ summary().sessions }}</div>
                        </div>
                        <div class="border-l border-white/15">
                          <div class="text-[7px] font-bold text-stone-300 uppercase tracking-wider">Series</div>
                          <div class="text-[11px] font-black text-awakin-sun tabular-nums">{{ summary().sets }}</div>
                        </div>
                        <div class="border-l border-white/15">
                          <div class="text-[7px] font-bold text-stone-300 uppercase tracking-wider">Volumen</div>
                          <div class="text-[11px] font-black text-emerald-400 tabular-nums">{{ shortVolume() }}</div>
                        </div>
                        <div class="border-l border-white/15">
                          <div class="text-[7px] font-bold text-stone-300 uppercase tracking-wider">Tiempo</div>
                          <div class="text-[11px] font-black text-white tabular-nums">{{ summary().minutes }}m</div>
                        </div>
                      </div>

                      <!-- BRANDING FOOTER: AWAKIN WORKOUT ACTIVE × LOGO KIN (SI PERTENECE) -->
                      <div class="pt-2 mt-2 border-t border-white/15 flex items-center justify-between text-left">
                        <div class="flex items-center gap-1.5">
                          <img src="/icons/workout-active.png" alt="Awakin Workout" class="w-4 h-4 object-contain shrink-0" />
                          @if (safeKinLogo()) {
                          <span class="text-[9px] text-stone-400 font-bold">×</span>
                          <img [src]="safeKinLogo()!" [alt]="currentAthlete()?.kin?.team_name || 'Kin'"
                            class="h-4 w-auto object-contain shrink-0" />
                          }
                        </div>
                        <div class="text-[8px] font-black uppercase tracking-widest text-stone-300">
                          {{ currentAthlete()?.kin?.team_name || 'AWAKIN WORKOUT' }}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Input oculto para foto de fondo opcional -->
          <input #bgPhotoInput type="file" accept="image/*" (change)="onBgPhotoSelected($event)" class="hidden" />

          <!-- Toolbar Lateral Vertical Solo Iconos (Idéntico a Historia Nutrición / Entrenamiento) -->
          <div
            class="absolute right-1 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-stone-900/80 backdrop-blur-md border border-white/15 p-1.5 rounded-full shadow-xl"
            (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()">

            <button type="button" (click)="toggleTool('template')" title="Gráfico Overlay (Mapa, Radar, Volumen, Series)"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'template' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-th-large text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('range')" title="Período (7D, 14D, 30D, Año)"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'range' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-calendar text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('photo')" title="Foto de fondo"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'photo' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-image text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('ratio')" title="Proporción"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'ratio' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-expand text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('contrast')" title="Contraste de fondo"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'contrast' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-sliders-h text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('overlay')" title="Estilo de tarjeta"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'overlay' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-clone text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('transform')" title="Tamaño y posición"
              class="hidden sm:flex w-8 h-8 rounded-full items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'transform' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-arrows-alt text-xs"></i>
            </button>
          </div>

          <!-- Popover Flotante de la Herramienta Activa -->
          @if (activeTool(); as tool) {
          <div
            class="absolute bottom-2.5 left-2.5 right-12 z-30 bg-stone-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-2 shadow-2xl text-white"
            (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()">

            @if (tool === 'template') {
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              @for (tpl of templates; track tpl.id) {
              <button type="button" (click)="selectedTemplate.set(tpl.id)"
                class="px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="selectedTemplate() === tpl.id
                      ? 'bg-awakin-sun text-white shadow-xs'
                      : 'bg-white/10 text-white/85 hover:bg-white/20'">
                <i [class]="tpl.icon + ' text-[11px]'"></i>
                <span>{{ tpl.label }}</span>
              </button>
              }
            </div>
            } @else if (tool === 'range') {
            <div class="flex items-center gap-1.5">
              @for (r of rangeOptions; track r.key) {
              <button type="button" (click)="activeRange.set(r.key)"
                class="flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer"
                [ngClass]="activeRange() === r.key ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                {{ r.label }}
              </button>
              }
            </div>
            } @else if (tool === 'photo') {
            <div class="flex items-center gap-1.5">
              <button type="button" (click)="bgPhotoInput.click()"
                class="flex-1 py-1.5 px-2.5 rounded-xl bg-awakin-sun text-white text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="pi pi-upload text-[10px]"></i>
                <span>{{ customBgUrl() ? 'Cambiar foto' : 'Subir foto de fondo' }}</span>
              </button>
              @if (customBgUrl()) {
              <button type="button" (click)="customBgUrl.set(null)"
                class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold cursor-pointer">
                Quitar
              </button>
              }
            </div>
            } @else if (tool === 'ratio') {
            <div class="flex items-center gap-1.5">
              @for (r of ratios; track r) {
              <button type="button" (click)="aspectRatio.set(r)"
                class="flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer"
                [ngClass]="aspectRatio() === r ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                {{ r }}
              </button>
              }
            </div>
            } @else if (tool === 'contrast') {
            <div class="flex items-center gap-2.5 px-1 py-0.5">
              <i class="pi pi-moon text-xs text-awakin-sun shrink-0"></i>
              <input type="range" min="0" max="80" step="5" [ngModel]="dimLevel()" (ngModelChange)="dimLevel.set($event)"
                class="flex-1 h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-awakin-sun" />
              <span class="text-[10px] font-black tabular-nums w-8 text-right">{{ dimLevel() }}%</span>
            </div>
            } @else if (tool === 'overlay') {
            <div class="flex items-center gap-1.5">
              <button type="button" (click)="cardStyle.set('transparent')"
                class="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                [ngClass]="cardStyle() === 'transparent' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                <i class="pi pi-eye-slash text-[11px]"></i>
                <span>Limpio</span>
              </button>
              <button type="button" (click)="cardStyle.set('glass')"
                class="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                [ngClass]="cardStyle() === 'glass' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                <i class="pi pi-clone text-[11px]"></i>
                <span>Cristal</span>
              </button>
              <button type="button" (click)="cardStyle.set('dark')"
                class="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                [ngClass]="cardStyle() === 'dark' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                <i class="pi pi-moon text-[11px]"></i>
                <span>Obsidiana</span>
              </button>
            </div>
            } @else if (tool === 'transform') {
            <div class="space-y-1.5 px-1">
              <div class="flex items-center gap-2">
                <button type="button" (click)="zoomOut()" [disabled]="overlayScale() <= 0.30"
                  class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer disabled:opacity-40">
                  <i class="pi pi-minus text-[10px]"></i>
                </button>
                <input type="range" min="0.30" max="1.25" step="0.01" [ngModel]="overlayScale()"
                  (ngModelChange)="setZoom($event)"
                  class="flex-1 h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-awakin-sun" />
                <button type="button" (click)="zoomIn()" [disabled]="overlayScale() >= 1.25"
                  class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer disabled:opacity-40">
                  <i class="pi pi-plus text-[10px]"></i>
                </button>
                <span class="text-[10px] font-black tabular-nums w-8 text-right">{{ Math.round(overlayScale() * 100) }}%</span>
              </div>
              <div class="flex items-center justify-center gap-1.5">
                <button type="button" (click)="alignTop()" title="Arriba"
                  class="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
                  <i class="pi pi-arrow-up text-[10px]"></i>
                </button>
                <button type="button" (click)="alignCenter()" title="Centrar"
                  class="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
                  <i class="pi pi-arrows-alt text-[10px]"></i>
                </button>
                <button type="button" (click)="alignBottom()" title="Abajo"
                  class="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
                  <i class="pi pi-arrow-down text-[10px]"></i>
                </button>
                <button type="button" (click)="resetPosition()" title="Restablecer"
                  class="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
                  <i class="pi pi-refresh text-[10px]"></i>
                </button>
              </div>
            </div>
            }
          </div>
          }
        </div>

        <!-- Footer Acciones Fijo (Mobile: solo Compartir; Desktop: Guardar PNG + Compartir) -->
        <div class="p-3 border-t border-stone-100 bg-white flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
          <button type="button" (click)="exportStory('download')" [disabled]="isExporting()"
            class="hidden sm:flex px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
            @if (isExporting() && exportAction() === 'download') {
              <i class="pi pi-spin pi-spinner text-xs text-awakin-sun"></i>
              <span>Generando...</span>
            } @else {
              <i class="pi pi-download text-xs"></i>
              <span>Guardar PNG</span>
            }
          </button>

          <button type="button" (click)="exportStory('share')" [disabled]="isExporting()"
            class="flex-1 py-3 rounded-xl bg-awakin-sun hover:bg-awakin-sun-dim text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-awakin-sun/25 active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50">
            @if (isExporting() && exportAction() === 'share') {
              <i class="pi pi-spin pi-spinner text-xs"></i>
              <span>Preparando...</span>
            } @else {
              <i class="pi pi-share-alt text-xs"></i>
              <span>Compartir Historia</span>
            }
          </button>
        </div>
      </div>
    </p-dialog>
  `,
})
export class MuscleLoadStoryModalComponent implements OnChanges, OnDestroy {
  protected readonly Math = Math;

  @Input() visible = false;
  @Input() logs: WorkoutLog[] = [];
  @Input() athlete: AthleteProfile | null = null;
  @Input() gender: BodyMapGender = 'male';
  @Input() initialRange: MuscleLoadRange = '30d';
  @Input() initialTemplate: MuscleLoadTemplateId = 'heatmap';
  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('reportCaptureArea') reportCaptureArea!: ElementRef<HTMLDivElement>;

  readonly ratios: MuscleLoadRatio[] = ['9:16', '4:5', '1:1'];
  readonly templates: { id: MuscleLoadTemplateId; label: string; icon: string }[] = [
    { id: 'heatmap', label: 'Mapa', icon: 'pi pi-user' },
    { id: 'radar', label: 'Radar', icon: 'pi pi-chart-pie' },
    { id: 'volume', label: 'Volumen', icon: 'pi pi-chart-bar' },
    { id: 'trend', label: 'Series', icon: 'pi pi-chart-line' },
  ];
  readonly rangeOptions: { key: MuscleLoadRange; label: string; title: string }[] = [
    { key: '7d', label: '7D', title: 'Últimos 7 días' },
    { key: '14d', label: '14D', title: 'Últimos 14 días' },
    { key: '30d', label: '30D', title: 'Últimos 30 días' },
    { key: 'year', label: 'Año', title: 'Este año' },
  ];

  private allLogs = signal<WorkoutLog[]>([]);
  currentAthlete = signal<AthleteProfile | null>(null);
  currentGender = signal<BodyMapGender>('male');

  selectedTemplate = signal<MuscleLoadTemplateId>('heatmap');
  activeRange = signal<MuscleLoadRange>('30d');
  aspectRatio = signal<MuscleLoadRatio>('9:16');
  cardStyle = signal<MuscleLoadCardStyle>('transparent');
  dimLevel = signal<number>(40);
  activeTool = signal<MuscleLoadTool | null>(null);
  customBgUrl = signal<string | null>(null);

  overlayScale = signal<number>(0.92);
  overlayPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  isActivelyGesturing = signal<boolean>(false);
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private initialPos = { x: 0, y: 0 };
  private initialPinchDistance = 0;
  private initialPinchScale = 1;
  private initialPinchCenter = { x: 0, y: 0 };

  isExporting = signal<boolean>(false);
  exportAction = signal<'download' | 'share' | null>(null);
  safeUserAvatar = signal<string | null>(null);
  safeKinLogo = signal<string | null>(null);

  private readonly boundTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private readonly boundTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private readonly boundTouchEnd = () => this.handleTouchEnd();

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

  rangeTitle = computed(() => {
    return this.rangeOptions.find((o) => o.key === this.activeRange())?.title || 'Últimos 30 días';
  });

  athleteDisplayName = computed(() => {
    const a = this.currentAthlete();
    if (!a) return 'Atleta Awakin';
    const full = `${a.first_name || ''} ${a.last_name || ''}`.trim();
    return full || a.username || 'Atleta Awakin';
  });

  athleteInitials = computed(() => {
    const name = this.athleteDisplayName();
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  });

  filteredLogs = computed<WorkoutLog[]>(() => {
    const logs = this.allLogs();
    const range = this.activeRange();
    const now = new Date();
    let cutoffMs: number;
    if (range === 'year') {
      cutoffMs = new Date(now.getFullYear(), 0, 1).getTime();
    } else {
      const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
      cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
    }
    return logs
      .filter((l) => new Date(l.workout_date).getTime() >= cutoffMs)
      .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime());
  });

  summary = computed(() => {
    const logs = this.filteredLogs();
    let volume = 0;
    let sets = 0;
    let minutes = 0;
    const unit = logs[logs.length - 1]?.volume_unit || 'lb';
    for (const l of logs) {
      volume += Number(l.total_volume || 0);
      sets += Number(l.total_sets || 0);
      minutes += Number(l.duration_minutes || 0);
    }
    return { sessions: logs.length, volume: Math.round(volume), sets, minutes: Math.round(minutes), unit };
  });

  shortVolume = computed(() => {
    const v = this.summary().volume;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return `${v}`;
  });

  muscleBreakdown = computed<WorkoutMuscleLegendItem[]>(() => {
    const map = new Map<string, number>();
    for (const log of this.filteredLogs()) {
      const byMuscle = log.sets_by_muscle || {};
      for (const [m, count] of Object.entries(byMuscle)) {
        const val = Number(count || 0);
        if (val > 0) map.set(m, (map.get(m) || 0) + val);
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const maxSets = sorted[0]?.[1] || 1;
    return sorted.map(([muscle, sets]) => {
      const tone = getAwakinSunTone(sets, maxSets);
      return {
        muscle,
        sets,
        color: tone.color,
        levelLabel: tone.levelLabel,
      };
    });
  });

  // Datos SVG del Radar de 6 ejes
  radarSvgData = computed(() => {
    const buckets: Record<string, number> = {
      Pecho: 0,
      Espalda: 0,
      Piernas: 0,
      Hombros: 0,
      Brazos: 0,
      Core: 0,
    };
    for (const log of this.filteredLogs()) {
      for (const [m, c] of Object.entries(log.sets_by_muscle || {})) {
        const key = m.toLowerCase();
        const val = Number(c || 0);
        if (key.includes('pech')) buckets['Pecho'] += val;
        else if (key.includes('espald') || key.includes('dorsal') || key.includes('trap')) buckets['Espalda'] += val;
        else if (
          key.includes('piern') ||
          key.includes('cuád') ||
          key.includes('cuad') ||
          key.includes('glút') ||
          key.includes('glut') ||
          key.includes('isquio') ||
          key.includes('panto') ||
          key.includes('gemel')
        ) {
          buckets['Piernas'] += val;
        } else if (key.includes('homb') || key.includes('delt')) buckets['Hombros'] += val;
        else if (key.includes('bícep') || key.includes('bicep') || key.includes('trícep') || key.includes('tricep') || key.includes('brazo')) {
          buckets['Brazos'] += val;
        } else {
          buckets['Core'] += val;
        }
      }
    }

    const labels = Object.keys(buckets);
    const values = Object.values(buckets);
    const maxVal = Math.max(1, ...values);
    const cx = 110;
    const cy = 100;
    const R = 64;

    const getPoint = (idx: number, ratio: number) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / labels.length;
      return { x: cx + Math.cos(angle) * R * ratio, y: cy + Math.sin(angle) * R * ratio };
    };

    const rings = [0.33, 0.66, 1].map((r) =>
      labels
        .map((_, i) => {
          const p = getPoint(i, r);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ')
    );

    const axes = labels.map((label, i) => {
      const edge = getPoint(i, 1);
      const lbl = getPoint(i, 1.32);
      return { label, value: values[i], x2: edge.x, y2: edge.y, lx: lbl.x, ly: lbl.y };
    });

    const dots = values.map((v, i) => getPoint(i, Math.max(0.08, v / maxVal)));
    const dataPoints = dots.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { rings, axes, dots, dataPoints };
  });

  // Datos SVG de Barras de Volumen (últimas 8 sesiones del rango)
  volumeSvgData = computed(() => {
    const logs = this.filteredLogs().slice(-8);
    if (logs.length === 0) return { bars: [] };
    const vals = logs.map((l) => Math.round(Number(l.total_volume || 0)));
    const maxVal = Math.max(1, ...vals);
    const slotW = 220 / logs.length;
    const barW = Math.min(26, Math.max(10, slotW * 0.58));

    const bars = logs.map((l, i) => {
      const v = vals[i];
      const h = Math.max(6, (v / maxVal) * 64);
      const cx = 10 + slotW * i + slotW / 2;
      const d = new Date(l.workout_date);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const shortVal = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
      return { x: cx - barW / 2, y: 84 - h, w: barW, h, cx, label, shortVal, isPeak: v === maxVal && v > 0 };
    });
    return { bars };
  });

  // Datos SVG de Tendencia de Series (últimas 8 sesiones del rango)
  trendSvgData = computed(() => {
    const logs = this.filteredLogs().slice(-8);
    if (logs.length === 0) return { points: [], linePath: '', areaPath: '' };
    const vals = logs.map((l) => Number(l.total_sets || 0));
    const maxVal = Math.max(1, ...vals);

    const points = logs.map((l, i) => {
      const x = logs.length === 1 ? 120 : 20 + (i * 200) / (logs.length - 1);
      const y = 80 - (vals[i] / maxVal) * 58;
      const d = new Date(l.workout_date);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      return { x, y, value: vals[i], label };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} 84 L ${points[0].x.toFixed(1)} 84 Z`
        : '';
    return { points, linePath, areaPath };
  });

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logs']) this.allLogs.set(this.logs || []);
    if (changes['athlete']) this.currentAthlete.set(this.athlete);
    if (changes['gender'] && this.gender) this.currentGender.set(this.gender);

    if (changes['visible'] && this.visible) {
      this.allLogs.set(this.logs || []);
      this.currentAthlete.set(this.athlete);
      this.currentGender.set(this.gender || 'male');
      this.activeRange.set(this.initialRange || '30d');
      this.selectedTemplate.set(this.initialTemplate || 'heatmap');
      this.activeTool.set(null);
      this.prepareAssets();
    }
  }

  private prepareAssets(): void {
    const av = this.athlete?.profile_image_url || null;
    this.safeUserAvatar.set(av);
    if (av) this.toDataUrl(av).then((safe) => this.safeUserAvatar.set(safe));

    const logo = this.athlete?.kin?.team_logo_url || null;
    this.safeKinLogo.set(logo);
    if (logo) this.toDataUrl(logo).then((safe) => this.safeKinLogo.set(safe));
  }

  onBgPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.customBgUrl.set(e.target.result);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  toggleTool(tool: MuscleLoadTool): void {
    this.activeTool.update((curr) => (curr === tool ? null : tool));
  }

  closeTool(): void {
    this.activeTool.set(null);
  }

  // Drag & Pinch Zoom
  onDragStart(e: MouseEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.isActivelyGesturing.set(true);
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.initialPos = { ...this.overlayPosition() };
  }

  onDragMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.overlayPosition.set({
      x: this.initialPos.x + (e.clientX - this.dragStart.x),
      y: this.initialPos.y + (e.clientY - this.dragStart.y),
    });
  }

  onDragEnd(): void {
    this.isDragging = false;
    this.isActivelyGesturing.set(false);
  }

  onWheelZoom(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.overlayScale() + (e.deltaY < 0 ? 0.05 : -0.05));
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.visible) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.muscle-load-draggable')) return;
    e.preventDefault();
    this.isActivelyGesturing.set(true);

    if (e.touches.length === 1) {
      this.isDragging = true;
      this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.initialPos = { ...this.overlayPosition() };
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.initialPinchDistance = Math.hypot(dx, dy);
      this.initialPinchScale = this.overlayScale();
      this.initialPinchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      this.initialPos = { ...this.overlayPosition() };
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.visible || !this.isActivelyGesturing()) return;
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging) {
      this.overlayPosition.set({
        x: this.initialPos.x + (e.touches[0].clientX - this.dragStart.x),
        y: this.initialPos.y + (e.touches[0].clientY - this.dragStart.y),
      });
    } else if (e.touches.length === 2 && this.initialPinchDistance > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      this.setZoom(this.initialPinchScale * (dist / this.initialPinchDistance));
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.overlayPosition.set({
        x: this.initialPos.x + (cx - this.initialPinchCenter.x),
        y: this.initialPos.y + (cy - this.initialPinchCenter.y),
      });
    }
  }

  private handleTouchEnd(): void {
    this.isDragging = false;
    this.initialPinchDistance = 0;
    this.isActivelyGesturing.set(false);
  }

  setZoom(val: number): void {
    this.overlayScale.set(Math.min(1.25, Math.max(0.3, Number(val))));
  }

  zoomIn(): void {
    this.setZoom(this.overlayScale() + 0.08);
  }

  zoomOut(): void {
    this.setZoom(this.overlayScale() - 0.08);
  }

  alignTop(): void {
    this.overlayPosition.set({ x: 0, y: -100 });
  }

  alignCenter(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  alignBottom(): void {
    this.overlayPosition.set({ x: 0, y: 100 });
  }

  resetPosition(): void {
    this.overlayScale.set(0.92);
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async exportStory(action: 'download' | 'share'): Promise<void> {
    if (!this.reportCaptureArea?.nativeElement || this.isExporting()) return;
    this.activeTool.set(null);
    this.isExporting.set(true);
    this.exportAction.set(action);

    try {
      const node = this.reportCaptureArea.nativeElement;
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#0C0A09',
      });
      const blob = await (await fetch(dataUrl)).blob();
      const filename = `carga-muscular-${this.selectedTemplate()}-${this.activeRange()}.png`;

      if (action === 'share' && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Carga Muscular (${this.rangeTitle()}) - Awakin`,
            text: `💪 Mi reporte de Carga Muscular (${this.rangeTitle()}): ${this.summary().sessions} sesiones · ${this.summary().sets} series · ${this.summary().volume} ${this.summary().unit}`,
          });
          return;
        }
      }

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error exportando reporte de carga muscular:', err);
      }
    } finally {
      this.isExporting.set(false);
      this.exportAction.set(null);
    }
  }

  private async toDataUrl(url: string): Promise<string> {
    if (!url || url.startsWith('data:')) return url;
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || url);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }
}
