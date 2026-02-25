import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para que [ngClass] funcione
import { RouterOutlet } from '@angular/router';
import { PrimeNGModule } from './shared/prime-ng.module';
import { NavigationComponent } from './components/navigation/navigation.component';
import { IntakeUserComponent } from './features/intake/intake-user.component';

@Component({
  selector: 'app-root',
  standalone: true,
  // Agregamos CommonModule aquí para habilitar las directivas como [ngClass]
  imports: [CommonModule, RouterOutlet, PrimeNGModule, NavigationComponent, IntakeUserComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // 1. ESTADO: Usamos un Signal para rastrear qué pestaña está activa.
  // Valor inicial: 'core' (el botón central naranja)
  activeTab = signal<string>('core');

  // 2. ACCIÓN: Función que se ejecuta al hacer click en los botones
  selectModule(moduleName: string) {
    // Actualizamos el signal
    this.activeTab.set(moduleName);

    // Feedback en consola para saber que funciona
    console.log(`Navegando al módulo: ${moduleName}`);

    // NOTA: Aquí más adelante conectaremos el Router real:
    // this.router.navigate(['/' + moduleName]);
  }
}
