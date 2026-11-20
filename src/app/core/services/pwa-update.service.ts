import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { AuthService } from './auth.service';

interface NgswAssetGroup {
  name?: string;
  urls?: string[];
}

interface NgswManifest {
  timestamp?: number;
  assetGroups?: NgswAssetGroup[];
}

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate, { optional: true });
  private authService = inject(AuthService);

  /** Controla el diálogo global bloqueante cuando existe una nueva versión */
  public readonly updateAvailable = signal<boolean>(false);
  /** Indica si el Service Worker está descargando los nuevos archivos */
  public readonly isDownloading = signal<boolean>(false);
  /** Indica que el usuario pulsó Actualizar y se está limpiando caché + recargando */
  public readonly isApplyingUpdate = signal<boolean>(false);

  private initialTimestamp: number | null = null;
  private isChecking = false;
  private lastCheckAt = 0;

  constructor() {
    if (typeof window === 'undefined') return;

    this.listenToServiceWorkerEvents();
    this.setupUpdateListeners();
    void this.checkForUpdates();
  }

  /**
   * Fuerza una verificación inmediata contra el Service Worker y el manifiesto fresco del servidor
   */
  public async checkForUpdates(force = false): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.updateAvailable() || this.isChecking) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const now = Date.now();
    if (!force && now - this.lastCheckAt < 3000) return;

    this.isChecking = true;
    this.lastCheckAt = now;

    try {
      if (this.swUpdate?.isEnabled) {
        await this.swUpdate.checkForUpdate().catch(() => false);
      }
      await this.checkServerManifestVersion();
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Activa la actualización, limpia todas las cachés del PWA/navegador y recarga conservando la ruta
   */
  public async applyUpdateAndReload(): Promise<void> {
    if (this.isApplyingUpdate()) return;
    this.isApplyingUpdate.set(true);

    try {
      if (typeof window !== 'undefined') {
        this.authService.saveLastRoute(window.location.pathname);
      }

      if (this.swUpdate?.isEnabled) {
        await this.swUpdate.activateUpdate().catch(() => false);
      }

      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await caches.keys().catch(() => [] as string[]);
        await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
      }

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker
          .getRegistrations()
          .catch(() => [] as ServiceWorkerRegistration[]);
        await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
      }
    } finally {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }

  private listenToServiceWorkerEvents(): void {
    if (!this.swUpdate?.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
      switch (event.type) {
        case 'VERSION_DETECTED':
          this.isDownloading.set(true);
          this.triggerUpdatePrompt();
          break;
        case 'VERSION_READY':
          this.isDownloading.set(false);
          this.triggerUpdatePrompt();
          break;
        case 'VERSION_INSTALLATION_FAILED':
          this.isDownloading.set(false);
          this.triggerUpdatePrompt();
          break;
      }
    });

    this.swUpdate.unrecoverable.subscribe(() => {
      this.isDownloading.set(false);
      this.triggerUpdatePrompt();
    });
  }

  private setupUpdateListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.checkForUpdates();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        void this.checkForUpdates();
      });
      window.addEventListener('online', () => {
        void this.checkForUpdates(true);
      });

      // Comprobación periódica cada 45s mientras la app esté visible
      window.setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          void this.checkForUpdates();
        }
      }, 45_000);
    }
  }

  private async checkServerManifestVersion(): Promise<void> {
    if (typeof fetch === 'undefined') return;

    try {
      const response = await fetch(`/ngsw.json?ngsw-bypass=true&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          'ngsw-bypass': 'true',
        },
      });

      if (!response.ok) return;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json') && !contentType.includes('text/plain')) return;

      const data = (await response.json()) as NgswManifest;
      if (!data || typeof data !== 'object' || !Array.isArray(data.assetGroups)) return;

      // 1. Comparación por timestamp del build en ngsw.json
      const serverTimestamp = typeof data.timestamp === 'number' ? data.timestamp : null;
      if (serverTimestamp !== null) {
        if (this.initialTimestamp === null) {
          this.initialTimestamp = serverTimestamp;
        } else if (serverTimestamp !== this.initialTimestamp) {
          this.triggerUpdatePrompt();
          return;
        }
      }

      // 2. Comparación por hash del bundle principal (main-*.js)
      const serverMainFile = this.extractMainFilenameFromManifest(data);
      const loadedMainFile = this.extractLoadedMainFilename();
      if (serverMainFile && loadedMainFile && serverMainFile !== loadedMainFile) {
        this.triggerUpdatePrompt();
      }
    } catch {
      // Ignorar errores transitorios de red o en entorno ng serve donde no existe ngsw.json
    }
  }

  private extractMainFilenameFromManifest(manifest: NgswManifest): string | null {
    for (const group of manifest.assetGroups || []) {
      for (const url of group.urls || []) {
        const match = url.match(/\/?(main-[A-Za-z0-9_-]+\.js)$/i);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  }

  private extractLoadedMainFilename(): string | null {
    if (typeof document === 'undefined') return null;
    for (const script of Array.from(document.scripts)) {
      const src = script.getAttribute('src') || script.src || '';
      const match = src.match(/(?:^|\/)(main-[A-Za-z0-9_-]+\.js)(?:\?|$)/i);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  private triggerUpdatePrompt(): void {
    const alreadyOpen = this.updateAvailable();
    this.updateAvailable.set(true);

    if (typeof window !== 'undefined') {
      this.authService.saveLastRoute(window.location.pathname);
    }

    if (!alreadyOpen) {
      this.sendSystemUpdateNotification();
    }
  }

  private sendSystemUpdateNotification(): void {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted' ||
      document.visibilityState === 'visible'
    ) {
      return;
    }

    const title = 'Actualización de Awakin disponible';
    const options: NotificationOptions = {
      body: 'Hay una nueva versión lista. Abre la app para actualizar.',
      icon: 'icons/icon-192x192.png',
    };

    try {
      new Notification(title, options);
    } catch {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready
          .then((reg) => reg.showNotification(title, options))
          .catch(() => {});
      }
    }
  }
}
