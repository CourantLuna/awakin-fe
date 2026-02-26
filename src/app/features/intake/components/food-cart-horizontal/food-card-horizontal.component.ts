import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FoodItem } from '../../models/intake.models';

@Component({
  selector: 'app-food-card-horizontal', // <-- NUEVO SELECTOR
  standalone: true,
  imports: [CommonModule],
  templateUrl: './food-card-horizontal.component.html', // <-- NUEVA RUTA
})
export class FoodCardHorizontalComponent {
  // <-- NUEVO NOMBRE DE CLASE
  // Entradas de datos
  food = input.required<FoodItem>();
  categories = input<string[]>([]);
  isOpen = input<boolean>(false);

  // Emisión de eventos hacia el padre
  onToggleLog = output<void>();
  onToggleMenu = output<Event>();
  onChangeCategory = output<{ category: string; event: Event }>();
}
