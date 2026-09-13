import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { moduleEnabledGuard } from './core/guards/module-enabled.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Módulo de Acceso Público
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
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

  // Comodín para redirigir rutas inexistentes
  { path: '**', redirectTo: 'home' }
];