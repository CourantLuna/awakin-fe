import { Component, input, model, signal, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MenuPlan,
  DayAssignment,
  ManualMenuSelection,
  WeeklyTemplate,
} from '../../models/intake.models';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';

// NUEVA INTERFAZ PARA LAS FILAS SEMANALES
export interface WeeklyPlanSelection {
  rowId: string;
  templateId: string | null;
  quantity: number;
}

@Component({
  selector: 'app-shopping-list-drawer',
  imports: [CommonModule, PrimeNGModule, FormsModule], // <-- Añadir SelectModule
  templateUrl: './shopping-list-drawer.html',
  styleUrl: './shopping-list-drawer.css',
})
export class ShoppingListDrawer {
  isOpen = model<boolean>(false);
  availableMenus = input<MenuPlan[]>([]);
  weekAssignments = input<WeeklyTemplate[]>([]);

  selectedMode = signal<'semanal' | 'manual'>('semanal');
  manualSelections = signal<ManualMenuSelection[]>([]);

  // ==========================================
  // NUEVO: ESTADO PARA SELECCIÓN SEMANAL (PLANES)
  // ==========================================
  weeklyPlanSelections = signal<WeeklyPlanSelection[]>([
    { rowId: 'row-init', templateId: null, quantity: 1 }, // Fila inicial vacía
  ]);

  constructor() {
    effect(() => {
      const initial = this.availableMenus().map((m) => ({
        menuId: m.id,
        selected: false,
        quantity: 1,
      }));
      this.manualSelections.set(initial);
    });
  }

  // ... (Tus métodos onAccordionChange, generateList, etc. se mantienen igual)
  onAccordionChange(value: string | number | string[] | number[] | undefined | null) {
    if (value) {
      const rawValue = Array.isArray(value) ? value[0] : value;
      const mode = String(rawValue);
      if (mode === 'semanal' || mode === 'manual') {
        this.selectedMode.set(mode as 'semanal' | 'manual');
      }
    } else {
      this.selectedMode.set(this.selectedMode());
    }
  }

  generateList() {
    if (this.selectedMode() === 'semanal') {
      this.generateFromWeekly();
    } else {
      this.generateFromManual();
    }
  }

  // ... (Métodos de manualSelections se mantienen igual)
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

  // ==========================================
  // NUEVOS MÉTODOS PARA EL CONSTRUCTOR SEMANAL
  // ==========================================

  addWeeklyPlanRow() {
    this.weeklyPlanSelections.update((rows) => [
      ...rows,
      { rowId: `row-${Date.now()}`, templateId: null, quantity: 1 },
    ]);
  }

  removeWeeklyPlanRow(rowId: string) {
    this.weeklyPlanSelections.update((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  updateWeeklyPlanTemplate(rowId: string, templateId: string) {
    this.weeklyPlanSelections.update((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, templateId } : r)),
    );
  }

  updateWeeklyPlanQuantity(rowId: string, delta: number) {
    this.weeklyPlanSelections.update((rows) =>
      rows.map((r) => {
        if (r.rowId === rowId) {
          return { ...r, quantity: Math.max(1, r.quantity + delta) };
        }
        return r;
      }),
    );
  }

  // ==========================================

  generateFromWeekly() {
    // Solo enviamos los que el usuario realmente seleccionó un template
    const validSelections = this.weeklyPlanSelections().filter((s) => s.templateId !== null);
    console.log('Generando Lista desde Plantillas:', validSelections);
    this.isOpen.set(false);
  }

  generateFromManual() {
    const selected = this.manualSelections().filter((s) => s.selected);
    console.log('Generando Manual:', selected);
    this.isOpen.set(false);
  }
}
