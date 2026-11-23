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
import { KinInfo } from '../../../../core/services/athlete.service';
import { KinMealPhotoItem } from '../../../../core/services/kin.service';

export type KinCollageRatio = '9:16' | '16:9' | '4:5' | '1:1';
export type KinCollageCardStyle = 'transparent' | 'glass' | 'dark';
export type KinCollageTemplateId = 'editorial' | 'ritual' | 'sticker' | 'stats' | 'minimal';
export type KinCollageDatePreset = 'today' | '7d' | '14d' | 'month' | 'custom';
type KinCollageTool = 'template' | 'date' | 'ratio' | 'text' | 'contrast' | 'overlay' | 'transform';

@Component({
  selector: 'app-kin-meals-collage-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [blockScroll]="true" [draggable]="false" [resizable]="false"
      [closable]="false" [showHeader]="false" [dismissableMask]="true" appendTo="body" (onHide)="closeModal()"
      [style]="{ width: '96vw', maxWidth: '440px', borderRadius: '14px' }"
      styleClass="overflow-hidden shadow-2xl border border-stone-200 bg-white rounded-xl [&_.p-dialog-content]:!p-0 [&_.p-dialog-content]:!overflow-hidden">

      <div class="bg-white text-stone-900 flex flex-col h-[84dvh] max-h-[84dvh] w-full overflow-hidden rounded-xl">
        <!-- Header del Editor (Compacto y fijo arriba) -->
        <div class="px-4 py-2.5 border-b border-stone-100 bg-white flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-7 h-7 rounded-xl bg-awakin-sun/10 border border-awakin-sun/25 flex items-center justify-center shrink-0">
              <img src="/icons/intake-active.png" alt="Kin Comidas" class="w-4 h-4 object-contain" />
            </div>
            <div class="min-w-0">
              <h3 class="text-xs font-black uppercase tracking-wider text-stone-900 truncate">Collage del Kin</h3>
            </div>
          </div>
          <button type="button" (click)="closeModal()"
            class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <!-- Escenario Principal Sin Scroll (Estilo Editor de Stories) -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-3 bg-stone-100/70 overflow-hidden"
          (click)="closeTool()">

          <!-- Contenedor de tamaño fluido para ajustar el Canvas sin desbordar -->
          <div class="w-full h-full flex items-center justify-center pr-11 sm:pr-12" style="container-type: size;">
            <div class="overflow-hidden rounded-none shadow-md bg-stone-950 shrink-0" [ngStyle]="captureBoxStyle()">
              <div #collageCaptureArea
                class="story-preview-container relative overflow-hidden rounded-none border-0 shadow-none bg-stone-950 flex flex-col justify-center items-center w-full h-full transition-all"
                style="border-radius: 0px !important; border: 0 !important; box-shadow: none !important;"
                (wheel)="onWheelZoom($event)">

                <!-- 1. FONDO: COLLAGE DINÁMICO SIN ESPACIOS VACÍOS (PARTICIÓN EN FILAS FLEX) -->
                @if (photoRows().length > 0) {
                <div class="absolute inset-0 flex flex-col gap-0.5 bg-stone-950 select-none pointer-events-none">
                  @for (row of photoRows(); track $index) {
                  <div class="flex-1 min-h-0 flex flex-row gap-0.5 w-full">
                    @for (photoUrl of row; track $index) {
                    <div class="flex-1 min-w-0 h-full overflow-hidden bg-stone-900 relative">
                      <img [src]="getSafePhotoUrl(photoUrl)" alt="Comida del Kin"
                        class="w-full h-full object-cover block" />
                    </div>
                    }
                  </div>
                  }
                </div>
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                  [style.background]="'rgba(12, 10, 9, ' + (dimLevel() / 100) + ')'"></div>
                <div
                  class="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65 pointer-events-none">
                </div>
                } @else {
                <div class="absolute inset-0 bg-[#0C0A09] pointer-events-none flex flex-col items-center justify-center p-6 text-center">
                  <div
                    class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(254,151,10,0.22)_0%,rgba(12,10,9,0.95)_70%)]">
                  </div>
                  <div class="relative z-10 space-y-1.5 opacity-80">
                    <i class="pi pi-calendar-times text-2xl text-awakin-sun"></i>
                    <p class="text-[11px] font-black uppercase tracking-wider text-white">Sin fotos en este período</p>
                    <p class="text-[10px] text-stone-300">Toca el ícono de calendario a la derecha para elegir otro rango.</p>
                  </div>
                </div>
                }

                <!-- 2. CAPA OVERLAY ARRASTRABLE Y ESCALABLE -->
                <div
                  class="kin-collage-draggable relative z-20 w-full h-full flex items-center justify-center px-3 select-none touch-none"
                  (mousedown)="onDragStart($event)" (wheel)="onWheelZoom($event)" (document:mousemove)="onDragMove($event)"
                  (document:mouseup)="onDragEnd()">

                  <div class="w-full ease-out will-change-transform" [class.transition-transform]="!isActivelyGesturing()"
                    [style.transform]="'translate(' + overlayPosition().x + 'px, ' + overlayPosition().y + 'px) scale(' + overlayScale() + ')'"
                    [style.transformOrigin]="'center center'">

                    <div class="w-full rounded-2xl p-3 select-none transition-all" [ngClass]="{
                        'bg-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]': cardStyle() === 'transparent',
                        'backdrop-blur-md bg-stone-950/75 border border-white/15 shadow-2xl': cardStyle() === 'glass',
                        'bg-stone-950/95 border border-awakin-sun/35 shadow-2xl': cardStyle() === 'dark'
                      }">

                      <!-- PLANTILLA 1: EDITORIAL TRIBU -->
                      @if (selectedTemplate() === 'editorial') {
                      <div class="space-y-2 text-center text-white">
                        <div class="flex items-center justify-center gap-1.5 flex-wrap">
                          <span
                            class="text-[9px] font-black uppercase tracking-widest text-awakin-sun bg-awakin-sun/15 px-2 py-0.5 rounded-full border border-awakin-sun/30">
                            {{ kin?.team_name || 'MI KIN' }}
                          </span>
                          <span class="text-[9px] font-bold text-stone-300 uppercase tracking-wider">
                            {{ periodLabel() }}
                          </span>
                        </div>

                        <h4 class="text-base sm:text-lg font-black uppercase tracking-tight leading-tight break-words text-wrap">
                          {{ headline() }}
                        </h4>

                        <div class="flex items-center justify-center gap-2 pt-1 text-[10px] font-black text-stone-200">
                          <span class="px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                            🥗 {{ displayPhotos().length }} {{ displayPhotos().length === 1 ? 'plato' : 'platos' }}
                          </span>
                          <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                            {{ uniqueAuthorsCount() }} {{ uniqueAuthorsCount() === 1 ? 'integrante' : 'integrantes' }}
                          </span>
                        </div>
                      </div>
                      }

                      <!-- PLANTILLA 2: RITUAL TRIBU AWAKIN -->
                      @else if (selectedTemplate() === 'ritual') {
                      <div class="space-y-2 text-center text-white">
                        <div class="flex items-center justify-center gap-2">
                          @if (safeKinLogo()) {
                          <img [src]="safeKinLogo()!" [alt]="kin?.team_name || 'Kin'"
                            class="w-9 h-9 rounded-xl object-cover border border-awakin-sun/50 bg-white p-0.5 shadow-md" />
                          }
                          <div class="text-left">
                            <div class="text-[8px] font-black uppercase tracking-widest text-awakin-sun">
                              CULTURA NUTRICIONAL
                            </div>
                            <div class="text-xs font-black uppercase tracking-tight text-white">
                              {{ kin?.team_name || 'MI KIN' }}
                            </div>
                          </div>
                        </div>

                        <h4 class="text-sm sm:text-base font-black uppercase italic tracking-tight leading-tight break-words text-wrap py-1 border-y border-white/20">
                          "{{ headline() }}"
                        </h4>

                        <div class="text-[9px] font-bold uppercase tracking-widest text-stone-300">
                          {{ displayPhotos().length }} {{ displayPhotos().length === 1 ? 'COMIDA REAL' : 'COMIDAS REALES' }} · {{ periodLabel() }}
                        </div>
                      </div>
                      }

                      <!-- PLANTILLA 3: STICKER FLOTANTE -->
                      @else if (selectedTemplate() === 'sticker') {
                      <div class="space-y-1.5 text-center text-white">
                        <div
                          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/55 border border-white/25 backdrop-blur-xs">
                          <span class="text-xs">🥗</span>
                          <span class="text-[10px] font-black uppercase tracking-wider text-white">
                            {{ headline() }}
                          </span>
                        </div>
                        <div class="text-[9px] font-black uppercase tracking-widest text-awakin-sun">
                          {{ kin?.team_name || 'MI KIN' }} · {{ periodLabel() }}
                        </div>
                      </div>
                      }

                      <!-- PLANTILLA 4: MÉTRICAS DEL EQUIPO -->
                      @else if (selectedTemplate() === 'stats') {
                      <div class="space-y-2 text-center text-white">
                        <div class="text-[9px] font-black uppercase tracking-widest text-awakin-sun">
                          {{ kin?.team_name || 'MI KIN' }} · {{ periodLabel() }}
                        </div>
                        <h4 class="text-sm font-black uppercase tracking-tight leading-tight break-words text-wrap">
                          {{ headline() }}
                        </h4>
                        <div class="grid grid-cols-3 gap-1.5 pt-1">
                          <div class="rounded-xl bg-black/45 border border-white/15 p-1.5">
                            <div class="text-xs font-black text-awakin-sun tabular-nums">{{ displayPhotos().length }}</div>
                            <div class="text-[8px] font-bold text-stone-300 uppercase">Platos</div>
                          </div>
                          <div class="rounded-xl bg-black/45 border border-white/15 p-1.5">
                            <div class="text-xs font-black text-emerald-400 tabular-nums">{{ uniqueAuthorsCount() }}</div>
                            <div class="text-[8px] font-bold text-stone-300 uppercase">Atletas</div>
                          </div>
                          <div class="rounded-xl bg-black/45 border border-white/15 p-1.5">
                            <div class="text-xs font-black text-white tabular-nums">{{ avgKcal() }}</div>
                            <div class="text-[8px] font-bold text-stone-300 uppercase">Kcal Prom</div>
                          </div>
                        </div>
                      </div>
                      }

                      <!-- PLANTILLA 5: FIRMA MINIMAL -->
                      @else if (selectedTemplate() === 'minimal') {
                      <div class="space-y-1 text-left text-white px-1">
                        <div class="text-[9px] font-black uppercase tracking-[0.2em] text-awakin-sun">
                          {{ kin?.team_name || 'MI KIN' }}
                        </div>
                        <h4 class="text-base font-black uppercase tracking-tight leading-none break-words text-wrap">
                          {{ headline() }}
                        </h4>
                        <div class="text-[9px] font-semibold text-stone-300 uppercase tracking-wider">
                          {{ periodLabel() }} · {{ displayPhotos().length }} {{ displayPhotos().length === 1 ? 'foto' : 'fotos' }}
                        </div>
                      </div>
                      }

                      <!-- BRANDING FOOTER EN CADA PLANTILLA (ISOTIPO AWAKIN × LOGO KIN) -->
                      <div class="pt-2 mt-2 border-t border-white/15 flex items-center justify-between text-left">
                        <div class="flex items-center gap-1.5">
                          <img src="/icons/awakin-isotipo.png" alt="Awakin" class="w-4 h-4 object-contain shrink-0" />
                          @if (safeKinLogo()) {
                          <span class="text-[9px] text-stone-400 font-bold">×</span>
                          <img [src]="safeKinLogo()!" [alt]="kin?.team_name || 'Kin'"
                            class="h-4 object-contain shrink-0 rounded-xs" />
                          }
                        </div>
                        <div class="text-[9px] font-black uppercase tracking-widest text-stone-300">
                          {{ kin?.team_name || 'KIN' }}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Toolbar Lateral Vertical Solo Iconos (Idéntico a Historia Nutrición / Entrenamiento) -->
          <div
            class="absolute right-1 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 bg-stone-900/80 backdrop-blur-md border border-white/15 p-1.5 rounded-full shadow-xl"
            (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()">

            <button type="button" (click)="toggleTool('template')" title="Plantilla Overlay" aria-label="Plantilla Overlay"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'template' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-th-large text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('date')" title="Rango de fechas" aria-label="Rango de fechas"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'date' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-calendar text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('ratio')" title="Proporción (9:16, 16:9, 4:5, 1:1)" aria-label="Proporción"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'ratio' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-expand text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('text')" title="Título y Mezclar Fotos" aria-label="Título y Mezclar Fotos"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'text' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-pencil text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('contrast')" title="Contraste de fondo" aria-label="Contraste"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'contrast' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-sliders-h text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('overlay')" title="Estilo de tarjeta" aria-label="Estilo de tarjeta"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'overlay' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-clone text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('transform')" title="Tamaño y posición" aria-label="Tamaño y posición"
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
              <button type="button" (click)="selectedTemplate.set(tpl.id)" [title]="tpl.label"
                class="px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                [ngClass]="selectedTemplate() === tpl.id
                      ? 'bg-awakin-sun text-white shadow-xs'
                      : 'bg-white/10 text-white/85 hover:bg-white/20'">
                <i [class]="tpl.icon + ' text-[11px]'"></i>
                <span>{{ tpl.label }}</span>
              </button>
              }
            </div>
            } @else if (tool === 'date') {
            <div class="space-y-2">
              <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">
                @for (p of datePresets; track p.id) {
                <button type="button" (click)="selectDatePreset(p.id)"
                  class="px-2.5 py-1.5 rounded-xl text-[10px] font-black shrink-0 cursor-pointer transition-all"
                  [ngClass]="datePreset() === p.id ? 'bg-awakin-sun text-white shadow-xs' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                  {{ p.label }}
                </button>
                }
              </div>

              @if (datePreset() === 'custom') {
              <div class="grid grid-cols-2 gap-1.5 pt-0.5">
                <label class="space-y-0.5">
                  <span class="text-[8px] font-black uppercase tracking-wider text-stone-300 block px-0.5">Desde</span>
                  <input type="date" [ngModel]="customStartDate()" (ngModelChange)="onCustomDateChange('start', $event)"
                    class="w-full bg-white/20 border border-white/20 rounded-xl px-2 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-awakin-sun" />
                </label>
                <label class="space-y-0.5">
                  <span class="text-[8px] font-black uppercase tracking-wider text-stone-300 block px-0.5">Hasta</span>
                  <input type="date" [ngModel]="customEndDate()" (ngModelChange)="onCustomDateChange('end', $event)"
                    class="w-full bg-white/20 border border-white/20 rounded-xl px-2 py-1 text-[10px] font-bold text-white focus:outline-none focus:border-awakin-sun" />
                </label>
              </div>
              }

              <div class="flex items-center justify-between px-1 text-[9px] text-stone-300 font-bold">
                <span>{{ filteredPhotoUrls().length }} {{ filteredPhotoUrls().length === 1 ? 'foto encontrada' : 'fotos encontradas' }}</span>
                @if (filteredPhotoUrls().length > maxCollagePhotos) {
                <span class="text-awakin-sun">Mostrando {{ displayPhotos().length }}</span>
                }
              </div>
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
            } @else if (tool === 'text') {
            <div class="space-y-1.5">
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                @for (preset of headlinePresets; track preset) {
                <button type="button" (click)="headline.set(preset)"
                  class="px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer transition-all"
                  [ngClass]="headline() === preset ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                  {{ preset }}
                </button>
                }
              </div>
              <div class="flex items-center gap-1.5">
                <input type="text" [ngModel]="headline()" (ngModelChange)="headline.set($event)" maxlength="42"
                  placeholder="Frase personalizada..."
                  class="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-white placeholder:text-stone-400 focus:outline-none focus:border-awakin-sun" />
                @if (filteredPhotoUrls().length > 1) {
                <button type="button" (click)="shufflePhotos()" title="Mezclar orden de fotos"
                  class="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shrink-0">
                  <i class="pi pi-refresh text-[10px]"></i>
                  <span>Mezclar</span>
                </button>
                }
              </div>
            </div>
            } @else if (tool === 'contrast') {
            <div class="flex items-center gap-2.5 px-1 py-0.5">
              <i class="pi pi-moon text-xs text-awakin-sun shrink-0"></i>
              <input type="range" min="0" max="75" step="5" [ngModel]="dimLevel()" (ngModelChange)="dimLevel.set($event)"
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
          <button type="button" (click)="exportCollage('download')" [disabled]="isExporting() || displayPhotos().length === 0"
            class="hidden sm:flex px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
            @if (isExporting() && exportAction() === 'download') {
              <i class="pi pi-spin pi-spinner text-xs text-awakin-sun"></i>
              <span>Generando...</span>
            } @else {
              <i class="pi pi-download text-xs"></i>
              <span>Guardar PNG</span>
            }
          </button>

          <button type="button" (click)="exportCollage('share')" [disabled]="isExporting() || displayPhotos().length === 0"
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
export class KinMealsCollageModalComponent implements OnChanges, OnDestroy {
  protected readonly Math = Math;
  readonly maxCollagePhotos = 24;

  @Input() visible = false;
  @Input() kin: KinInfo | null = null;
  @Input() mealPhotos: KinMealPhotoItem[] = [];
  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('collageCaptureArea') collageCaptureArea!: ElementRef<HTMLDivElement>;

  readonly ratios: KinCollageRatio[] = ['9:16', '16:9', '4:5', '1:1'];
  readonly headlinePresets: string[] = [
    'Así come mi equipo',
    'Así comemos',
    'Nutrición en Tribu',
    'Disciplina en la Mesa',
  ];
  readonly templates: { id: KinCollageTemplateId; label: string; icon: string }[] = [
    { id: 'editorial', label: 'Editorial', icon: 'pi pi-sparkles' },
    { id: 'ritual', label: 'Tribu Cult', icon: 'pi pi-shield' },
    { id: 'sticker', label: 'Sticker', icon: 'pi pi-tag' },
    { id: 'stats', label: 'Métricas', icon: 'pi pi-chart-bar' },
    { id: 'minimal', label: 'Minimal', icon: 'pi pi-minus' },
  ];
  readonly datePresets: { id: KinCollageDatePreset; label: string }[] = [
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '14d', label: '14 días' },
    { id: 'month', label: 'Este mes' },
    { id: 'custom', label: 'Rango' },
  ];

  // Signals reactivas de entrada y filtro
  private rawMeals = signal<KinMealPhotoItem[]>([]);
  datePreset = signal<KinCollageDatePreset>('7d');
  customStartDate = signal<string>(this.formatYMD(new Date(Date.now() - 6 * 86400000)));
  customEndDate = signal<string>(this.formatYMD(new Date()));

  selectedTemplate = signal<KinCollageTemplateId>('editorial');
  aspectRatio = signal<KinCollageRatio>('9:16');
  cardStyle = signal<KinCollageCardStyle>('transparent');
  headline = signal<string>('Así come mi equipo');
  dimLevel = signal<number>(25);
  activeTool = signal<KinCollageTool | null>(null);

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

  safeKinLogo = signal<string | null>(null);
  private safeUrlCache = signal<Record<string, string>>({});
  private photoOffset = signal<number>(0);

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

  // Rango [startMs, endMs] en hora local según preset seleccionado
  private activeDateBounds = computed<{ startMs: number; endMs: number }>(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

    switch (this.datePreset()) {
      case 'today':
        return { startMs: startOfToday, endMs: endOfToday };
      case '7d':
        return { startMs: startOfToday - 6 * 86400000, endMs: endOfToday };
      case '14d':
        return { startMs: startOfToday - 13 * 86400000, endMs: endOfToday };
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        return { startMs: startOfMonth, endMs: endOfToday };
      }
      case 'custom': {
        const s = this.parseLocalYMD(this.customStartDate(), false);
        const e = this.parseLocalYMD(this.customEndDate(), true);
        const startMs = s ?? startOfToday - 6 * 86400000;
        const endMs = e ?? endOfToday;
        return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
      }
    }
  });

  // Etiqueta legible del período para mostrar en los gráficos overlay
  periodLabel = computed<string>(() => {
    const now = new Date();
    switch (this.datePreset()) {
      case 'today':
        return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
          .format(now)
          .toUpperCase();
      case '7d':
        return 'ÚLTIMOS 7 DÍAS';
      case '14d':
        return 'ÚLTIMOS 14 DÍAS';
      case 'month':
        return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
          .format(now)
          .toUpperCase();
      case 'custom': {
        const s = this.parseLocalYMD(this.customStartDate(), false);
        const e = this.parseLocalYMD(this.customEndDate(), false);
        if (s && e) {
          const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
          return `${fmt.format(new Date(s))} – ${fmt.format(new Date(e))}`.toUpperCase();
        }
        return 'RANGO PERSONALIZADO';
      }
    }
  });

  // Comidas filtradas dentro del rango seleccionado
  filteredMeals = computed<KinMealPhotoItem[]>(() => {
    const { startMs, endMs } = this.activeDateBounds();
    return this.rawMeals().filter((m) => {
      const url = (m.foto_url || '').trim();
      if (!url) return false;
      const ms = this.extractMealTimestampMs(m);
      if (ms === null) return false;
      return ms >= startMs && ms <= endMs;
    });
  });

  // URLs únicas filtradas
  filteredPhotoUrls = computed<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of this.filteredMeals()) {
      const url = (m.foto_url || '').trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
    return out;
  });

  // Fotos activas en el collage (hasta maxCollagePhotos, con soporte de mezcla/offset)
  displayPhotos = computed<string[]>(() => {
    const list = this.filteredPhotoUrls();
    if (list.length === 0) return [];
    const count = Math.min(this.maxCollagePhotos, list.length);
    const start = this.photoOffset() % list.length;
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(list[(start + i) % list.length]);
    }
    return out;
  });

  // Partición dinámica en filas para garantizar CERO ESPACIOS VACÍOS para cualquier N y proporción
  photoRows = computed<string[][]>(() => {
    const photos = this.displayPhotos();
    const n = photos.length;
    if (n === 0) return [];
    if (n === 1) return [photos];

    const ratioNumeric =
      this.aspectRatio() === '16:9'
        ? 16 / 9
        : this.aspectRatio() === '1:1'
          ? 1
          : this.aspectRatio() === '4:5'
            ? 4 / 5
            : 9 / 16;

    // Calcular número óptimo de filas R para celdas equilibradas
    let rows = Math.round(Math.sqrt(n / ratioNumeric));
    rows = Math.max(1, Math.min(n, rows));

    // Casos especiales estéticos para cantidades pequeñas
    if (n === 2) rows = ratioNumeric >= 1 ? 1 : 2;
    else if (n === 3) rows = ratioNumeric >= 1.5 ? 1 : 2;
    else if (n === 4) rows = 2;

    const base = Math.floor(n / rows);
    const extra = n % rows;
    const result: string[][] = [];
    let cursor = 0;

    for (let r = 0; r < rows; r++) {
      // Distribuir las fotos sobrantes en las últimas filas para una pirámide visual equilibrada
      const rowSize = r >= rows - extra ? base + 1 : base;
      result.push(photos.slice(cursor, cursor + rowSize));
      cursor += rowSize;
    }
    return result;
  });

  uniqueAuthorsCount = computed(() => {
    const ids = new Set(this.filteredMeals().map((m) => m.author?.id).filter(Boolean));
    return ids.size;
  });

  avgKcal = computed(() => {
    const vals = this.filteredMeals().map((m) => Number(m.calorias || 0)).filter((v) => v > 0);
    if (vals.length === 0) return '—';
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  captureBoxStyle = computed(() => {
    switch (this.aspectRatio()) {
      case '16:9':
        return {
          width: 'min(100cqw, calc(100cqh * 16 / 9))',
          height: 'min(100cqh, calc(100cqw * 9 / 16))',
        };
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
    if (changes['mealPhotos']) {
      this.rawMeals.set(this.mealPhotos || []);
    }
    if (changes['visible'] && this.visible) {
      this.rawMeals.set(this.mealPhotos || []);
      this.activeTool.set(null);
      this.photoOffset.set(0);
      this.autoSelectBestInitialPreset();
      this.warmVisiblePhotoCache();
      this.prepareKinLogo();
    } else if (changes['mealPhotos'] && this.visible) {
      this.warmVisiblePhotoCache();
    }
  }

  // Si el preset actual (ej. 7d) no tiene fotos al abrir, buscar el primer preset con fotos (14d -> month)
  private autoSelectBestInitialPreset(): void {
    if (this.filteredPhotoUrls().length > 0) return;
    const fallbacks: KinCollageDatePreset[] = ['7d', '14d', 'month'];
    for (const preset of fallbacks) {
      this.datePreset.set(preset);
      if (this.filteredPhotoUrls().length > 0) return;
    }
  }

  selectDatePreset(preset: KinCollageDatePreset): void {
    this.datePreset.set(preset);
    this.photoOffset.set(0);
    this.warmVisiblePhotoCache();
  }

  onCustomDateChange(edge: 'start' | 'end', value: string): void {
    if (edge === 'start') this.customStartDate.set(value);
    else this.customEndDate.set(value);
    this.photoOffset.set(0);
    this.warmVisiblePhotoCache();
  }

  toggleTool(tool: KinCollageTool): void {
    this.activeTool.update((curr) => (curr === tool ? null : tool));
  }

  closeTool(): void {
    this.activeTool.set(null);
  }

  getSafePhotoUrl(rawUrl: string): string {
    return this.safeUrlCache()[rawUrl] || rawUrl;
  }

  private prepareKinLogo(): void {
    const logo = this.kin?.team_logo_url || null;
    this.safeKinLogo.set(logo);
    if (logo) {
      this.toDataUrl(logo).then((safe) => this.safeKinLogo.set(safe));
    }
  }

  private warmVisiblePhotoCache(): void {
    const urls = this.displayPhotos();
    const cache = this.safeUrlCache();
    const missing = urls.filter((u) => u && !u.startsWith('data:') && !cache[u]);
    if (missing.length === 0) return;

    missing.forEach((url) => {
      this.toDataUrl(url).then((safe) => {
        if (safe !== url) {
          this.safeUrlCache.update((curr) => ({ ...curr, [url]: safe }));
        }
      });
    });
  }

  shufflePhotos(): void {
    const len = this.filteredPhotoUrls().length;
    if (len > 1) {
      this.photoOffset.update((v) => (v + 1) % len);
      this.warmVisiblePhotoCache();
    }
  }

  private extractMealTimestampMs(m: KinMealPhotoItem): number | null {
    if (m.timestamp) {
      const parsed = new Date(m.timestamp).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }

  private formatYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseLocalYMD(ymd: string, endOfDay: boolean): number | null {
    const match = (ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const d = endOfDay
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999)
      : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  // Drag & Zoom Gestures
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
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    this.setZoom(this.overlayScale() + delta);
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.visible) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.kin-collage-draggable')) return;
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
    this.overlayPosition.set({ x: 0, y: -110 });
  }

  alignCenter(): void {
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  alignBottom(): void {
    this.overlayPosition.set({ x: 0, y: 110 });
  }

  resetPosition(): void {
    this.overlayScale.set(0.92);
    this.overlayPosition.set({ x: 0, y: 0 });
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async exportCollage(action: 'download' | 'share'): Promise<void> {
    if (!this.collageCaptureArea?.nativeElement || this.isExporting() || this.displayPhotos().length === 0) return;
    this.activeTool.set(null);
    this.isExporting.set(true);
    this.exportAction.set(action);

    try {
      // Asegurar que todas las fotos visibles estén en dataUrl antes de capturar
      const urls = this.displayPhotos();
      const cache = this.safeUrlCache();
      const missing = urls.filter((u) => u && !u.startsWith('data:') && !cache[u]);
      if (missing.length > 0) {
        const converted = await Promise.all(missing.map((u) => this.toDataUrl(u)));
        this.safeUrlCache.update((curr) => {
          const next = { ...curr };
          missing.forEach((u, i) => (next[u] = converted[i]));
          return next;
        });
        await new Promise((r) => setTimeout(r, 80));
      }

      const node = this.collageCaptureArea.nativeElement;
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#0C0A09',
      });
      const blob = await (await fetch(dataUrl)).blob();
      const ratioSlug = this.aspectRatio().replace(':', 'x');
      const teamSlug = (this.kin?.team_name || 'kin').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `collage-${teamSlug}-${this.datePreset()}-${ratioSlug}.png`;

      if (action === 'share' && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${this.headline()} - ${this.kin?.team_name || 'Awakin Kin'}`,
            text: `🥗 ${this.headline()} (${this.periodLabel()}) · ${this.kin?.team_name || 'Mi Kin'} en Awakin`,
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
        console.error('Error exportando collage del Kin:', err);
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
