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
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import * as htmlToImage from 'html-to-image';
import { KinInfo } from '../../../../core/services/athlete.service';
import { KinMemberItem } from '../../../../core/services/kin.service';

export type KinRankingMode = 'streak' | 'workouts' | 'level';

@Component({
  selector: 'app-kin-ranking-story-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [blockScroll]="true" [draggable]="false" [resizable]="false"
      [closable]="false" [showHeader]="false" [dismissableMask]="true" appendTo="body" (onHide)="closeModal()"
      [style]="{ width: '96vw', maxWidth: '440px', borderRadius: '14px' }"
      styleClass="overflow-hidden shadow-2xl border border-stone-200 bg-white rounded-xl [&_.p-dialog-content]:!p-0 [&_.p-dialog-content]:!overflow-hidden">

      <div class="bg-white text-stone-900 flex flex-col h-[86dvh] max-h-[86dvh] w-full overflow-hidden rounded-xl">
        <!-- Header Fijo -->
        <div class="px-4 py-2.5 border-b border-stone-100 bg-white flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
              <i class="pi pi-trophy text-xs text-amber-500"></i>
            </div>
            <div class="min-w-0">
              <h3 class="text-xs font-black uppercase tracking-wider text-stone-900 truncate">Podio del Kin 9:16</h3>
              <p class="text-[10px] text-stone-400 font-medium truncate">Historia de Leaderboard para compartir</p>
            </div>
          </div>
          <button type="button" (click)="closeModal()"
            class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <!-- Preview Canvas 9:16 -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center p-2.5 bg-stone-100/80 overflow-hidden">
          <div class="w-full h-full flex items-center justify-center" style="container-type: size;">
            <div class="overflow-hidden rounded-none shadow-lg bg-stone-950 shrink-0"
              [ngStyle]="{ width: 'min(100cqw, calc(100cqh * 9 / 16))', height: 'min(100cqh, calc(100cqw * 16 / 9))' }">

              <div #podiumCaptureArea
                class="relative w-full h-full overflow-hidden rounded-none border-0 shadow-none bg-[#0C0A09] flex flex-col justify-between p-4 text-white"
                style="border-radius: 0px !important; border: 0 !important; box-shadow: none !important;">

                <!-- Fondo: ranking_bg_url con transparencia o Dark Ritual Awakin -->
                @if (safeBgUrl(); as bg) {
                  <img [src]="bg" alt="Fondo Podio" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                  <div class="absolute inset-0 pointer-events-none"
                    [style.background]="'rgba(12, 10, 9, ' + (dimLevel() / 100) + ')'"></div>
                  <div class="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/85 pointer-events-none"></div>
                } @else {
                  <div class="absolute inset-0 bg-[#0C0A09] pointer-events-none">
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(254,151,10,0.28)_0%,rgba(12,10,9,0.96)_72%)]"></div>
                    <div class="absolute inset-0 opacity-[0.05]"
                      style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 16px 16px;"></div>
                  </div>
                }

                <!-- Top: Título + Badge Categoría -->
                <div class="relative z-10 text-center space-y-1.5 pt-1">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-awakin-sun/20 border border-awakin-sun/40 text-awakin-sun text-[9px] font-black uppercase tracking-widest">
                    <i class="pi pi-trophy text-[9px]"></i>
                    <span>{{ modeTitle() }}</span>
                  </div>
                  <h2 class="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-tight drop-shadow">
                    {{ kin?.team_name || 'MI KIN' }}
                  </h2>
                  <p class="text-[9px] font-bold uppercase tracking-widest text-stone-300">
                    {{ todayFormatted }}
                  </p>
                </div>

                <!-- Centro: Podio Visual Top 3 (2° | 1° | 3°) + Resto Top 5 -->
                <div class="relative z-10 flex-1 flex flex-col justify-center gap-3 my-2">
                  @if (sortedMembers().length > 0) {
                    <div class="grid grid-cols-3 items-end gap-2 px-1">
                      <!-- 2° Lugar -->
                      <div class="flex flex-col items-center">
                        @if (sortedMembers()[1]; as second) {
                          <div class="relative mb-1.5">
                            <img [src]="getSafeAvatar(second)" [alt]="second.full_name"
                              class="w-11 h-11 rounded-full object-cover border-2 border-stone-300 shadow-lg" />
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-stone-200 text-stone-900 text-[10px] font-black flex items-center justify-center border border-stone-900">
                              2
                            </span>
                          </div>
                          <span class="text-[10px] font-black text-white truncate max-w-full text-center leading-tight">
                            {{ second.full_name.split(' ')[0] }}
                          </span>
                          <span class="text-[8px] font-bold text-stone-300 truncate max-w-full">
                            {{ formatMetric(second) }}
                          </span>
                          <div class="w-full h-16 mt-1.5 rounded-t-xl bg-gradient-to-b from-stone-300/35 to-stone-500/15 border border-stone-300/35 flex flex-col items-center justify-center">
                            <span class="text-lg font-black text-stone-200">2°</span>
                          </div>
                        } @else {
                          <div class="w-full h-14 rounded-t-xl bg-white/5 border border-white/10"></div>
                        }
                      </div>

                      <!-- 1° Lugar (Elevado + Corona Dorada) -->
                      <div class="flex flex-col items-center">
                        @if (sortedMembers()[0]; as first) {
                          <div class="text-amber-400 text-sm mb-0.5 drop-shadow">👑</div>
                          <div class="relative mb-1.5">
                            <img [src]="getSafeAvatar(first)" [alt]="first.full_name"
                              class="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.45)]" />
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black flex items-center justify-center border border-stone-950">
                              1
                            </span>
                          </div>
                          <span class="text-[11px] font-black text-amber-300 truncate max-w-full text-center leading-tight">
                            {{ first.full_name.split(' ')[0] }}
                          </span>
                          <span class="text-[9px] font-black text-white truncate max-w-full">
                            {{ formatMetric(first) }}
                          </span>
                          <div class="w-full h-24 mt-1.5 rounded-t-xl bg-gradient-to-b from-amber-400/45 to-amber-600/15 border border-amber-400/50 flex flex-col items-center justify-center shadow-lg">
                            <span class="text-2xl font-black text-amber-300">1°</span>
                          </div>
                        }
                      </div>

                      <!-- 3° Lugar -->
                      <div class="flex flex-col items-center">
                        @if (sortedMembers()[2]; as third) {
                          <div class="relative mb-1.5">
                            <img [src]="getSafeAvatar(third)" [alt]="third.full_name"
                              class="w-10 h-10 rounded-full object-cover border-2 border-amber-700 shadow-lg" />
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-black flex items-center justify-center border border-stone-900">
                              3
                            </span>
                          </div>
                          <span class="text-[10px] font-black text-white truncate max-w-full text-center leading-tight">
                            {{ third.full_name.split(' ')[0] }}
                          </span>
                          <span class="text-[8px] font-bold text-stone-300 truncate max-w-full">
                            {{ formatMetric(third) }}
                          </span>
                          <div class="w-full h-12 mt-1.5 rounded-t-xl bg-gradient-to-b from-amber-700/40 to-amber-900/15 border border-amber-700/40 flex flex-col items-center justify-center">
                            <span class="text-base font-black text-amber-200">3°</span>
                          </div>
                        } @else {
                          <div class="w-full h-10 rounded-t-xl bg-white/5 border border-white/10"></div>
                        }
                      </div>
                    </div>

                    <!-- Posiciones #4 y #5 si existen -->
                    @if (sortedMembers().length > 3) {
                      <div class="space-y-1.5 px-1">
                        @for (m of sortedMembers().slice(3, 5); track m.id; let i = $index) {
                          <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-black/45 border border-white/15">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="text-[10px] font-black text-stone-300 w-4 text-center">{{ i + 4 }}°</span>
                              <img [src]="getSafeAvatar(m)" [alt]="m.full_name"
                                class="w-6 h-6 rounded-full object-cover border border-white/25 shrink-0" />
                              <span class="text-[10px] font-bold text-white truncate">{{ m.full_name }}</span>
                            </div>
                            <span class="text-[10px] font-black text-awakin-sun shrink-0">{{ formatMetric(m) }}</span>
                          </div>
                        }
                      </div>
                    }
                  } @else {
                    <div class="text-center text-xs text-stone-400">Sin miembros en el ranking</div>
                  }
                </div>

                <!-- Footer Branding: Awakin Isotipo × Kin Logo -->
                <div class="relative z-10 pt-2 border-t border-white/15 flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <img src="/icons/awakin-isotipo.png" alt="Awakin" class="w-4 h-4 object-contain shrink-0" />
                    @if (safeKinLogo()) {
                      <span class="text-[9px] text-stone-400 font-bold">×</span>
                      <img [src]="safeKinLogo()!" [alt]="kin?.team_name || 'Kin'" class="h-4 object-contain shrink-0 rounded-xs" />
                    }
                  </div>
                  <span class="text-[9px] font-black uppercase tracking-widest text-stone-300">
                    LEADERBOARD KIN
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Selector de Categoría + Opacidad -->
        <div class="px-4 py-2.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200">
            <button type="button" (click)="activeMode.set('streak')"
              class="px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
              [ngClass]="activeMode() === 'streak' ? 'bg-stone-900 text-white' : 'text-stone-500'">
              Racha
            </button>
            <button type="button" (click)="activeMode.set('workouts')"
              class="px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
              [ngClass]="activeMode() === 'workouts' ? 'bg-stone-900 text-white' : 'text-stone-500'">
              Semana
            </button>
            <button type="button" (click)="activeMode.set('level')"
              class="px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer"
              [ngClass]="activeMode() === 'level' ? 'bg-stone-900 text-white' : 'text-stone-500'">
              Nivel
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <i class="pi pi-sun text-[10px] text-stone-400"></i>
            <input type="range" min="15" max="80" step="5" [ngModel]="dimLevel()" (ngModelChange)="dimLevel.set($event)"
              class="w-20 h-1.5 bg-stone-200 rounded-lg accent-awakin-sun cursor-pointer" title="Oscurecer fondo" />
          </div>
        </div>

        <!-- Footer Acciones (Mobile: solo Compartir; Desktop: Guardar PNG + Compartir) -->
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
export class KinRankingStoryModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() kin: KinInfo | null = null;
  @Input() members: KinMemberItem[] = [];
  @Input() initialMode: KinRankingMode = 'streak';

  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('podiumCaptureArea') podiumCaptureArea!: ElementRef<HTMLDivElement>;

  readonly todayFormatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date())
    .toUpperCase();

  activeMode = signal<KinRankingMode>('streak');
  dimLevel = signal<number>(45);
  isExporting = signal<boolean>(false);
  exportAction = signal<'download' | 'share' | null>(null);

  safeBgUrl = signal<string | null>(null);
  safeKinLogo = signal<string | null>(null);
  safeAvatarMap = signal<Record<string, string>>({});

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialMode'] && this.initialMode) {
      this.activeMode.set(this.initialMode);
    }
    if (changes['visible'] && this.visible) {
      this.activeMode.set(this.initialMode || 'streak');
      this.prepareAssets();
    }
  }

  private prepareAssets(): void {
    const bg = this.kin?.ranking_bg_url || null;
    this.safeBgUrl.set(bg);
    if (bg) {
      this.toDataUrl(bg).then((safe) => this.safeBgUrl.set(safe));
    }

    const logo = this.kin?.team_logo_url || null;
    this.safeKinLogo.set(logo);
    if (logo) {
      this.toDataUrl(logo).then((safe) => this.safeKinLogo.set(safe));
    }

    const top = (this.members || []).slice(0, 8);
    top.forEach((m) => {
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

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async exportStory(action: 'download' | 'share'): Promise<void> {
    if (!this.podiumCaptureArea?.nativeElement || this.isExporting()) return;
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
