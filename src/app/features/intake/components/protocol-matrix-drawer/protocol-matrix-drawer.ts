import { Component, input, model, signal, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuPlan, WeeklyTemplate, DishItem, DishIngredient, LooseIngredientItem } from '../../models/intake.models';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { SelectModule } from 'primeng/select';
import { PopoverModule } from 'primeng/popover';
import { IntakeService } from '../../../../core/services/intake.service';
import { formatQuantity, toFraction } from '../../../../core/helpers/nutrition-optimizer';

@Component({
  selector: 'app-protocol-matrix-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeNGModule, SelectModule, PopoverModule],
  templateUrl: './protocol-matrix-drawer.html',
  styleUrl: './protocol-matrix-drawer.css',
})
export class ProtocolMatrixDrawer {
  private intakeService = inject(IntakeService);

  isOpen = model<boolean>(false);
  athleteId = input<string | null>(null);

  // Controla cuál es el plan que rige la semana actual
  activeTemplateId = model<string | null>(null);

  maxTemplates = input<number>(5);

  weeklyTemplates = model<WeeklyTemplate[]>([]);

  availableMenus = input<MenuPlan[]>([]);
  onOpenShoppingList = output<void>();
  onSavePlan = output<WeeklyTemplate[]>();

  isSaving = signal<boolean>(false);
  openDropdownKey = signal<string | null>(null);
  canAddMore = computed(() => this.weeklyTemplates().length < this.maxTemplates());

  // Catálogo filtrado: solo menús asignados en la semana/planes Y aquellos creados por el atleta logueado
  catalogMenus = computed(() => {
    const athleteId = this.athleteId();
    const allMenus = this.availableMenus();
    const templates = this.weeklyTemplates();

    const assignedMenuIds = new Set<string>();
    for (const t of templates) {
      for (const a of t.assignments) {
        if (a.menuId) assignedMenuIds.add(a.menuId);
      }
    }

    return allMenus.filter((m) => {
      const isAssigned = assignedMenuIds.has(m.id);
      const isCreatedByAthlete = Boolean(
        athleteId && (m.createdBy === athleteId || m.athleteId === athleteId)
      );
      return isAssigned || isCreatedByAthlete;
    });
  });

  isMenuFromCoach(menu: MenuPlan): boolean {
    const athleteId = this.athleteId();
    if (!athleteId) return true;
    return !(menu.createdBy === athleteId || menu.athleteId === athleteId);
  }

  isMenuSelectedForActiveDay(menuId: string, planId: string | null): boolean {
    if (!planId) return false;
    const plan = this.weeklyTemplates().find((p) => p.id === planId);
    if (!plan) return false;
    const dayIdx = this.getDayIndex(planId);
    return plan.assignments[dayIdx]?.menuId === menuId;
  }

  duplicateMenu(menu: MenuPlan, event?: Event) {
    if (event) event.stopPropagation();
    this.intakeService.duplicateMenu(menu).subscribe();
  }

  assignMenuToCurrentDay(menuId: string, event?: Event) {
    if (event) event.stopPropagation();
    const activeId = this.activeTemplateId();
    if (!activeId) return;
    const plan = this.weeklyTemplates().find((p) => p.id === activeId);
    if (!plan || plan.isFromCoach) return;
    const dayIdx = this.getDayIndex(activeId);
    this.assignMenuToDay(activeId, dayIdx, menuId);
  }

