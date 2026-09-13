import { Component, inject, signal, ViewEncapsulation, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockModule } from 'primeng/dock';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { ModuleConfigService } from '../../core/services/module-config.service';

// Definimos el tipo de nuestras pestañas permitidas
type TabId = 'intake' | 'workout' | 'home' | 'kin' | 'avatar';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, DockModule],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class NavigationComponent implements OnInit {
  // Inyectamos el motor de rutas de Angular
  private router = inject(Router);
  public moduleConfig = inject(ModuleConfigService);

  // Estado reactivo de pestaña activa
  activeTab = signal<TabId>('home');

  // Control de visibilidad para ocultar/mostrar al hacer scroll
  isBarVisible = signal<boolean>(true);
  private lastScrollY = 0;
  private readonly scrollThreshold = 10;

  isModuleEnabled(id: TabId): boolean {
    return this.moduleConfig.isModuleEnabled(id);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const deltaY = currentScrollY - this.lastScrollY;

    // Si estamos cerca del tope superior de la página, siempre visible
    if (currentScrollY <= 40) {
      this.isBarVisible.set(true);
      this.lastScrollY = currentScrollY;
      return;
    }

    // Comprobar dirección con umbral para evitar parpadeos
    if (Math.abs(deltaY) > this.scrollThreshold) {
      if (deltaY > 0) {
        // Scroll hacia abajo: ocultar cilindro flotante
        this.isBarVisible.set(false);
      } else {
        // Scroll hacia arriba: mostrar cilindro flotante
        this.isBarVisible.set(true);
      }
      this.lastScrollY = currentScrollY;
    }
  }

  ngOnInit() {
    // 1. Sincronización Inmediata (Lectura en frío)
    this.syncTabWithUrl(this.router.url);

    // 2. Sincronización en Tiempo Real (Escucha de eventos)
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.syncTabWithUrl(event.urlAfterRedirects);
      });
  }

  /**
   * Extrae el módulo de la URL y actualiza el signal visual
   */
  private syncTabWithUrl(url: string) {
    // Si la URL es "/", sabemos que el Router redirige a "/home" (según tus rutas)
    if (url === '/') {
      this.activeTab.set('home');
      return;
    }

    // Validamos que el segmento sea una pestaña válida de nuestro Bottom Bar
    const validTabs: TabId[] = ['intake', 'workout', 'home', 'kin', 'avatar'];

    // Si estamos en la pantalla de mantenimiento, mantener seleccionada la pestaña correspondiente
    if (url.includes('/maintenance')) {
      const queryPart = url.split('?')[1] || '';
      const params = new URLSearchParams(queryPart);
      const mod = params.get('module') as TabId;
      if (mod && validTabs.includes(mod)) {
        this.activeTab.set(mod);
        return;
      }
    }

    // Extraemos la primera parte de la ruta (ej. "/intake/detalles" -> "intake")
    const cleanUrl = url.split('?')[0]; // Removemos query params por seguridad
    const segments = cleanUrl.split('/');
    const currentModule = segments[1] as TabId; // El segmento 0 es vacío "", el 1 es "intake"

    if (validTabs.includes(currentModule)) {
      this.activeTab.set(currentModule);
    }
  }

  /**
   * Cambia el módulo activo por click del usuario
   */
  selectModule(id: TabId) {
    this.isBarVisible.set(true);
    console.log(`⚡ Enrutando al módulo: /${id}`);
    this.router.navigate(['/' + id]);
  }
}
