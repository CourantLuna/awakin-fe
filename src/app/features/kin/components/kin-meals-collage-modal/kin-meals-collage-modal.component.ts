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
import { KinMealPhotoItem } from '../../../../core/services/kin.service';

export type KinCollageRatio = '9:16' | '16:9' | '4:5' | '1:1';

@Component({
  selector: 'app-kin-meals-collage-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [blockScroll]="true" [draggable]="false" [resizable]="false"
      [closable]="false" [showHeader]="false" [dismissableMask]="true" appendTo="body" (onHide)="closeModal()"
      [style]="{ width: '96vw', maxWidth: '460px', borderRadius: '14px' }"
      styleClass="overflow-hidden shadow-2xl border border-stone-200 bg-white rounded-xl [&_.p-dialog-content]:!p-0 [&_.p-dialog-content]:!overflow-hidden">

      <div class="bg-white text-stone-900 flex flex-col h-[86dvh] max-h-[86dvh] w-full overflow-hidden rounded-xl">
        <!-- Header Fijo -->
        <div class="px-4 py-2.5 border-b border-stone-100 bg-white flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-xl bg-kin-primary/10 border border-kin-primary/25 flex items-center justify-center shrink-0">
              <img src="/icons/intake-active.png" alt="Kin Comidas" class="w-4 h-4 object-contain" />
            </div>
            <div class="min-w-0">
              <h3 class="text-xs font-black uppercase tracking-wider text-stone-900 truncate">Collage del Kin</h3>
              <p class="text-[10px] text-stone-400 font-medium truncate">4 formatos: 9:16 · 16:9 · 4:5 · 1:1</p>
            </div>
          </div>
          <button type="button" (click)="closeModal()"
            class="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0">
            <i class="pi pi-times text-xs"></i>
          </button>
        </div>

        <!-- Preview Canvas -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center p-3 bg-stone-100/80 overflow-hidden">
          <div class="w-full h-full flex items-center justify-center" style="container-type: size;">
            <div class="overflow-hidden rounded-none shadow-lg bg-stone-950 shrink-0" [ngStyle]="captureBoxStyle()">
              <div #collageCaptureArea
                class="relative w-full h-full overflow-hidden rounded-none border-0 shadow-none bg-stone-950 flex flex-col justify-between"
                style="border-radius: 0px !important; border: 0 !important; box-shadow: none !important;">

                <!-- Grid de Fotos de Comidas del Kin -->
                @if (displayPhotos().length > 0) {
                  <div class="absolute inset-0 grid gap-0.5 bg-stone-950" [ngClass]="gridLayoutClass()">
                    @for (photo of displayPhotos(); track $index) {
                      <div class="relative w-full h-full overflow-hidden bg-stone-900">
                        <img [src]="photo" alt="Comida del Kin" class="w-full h-full object-cover" />
                      </div>
                    }
                  </div>
                } @else {
                  <div class="absolute inset-0 bg-[#0C0A09]">
                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(254,151,10,0.22)_0%,rgba(12,10,9,0.96)_72%)]"></div>
                  </div>
                }

                <!-- Overlay de contraste -->
                <div class="absolute inset-0 pointer-events-none"
                  [style.background]="'rgba(12, 10, 9, ' + (dimLevel() / 100) + ')'"></div>
                <div class="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-black/80 pointer-events-none"></div>

                <!-- Header Overlay Superior -->
                <div class="relative z-10 p-3.5 flex items-start justify-between gap-2 text-white">
                  <div class="flex items-center gap-2 min-w-0">
                    @if (safeKinLogo()) {
                      <img [src]="safeKinLogo()!" [alt]="kin?.team_name || 'Kin'"
                        class="w-8 h-8 rounded-xl object-cover border border-white/25 bg-white/95 p-0.5 shrink-0 shadow-md" />
                    }
                    <div class="min-w-0">
                      <div class="text-[9px] font-black uppercase tracking-widest text-awakin-sun drop-shadow">
                        {{ kin?.team_name || 'MI KIN' }}
                      </div>
                      <h4 class="font-black uppercase tracking-tight leading-tight text-white drop-shadow-md break-words"
                        [ngClass]="aspectRatio() === '16:9' ? 'text-sm' : 'text-base sm:text-lg'">
                        {{ headline() }}
                      </h4>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full bg-black/50 border border-white/20 text-[9px] font-black uppercase tracking-wider text-stone-100 shrink-0">
                    {{ displayPhotos().length }} platos
                  </span>
                </div>

                <!-- Footer Branding -->
                <div class="relative z-10 px-3.5 py-2.5 flex items-center justify-between text-white">
                  <div class="flex items-center gap-1.5">
                    <img src="/icons/awakin-isotipo.png" alt="Awakin" class="w-4 h-4 object-contain shrink-0" />
                    @if (safeKinLogo()) {
                      <span class="text-[9px] text-stone-300 font-bold">×</span>
                      <img [src]="safeKinLogo()!" [alt]="kin?.team_name || 'Kin'" class="h-4 object-contain shrink-0 rounded-xs" />
                    }
                  </div>
                  <span class="text-[9px] font-bold uppercase tracking-widest text-stone-200/90">
                    {{ todayFormatted }}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Controles Compactos -->
        <div class="px-4 py-2.5 border-t border-stone-100 bg-stone-50/70 space-y-2.5 shrink-0">
          <!-- Selector de 4 Proporciones -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-black uppercase tracking-wider text-stone-500">Formato</span>
            <div class="flex items-center gap-1">
              @for (r of ratios; track r) {
                <button type="button" (click)="aspectRatio.set(r)"
                  class="px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer border"
                  [ngClass]="aspectRatio() === r
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'">
                  {{ r }}
                </button>
              }
            </div>
          </div>

          <!-- Frases rápidas + Mezclar -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            @for (preset of headlinePresets; track preset) {
              <button type="button" (click)="headline.set(preset)"
                class="px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer border"
                [ngClass]="headline() === preset
                  ? 'bg-awakin-sun/15 text-awakin-sun border-awakin-sun/40'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'">
                {{ preset }}
              </button>
            }
            @if (allPhotoUrls().length > maxPhotosForRatio()) {
              <button type="button" (click)="shufflePhotos()"
                class="px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 bg-stone-900 text-white hover:bg-stone-800 cursor-pointer flex items-center gap-1">
                <i class="pi pi-refresh text-[9px]"></i>
                <span>Mezclar</span>
              </button>
            }
          </div>

          <!-- Texto personalizado + Opacidad -->
          <div class="flex items-center gap-2">
            <input type="text" [ngModel]="headline()" (ngModelChange)="headline.set($event)" maxlength="42"
              placeholder="Ej: Así come mi equipo"
              class="flex-1 min-w-0 bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-awakin-sun" />
            <div class="flex items-center gap-1.5 shrink-0">
              <i class="pi pi-sun text-[10px] text-stone-400"></i>
              <input type="range" min="0" max="65" step="5" [ngModel]="dimLevel()" (ngModelChange)="dimLevel.set($event)"
                class="w-16 h-1.5 bg-stone-200 rounded-lg accent-awakin-sun cursor-pointer" title="Contraste" />
            </div>
          </div>
        </div>

        <!-- Footer Acciones (Mobile: solo Compartir; Desktop: Guardar PNG + Compartir) -->
        <div class="p-3 border-t border-stone-100 bg-white flex items-center gap-2 shrink-0 sticky bottom-0 z-20">
          <button type="button" (click)="exportCollage('download')" [disabled]="isExporting()"
            class="hidden sm:flex px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
            @if (isExporting() && exportAction() === 'download') {
              <i class="pi pi-spin pi-spinner text-xs text-awakin-sun"></i>
              <span>Generando...</span>
            } @else {
              <i class="pi pi-download text-xs"></i>
              <span>Guardar PNG</span>
            }
          </button>

          <button type="button" (click)="exportCollage('share')" [disabled]="isExporting()"
            class="flex-1 py-3 rounded-xl bg-awakin-sun hover:bg-awakin-sun-dim text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-awakin-sun/25 active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50">
            @if (isExporting() && exportAction() === 'share') {
              <i class="pi pi-spin pi-spinner text-xs"></i>
              <span>Preparando...</span>
            } @else {
              <i class="pi pi-share-alt text-xs"></i>
              <span>Compartir Collage</span>
            }
          </button>
        </div>
      </div>
    </p-dialog>
  `,
})
export class KinMealsCollageModalComponent implements OnChanges {
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

  readonly todayFormatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date())
    .toUpperCase();

  aspectRatio = signal<KinCollageRatio>('9:16');
  headline = signal<string>('Así come mi equipo');
  dimLevel = signal<number>(20);
  isExporting = signal<boolean>(false);
  exportAction = signal<'download' | 'share' | null>(null);

  allPhotoUrls = signal<string[]>([]);
  safeKinLogo = signal<string | null>(null);
  private photoOffset = signal<number>(0);

  maxPhotosForRatio = computed(() => {
    const r = this.aspectRatio();
    if (r === '9:16') return 6;
    if (r === '16:9') return 6;
    if (r === '4:5') return 6;
    return 4;
  });

  displayPhotos = computed<string[]>(() => {
    const list = this.allPhotoUrls();
    if (list.length === 0) return [];
    const max = Math.min(this.maxPhotosForRatio(), list.length);
    const start = this.photoOffset() % list.length;
    const out: string[] = [];
    for (let i = 0; i < max; i++) {
      out.push(list[(start + i) % list.length]);
    }
    return out;
  });

  gridLayoutClass = computed(() => {
    const count = this.displayPhotos().length;
    const r = this.aspectRatio();
    if (count <= 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return r === '16:9' ? 'grid-cols-2 grid-rows-1' : 'grid-cols-1 grid-rows-2';
    if (count === 3) return r === '16:9' ? 'grid-cols-3 grid-rows-1' : 'grid-cols-1 grid-rows-3';
    if (count === 4) return 'grid-cols-2 grid-rows-2';
    if (r === '16:9') return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-2 grid-rows-3';
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
    if (changes['visible'] && this.visible) {
      this.preparePhotos();
    } else if (changes['mealPhotos'] && this.visible) {
      this.preparePhotos();
    }
  }

  private preparePhotos(): void {
    const uniqueUrls = Array.from(
      new Set(
        (this.mealPhotos || [])
          .map((m) => (m.foto_url || '').trim())
          .filter((u) => u.length > 0)
      )
    ).slice(0, 18);

    this.allPhotoUrls.set(uniqueUrls);
    this.safeKinLogo.set(this.kin?.team_logo_url || null);

    // Convertir a dataUrl en segundo plano para exportación CORS limpia
    Promise.all(uniqueUrls.slice(0, 9).map((u) => this.toDataUrl(u))).then((converted) => {
      this.allPhotoUrls.update((curr) => {
        const next = [...curr];
        converted.forEach((c, idx) => {
          if (idx < next.length) next[idx] = c;
        });
        return next;
      });
    });

    if (this.kin?.team_logo_url) {
      this.toDataUrl(this.kin.team_logo_url).then((safe) => this.safeKinLogo.set(safe));
    }
  }

  shufflePhotos(): void {
    const len = this.allPhotoUrls().length;
    if (len > 1) {
      this.photoOffset.update((v) => (v + 2) % len);
    }
  }

  closeModal(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async exportCollage(action: 'download' | 'share'): Promise<void> {
    if (!this.collageCaptureArea?.nativeElement || this.isExporting()) return;
    this.isExporting.set(true);
    this.exportAction.set(action);

    try {
      const node = this.collageCaptureArea.nativeElement;
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#0C0A09',
      });
      const blob = await (await fetch(dataUrl)).blob();
      const ratioSlug = this.aspectRatio().replace(':', 'x');
      const teamSlug = (this.kin?.team_name || 'kin').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `collage-${teamSlug}-${ratioSlug}.png`;

      if (action === 'share' && navigator.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${this.headline()} - ${this.kin?.team_name || 'Awakin Kin'}`,
            text: `🥗 ${this.headline()} · ${this.kin?.team_name || 'Mi Kin'} en Awakin`,
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
