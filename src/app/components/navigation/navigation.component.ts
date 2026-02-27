import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockModule } from 'primeng/dock';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, DockModule],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css'],
  encapsulation: ViewEncapsulation.None, // Necesario para modificar estilos internos de PrimeNG
})
export class NavigationComponent {
  // Estado reactivo para la pestaña activa
  activeTab = signal<'intake' | 'workout' | 'home' | 'kin' | 'avatar'>('home');

  // Configuración de los ítems del Dock
  items: MenuItem[] = [
    { id: 'intake', label: 'INTAKE' },
    { id: 'workout', label: 'WORKOUT' },
    { id: 'home', label: 'HOME' }, // El botón central especial
    { id: 'kin', label: 'KIN' },
    { id: 'avatar', label: 'AVATAR' },
  ];

  // Inyectamos el motor de rutas de Angular
  private router = inject(Router);

  /**
   * Cambia el módulo activo
   */
  selectModule(id: string) {
    this.activeTab.set(id as any);
    console.log(`⚡ Enrutando al módulo: /${id}`);

    // Ejecutamos la navegación real en la PWA
    this.router.navigate(['/' + id]);
    // Aquí puedes agregar tu router.navigate(['/ruta'])
  }

  /**
   * Helper para obtener la ruta de la imagen dinámicamente
   */
  getIconPath(id: string): string {
    const isActive = this.activeTab() === id;
    // Lógica especial para el icono 'home' del Core
    if (id === 'core') {
      return isActive ? 'icons/home-active.png' : 'icons/home-gray.png';
    }
    return isActive ? `icons/${id}-active.png` : `icons/${id}-gray.png`;
  }
}
