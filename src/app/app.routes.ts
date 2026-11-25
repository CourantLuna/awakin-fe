import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { moduleEnabledGuard } from './core/guards/module-enabled.guard';
import { LAST_ROUTE_STORAGE_KEY, VALID_APP_MODULES } from './core/services/auth.service';

export function resolveInitialRedirect(): string {
  if (typeof localStorage === 'undefined') return 'home';
  try {
    const saved = localStorage.getItem(LAST_ROUTE_STORAGE_KEY) || '';
    const clean = saved.split('?')[0].split('#')[0];
    const segment = clean.split('/').filter(Boolean)[0] || '';
    if ((VALID_APP_MODULES as readonly string[]).includes(segment)) {
      return segment;
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return 'home';
}

export const routes: Routes = [
  { path: '', redirectTo: () => resolveInitialRedirect(), pathMatch: 'full' },

  // Módulo de Acceso Público (Protegido por guestGuard si ya está autenticado)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'pending-access',
    loadComponent: () =>
      import('./features/auth/pending-access/pending-access.component').then((m) => m.PendingAccessComponent),
  },
  {
    path: 'join/:token',
    loadComponent: () =>
      import('./features/auth/join-invite/join-invite.component').then((m) => m.JoinInviteComponent),
  },

  // Vista de Módulo en Mantenimiento
  {
    path: 'maintenance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/maintenance/maintenance.component').then((m) => m.MaintenanceComponent),
  },

  // Módulos Privados de Rendimiento (Protegidos por Auth y Control de Módulos)
  {
    path: 'intake',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'intake' },
    loadComponent: () =>
      import('./features/intake/intake-user.component').then((m) => m.IntakeUserComponent),
  },
  {
    path: 'workout',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'workout' },
    loadComponent: () =>
      import('./features/workout/workout-user.component').then((m) => m.WorkoutUserComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'home' },
    loadComponent: () =>
      import('./features/home/home-awakin.component').then((m) => m.HomeAwakinComponent),
  },
  {
    path: 'kin',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'kin' },
    loadComponent: () =>
      import('./features/kin/kin-community.component').then((m) => m.KinCommunityComponent),
  },
  {
    path: 'avatar',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'avatar' },
    loadComponent: () =>
      import('./features/profile/profile-avatar.component').then((m) => m.ProfileAvatarComponent),
  },
  {
    path: 'avatar/:identifier',
    canActivate: [authGuard, moduleEnabledGuard],
    data: { module: 'avatar' },
    loadComponent: () =>
      import('./features/profile/profile-avatar.component').then((m) => m.ProfileAvatarComponent),
  },

  // Comodín para redirigir rutas inexistentes
  { path: '**', redirectTo: () => resolveInitialRedirect() }
];