import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import {
  CatalogIngredient,
  FoodItem,
  FoodPhotoEstimationResult,
  FormattedRecordIngredient,
  ManualIngredientRow,
  NutritionEntryMode,
  ResolvedCustomNutrition,
} from '../../models/intake.models';
import {
  Ingredient,
  applyOptimizationToDish,
  calculateIngredientMacros,
  formatQuantity,
  getGramsForQuantity,
} from '../../../../core/helpers/nutrition-optimizer';

@Component({
  selector: 'app-food-estimation-panel',
  imports: [CommonModule, FormsModule, SelectModule],
  templateUrl: './food-estimation-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodEstimationPanelComponent {
  catalogIngredients = input.required<CatalogIngredient[]>();
  isAnalyzing = input<boolean>(false);
  aiError = input<string | null>(null);
  aiResult = input<FoodPhotoEstimationResult | null>(null);
  hasPhoto = input<boolean>(false);
  plannedFoods = input<FoodItem[]>([]);
  defaultDishName = input<string>('');

  nutritionChange = output<ResolvedCustomNutrition>();
  retryAiAnalysis = output<void>();

  activeMode = signal<NutritionEntryMode>('AI');
  dishNameInput = signal<string>('');

  // Vía A: Macros directos en gramos
  manualProtein = signal<number | null>(null);
  manualCarbs = signal<number | null>(null);
  manualFat = signal<number | null>(null);

  // Vía B: Ingredientes desde base de datos intake
  selectedCatalogIngredientId = signal<string | null>(null);
  ingredientRows = signal<ManualIngredientRow[]>([]);

  private lastAiSignature = '';

  constructor() {
    // Reacciona a resultados o fallos nuevos del modelo de visión
    effect(() => {
      const result = this.aiResult();
      const err = this.aiError();
      const analyzing = this.isAnalyzing();

      if (analyzing) {
        this.lastAiSignature = '';
        return;
      }

      if (result) {
        const sig = `${result.dishName}|${result.kcal}|${result.protein}|${result.carbs}|${result.fat}`;
        if (sig !== this.lastAiSignature) {
          this.lastAiSignature = sig;
          this.activeMode.set('AI');
          this.dishNameInput.set(result.dishName);
        }
        return;
      }

      this.lastAiSignature = '';
      if (err && this.activeMode() === 'AI') {
        this.activeMode.set('MACROS');
      } else if (!result && !err && this.activeMode() === 'AI') {
        this.activeMode.set('MACROS');
      }
    });

    // Emite el estado nutricional resuelto cada vez que cambia la entrada activa
    effect(() => {
      this.nutritionChange.emit(this.resolvedNutrition());
    });
  }

  manualKcal = computed(() => {
    const p = Math.max(0, Number(this.manualProtein()) || 0);
    const c = Math.max(0, Number(this.manualCarbs()) || 0);
    const f = Math.max(0, Number(this.manualFat()) || 0);
    return Math.round(p * 4 + c * 4 + f * 9);
  });

  isMacrosValid = computed(() => {
    const pRaw = this.manualProtein();
    const cRaw = this.manualCarbs();
    const fRaw = this.manualFat();
    const hasAny = pRaw !== null || cRaw !== null || fRaw !== null;
    if (!hasAny) return false;
    const p = Number(pRaw) || 0;
    const c = Number(cRaw) || 0;
    const f = Number(fRaw) || 0;
    if (p < 0 || c < 0 || f < 0) return false;
    return p + c + f > 0;
  });

  computedIngredientDetails = computed(() => {
    return this.ingredientRows().map((row) => {
      const optimizerIng = this.toOptimizerIngredient(row.ingredient);
      const qty = Math.max(0, Number(row.quantity) || 0);
      const grams = getGramsForQuantity(optimizerIng, qty, row.mode);
      const macros = calculateIngredientMacros(optimizerIng, qty, row.mode);
      const unitLabel = this.getRowUnitLabel(row);
      const kcal =
        macros.calories > 0
          ? Math.round(macros.calories)
          : Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9);

      const isSyntheticId =
        row.ingredient.id.startsWith('ai_') || row.ingredient.id.startsWith('plan_');
      const formatted: FormattedRecordIngredient = {
        ingredient_id: isSyntheticId ? null : row.ingredient.id,
        nombre: row.ingredient.name,
        cantidad_display: formatQuantity(qty, unitLabel, row.mode),
        cantidad_original: Math.round(qty * 100) / 100,
        unidad_original: unitLabel,
        modo: row.mode,
        cantidad_g: Math.round(grams * 10) / 10,
        kcals: kcal,
        proteinas_g: Math.round(macros.protein * 10) / 10,
        carbohidratos_g: Math.round(macros.carbs * 10) / 10,
        grasas_g: Math.round(macros.fat * 10) / 10,
      };

      return {
        row,
        kcal,
        protein: Math.round(macros.protein * 10) / 10,
        carbs: Math.round(macros.carbs * 10) / 10,
        fat: Math.round(macros.fat * 10) / 10,
        grams: Math.round(grams * 10) / 10,
        formatted,
      };
    });
  });

  ingredientTotals = computed(() => {
    const details = this.computedIngredientDetails();
    const p = details.reduce((acc, d) => acc + d.protein, 0);
    const c = details.reduce((acc, d) => acc + d.carbs, 0);
    const f = details.reduce((acc, d) => acc + d.fat, 0);
    const kcal = details.reduce((acc, d) => acc + d.kcal, 0);
    return {
      kcal: Math.round(kcal),
      protein: Math.round(p * 10) / 10,
      carbs: Math.round(c * 10) / 10,
      fat: Math.round(f * 10) / 10,
      hasValidItems: details.some((d) => d.row.quantity > 0),
    };
  });

  hasPlannedIngredientsAvailable = computed(() => {
    return this.plannedFoods().length > 0;
  });

  resolvedNutrition = computed<ResolvedCustomNutrition>(() => {
    const mode = this.activeMode();
    const fallbackTitle = this.defaultDishName().trim() || 'Comida personalizada';
    const customName = this.dishNameInput().trim();

    if (mode === 'AI') {
      const ai = this.aiResult();
      if (ai) {
        return {
          mode: 'AI',
          dishName: customName || ai.dishName || fallbackTitle,
          kcal: Math.round(ai.kcal),
          protein: Math.round(ai.protein * 10) / 10,
          carbs: Math.round(ai.carbs * 10) / 10,
          fat: Math.round(ai.fat * 10) / 10,
          ingredients: ai.ingredients,
          isValid: ai.kcal > 0 || ai.protein + ai.carbs + ai.fat > 0,
        };
      }
    }

    if (mode === 'INGREDIENTS') {
      const totals = this.ingredientTotals();
      const validDetails = this.computedIngredientDetails().filter((d) => d.row.quantity > 0);
      const autoName =
        validDetails.length > 0
          ? validDetails.map((d) => d.row.ingredient.name).slice(0, 3).join(' + ')
          : fallbackTitle;

      return {
        mode: 'INGREDIENTS',
        dishName: customName || autoName,
        kcal: totals.kcal,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        ingredients: validDetails.map((d) => d.formatted),
        isValid: totals.hasValidItems,
      };
    }

    const p = Math.round(Math.max(0, Number(this.manualProtein()) || 0) * 10) / 10;
    const c = Math.round(Math.max(0, Number(this.manualCarbs()) || 0) * 10) / 10;
    const f = Math.round(Math.max(0, Number(this.manualFat()) || 0) * 10) / 10;
    const kcal = this.manualKcal();

    return {
      mode: 'MACROS',
      dishName: customName || fallbackTitle,
      kcal,
      protein: p,
      carbs: c,
      fat: f,
      ingredients: [],
      isValid: this.isMacrosValid(),
    };
  });

  selectMode(mode: NutritionEntryMode): void {
    if (mode === 'MACROS' && this.activeMode() === 'AI' && this.aiResult()) {
      this.prefillMacrosFromAi();
    } else if (mode === 'INGREDIENTS' && this.activeMode() === 'AI' && this.aiResult()) {
      this.prefillIngredientsFromAi();
    }
    this.activeMode.set(mode);
  }

  switchToMacrosFromAi(): void {
    this.prefillMacrosFromAi();
    this.activeMode.set('MACROS');
  }

  switchToIngredientsFromAi(): void {
    this.prefillIngredientsFromAi();
    this.activeMode.set('INGREDIENTS');
  }

  onCatalogIngredientSelected(ingredientId: string | null): void {
    if (!ingredientId) return;
    const found = this.catalogIngredients().find((ing) => ing.id === ingredientId);
    if (!found) return;

    const isGramUnit = this.isGramOrMlUnit(found.unit);
    const defaultQty = isGramUnit ? Math.max(10, Math.round(found.serving_size || 100)) : 1;
    const defaultMode: 'g' | 'portions' = isGramUnit ? 'g' : 'portions';

    const newRow: ManualIngredientRow = {
      rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ingredientId: found.id,
      ingredient: found,
      quantity: defaultQty,
      mode: defaultMode,
    };

    this.ingredientRows.update((rows) => [...rows, newRow]);
    this.selectedCatalogIngredientId.set(null);
  }

  updateRowQuantity(rowId: string, rawVal: number | string | null): void {
    const parsed = rawVal === null || rawVal === '' ? 0 : Math.max(0, Number(rawVal) || 0);
    this.ingredientRows.update((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, quantity: parsed } : r))
    );
  }

  updateRowMode(rowId: string, newMode: 'g' | 'portions'): void {
    this.ingredientRows.update((rows) =>
      rows.map((r) => {
        if (r.rowId !== rowId || r.mode === newMode) return r;
        const optIng = this.toOptimizerIngredient(r.ingredient);
        if (newMode === 'portions') {
          const gramsNow = getGramsForQuantity(optIng, r.quantity, r.mode);
          const gramsPerPortion = getGramsForQuantity(optIng, 1, 'portions') || 100;
          const nextPortions = Math.max(0.25, Math.round((gramsNow / gramsPerPortion) * 4) / 4);
          return { ...r, mode: 'portions', quantity: nextPortions };
        } else {
          const gramsNow = Math.max(1, Math.round(getGramsForQuantity(optIng, r.quantity, r.mode)));
          return { ...r, mode: 'g', quantity: gramsNow };
        }
      })
    );
  }

  removeIngredientRow(rowId: string): void {
    this.ingredientRows.update((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  loadIngredientsFromPlan(): void {
    const foods = this.plannedFoods();
    if (foods.length === 0) return;

    const catalog = this.catalogIngredients();
    const newRows: ManualIngredientRow[] = [];

    for (const food of foods) {
      if (food.dishItem && food.dishItem.ingredients && food.dishItem.ingredients.length > 0) {
        const activeDish =
          food.dishItem.isOptimizerActive && food.dishItem.optimizerTargets
            ? applyOptimizationToDish(food.dishItem)
            : food.dishItem;

        for (const di of activeDish.ingredients || []) {
          const raw = di.rawIngredientObj || {};
          const ingId = String(di.ingredient_id || raw.id || di.id || '');
          const matched = catalog.find(
            (c) => c.id === ingId || c.name.toLowerCase() === (di.name || '').toLowerCase()
          );

          const ingObj: CatalogIngredient = matched || {
            id: ingId || `plan_${di.name}`,
            name: di.name || raw.name || 'Ingrediente',
            unit: di.unit || raw.unit || 'g',
            serving_size: Number(di.serving_size ?? raw.serving_size ?? 100),
            calories: Number(di.calories ?? raw.calories ?? 0),
            protein: Number(di.protein ?? raw.protein ?? 0),
            carbs: Number(di.carbs ?? raw.carbs ?? 0),
            fats: Number(di.fats ?? raw.fats ?? 0),
            unit_weight_grams: di.unit_weight_grams ?? raw.unit_weight_grams,
          };

          const mode: 'g' | 'portions' =
            di.mode === 'portions' || !this.isGramOrMlUnit(ingObj.unit) ? 'portions' : 'g';

          newRows.push({
            rowId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ingredientId: ingObj.id,
            ingredient: ingObj,
            quantity: Number(di.quantity) || (mode === 'g' ? 100 : 1),
            mode,
          });
        }
      } else {
        const matched = catalog.find(
          (c) => c.name.toLowerCase() === food.name.toLowerCase()
        );
        const ingObj: CatalogIngredient = matched || {
          id: `plan_${food.id}`,
          name: food.name,
          unit: food.unit || 'porción',
          serving_size: 1,
          calories: food.portion > 0 ? food.kcal / food.portion : food.kcal,
          protein: food.portion > 0 ? food.protein / food.portion : food.protein,
          carbs: food.portion > 0 ? food.carbs / food.portion : food.carbs,
          fats: food.portion > 0 ? food.fat / food.portion : food.fat,
          unit_weight_grams: 100,
        };
        const mode: 'g' | 'portions' = this.isGramOrMlUnit(food.unit) ? 'g' : 'portions';
        newRows.push({
          rowId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ingredientId: ingObj.id,
          ingredient: ingObj,
          quantity: Number(food.portion) || 1,
          mode,
        });
      }
    }

    if (newRows.length > 0) {
      this.ingredientRows.set(newRows);
      this.activeMode.set('INGREDIENTS');
    }
  }

  hasDiscreteUnit(ing: CatalogIngredient): boolean {
    return !this.isGramOrMlUnit(ing.unit);
  }

  getRowUnitLabel(row: ManualIngredientRow): string {
    const clean = (row.ingredient.unit || 'g').toLowerCase().trim();
    if (row.mode === 'g') {
      return clean === 'ml' || clean === 'mililitros' ? 'ml' : 'g';
    }
    return this.isGramOrMlUnit(row.ingredient.unit) ? 'porción' : row.ingredient.unit || 'porción';
  }

  getRowSummary(rowId: string): { kcal: number; protein: number; carbs: number; fat: number } {
    const found = this.computedIngredientDetails().find((d) => d.row.rowId === rowId);
    if (!found) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      kcal: found.kcal,
      protein: found.protein,
      carbs: found.carbs,
      fat: found.fat,
    };
  }

  resetManualFields(): void {
    this.lastAiSignature = '';
    this.dishNameInput.set('');
    this.manualProtein.set(null);
    this.manualCarbs.set(null);
    this.manualFat.set(null);
    this.selectedCatalogIngredientId.set(null);
    this.ingredientRows.set([]);
    this.activeMode.set('MACROS');
  }

  private prefillMacrosFromAi(): void {
    const ai = this.aiResult();
    if (!ai) return;
    if (!this.dishNameInput().trim()) {
      this.dishNameInput.set(ai.dishName);
    }
    this.manualProtein.set(Math.round(ai.protein));
    this.manualCarbs.set(Math.round(ai.carbs));
    this.manualFat.set(Math.round(ai.fat));
  }

  private prefillIngredientsFromAi(): void {
    const ai = this.aiResult();
    if (!ai || !ai.ingredients || ai.ingredients.length === 0) return;
    if (!this.dishNameInput().trim()) {
      this.dishNameInput.set(ai.dishName);
    }

    const catalog = this.catalogIngredients();
    const mappedRows: ManualIngredientRow[] = ai.ingredients.map((item, idx) => {
      const catalogMatch =
        (item.ingredient_id ? catalog.find((c) => c.id === item.ingredient_id) : undefined) ||
        catalog.find((c) => c.name.toLowerCase() === item.nombre.toLowerCase());

      if (catalogMatch) {
        return {
          rowId: `ai_row_${idx}_${Date.now()}`,
          ingredientId: catalogMatch.id,
          ingredient: catalogMatch,
          quantity: Math.max(1, Math.round(item.cantidad_g || item.cantidad_original || 100)),
          mode: 'g',
        };
      }

      const grams = Math.max(1, Number(item.cantidad_g || item.cantidad_original || 100));
      const factorTo100 = 100 / grams;
      const syntheticIng: CatalogIngredient = {
        id: `ai_custom_${idx}`,
        name: item.nombre,
        unit: item.unidad_original === 'ml' ? 'ml' : 'g',
        serving_size: 100,
        calories: Math.round(item.kcals * factorTo100 * 10) / 10,
        protein: Math.round(item.proteinas_g * factorTo100 * 10) / 10,
        carbs: Math.round(item.carbohidratos_g * factorTo100 * 10) / 10,
        fats: Math.round(item.grasas_g * factorTo100 * 10) / 10,
      };

      return {
        rowId: `ai_row_${idx}_${Date.now()}`,
        ingredientId: syntheticIng.id,
        ingredient: syntheticIng,
        quantity: Math.round(grams),
        mode: 'g',
      };
    });

    this.ingredientRows.set(mappedRows);
  }

  private isGramOrMlUnit(unit?: string): boolean {
    const clean = (unit || '').toLowerCase().trim();
    return clean === 'g' || clean === 'gramos' || clean === 'ml' || clean === 'mililitros';
  }

  private toOptimizerIngredient(cat: CatalogIngredient): Ingredient {
    return {
      id: cat.id,
      name: cat.name,
      protein: Number(cat.protein) || 0,
      carbs: Number(cat.carbs) || 0,
      fats: Number(cat.fats) || 0,
      calories: Number(cat.calories) || 0,
      unit: cat.unit || 'g',
      serving_size: Number(cat.serving_size) || 100,
      unit_weight_grams: cat.unit_weight_grams ? Number(cat.unit_weight_grams) : undefined,
    };
  }
}
