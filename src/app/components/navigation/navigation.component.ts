import { Component, inject, signal, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockModule } from 'primeng/dock';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

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

  // Estado reactivo (Iniciamos en 'home', pero se sobrescribirá al instante)
  activeTab = signal<TabId>('home');

  ngOnInit() {
    // 1. Sincronización Inmediata (Lectura en frío)
    // Cuando el componente carga, leemos la URL actual.
    // Si la URL es "/intake", this.router.url devolverá "/intake".
    this.syncTabWithUrl(this.router.url);

    // 2. Sincronización en Tiempo Real (Escucha de eventos)
    // Nos suscribimos a los eventos del Router para detectar cuando el usuario
    // navega usando el botón "Atrás/Adelante" del navegador.
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

    // Extraemos la primera parte de la ruta (ej. "/intake/detalles" -> "intake")
    const cleanUrl = url.split('?')[0]; // Removemos query params por seguridad
    const segments = cleanUrl.split('/');
    const currentModule = segments[1] as TabId; // El segmento 0 es vacío "", el 1 es "intake"

    // Validamos que el segmento sea una pestaña válida de nuestro Bottom Bar
    const validTabs: TabId[] = ['intake', 'workout', 'home', 'kin', 'avatar'];

    if (validTabs.includes(currentModule)) {
      this.activeTab.set(currentModule);
    }
  }

  /**
   * Cambia el módulo activo por click del usuario
   */
  selectModule(id: TabId) {
    // Al hacer click, el Router disparará un NavigationEnd,
    // el cual nuestro subscribe atrapará y actualizará el activeTab automáticamente.
    // Por lo tanto, no necesitamos hacer `this.activeTab.set(id)` aquí.

    console.log(`⚡ Enrutando al módulo: /${id}`);
    this.router.navigate(['/' + id]);
  }
}
