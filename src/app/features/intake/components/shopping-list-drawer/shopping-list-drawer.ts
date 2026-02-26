import { Component, input, model, signal, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuPlan, DayAssignment, ManualMenuSelection } from '../../models/intake.models';
import { FormsModule } from '@angular/forms'; // <-- NUEVO
import { PrimeNGModule } from '../../../../shared/prime-ng.module';

@Component({
  selector: 'app-shopping-list-drawer',
  imports: [CommonModule, PrimeNGModule, FormsModule],
  templateUrl: './shopping-list-drawer.html',
  styleUrl: './shopping-list-drawer.css',
})
export class ShoppingListDrawer {
  // Entradas y Salidas bidireccionales (Angular 19 Models)
  isOpen = model<boolean>(false);
  availableMenus = input<MenuPlan[]>([]);
  weekAssignments = input<DayAssignment[]>([]);

  // NUEVO: Estado reactivo para controlar el modo seleccionado
  selectedMode = signal<'semanal' | 'manual'>('semanal');

  // Estado local exclusivo de este componente
  manualSelections = signal<ManualMenuSelection[]>([]);

  constructor() {
    // Cuando cambian los menús disponibles, inicializamos la lista manual
    effect(() => {
      const initial = this.availableMenus().map((m) => ({
        menuId: m.id,
        selected: false,
        quantity: 1,
      }));
      this.manualSelections.set(initial);
    });
  }

  // NUEVO: Firma de tipos ajustada a PrimeNG 18+
  onAccordionChange(value: string | number | string[] | number[] | undefined | null) {
    if (value) {
      // 1. Extraemos el valor base (sea de un array o un valor simple)
      const rawValue = Array.isArray(value) ? value[0] : value;

      // 2. Lo casteamos a string de forma segura
      const mode = String(rawValue);

      // 3. Verificamos que pertenezca a nuestro protocolo estricto
      if (mode === 'semanal' || mode === 'manual') {
        this.selectedMode.set(mode as 'semanal' | 'manual');
      }
    } else {
      // Si el usuario intenta hacer clic en el panel abierto para cerrarlo,
      // lo mantenemos forzosamente abierto (UX de Radio Button).
      this.selectedMode.set(this.selectedMode());
    }
  }

  // NUEVO: Único botón de acción (Director de Operaciones)
  generateList() {
    if (this.selectedMode() === 'semanal') {
      this.generateFromWeekly();
    } else {
      this.generateFromManual();
    }
  }

  getManualSelection(menuId: string): ManualMenuSelection | undefined {
    return this.manualSelections().find((s) => s.menuId === menuId);
  }

  toggleManualSelection(menuId: string) {
    this.manualSelections.update((sels) =>
      sels.map((s) => (s.menuId === menuId ? { ...s, selected: !s.selected } : s)),
    );
  }

  updateManualQuantity(menuId: string, delta: number, event: Event) {
    event.stopPropagation();
    this.manualSelections.update((sels) =>
      sels.map((s) => {
        if (s.menuId === menuId) {
          const newQuantity = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQuantity, selected: true };
        }
        return s;
      }),
    );
  }

  generateFromWeekly() {
    console.log('Generando desde Semana:', this.weekAssignments());
    this.isOpen.set(false);
  }

  generateFromManual() {
    const selected = this.manualSelections().filter((s) => s.selected);
    console.log('Generando Manual:', selected);
    this.isOpen.set(false);
  }
}
