import { Component, input, model, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuPlan, WeeklyTemplate } from '../../models/intake.models';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-protocol-matrix-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeNGModule, SelectModule],
  templateUrl: './protocol-matrix-drawer.html',
  styleUrl: './protocol-matrix-drawer.css',
})
export class ProtocolMatrixDrawer {
  isOpen = model<boolean>(false);

  // NUEVO: Controla cuál es el plan que rige la semana actual
  activeTemplateId = model<string | null>('coach-t1'); // Inicializado con el primer plan

  maxTemplates = input<number>(5);

  weeklyTemplates = model<WeeklyTemplate[]>([
    {
      id: 'coach-t1',
      name: 'Semana 1 y 2 (Adaptación)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lun', menuId: '1' },
        { dayName: 'Mar', menuId: '1' },
        { dayName: 'Mié', menuId: '3' },
        { dayName: 'Jue', menuId: '2' },
        { dayName: 'Vie', menuId: '1' },
        { dayName: 'Sáb', menuId: '2' },
        { dayName: 'Dom', menuId: '2' },
      ],
    },
    {
      id: 'coach-t2',
      name: 'Semana 3 y 4 (Sobrecarga)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lun', menuId: '1' },
        { dayName: 'Mar', menuId: '3' },
        { dayName: 'Mié', menuId: '1' },
        { dayName: 'Jue', menuId: '3' },
        { dayName: 'Vie', menuId: '1' },
        { dayName: 'Sáb', menuId: '2' },
        { dayName: 'Dom', menuId: '3' },
      ],
    },
  ]);

  availableMenus = input<MenuPlan[]>([]);
  onOpenShoppingList = output<void>();

  openDropdownKey = signal<string | null>(null);
  canAddMore = computed(() => this.weeklyTemplates().length < this.maxTemplates());

  // NUEVO: Método para cambiar el plan maestro
  setActiveTemplate(templateId: string, event: Event) {
    event.stopPropagation();
    this.activeTemplateId.set(templateId);
  }

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
    if (!this.canAddMore()) return;

    this.weeklyTemplates.update((templates) => {
      const newId = `t-${Date.now()}`;
      const newTemplate: WeeklyTemplate = {
        id: newId,
        name: `Mi Plan ${templates.length + 1}`,
        isFromCoach: false,
        assignments: [
          { dayName: 'Lun', menuId: null },
          { dayName: 'Mar', menuId: null },
          { dayName: 'Mié', menuId: null },
          { dayName: 'Jue', menuId: null },
          { dayName: 'Vie', menuId: null },
          { dayName: 'Sáb', menuId: null },
          { dayName: 'Dom', menuId: null },
        ],
      };
      return [...templates, newTemplate];
    });
  }

  duplicateTemplate(plan: WeeklyTemplate, event: Event) {
    event.stopPropagation();
    if (!this.canAddMore()) return;

    this.weeklyTemplates.update((templates) => {
      const newId = `t-${Date.now()}`;
      const newTemplate: WeeklyTemplate = {
        ...plan,
        id: newId,
        name: `${plan.name} (Copia)`,
        isFromCoach: false,
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
