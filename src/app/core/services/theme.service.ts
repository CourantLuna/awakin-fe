import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AthleteService, KinInfo } from './athlete.service';

const THEME_STORAGE_KEY = 'awakin_theme_mode';
const SELECTED_KIN_STORAGE_KEY = 'awakin_selected_kin_id';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private athleteService = inject(AthleteService);

  public readonly DEFAULT_AWAKIN_PRIMARY = '#FE970A';
  public readonly DEFAULT_AWAKIN_SECONDARY = '#E58500';

  /** Estado reactivo del modo noche (`true`) / modo día (`false`) */
  public readonly isDarkMode = signal<boolean>(this.readInitialThemeMode());

  /** ID del Kin seleccionado manualmente (para coaches/instructores con múltiples Kins) */
  private readonly selectedKinId = signal<string | null>(this.readInitialSelectedKinId());

  /** Todos los Kins disponibles para el usuario (propio + donde es instructor/coach) */
  public readonly availableKins = computed<KinInfo[]>(() => {
    const ath = this.athleteService.currentAthlete();
    if (!ath) return [];

    const byId = new Map<string, KinInfo>();
    const addKin = (k?: KinInfo | null) => {
      if (!k || (!k.id && !k.team_name)) return;
      const key = k.id || k.team_name || '';
      if (key && !byId.has(key)) {
        byId.set(key, k);
      }
    };

    addKin(ath.kin);
    for (const k of ath.kins || []) addKin(k);
    for (const k of ath.instructor_kins || []) addKin(k);

    return Array.from(byId.values());
  });

  /** Kin activo del atleta o instructor (respeta selección manual si pertenece a sus Kins) */
  public readonly activeKin = computed<KinInfo | null>(() => {
    const list = this.availableKins();
    if (list.length === 0) return null;

    const selected = this.selectedKinId();
    if (selected) {
      const match = list.find((k) => k.id === selected);
      if (match) return match;
    }

    const ath = this.athleteService.currentAthlete();
    if (ath?.kin && (ath.kin.id || ath.kin.primary_color || ath.kin.secondary_color)) {
      return ath.kin;
    }
    return list[0];
  });

  /** Color primario del Kin o fallback al tema Awakin */
  public readonly kinPrimaryColor = computed<string>(() => {
    return this.sanitizeColor(this.activeKin()?.primary_color) || this.DEFAULT_AWAKIN_PRIMARY;
  });

  /** Color secundario del Kin o fallback al primario del Kin / tema Awakin */
  public readonly kinSecondaryColor = computed<string>(() => {
    return (
      this.sanitizeColor(this.activeKin()?.secondary_color) ||
      this.sanitizeColor(this.activeKin()?.primary_color) ||
      this.DEFAULT_AWAKIN_SECONDARY
    );
  });

  constructor() {
    // Sincroniza clase dark/my-app-dark, localStorage y meta theme-color
    effect(() => {
      const dark = this.isDarkMode();
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.classList.toggle('dark', dark);
        root.classList.toggle('my-app-dark', dark);

        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
          themeMeta.setAttribute('content', dark ? '#0C0A09' : '#FAFAF9');
        }
      }

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
        } catch {
          // Ignorar errores de almacenamiento (modo privado / cuota)
        }
      }
    });

    // Sincroniza variables CSS globales del Kin en :root
    effect(() => {
      const primary = this.kinPrimaryColor();
      const secondary = this.kinSecondaryColor();
      if (typeof document !== 'undefined') {
        const style = document.documentElement.style;
        style.setProperty('--kin-primary', primary);
        style.setProperty('--kin-secondary', secondary);
      }
    });
  }

  /** Cambia el Kin activo (para instructores con múltiples Kins) */
  public selectActiveKin(kinId: string): void {
    if (!kinId) return;
    this.selectedKinId.set(kinId);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SELECTED_KIN_STORAGE_KEY, kinId);
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
  }

  /** Alterna entre Modo Día y Modo Noche */
  public toggleTheme(): void {
    this.isDarkMode.update((dark) => !dark);
  }

  /** Establece explícitamente el Modo Día o Modo Noche */
  public setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
  }

  /** Convierte un color hexadecimal o rgb a rgba con la opacidad deseada (útil para Canvas/Chart.js) */
  public withAlpha(color: string, alpha: number): string {
    const clean = (color || '').trim();
    const clampedAlpha = Math.max(0, Math.min(1, alpha));

    if (clean.startsWith('#')) {
      let hex = clean.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((c) => c + c)
          .join('');
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
        }
      }
    }

    const rgbMatch = clean.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${clampedAlpha})`;
    }

    return clean || `rgba(254, 151, 10, ${clampedAlpha})`;
  }

  private readInitialThemeMode(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  }

  private readInitialSelectedKinId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(SELECTED_KIN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private sanitizeColor(color?: string | null): string | null {
    if (!color) return null;
    const trimmed = color.trim();
    if (!trimmed || /[;{}]/.test(trimmed)) return null;

    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      return CSS.supports('color', trimmed) ? trimmed : null;
    }

    const hexRegex = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
    return hexRegex.test(trimmed) ? trimmed : null;
  }
}
