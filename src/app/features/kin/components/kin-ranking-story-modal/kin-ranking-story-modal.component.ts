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
import { KinMemberItem } from '../../../../core/services/kin.service';

export type KinRankingMode = 'streak' | 'workouts' | 'level';
export type KinRankingAspectRatio = '9:16' | '4:5' | '1:1';
export type KinRankingCardStyle = 'transparent' | 'glass' | 'dark';
export type KinRankingTemplateId = 'podium' | 'cards' | 'champion' | 'minimal' | 'ritual';
type KinRankingTool = 'template' | 'mode' | 'ratio' | 'contrast' | 'overlay' | 'transform';

@Component({
  selector: 'app-kin-ranking-story-modal',
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
              <i class="pi pi-trophy text-xs text-awakin-sun"></i>
            </div>
            <h3 class="text-xs font-black uppercase tracking-wider text-stone-900 truncate">Podio del Kin</h3>
          </div>
          <button type="button" (click)="closeModal()"
            class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <!-- Escenario Principal Sin Scroll (Estilo Editor de Stories) -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-3 bg-stone-100/70 overflow-hidden"
          (click)="closeTool()">

          <div class="w-full h-full flex items-center justify-center pr-11 sm:pr-12" style="container-type: size;">
            <div class="overflow-hidden rounded-none shadow-md bg-stone-950 shrink-0" [ngStyle]="captureBoxStyle()">
              <div #podiumCaptureArea
                class="story-preview-container relative overflow-hidden rounded-none border-0 shadow-none bg-[#0C0A09] flex flex-col justify-center items-center w-full h-full transition-all"
                style="border-radius: 0px !important; border: 0 !important; box-shadow: none !important;"
                (wheel)="onWheelZoom($event)">

                <!-- 1. FONDO: ranking_bg_url CON TRANSPARENCIA O DARK RITUAL AWAKIN -->
                @if (safeBgUrl(); as bg) {
                <img [src]="bg" alt="Fondo Podio"
                  class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />
                <div class="absolute inset-0 pointer-events-none transition-opacity duration-200"
                  [style.background]="'rgba(12, 10, 9, ' + (dimLevel() / 100) + ')'"></div>
                <div
                  class="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none">
                </div>
                } @else {
                <div class="absolute inset-0 bg-[#0C0A09] pointer-events-none">
                  <div
                    class="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(254,151,10,0.26)_0%,rgba(12,10,9,0.96)_72%)]">
                  </div>
                  <div class="absolute inset-0 opacity-[0.05]"
                    style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 16px 16px;">
                  </div>
                </div>
                }

                <!-- 2. CAPA OVERLAY ARRASTRABLE Y ESCALABLE -->
                <div
                  class="kin-ranking-draggable relative z-20 w-full h-full flex items-center justify-center px-3 select-none touch-none"
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

                      <!-- ========================================================== -->
                      <!-- PLANTILLA 1: PODIO 3D CLÁSICO (2° | 1° CORONA | 3° + 4-5)  -->
                      <!-- ========================================================== -->
                      @if (selectedTemplate() === 'podium') {
                      <div class="space-y-3 text-center">
                        <div class="space-y-0.5">
                          <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-awakin-sun/20 border border-awakin-sun/40 text-awakin-sun text-[8px] font-black uppercase tracking-widest">
                            <i class="pi pi-trophy text-[8px]"></i>
                            <span>{{ modeTitle() }}</span>
                          </div>
                          <h4 class="text-sm sm:text-base font-black uppercase tracking-tight leading-tight">
                            {{ kin?.team_name || 'MI KIN' }}
                          </h4>
                          <div class="text-[8px] font-bold uppercase tracking-widest text-stone-300">{{ todayFormatted }}</div>
                        </div>

                        @if (sortedMembers().length > 0) {
                        <div class="grid grid-cols-3 items-end gap-1.5 px-0.5 pt-1">
                          <!-- 2° -->
                          <div class="flex flex-col items-center">
                            @if (sortedMembers()[1]; as second) {
                            <div class="relative mb-1">
                              <img [src]="getSafeAvatar(second)" [alt]="second.full_name"
                                class="w-10 h-10 rounded-full object-cover border-2 border-stone-300 shadow-md" />
                              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-stone-200 text-stone-950 text-[9px] font-black flex items-center justify-center border border-stone-900">2</span>
                            </div>
                            <span class="text-[9px] font-black truncate max-w-full">{{ second.full_name.split(' ')[0] }}</span>
                            <span class="text-[8px] font-bold text-stone-300 truncate max-w-full">{{ formatMetric(second) }}</span>
                            <div class="w-full h-14 mt-1 rounded-t-xl bg-gradient-to-b from-stone-300/35 to-stone-500/15 border border-stone-300/35 flex items-center justify-center">
                              <span class="text-base font-black text-stone-200">2°</span>
                            </div>
                            } @else {
                            <div class="w-full h-12 rounded-t-xl bg-white/5 border border-white/10"></div>
                            }
                          </div>

                          <!-- 1° -->
                          <div class="flex flex-col items-center">
                            @if (sortedMembers()[0]; as first) {
                            <div class="text-amber-400 text-xs mb-0.5">👑</div>
                            <div class="relative mb-1">
                              <img [src]="getSafeAvatar(first)" [alt]="first.full_name"
                                class="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.45)]" />
                              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[9px] font-black flex items-center justify-center border border-stone-950">1</span>
                            </div>
                            <span class="text-[10px] font-black text-amber-300 truncate max-w-full">{{ first.full_name.split(' ')[0] }}</span>
                            <span class="text-[8px] font-black text-white truncate max-w-full">{{ formatMetric(first) }}</span>
                            <div class="w-full h-20 mt-1 rounded-t-xl bg-gradient-to-b from-amber-400/45 to-amber-600/15 border border-amber-400/50 flex items-center justify-center shadow-lg">
                              <span class="text-xl font-black text-amber-300">1°</span>
                            </div>
                            }
                          </div>

                          <!-- 3° -->
                          <div class="flex flex-col items-center">
                            @if (sortedMembers()[2]; as third) {
                            <div class="relative mb-1">
                              <img [src]="getSafeAvatar(third)" [alt]="third.full_name"
                                class="w-9 h-9 rounded-full object-cover border-2 border-amber-700 shadow-md" />
                              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-700 text-white text-[9px] font-black flex items-center justify-center border border-stone-900">3</span>
                            </div>
                            <span class="text-[9px] font-black truncate max-w-full">{{ third.full_name.split(' ')[0] }}</span>
                            <span class="text-[8px] font-bold text-stone-300 truncate max-w-full">{{ formatMetric(third) }}</span>
                            <div class="w-full h-10 mt-1 rounded-t-xl bg-gradient-to-b from-amber-700/40 to-amber-900/15 border border-amber-700/40 flex items-center justify-center">
                              <span class="text-sm font-black text-amber-200">3°</span>
                            </div>
                            } @else {
                            <div class="w-full h-9 rounded-t-xl bg-white/5 border border-white/10"></div>
                            }
                          </div>
                        </div>

                        @if (sortedMembers().length > 3) {
                        <div class="space-y-1 pt-1">
                          @for (m of sortedMembers().slice(3, 5); track m.id; let i = $index) {
                          <div class="flex items-center justify-between gap-2 px-2 py-1 rounded-xl bg-black/45 border border-white/15 text-left">
                            <div class="flex items-center gap-1.5 min-w-0">
                              <span class="text-[9px] font-black text-stone-300 w-4 text-center">{{ i + 4 }}°</span>
                              <img [src]="getSafeAvatar(m)" [alt]="m.full_name" class="w-5 h-5 rounded-full object-cover border border-white/25 shrink-0" />
                              <span class="text-[9px] font-bold text-white truncate">{{ m.full_name }}</span>
                            </div>
                            <span class="text-[9px] font-black text-awakin-sun shrink-0">{{ formatMetric(m) }}</span>
                          </div>
                          }
                        </div>
                        }
                        }
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- PLANTILLA 2: RANKING ELITE (TARJETAS CON BARRA PROGRESO)   -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'cards') {
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <div>
                            <div class="text-[8px] font-black uppercase tracking-widest text-awakin-sun">{{ modeTitle() }}</div>
                            <h4 class="text-sm font-black uppercase tracking-tight">{{ kin?.team_name || 'MI KIN' }}</h4>
                          </div>
                          <span class="text-[8px] font-bold uppercase text-stone-300">{{ todayFormatted }}</span>
                        </div>

                        <div class="space-y-1.5">
                          @for (m of sortedMembers().slice(0, 5); track m.id; let idx = $index) {
                          <div class="p-2 rounded-xl bg-black/45 border border-white/15 space-y-1">
                            <div class="flex items-center justify-between gap-2">
                              <div class="flex items-center gap-2 min-w-0">
                                <span class="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
                                  [ngClass]="idx === 0 ? 'bg-amber-400 text-stone-950' : idx === 1 ? 'bg-stone-300 text-stone-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-stone-200'">
                                  {{ idx + 1 }}
                                </span>
                                <img [src]="getSafeAvatar(m)" [alt]="m.full_name" class="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0" />
                                <span class="text-[10px] font-black truncate">{{ m.full_name }}</span>
                              </div>
                              <span class="text-[10px] font-black text-awakin-sun shrink-0">{{ formatMetric(m) }}</span>
                            </div>
                            <div class="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                              <div class="h-full rounded-full"
                                [ngClass]="idx === 0 ? 'bg-amber-400' : 'bg-awakin-sun/75'"
                                [style.width.%]="getRelativeBarPct(m)"></div>
                            </div>
                          </div>
                          }
                        </div>
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- PLANTILLA 3: MVP DESTACADO (#1 SPOTLIGHT + RUNNERS-UP)     -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'champion') {
                      <div class="space-y-2.5 text-center">
                        <div class="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                          👑 LÍDER #1 · {{ modeTitle() }}
                        </div>

                        @if (sortedMembers()[0]; as mvp) {
                        <div class="flex flex-col items-center py-1">
                          <div class="relative">
                            <img [src]="getSafeAvatar(mvp)" [alt]="mvp.full_name"
                              class="w-16 h-16 rounded-full object-cover border-3 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.5)]" />
                            <span class="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[8px] font-black uppercase tracking-wider">
                              MVP
                            </span>
                          </div>
                          <h4 class="text-sm font-black uppercase tracking-tight mt-2.5">{{ mvp.full_name }}</h4>
                          <div class="text-lg font-black text-awakin-sun tabular-nums leading-tight">
                            {{ formatMetric(mvp) }}
                          </div>
                        </div>
                        }

                        @if (sortedMembers().length > 1) {
                        <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/15">
                          @for (runner of sortedMembers().slice(1, 3); track runner.id; let i = $index) {
                          <div class="flex items-center gap-1.5 p-1.5 rounded-xl bg-black/40 border border-white/15 text-left">
                            <span class="text-[10px] font-black text-stone-300">{{ i + 2 }}°</span>
                            <img [src]="getSafeAvatar(runner)" [alt]="runner.full_name" class="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0" />
                            <div class="min-w-0">
                              <div class="text-[9px] font-black truncate">{{ runner.full_name.split(' ')[0] }}</div>
                              <div class="text-[8px] font-bold text-awakin-sun truncate">{{ formatMetric(runner) }}</div>
                            </div>
                          </div>
                          }
                        </div>
                        }
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- PLANTILLA 4: TOP 3 MINIMAL EDITORIAL                       -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'minimal') {
                      <div class="space-y-2 text-left px-1">
                        <div class="text-[8px] font-black uppercase tracking-[0.22em] text-awakin-sun">
                          {{ kin?.team_name || 'MI KIN' }} · {{ todayFormatted }}
                        </div>
                        <h4 class="text-sm font-black uppercase tracking-tight leading-none">
                          {{ modeTitle() }}
                        </h4>

                        <div class="space-y-1.5 pt-1">
                          @for (m of sortedMembers().slice(0, 3); track m.id; let idx = $index) {
                          <div class="flex items-center justify-between gap-2 py-1 border-b border-white/15 last:border-b-0">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="text-xs font-black tabular-nums" [ngClass]="idx === 0 ? 'text-amber-400' : 'text-stone-300'">
                                0{{ idx + 1 }}
                              </span>
                              <img [src]="getSafeAvatar(m)" [alt]="m.full_name" class="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0" />
                              <span class="text-[11px] font-black uppercase truncate">{{ m.full_name }}</span>
                            </div>
                            <span class="text-[10px] font-black text-awakin-sun shrink-0">{{ formatMetric(m) }}</span>
                          </div>
                          }
                        </div>
                      </div>
                      }

                      <!-- ========================================================== -->
                      <!-- PLANTILLA 5: SALÓN DE LA TRIBU (RITUAL CULT)               -->
                      <!-- ========================================================== -->
                      @else if (selectedTemplate() === 'ritual') {
                      <div class="space-y-2 text-center">
                        <div class="text-[9px] font-black uppercase tracking-[0.22em] text-awakin-sun">
                          HONOR Y DISCIPLINA · {{ kin?.team_name || 'MI KIN' }}
                        </div>
                        <div class="text-xs font-black uppercase italic text-stone-100">
                          {{ modeTitle() }}
                        </div>

                        <div class="flex items-center justify-center gap-3 py-1.5 border-y border-white/20">
                          @for (m of sortedMembers().slice(0, 3); track m.id; let idx = $index) {
                          <div class="flex flex-col items-center w-20">
                            <div class="relative">
                              <img [src]="getSafeAvatar(m)" [alt]="m.full_name"
                                class="rounded-full object-cover border-2 shadow-md"
                                [ngClass]="idx === 0 ? 'w-12 h-12 border-amber-400' : 'w-10 h-10 border-white/40'" />
                              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center"
                                [ngClass]="idx === 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 text-white border border-white/30'">
                                {{ idx + 1 }}
                              </span>
                            </div>
                            <span class="text-[9px] font-black truncate w-full mt-1.5">{{ m.full_name.split(' ')[0] }}</span>
                            <span class="text-[8px] font-bold text-awakin-sun">{{ formatMetric(m) }}</span>
                          </div>
                          }
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
                          LEADERBOARD KIN
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

            <button type="button" (click)="toggleTool('mode')" title="Categoría (Racha, Semana, Nivel)" aria-label="Categoría"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'mode' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-trophy text-xs"></i>
            </button>

            <button type="button" (click)="toggleTool('ratio')" title="Proporción" aria-label="Proporción"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90"
              [ngClass]="activeTool() === 'ratio' ? 'bg-awakin-sun text-white shadow-sm' : 'text-white/85 hover:bg-white/15'">
              <i class="pi pi-expand text-xs"></i>
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
            } @else if (tool === 'mode') {
            <div class="flex items-center gap-1.5">
              <button type="button" (click)="activeMode.set('streak')"
                class="flex-1 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all"
                [ngClass]="activeMode() === 'streak' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                🔥 Racha
              </button>
              <button type="button" (click)="activeMode.set('workouts')"
                class="flex-1 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all"
                [ngClass]="activeMode() === 'workouts' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                ⚡ Semana
              </button>
              <button type="button" (click)="activeMode.set('level')"
                class="flex-1 py-1.5 rounded-xl text-[10px] font-black cursor-pointer transition-all"
                [ngClass]="activeMode() === 'level' ? 'bg-awakin-sun text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'">
                🏆 Nivel
              </button>
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
export class KinRankingStoryModalComponent implements OnChanges, OnDestroy {
  protected readonly Math = Math;

  @Input() visible = false;
  @Input() kin: KinInfo | null = null;
  @Input() members: KinMemberItem[] = [];
  @Input() initialMode: KinRankingMode = 'streak';
  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('podiumCaptureArea') podiumCaptureArea!: ElementRef<HTMLDivElement>;

  readonly ratios: KinRankingAspectRatio[] = ['9:16', '4:5', '1:1'];
  readonly templates: { id: KinRankingTemplateId; label: string; icon: string }[] = [
    { id: 'podium', label: 'Podio 3D', icon: 'pi pi-trophy' },
    { id: 'cards', label: 'Ranking Elite', icon: 'pi pi-list' },
    { id: 'champion', label: 'MVP #1', icon: 'pi pi-star' },
    { id: 'minimal', label: 'Minimal', icon: 'pi pi-minus' },
    { id: 'ritual', label: 'Tribu Cult', icon: 'pi pi-shield' },
  ];

  readonly todayFormatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date())
    .toUpperCase();

  selectedTemplate = signal<KinRankingTemplateId>('podium');
  activeMode = signal<KinRankingMode>('streak');
  aspectRatio = signal<KinRankingAspectRatio>('9:16');
  cardStyle = signal<KinRankingCardStyle>('transparent');
  dimLevel = signal<number>(45);
  activeTool = signal<KinRankingTool | null>(null);

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

  safeBgUrl = signal<string | null>(null);
  safeKinLogo = signal<string | null>(null);
  safeAvatarMap = signal<Record<string, string>>({});

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

  modeTitle = computed(() => {
    switch (this.activeMode()) {
      case 'workouts':
        return 'Top Entrenos · Semana';
      case 'level':
        return 'Top Nivel del Kin';
      case 'streak':
      default:
        return 'Top Racha Activa';
    }
  });

  sortedMembers = computed<KinMemberItem[]>(() => {
    const list = [...(this.members || [])];
    const mode = this.activeMode();
    return list.sort((a, b) => {
      if (mode === 'workouts') {
        return b.weekly_workouts - a.weekly_workouts || b.streak_days - a.streak_days;
      }
      if (mode === 'level') {
        return b.current_level - a.current_level || b.streak_days - a.streak_days;
      }
      return b.streak_days - a.streak_days || b.weekly_workouts - a.weekly_workouts;
    });
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
    if (changes['initialMode'] && this.initialMode) {
      this.activeMode.set(this.initialMode);
    }
    if (changes['visible'] && this.visible) {
      this.activeMode.set(this.initialMode || 'streak');
      this.activeTool.set(null);
      this.prepareAssets();
    }
  }

  toggleTool(tool: KinRankingTool): void {
    this.activeTool.update((curr) => (curr === tool ? null : tool));
  }

  closeTool(): void {
    this.activeTool.set(null);
  }

  private prepareAssets(): void {
    const bg = this.kin?.ranking_bg_url || null;
    this.safeBgUrl.set(bg);
    if (bg) this.toDataUrl(bg).then((safe) => this.safeBgUrl.set(safe));

    const logo = this.kin?.team_logo_url || null;
    this.safeKinLogo.set(logo);
    if (logo) this.toDataUrl(logo).then((safe) => this.safeKinLogo.set(safe));

    (this.members || []).slice(0, 8).forEach((m) => {
      const rawUrl = m.profile_image_url || `https://i.pravatar.cc/120?u=${m.id}`;
      this.toDataUrl(rawUrl).then((safe) => {
        this.safeAvatarMap.update((map) => ({ ...map, [m.id]: safe }));
      });
    });
  }

  getSafeAvatar(member: KinMemberItem): string {
    return this.safeAvatarMap()[member.id] || member.profile_image_url || `https://i.pravatar.cc/120?u=${member.id}`;
  }

  formatMetric(member: KinMemberItem): string {
    switch (this.activeMode()) {
      case 'workouts':
        return `${member.weekly_workouts} ent.`;
      case 'level':
        return `Nv. ${member.current_level}`;
      case 'streak':
      default:
        return `${member.streak_days} días 🔥`;
    }
  }

  getRelativeBarPct(member: KinMemberItem): number {
    const top = this.sortedMembers()[0];
    if (!top) return 20;
    const val =
      this.activeMode() === 'workouts'
        ? member.weekly_workouts
        : this.activeMode() === 'level'
        ? member.current_level
        : member.streak_days;
    const max =
      this.activeMode() === 'workouts'
        ? top.weekly_workouts
        : this.activeMode() === 'level'
        ? top.current_level
        : top.streak_days;
    if (!max || max <= 0) return 35;
    return Math.max(15, Math.min(100, Math.round((val / max) * 100)));
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
    if (!target?.closest('.kin-ranking-draggable')) return;
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

  async exportStory(action: 'download' | 'share'): Promise<void> {
    if (!this.podiumCaptureArea?.nativeElement || this.isExporting()) return;
    this.activeTool.set(null);
    this.isExporting.set(true);
    this.exportAction.set(action);

    try {
      const node = this.podiumCaptureArea.nativeElement;
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#0C0A09',
      });
      const blob = await (await fetch(dataUrl)).blob();
      const teamSlug = (this.kin?.team_name || 'kin').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `podio-${teamSlug}-${this.activeMode()}.png`;

      if (action === 'share' && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${this.modeTitle()} - ${this.kin?.team_name || 'Awakin Kin'}`,
            text: `🏆 ${this.modeTitle()} · ${this.kin?.team_name || 'Mi Kin'} en Awakin`,
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
        console.error('Error exportando podio del Kin:', err);
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
