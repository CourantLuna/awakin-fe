import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ModuleConfigService } from '../services/module-config.service';

export const moduleEnabledGuard: CanActivateFn = (route, state) => {
  const moduleConfig = inject(ModuleConfigService);
  const router = inject(Router);

  // Obtener el identificador del módulo desde route.data o deducirlo del path
  const moduleName = (route.data?.['module'] as string) || route.routeConfig?.path || '';

  if (!moduleName) {
    return true;
  }

  const isEnabled = moduleConfig.isModuleEnabled(moduleName);

  if (isEnabled) {
    return true;
  }

  // Si está deshabilitado / en mantenimiento, redirigir a la pantalla de mantenimiento
  console.warn(`🛑 Módulo [${moduleName}] en mantenimiento. Redirigiendo a pantalla de aviso.`);
  return router.createUrlTree(['/maintenance'], {
    queryParams: { module: moduleName },
  });
};