  getMenuDishImages(menu: MenuPlan): string[] {
    if (!menu.dishes || menu.dishes.length === 0) {
      return menu.coverImageUrl
        ? [menu.coverImageUrl]
        : ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80'];
    }
    const imgs = menu.dishes
      .map((d) => d.coverImageUrl)
      .filter((img): img is string => Boolean(img));
    return imgs.length > 0
      ? imgs
      : (menu.coverImageUrl
          ? [menu.coverImageUrl]
          : ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80']);
  }

  // Navegación de días en el carrusel (índice 0 a 6 por plan)
  activeDayIndex = signal<Record<string, number>>({});

  readonly dayNamesFull = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  // Orden y títulos de tipos de comida
  readonly mealOrder = [
    'BREAKFAST',
    'SNACK_AM',
    'LUNCH',
    'SNACK_PM',
    'DINNER',
    'SNACK_EXTRA',
    'DRINK',
  ];

  readonly mealTitles: Record<string, string> = {
    BREAKFAST: 'DESAYUNO',
    SNACK_AM: 'MERIENDA AM',
    LUNCH: 'ALMUERZO',
    SNACK_PM: 'MERIENDA PM',
    DINNER: 'CENA',
    SNACK_EXTRA: 'MERIENDA EXTRA',
    DRINK: 'BEBIDAS',
  };

  // Estado del acordeón de ingredientes de cada platillo
  expandedDishIngredients = signal<Record<string, boolean>>({});

  // Modal de Recipe Preview
  selectedDishForPreview = signal<DishItem | null>(null);
  isRecipePreviewOpen = signal<boolean>(false);

  getDayIndex(planId: string): number {
    return this.activeDayIndex()[planId] ?? 0;
  }

  setDayIndex(planId: string, idx: number, event?: Event) {
    if (event) event.stopPropagation();
    this.activeDayIndex.update((state) => ({ ...state, [planId]: idx }));
  }

  prevDay(planId: string, event?: Event) {
    if (event) event.stopPropagation();
    const current = this.getDayIndex(planId);
    const prev = current > 0 ? current - 1 : 6;
    this.setDayIndex(planId, prev);
  }

  // Control de gestos táctiles (Swipe) en mobile para el carrusel
  private touchStartX = 0;
  private touchStartY = 0;

  onTouchStart(event: TouchEvent) {
    if (!event.touches || event.touches.length === 0) return;
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(planId: string, event: TouchEvent) {
    if (!event.changedTouches || event.changedTouches.length === 0) return;
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;

    const deltaX = touchEndX - this.touchStartX;
    const deltaY = touchEndY - this.touchStartY;

    // Solo activamos si el gesto fue predominantemente horizontal y supera el umbral de 40px
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        // Deslizar hacia la izquierda (swipe left) -> siguiente día
        this.nextDay(planId);
      } else {
        // Deslizar hacia la derecha (swipe right) -> día anterior
        this.prevDay(planId);
      }
    }
  }

  nextDay(planId: string, event?: Event) {
    if (event) event.stopPropagation();
    const current = this.getDayIndex(planId);
    const next = current < 6 ? current + 1 : 0;
    this.setDayIndex(planId, next);
  }

  toggleDishIngredients(dishKey: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.expandedDishIngredients.update((state) => ({
      ...state,
      [dishKey]: !state[dishKey],
    }));
  }

  isDishIngredientsExpanded(dishKey: string): boolean {
    return Boolean(this.expandedDishIngredients()[dishKey]);
  }

  openRecipePreview(dish: DishItem, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedDishForPreview.set(dish);
    this.isRecipePreviewOpen.set(true);
  }

  closeRecipePreview() {
    this.isRecipePreviewOpen.set(false);
    this.selectedDishForPreview.set(null);
  }

  getDishesForMeal(menu: MenuPlan | null, mealType: string): DishItem[] {
    if (!menu || !menu.dishes) return [];
    return menu.dishes.filter((d) => d.mealType === mealType);
  }

  getLooseIngredientsForMeal(menu: MenuPlan | null, mealType: string): LooseIngredientItem[] {
    if (!menu || !menu.looseIngredients) return [];
    return menu.looseIngredients.filter((li) => li.mealType === mealType);
  }

  getMealItemCount(menu: MenuPlan | null, mealType: string): number {
    return (
      this.getDishesForMeal(menu, mealType).length +
      this.getLooseIngredientsForMeal(menu, mealType).length
    );
  }

  getActiveMealTypes(menu: MenuPlan | null): string[] {
    if (!menu) return [];
    const active = this.mealOrder.filter((mType) => this.getMealItemCount(menu, mType) > 0);
    // Si no tiene nada mapeado por tipo, pero tiene platillos o ingredientes sueltos:
    if (active.length === 0 && ((menu.dishes && menu.dishes.length > 0) || (menu.looseIngredients && menu.looseIngredients.length > 0))) {
      return ['BREAKFAST', 'LUNCH', 'DINNER'];
    }
    return active;
  }

