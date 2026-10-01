import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

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
  // Inicialización inmediata con la configuración local de environment.ts
  private defaultModules: ModuleConfig = {
    home: environment.modules?.home ?? true,
    intake: environment.modules?.intake ?? true,
    workout: environment.modules?.workout ?? false,
    kin: environment.modules?.kin ?? false,
    avatar: environment.modules?.avatar ?? true,
  };

  // Signal reactivo basado 100% en environment.ts / environment.development.ts
  modules = signal<ModuleConfig>(this.defaultModules);
  isLoaded = signal<boolean>(true);

  constructor() {
    // Los módulos se controlan exclusivamente desde environment.ts en el Frontend
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
