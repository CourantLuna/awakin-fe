import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router'; // <-- Importamos Router
import { PrimeNGModule } from './shared/prime-ng.module';
import { NavigationComponent } from './components/navigation/navigation.component';

// ¡OJO! Hemos borrado la importación de IntakeUserComponent porque ahora es Lazy Loaded

@Component({
  selector: 'app-root',
  standalone: true,
  // Ya no declaramos IntakeUserComponent en los imports
  imports: [CommonModule, RouterOutlet, PrimeNGModule, NavigationComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Inyectamos el motor de rutas de Angular
  private router = inject(Router);

  // ESTADO: Valor inicial coincide con la ruta por defecto
  activeTab = signal<string>('intake');

  // ACCIÓN: El Bottom Bar llama a esta función
  selectModule(moduleName: string) {
    this.activeTab.set(moduleName);
    console.log(`⚡ Enrutando al módulo: /${moduleName}`);

    // Ejecutamos la navegación real en la PWA
    this.router.navigate(['/' + moduleName]);
  }
}
