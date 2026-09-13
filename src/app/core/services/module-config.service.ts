import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

export interface ModuleConfig {
  home: boolean;
  intake: boolean;
  workout: boolean;
  kin: boolean;
  avatar: boolean;
  [key: string]: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ModuleConfigService {
  private http = inject(HttpClient);

  // Inicialización inmediata con la configuración local de environment.ts
  private defaultModules: ModuleConfig = {
    home: environment.modules?.home ?? true,
    intake: environment.modules?.intake ?? true,
    workout: environment.modules?.workout ?? false,
    kin: environment.modules?.kin ?? false,
    avatar: environment.modules?.avatar ?? true,
  };

  // Signal reactivo para acceso síncrono en guards y componentes
  modules = signal<ModuleConfig>(this.defaultModules);
  isLoaded = signal<boolean>(false);

  constructor() {
    this.syncWithBackend();
  }

  /**
   * Intenta sincronizar el estado de los módulos con el backend (/api/v1/system/modules).
   * Si el backend está apagado o no responde, mantiene sin problemas la configuración de environment.ts.
   */
  syncWithBackend() {
    const url = `${environment.apiUrl}/system/modules`;
    this.http
      .get<ModuleConfig>(url)
      .pipe(
        tap((remoteConfig) => {
          if (remoteConfig) {
            console.log('⚡ Estado de módulos sincronizado con backend:', remoteConfig);
            this.modules.update((curr) => Object.assign({}, curr, remoteConfig));
            this.isLoaded.set(true);
          }
        }),
        catchError((err) => {
          console.warn('⚠️ No se pudo conectar al endpoint de módulos del backend, usando environment local:', err.message || err);
          this.isLoaded.set(true);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Consulta si un módulo específico está habilitado (true) o en mantenimiento (false).
   */
  isModuleEnabled(moduleName: string): boolean {
    const current = this.modules();
    return current[moduleName] ?? true;
  }

  /**
   * Retorna metadatos legibles para la pantalla de mantenimiento.
   */
  getModuleMeta(moduleName: string): { title: string; description: string; icon: string } {
    switch (moduleName) {
      case 'workout':
        return {
          title: 'Módulo Workout',
          description: 'El motor de biometría y sobrecarga progresiva se encuentra en fase de calibración activa.',
          icon: 'pi pi-bolt',
        };
      case 'kin':
        return {
          title: 'Módulo Kin',
          description: 'La red comunitaria de tribus y chat cifrado está recibiendo mejoras de infraestructura.',
          icon: 'pi pi-users',
        };
      case 'intake':
        return {
          title: 'Módulo Intake',
          description: 'El planificador nutricional está en mantenimiento programado.',
          icon: 'pi pi-apple',
        };
      case 'avatar':
        return {
          title: 'Módulo Avatar',
          description: 'El perfil y métricas biométricas están en mantenimiento.',
          icon: 'pi pi-user',
        };
      case 'home':
        return {
          title: 'Awakin Core',
          description: 'El tablero principal está en mantenimiento.',
          icon: 'pi pi-home',
        };
      default:
        return {
          title: `Módulo ${moduleName.toUpperCase()}`,
          description: 'Este módulo se encuentra actualmente en mantenimiento.',
          icon: 'pi pi-cog',
        };
    }
  }
}
