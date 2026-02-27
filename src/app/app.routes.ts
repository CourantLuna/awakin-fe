import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Módulo 1: Nutrición (El que ya hicimos)
  {
    path: 'intake',
    loadComponent: () =>
      import('./features/intake/intake-user.component').then((m) => m.IntakeUserComponent),
  },

  // Módulo 2: Entrenamiento
  {
    path: 'workout',
    loadComponent: () =>
      import('./features/workout/workout-user.component').then((m) => m.WorkoutUserComponent),
  },

  // Módulo 3: Global Feed (AWAKIN Home)
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home-awakin.component').then((m) => m.HomeAwakinComponent),
  },

  // Módulo 4: Privado (KIN / Tribu)
  {
    path: 'kin',
    loadComponent: () =>
      import('./features/kin/kin-community.component').then((m) => m.KinCommunityComponent),
  },

  // Módulo 5: Perfil / Avatar
  {
    path: 'avatar',
    loadComponent: () =>
      import('./features/profile/profile-avatar.component').then((m) => m.ProfileAvatarComponent),
  },
];
