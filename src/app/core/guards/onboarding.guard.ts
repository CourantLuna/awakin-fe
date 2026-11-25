import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasRawSession()) {
    router.navigate(['/login']);
    return false;
  }

  if (!authService.isActiveAccount()) {
    router.navigate(['/pending-access']);
    return false;
  }

  if (authService.hasCompletedOnboarding()) {
    router.navigate([authService.getLastRoute()]);
    return false;
  }

  return true;
};
