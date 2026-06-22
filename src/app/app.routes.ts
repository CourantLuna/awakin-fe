import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Módulo de Acceso Público
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },


  // Módulos Privados de Rendimiento (Protegidos por el Guard)
  {
    path: 'intake',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/intake/intake-user.component').then((m) => m.IntakeUserComponent),
  },
  {
    path: 'workout',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workout/workout-user.component').then((m) => m.WorkoutUserComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/home/home-awakin.component').then((m) => m.HomeAwakinComponent),
  },
  {
    path: 'kin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/kin/kin-community.component').then((m) => m.KinCommunityComponent),
  },
  {
    path: 'avatar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-avatar.component').then((m) => m.ProfileAvatarComponent),
  },
  
  // Comodín para redirigir rutas inexistentes
  { path: '**', redirectTo: 'home' }
];