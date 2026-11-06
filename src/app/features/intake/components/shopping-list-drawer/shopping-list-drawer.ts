import { Component, input, model, signal, effect, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import {
  MenuPlan,
  WeeklyTemplate,
  ManualMenuSelection,
  DishItem,
} from '../../models/intake.models';
import {
  AggregatedShoppingItem,
  ShoppingListResult,
  WeeklyPlanSelectionInput,
  generateShoppingListFromWeeklyPlans,
  generateShoppingListFromMenus,
  generateShoppingListFromDish,
  formatShoppingListAsText,
  generateShoppingListPdf,
} from '../../../../core/helpers/shopping-list.helper';

export interface WeeklyPlanSelection {
  rowId: string;
  templateId: string | null;
  quantity: number;
}

@Component({
  selector: 'app-shopping-list-drawer',
  standalone: true,
  imports: [CommonModule, PrimeNGModule, FormsModule],
  templateUrl: './shopping-list-drawer.html',
  styleUrl: './shopping-list-drawer.css',
})
export class ShoppingListDrawer {
  readonly Math = Math;
  isOpen = model<boolean>(false);
  athleteId = input<string | null>(null);
  availableMenus = input<MenuPlan[]>([]);
  weekAssignments = input<WeeklyTemplate[]>([]);
  initialDish = input<DishItem | null>(null);

  // Estados de Vista
  currentStep = signal<'configure' | 'result'>('configure');
  selectedMode = signal<'semanal' | 'manual' | 'receta'>('semanal');

  // Estado para Selección Semanal
  weeklyPlanSelections = signal<WeeklyPlanSelection[]>([
    { rowId: 'row-init', templateId: null, quantity: 1 },
  ]);

  // Estado para Selección Manual
  manualSelections = signal<ManualMenuSelection[]>([]);

  // Estado para Selección por Receta
  selectedDish = signal<DishItem | null>(null);
  dishPortions = signal<number>(1);

  // Resultado de la Lista Generada
  activeResult = signal<ShoppingListResult | null>(null);
  selectedCategoryFilter = signal<string>('TODOS');
  searchQuery = signal<string>('');
  copyFeedback = signal<string | null>(null);
  isGeneratingPdf = signal<boolean>(false);

  // Catálogo de menús estrictamente filtrado:
  // Solo los creados por el usuario logueado O asignados por el instructor en sus planes semanales
  filteredMenus = computed<MenuPlan[]>(() => {
    const athleteId = this.athleteId();
    const allMenus = this.availableMenus();
    const plans = this.weekAssignments();

    // 1. Recopilar todos los IDs de menú asignados en los planes semanales del atleta
    const assignedMenuIds = new Set<string>();
    for (const plan of plans) {
      if (plan.assignments) {
        for (const asg of plan.assignments) {
          if (asg.menuId) assignedMenuIds.add(String(asg.menuId));
          if (asg.menu?.id) assignedMenuIds.add(String(asg.menu.id));
        }
      }
    }

    // 2. Filtrar únicamente los asignados O creados por el usuario logueado
    return allMenus.filter((m) => {
      const isAssigned = assignedMenuIds.has(String(m.id));
      const isCreatedByAthlete = Boolean(
        athleteId && (
          String(m.createdBy) === String(athleteId) ||
          String(m.athleteId) === String(athleteId)
        )
      );
      return isAssigned || isCreatedByAthlete;
    });
  });

  isMenuFromCoach(menu: MenuPlan): boolean {
    const athleteId = this.athleteId();
    if (!athleteId) return false;
    return !(String(menu.createdBy) === String(athleteId) || String(menu.athleteId) === String(athleteId));
  }

  canShare = computed(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isMobile && hasTouch && typeof navigator.share === 'function';
  });

  hasValidSelection = computed(() => {
    if (this.selectedMode() === 'semanal') {
      return this.weeklyPlanSelections().some((s) => s.templateId !== null && s.quantity > 0);
    }
    if (this.selectedMode() === 'manual') {
      return this.manualSelections().some((s) => s.selected && s.quantity > 0);
    }
    if (this.selectedMode() === 'receta') {
      return !!this.selectedDish() && this.dishPortions() > 0;
    }
    return false;
  });

  constructor() {
    // Sincronizar menús disponibles en selección manual usando filteredMenus
    effect(() => {
      const menus = this.filteredMenus();
      const currentMap = new Map(untracked(() => this.manualSelections()).map((s) => [s.menuId, s]));
      const synced = menus.map((m) => {
        const existing = currentMap.get(m.id);
        return {
          menuId: m.id,
          selected: existing ? existing.selected : false,
          quantity: existing ? existing.quantity : 1,
        };
      });
      this.manualSelections.set(synced);
    });

    // Preseleccionar el plan semanal activo o primero si existe
    effect(() => {
      const plans = this.weekAssignments();
      const currentSelections = untracked(() => this.weeklyPlanSelections());
      if (plans.length > 0 && currentSelections.length === 1 && currentSelections[0].templateId === null) {
        const activePlan = plans.find((p) => p.isActive) || plans[0];
        this.weeklyPlanSelections.set([
          { rowId: 'row-init', templateId: activePlan.id, quantity: 1 },
        ]);
      }
    });

    // Reaccionar si se pasa initialDish
    effect(() => {
      const d = this.initialDish();
      if (d) {
        this.selectedDish.set(d);
        this.selectedMode.set('receta');
        this.generateFromSingleDish(d, this.dishPortions());
      } else {
        this.selectedDish.set(null);
        if (this.selectedMode() === 'receta') {
          this.selectedMode.set('semanal');
          this.currentStep.set('configure');
        }
      }
    });
  }

  // Métodos de navegación
  close() {
    this.isOpen.set(false);
  }

  backToConfigure() {
    this.currentStep.set('configure');
  }

  onAccordionChange(value: string | number | string[] | number[] | undefined | null) {
    if (value) {
      const rawValue = Array.isArray(value) ? value[0] : value;
      const mode = String(rawValue);
      if (mode === 'semanal' || mode === 'manual' || mode === 'receta') {
        this.selectedMode.set(mode as any);
      }
    }
  }

  // ==========================================
  // FILAS DEL CONSTRUCTOR SEMANAL
  // ==========================================
  addWeeklyPlanRow() {
    const plans = this.weekAssignments();
    const defaultTemplateId = plans.length > 0 ? plans[0].id : null;
    this.weeklyPlanSelections.update((rows) => [
      ...rows,
      { rowId: `row-${Date.now()}`, templateId: defaultTemplateId, quantity: 1 },
    ]);
  }

  removeWeeklyPlanRow(rowId: string) {
    this.weeklyPlanSelections.update((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  updateWeeklyPlanTemplate(rowId: string, templateId: string) {
    this.weeklyPlanSelections.update((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, templateId } : r))
    );
  }

  updateWeeklyPlanQuantity(rowId: string, delta: number) {
    this.weeklyPlanSelections.update((rows) =>
      rows.map((r) => {
        if (r.rowId === rowId) {
          return { ...r, quantity: Math.max(1, r.quantity + delta) };
        }
        return r;
      })
    );
  }

  // ==========================================
  // SELECCIÓN MANUAL DE MENÚS
  // ==========================================
  getManualSelection(menuId: string): ManualMenuSelection | undefined {
    return this.manualSelections().find((s) => s.menuId === menuId);
  }

  toggleManualSelection(menuId: string) {
    this.manualSelections.update((sels) =>
      sels.map((s) => (s.menuId === menuId ? { ...s, selected: !s.selected } : s))
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
      })
    );
  }

  // ==========================================
  // GENERACIÓN DE LISTAS
  // ==========================================
  generateList() {
    if (this.selectedMode() === 'semanal') {
      this.generateFromWeekly();
    } else if (this.selectedMode() === 'manual') {
      this.generateFromManual();
    } else if (this.selectedMode() === 'receta' && this.selectedDish()) {
      this.generateFromSingleDish(this.selectedDish()!, this.dishPortions());
    }
  }

  generateFromWeekly() {
    const validSelections = this.weeklyPlanSelections().filter((s) => s.templateId !== null);
    if (validSelections.length === 0) return;

    const result = generateShoppingListFromWeeklyPlans(
      this.weekAssignments(),
      validSelections as WeeklyPlanSelectionInput[],
      this.availableMenus()
    );

    this.activeResult.set(result);
    this.selectedCategoryFilter.set('TODOS');
    this.searchQuery.set('');
    this.currentStep.set('result');
  }

  generateFromManual() {
    const selected = this.manualSelections().filter((s) => s.selected && s.quantity > 0);
    if (selected.length === 0) return;

    const result = generateShoppingListFromMenus(selected, this.filteredMenus());

    this.activeResult.set(result);
    this.selectedCategoryFilter.set('TODOS');
    this.searchQuery.set('');
    this.currentStep.set('result');
  }

  generateFromSingleDish(dish: DishItem, portions: number) {
    const result = generateShoppingListFromDish(dish, portions);
    this.activeResult.set(result);
    this.selectedCategoryFilter.set('TODOS');
    this.searchQuery.set('');
    this.currentStep.set('result');
  }

  // ==========================================
  // FILTRADO Y CHECKLIST EN VISTA DE RESULTADO
  // ==========================================
  filteredItems = computed(() => {
    const res = this.activeResult();
    if (!res) return [];

    const cat = this.selectedCategoryFilter();
    const query = this.searchQuery().toLowerCase().trim();

    return res.items.filter((item) => {
      const matchCat = cat === 'TODOS' || item.category === cat;
      const matchQuery = !query || item.name.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  });

  checkedCount = computed(() => {
    const res = this.activeResult();
    if (!res) return 0;
    return res.items.filter((i) => i.checked).length;
  });

  progressPercent = computed(() => {
    const res = this.activeResult();
    if (!res || res.totalUniqueItems === 0) return 0;
    return Math.round((this.checkedCount() / res.totalUniqueItems) * 100);
  });

  toggleItemChecked(item: AggregatedShoppingItem) {
    this.activeResult.update((res) => {
      if (!res) return null;
      return {
        ...res,
        items: res.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
      };
    });
  }

  markAll(status: boolean) {
    this.activeResult.update((res) => {
      if (!res) return null;
      return {
        ...res,
        items: res.items.map((i) => ({ ...i, checked: status })),
      };
    });
  }

  // ==========================================
  // ACCIONES: COPIAR Y EXPORTAR PDF
  // ==========================================
  async copyToClipboard() {
    const res = this.activeResult();
    if (!res) return;

    const text = formatShoppingListAsText(res);
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedback.set('¡Copiado para WhatsApp y Notas!');
      setTimeout(() => this.copyFeedback.set(null), 3000);
    } catch {
      this.copyFeedback.set('Error al copiar');
      setTimeout(() => this.copyFeedback.set(null), 3000);
    }
  }

  /**
   * Descarga directa del archivo PDF en el sistema (Desktop / PC / Navegador estándar).
   * En navegadores modernos con soporte de File System Access API (Chrome/Edge en Desktop)
   * permite abrir el diálogo nativo de "Guardar como..." para elegir la carpeta.
   * Si no, utiliza descarga automática directa con Blob URL. NUNCA abre el panel de compartir en PC.
   */
  async downloadPdf() {
    const res = this.activeResult();
    if (!res) return;

    this.isGeneratingPdf.set(true);
    try {
      const doc = generateShoppingListPdf(res);
      const fileName = `lista-compras-awakin-${Date.now()}.pdf`;
      const blob = doc.output('blob');

      // 1. En Desktop: Intentar diálogo nativo "Guardar como..." si está disponible (File System Access API)
      if ('showSaveFilePicker' in window && !this.canShare()) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'Documento PDF (*.pdf)',
                accept: { 'application/pdf': ['.pdf'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          this.copyFeedback.set('¡PDF guardado correctamente!');
          setTimeout(() => this.copyFeedback.set(null), 3000);
          this.isGeneratingPdf.set(false);
          return;
        } catch (pickerErr: any) {
          // Si el usuario canceló el selector nativo "Guardar como...", no forzar descarga
          if (pickerErr.name === 'AbortError') {
            this.isGeneratingPdf.set(false);
            return;
          }
          console.warn('Fallback de showSaveFilePicker a descarga directa:', pickerErr);
        }
      }

      // 2. Descarga estándar directa mediante Blob URL y enlace temporal
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      this.copyFeedback.set('¡Descarga de PDF iniciada!');
      setTimeout(() => this.copyFeedback.set(null), 3000);
    } catch (e) {
      console.error('Error generando o descargando PDF:', e);
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  /**
   * Comparte el archivo PDF mediante el Share Sheet nativo en dispositivos móviles (WhatsApp, Correo, etc.)
   */
  async sharePdf() {
    const res = this.activeResult();
    if (!res) return;

    this.isGeneratingPdf.set(true);
    try {
      const doc = generateShoppingListPdf(res);
      const fileName = `lista-compras-awakin-${Date.now()}.pdf`;
      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: res.title,
          text: `Lista de compras calculada en Awakin Protocol (${res.totalUniqueItems} ingredientes).`,
        });
      } else {
        await this.downloadPdf();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Error compartiendo PDF:', e);
      }
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  // Alias retrocompatible
  async downloadOrSharePdf() {
    return this.downloadPdf();
  }
}
