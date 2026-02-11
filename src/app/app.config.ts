import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config'; // IMPORTANTE
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import Aura from '@primeuix/themes/aura';


export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), provideAnimationsAsync(),provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
    // 2. Configurar el Tema Aura (Moderno)
    providePrimeNG({
        theme: {
            preset: Aura,
             options: {
                darkModeSelector: '.dark', // Para controlar modo oscuro manual
            }
        }
    })
    
  ]
};
