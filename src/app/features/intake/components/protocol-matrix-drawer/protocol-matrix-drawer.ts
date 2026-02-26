import { Component, input, model, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuPlan, WeeklyTemplate } from '../../models/intake.models';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { SelectModule } from 'primeng/select'; // <-- EL COMPONENTE MODERNO

@Component({
  selector: 'app-protocol-matrix-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeNGModule, SelectModule], // <-- Añadido aquí
  templateUrl: './protocol-matrix-drawer.html',
  styleUrl: './protocol-matrix-drawer.css',
})
export class ProtocolMatrixDrawer {
  // Comunicación con el padre
  isOpen = model<boolean>(false);

  // MOCK DE PLANTILLAS DEL COACH
  weeklyTemplates = model<WeeklyTemplate[]>([
    {
      id: 'coach-t1',
      name: 'Semana 1 y 2 (Adaptación)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lunes', menuId: '1' },
        { dayName: 'Martes', menuId: '1' },
        { dayName: 'Miércoles', menuId: '3' },
        { dayName: 'Jueves', menuId: '2' },
        { dayName: 'Viernes', menuId: '1' },
        { dayName: 'Sábado', menuId: '2' },
        { dayName: 'Domingo', menuId: '2' },
      ],
    },
    {
      id: 'coach-t2',
      name: 'Semana 3 y 4 (Sobrecarga)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lunes', menuId: '1' },
        { dayName: 'Martes', menuId: '3' },
        { dayName: 'Miércoles', menuId: '1' },
        { dayName: 'Jueves', menuId: '3' },
        { dayName: 'Viernes', menuId: '1' },
        { dayName: 'Sábado', menuId: '2' },
        { dayName: 'Domingo', menuId: '3' },
      ],
    },
  ]);

  availableMenus = input<MenuPlan[]>([]);
  onOpenShoppingList = output<void>();

  // ESTADO DE LA UI
  openDropdownKey = signal<string | null>(null);

  toggleDayMenu(templateId: string, dayIndex: number, event: Event) {
    event.stopPropagation();
    const key = `${templateId}-${dayIndex}`;
    this.openDropdownKey.update((current) => (current === key ? null : key));
  }

  assignMenuToDay(templateId: string, dayIndex: number, menuId: string | null, event?: Event) {
    if (event) event.stopPropagation();
    this.weeklyTemplates.update((templates) => {
      return templates.map((template) => {
        if (template.id === templateId) {
          const newAssignments = [...template.assignments];
          newAssignments[dayIndex] = { ...newAssignments[dayIndex], menuId };
          return { ...template, assignments: newAssignments };
        }
        return template;
      });
    });
    this.openDropdownKey.set(null);
  }

  addNewTemplate() {
    this.weeklyTemplates.update((templates) => {
      const newId = `t-${Date.now()}`;
      const newTemplate: WeeklyTemplate = {
        id: newId,
        name: `Mi Plantilla ${templates.length + 1}`,
        isFromCoach: false,
        assignments: [
          { dayName: 'Lunes', menuId: null },
          { dayName: 'Martes', menuId: null },
          { dayName: 'Miércoles', menuId: null },
          { dayName: 'Jueves', menuId: null },
          { dayName: 'Viernes', menuId: null },
          { dayName: 'Sábado', menuId: null },
          { dayName: 'Domingo', menuId: null },
        ],
      };
      return [...templates, newTemplate];
    });
  }

  updateTemplateName(templateId: string, newName: string) {
    this.weeklyTemplates.update((templates) =>
      templates.map((t) => (t.id === templateId ? { ...t, name: newName } : t)),
    );
  }

  deleteTemplate(templateId: string, event: Event) {
    event.stopPropagation();
    this.weeklyTemplates.update((templates) => templates.filter((t) => t.id !== templateId));
  }

  getAssignedMenu(menuId: string | null): MenuPlan | null {
    if (!menuId) return null;
    return this.availableMenus().find((m) => m.id === menuId) || null;
  }
}
