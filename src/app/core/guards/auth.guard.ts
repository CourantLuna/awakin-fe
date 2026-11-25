import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Acceso permitido únicamente si tiene sesión Y athletes.is_active === true
  if (authService.isAuthenticated()) {
    return true;
  }

  // Si tiene sesión de Google/Supabase pero aún no ha sido activado (is_active === false), bloquear en /pending-access
  if (authService.hasRawSession() && !authService.isActiveAccount()) {
    router.navigate(['/pending-access']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};