  // Método para cambiar el plan maestro
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
    let updatedPlanToSave: WeeklyTemplate | null = null;
    this.weeklyTemplates.update((templates) => {
      return templates.map((template) => {
        if (template.id === templateId) {
          const newAssignments = [...template.assignments];
          newAssignments[dayIndex] = { ...newAssignments[dayIndex], menuId };
          const updated = { ...template, assignments: newAssignments };
          updatedPlanToSave = updated;
          return updated;
        }
        return template;
      });
    });
    if (updatedPlanToSave) {
      this.intakeService.saveWeeklyPlan(updatedPlanToSave).subscribe();
    }
    this.openDropdownKey.set(null);
  }

  addNewTemplate() {
    if (!this.canAddMore()) return;

    const athlete = this.athleteId();
    const planName = `Mi Plan ${this.weeklyTemplates().length + 1}`;

    if (athlete) {
      this.intakeService.createWeeklyPlan(athlete, planName).subscribe({
        next: (created) => {
          if (created && !this.activeTemplateId()) {
            this.activeTemplateId.set(created.id);
          }
        },
        error: (err) => {
          console.warn('Error creating plan via service, adding locally:', err);
          this.addLocalTemplate(planName);
        }
      });
    } else {
      this.addLocalTemplate(planName);
    }
  }

  private addLocalTemplate(name: string) {
    this.weeklyTemplates.update((templates) => {
      const newId = `t-${Date.now()}`;
      const newTemplate: WeeklyTemplate = {
        id: newId,
        name,
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
      if (!this.activeTemplateId()) {
        this.activeTemplateId.set(newId);
      }
      return [...templates, newTemplate];
    });
  }

  duplicateTemplate(plan: WeeklyTemplate, event: Event) {
    event.stopPropagation();
    if (!this.canAddMore()) return;

    const athlete = this.athleteId();
    const copyName = `${plan.name} (Copia)`;

    if (athlete) {
      this.intakeService.createWeeklyPlan(athlete, copyName).subscribe({
        next: (created) => {
          if (created) {
            const duplicated: WeeklyTemplate = {
              ...created,
              assignments: [...plan.assignments]
            };
            this.intakeService.saveWeeklyPlan(duplicated).subscribe();
            this.weeklyTemplates.update((templates) =>
              templates.map((t) => (t.id === created.id ? duplicated : t))
            );
          }
        },
        error: () => this.duplicateLocalTemplate(plan, copyName)
      });
    } else {
      this.duplicateLocalTemplate(plan, copyName);
    }
  }

  private duplicateLocalTemplate(plan: WeeklyTemplate, copyName: string) {
    this.weeklyTemplates.update((templates) => {
      const newId = `t-${Date.now()}`;
      const newTemplate: WeeklyTemplate = {
        ...plan,
        id: newId,
        name: copyName,
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
    this.intakeService.deleteWeeklyPlan(templateId).subscribe({
      next: () => {
        this.weeklyTemplates.update((templates) => templates.filter((t) => t.id !== templateId));
        if (this.activeTemplateId() === templateId) {
          const remaining = this.weeklyTemplates().filter((t) => t.id !== templateId);
          this.activeTemplateId.set(remaining[0]?.id || null);
        }
      },
      error: (err) => {
        console.warn('Error deleting plan via service, removing locally:', err);
        this.weeklyTemplates.update((templates) => templates.filter((t) => t.id !== templateId));
      }
    });
  }

  saveAll() {
    this.isSaving.set(true);
    const plans = this.weeklyTemplates();
    
    // Guardar todos los planes
    const saveOps = plans.map((p) => this.intakeService.saveWeeklyPlan(p));
    
    if (saveOps.length === 0) {
      this.isSaving.set(false);
      this.isOpen.set(false);
      return;
    }

    let completed = 0;
    saveOps.forEach((op) => {
      op.subscribe({
        next: () => {
          completed++;
          if (completed >= saveOps.length) {
            this.isSaving.set(false);
            this.onSavePlan.emit(plans);
            this.isOpen.set(false);
          }
        },
        error: () => {
          completed++;
          if (completed >= saveOps.length) {
            this.isSaving.set(false);
            this.onSavePlan.emit(plans);
            this.isOpen.set(false);
          }
        }
      });
    });
  }

  getAssignedMenu(menuId: string | null): MenuPlan | null {
    if (!menuId) return null;
    return this.availableMenus().find((m) => m.id === menuId) || null;
  }

  formatQuantity(quantity: number, unit?: string, mode?: string): string {
    return formatQuantity(quantity, unit, mode);
  }

  toFraction(val: number): string {
    return toFraction(val);
  }
}

