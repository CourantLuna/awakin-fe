/**
 * NUTRITION OPTIMIZER CORE (Zero-Dependency Engine)
 * Basado en CORE_OPTIMIZADOR_CALCULADORA.md
 */

import { DishItem, DishIngredient, LooseIngredientItem, MenuPlan } from '../../features/intake/models/intake.models';

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface OptimizationTargetRange {
  min: number;
  max: number;
}

export interface OptimizationTargets {
  protein: OptimizationTargetRange;
  carbs: OptimizationTargetRange;
  fat: OptimizationTargetRange;
}

export interface Ingredient {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
  unit?: string;
  serving_size?: number;
  unit_weight_grams?: number;
}

export interface RecipeIngredientItem {
  id?: string;
  ingredient_id?: string;
  quantity: number;
  mode?: 'g' | 'portions';
  ingredient?: Ingredient;
  sub_dish?: {
    id: string;
    total_protein: number;
    total_carbs: number;
    total_fats: number;
    total_calories: number;
    total_weight_grams?: number;
    portions?: number;
  };
}

export type MacroSourceCategory = 'protein' | 'carbs' | 'fat' | 'neutral';

// ==========================================
// 1. CÁLCULO BASE DE MACROS Y UNIDADES
// ==========================================

/**
 * Convierte un número decimal a representación de fracción culinaria (ej: 0.5 -> "1/2", 1.5 -> "1 1/2", 2.25 -> "2 1/4").
 * NUNCA retorna decimales.
 */
export function toFraction(val: number): string {
  if (val <= 0 || isNaN(val)) return '0';

  const whole = Math.floor(val);
  const frac = val - whole;

  let fracStr = '';
  if (frac < 0.08) {
    fracStr = '';
  } else if (frac < 0.2) {
    fracStr = '1/8';
  } else if (frac < 0.29) {
    fracStr = '1/4';
  } else if (frac < 0.42) {
    fracStr = '1/3';
  } else if (frac < 0.58) {
    fracStr = '1/2';
  } else if (frac < 0.71) {
    fracStr = '2/3';
  } else if (frac < 0.88) {
    fracStr = '3/4';
  } else {
    return String(whole + 1);
  }

  if (whole === 0) {
    return fracStr || '1';
  }

  return fracStr ? `${whole} ${fracStr}` : String(whole);
}

/**
 * Formatea una cantidad respetando:
 * - Gramos / ml: SIEMPRE enteros, nunca decimales (ej: "150 g").
 * - Porciones / unidades discretas: SIEMPRE fracciones o enteros, NUNCA decimales (ej: "1 1/2 porciones", "2 huevos", "1/2 unidad").
 */
export function formatQuantity(quantity: number, unit?: string, mode?: string): string {
  const qty = Number(quantity) || 0;
  const cleanUnit = (unit || '').toLowerCase().trim();
  const cleanMode = (mode || '').toLowerCase().trim();

  const isGrams =
    cleanUnit === 'g' ||
    cleanUnit === 'gramos' ||
    cleanUnit === 'ml' ||
    cleanUnit === 'mililitros' ||
    cleanMode === 'g';

  if (isGrams) {
    const rounded = Math.round(qty);
    const displayUnit = cleanUnit === 'ml' || cleanUnit === 'mililitros' ? 'ml' : 'g';
    return `${rounded > 0 ? rounded : 1} ${displayUnit}`;
  }

  // Porciones / Unidades discretas
  const frac = toFraction(qty);
  const displayUnit = unit ? unit : 'porción';
  return `${frac} ${displayUnit}`;
}

export const getGramsForQuantity = (
  ingredient: Ingredient | undefined,
  quantity: number,
  mode: string | undefined
): number => {
  if (!ingredient) return 0;
  const qty = Number(quantity) || 0;
  const cleanUnit = String(ingredient.unit || '').toLowerCase().trim();
  const isGramUnit = cleanUnit === 'g' || cleanUnit === 'gramos' || cleanUnit === 'ml';

  if (mode === 'g') {
    return qty;
  }

  // Si el modo es portions (o el ingrediente no es g/ml)
  if (mode === 'portions' || !isGramUnit) {
    if (isGramUnit) {
      const servingSize = Number(ingredient.serving_size) || 100;
      return qty * servingSize;
    }
    // Para unidades discretas (porcion, unidad, huevo, etc.), unit_weight_grams es el peso en gramos de 1 porcion/unidad
    const unitWeight = Number(ingredient.unit_weight_grams);
    const gramsPerPortion = unitWeight && unitWeight > 0 ? unitWeight : 100;
    return qty * gramsPerPortion;
  }

  return qty;
};

export const calculateIngredientMacros = (
  ingredient: Ingredient,
  quantity: number,
  mode: string | undefined
): Macros => {
  const cleanUnit = String(ingredient.unit || '').toLowerCase().trim();
  const isGramUnit = cleanUnit === 'g' || cleanUnit === 'gramos' || cleanUnit === 'ml';

  // Gramos totales que representa la cantidad solicitada
  const grams = getGramsForQuantity(ingredient, quantity, mode);

  // unit_weight_grams representa los gramos de 1 porción/serving_size
  let gramsPerServing = Number(ingredient.unit_weight_grams);
  if (!gramsPerServing || gramsPerServing <= 0) {
    gramsPerServing = isGramUnit ? (Number(ingredient.serving_size) || 100) : 100;
  }

  const multiplier = gramsPerServing > 0 ? (grams / gramsPerServing) : (grams / 100);

  return {
    protein: (ingredient.protein || 0) * multiplier,
    carbs: (ingredient.carbs || 0) * multiplier,
    fat: (ingredient.fats || 0) * multiplier,
    calories: (ingredient.calories || 0) * multiplier,
  };
};

export const getPrimaryMacroSource = (p100: number, c100: number, f100: number): MacroSourceCategory => {
  const totalMacros = p100 + c100 + f100;
  if (totalMacros < 1.5) return 'neutral';

  if (f100 > p100 && f100 > c100) return 'fat';
  if (p100 > c100 && p100 > f100) return 'protein';
  if (c100 > p100 && c100 > f100) return 'carbs';

  const kcalP = p100 * 4;
  const kcalC = c100 * 4;
  const kcalF = f100 * 9;
  if (kcalF >= kcalP && kcalF >= kcalC) return 'fat';
  if (kcalP >= kcalC && kcalP >= kcalF) return 'protein';
  return 'carbs';
};

// ==========================================
// 2. MOTOR DEL OPTIMIZADOR
// ==========================================

const getItemKey = (req: any, fallbackIdx?: number): string => {
  return (
    req.ingredient_id ||
    req.id ||
    req.ingredient?.id ||
    (req.ingredient?.name ? `name_${req.ingredient.name}` : null) ||
    (fallbackIdx !== undefined ? `item_${fallbackIdx}` : 'unknown')
  );
};

export const getMacrosPer100g = (ingredient: Ingredient): Macros => {
  let gramsPerServing = Number(ingredient.unit_weight_grams);
  if (!gramsPerServing || gramsPerServing <= 0) {
    const cleanUnit = String(ingredient.unit || '').toLowerCase().trim();
    const isGramUnit = cleanUnit === 'g' || cleanUnit === 'gramos' || cleanUnit === 'ml';
    gramsPerServing = isGramUnit ? (Number(ingredient.serving_size) || 100) : 100;
  }
  const factor = 100 / (gramsPerServing > 0 ? gramsPerServing : 100);
  return {
    protein: (ingredient.protein || 0) * factor,
    carbs: (ingredient.carbs || 0) * factor,
    fat: (ingredient.fats || 0) * factor,
    calories: (ingredient.calories || 0) * factor,
  };
};

const getItemMacrosPer100g = (req: RecipeIngredientItem): Macros => {
  if (req.ingredient) {
    return getMacrosPer100g(req.ingredient);
  }
  if (req.sub_dish) {
    const totalW = Number(req.sub_dish.total_weight_grams) || 0;
    const portions = Number(req.sub_dish.portions) || 1;
    const effectiveTotalW = totalW > 0 ? totalW : portions * 100;
    const factor = 100 / effectiveTotalW;
    return {
      protein: (Number(req.sub_dish.total_protein) || 0) * factor,
      carbs: (Number(req.sub_dish.total_carbs) || 0) * factor,
      fat: (Number(req.sub_dish.total_fats) || 0) * factor,
      calories: (Number(req.sub_dish.total_calories) || 0) * factor,
    };
  }
  return { protein: 0, carbs: 0, fat: 0, calories: 0 };
};

const getItemInitialGrams = (req: RecipeIngredientItem): number => {
  const qty = Number(req.quantity) || 0;
  let grams = qty;

  if (req.ingredient) {
    if (req.mode === 'portions') {
      grams = getGramsForQuantity(req.ingredient, qty, req.mode);
    }
  } else if (req.sub_dish) {
    if (req.mode === 'portions') {
      const totalW = Number(req.sub_dish.total_weight_grams) || 0;
      const portions = Number(req.sub_dish.portions) || 1;
      const portionGrams = totalW > 0 ? totalW / portions : 100;
      grams = qty * portionGrams;
    }
  }

  // Heurística de punto inicial si la cantidad es 0
  if (grams <= 0) {
    const m = getItemMacrosPer100g(req);
    const cat = getPrimaryMacroSource(m.protein, m.carbs, m.fat);
    if (cat === 'fat') grams = m.fat > 50 ? 15 : 40;
    else if (cat === 'protein') grams = 120;
    else if (cat === 'carbs') grams = 80;
    else grams = 30;
  }

  return grams;
};

export const optimizeRecipeMacros = (
  ingredients: RecipeIngredientItem[],
  targets: OptimizationTargets
): Record<string, number> => {
  if (!ingredients || ingredients.length === 0) return {};

  interface ProcessedItem {
    req: RecipeIngredientItem;
    key: string;
    initialGrams: number;
    macros100g: Macros;
    pPerG: number;
    cPerG: number;
    fPerG: number;
    category: MacroSourceCategory;
  }

  const items: ProcessedItem[] = ingredients
    .filter((req) => req.ingredient || req.sub_dish)
    .map((req, idx) => {
      const key = getItemKey(req, idx);
      const initialGrams = getItemInitialGrams(req);
      const macros100g = getItemMacrosPer100g(req);
      const category = getPrimaryMacroSource(macros100g.protein, macros100g.carbs, macros100g.fat);

      return {
        req,
        key,
        initialGrams,
        macros100g,
        pPerG: macros100g.protein / 100,
        cPerG: macros100g.carbs / 100,
        fPerG: macros100g.fat / 100,
        category,
      };
    });

  if (items.length === 0) return {};

  const baseContributions = {
    protein: { p: 0, c: 0, f: 0, count: 0 },
    carbs:   { p: 0, c: 0, f: 0, count: 0 },
    fat:     { p: 0, c: 0, f: 0, count: 0 },
    neutral: { p: 0, c: 0, f: 0, count: 0 }
  };

  items.forEach((it) => {
    baseContributions[it.category].p += it.initialGrams * it.pPerG;
    baseContributions[it.category].c += it.initialGrams * it.cPerG;
    baseContributions[it.category].f += it.initialGrams * it.fPerG;
    baseContributions[it.category].count++;
  });

  const hasP = baseContributions.protein.count > 0;
  const hasC = baseContributions.carbs.count > 0;
  const hasF = baseContributions.fat.count > 0;

  const targetP = (targets.protein.min + targets.protein.max) / 2;
  const targetC = (targets.carbs.min + targets.carbs.max) / 2;
  const targetF = (targets.fat.min + targets.fat.max) / 2;

  let FP = 1.0;
  let FC = 1.0;
  let FF = 1.0;

  // Fase 1: Solución Matricial 3x3 (Cramer)
  const det3 = (m: number[][]) => (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );

  const M = [
    [baseContributions.protein.p, baseContributions.carbs.p, baseContributions.fat.p],
    [baseContributions.protein.c, baseContributions.carbs.c, baseContributions.fat.c],
    [baseContributions.protein.f, baseContributions.carbs.f, baseContributions.fat.f]
  ];
  const b = [
    targetP - baseContributions.neutral.p,
    targetC - baseContributions.neutral.c,
    targetF - baseContributions.neutral.f
  ];

  const D = det3(M);
  if (hasP && hasC && hasF && Math.abs(D) > 1e-4) {
    const M0 = [
      [b[0], M[0][1], M[0][2]],
      [b[1], M[1][1], M[1][2]],
      [b[2], M[2][1], M[2][2]]
    ];
    const M1 = [
      [M[0][0], b[0], M[0][2]],
      [M[1][0], b[1], M[1][2]],
      [M[2][0], b[2], M[2][2]]
    ];
    const M2 = [
      [M[0][0], M[0][1], b[0]],
      [M[1][0], M[1][1], b[1]],
      [M[2][0], M[2][1], b[2]]
    ];
    const solP = det3(M0) / D;
    const solC = det3(M1) / D;
    const solF = det3(M2) / D;
    if (solP > 0.05 && solC > 0.05 && solF > 0.05) {
      FP = Math.min(5.0, Math.max(0.15, solP));
      FC = Math.min(5.0, Math.max(0.15, solC));
      FF = Math.min(5.0, Math.max(0.15, solF));
    }
  } else {
    // Fallbacks para 2 o 1 grupo
    if (hasP && hasF && !hasC) {
      const denom = (baseContributions.protein.p * baseContributions.fat.f) - (baseContributions.protein.f * baseContributions.fat.p);
      if (Math.abs(denom) > 1e-4) {
        const sP = (b[0] * baseContributions.fat.f - b[2] * baseContributions.fat.p) / denom;
        const sF = (baseContributions.protein.p * b[2] - baseContributions.protein.f * b[0]) / denom;
        if (sP > 0.05) FP = Math.min(5.0, Math.max(0.15, sP));
        if (sF > 0.05) FF = Math.min(5.0, Math.max(0.15, sF));
      }
    } else if (hasP && hasC && !hasF) {
      const denom = (baseContributions.protein.p * baseContributions.carbs.c) - (baseContributions.protein.c * baseContributions.carbs.p);
      if (Math.abs(denom) > 1e-4) {
        const sP = (b[0] * baseContributions.carbs.c - b[1] * baseContributions.carbs.p) / denom;
        const sC = (baseContributions.protein.p * b[1] - baseContributions.protein.c * b[0]) / denom;
        if (sP > 0.05) FP = Math.min(5.0, Math.max(0.15, sP));
        if (sC > 0.05) FC = Math.min(5.0, Math.max(0.15, sC));
      }
    } else if (hasP && !hasC && !hasF && baseContributions.protein.p > 0) {
      FP = Math.min(5.0, Math.max(0.15, b[0] / baseContributions.protein.p));
    }
  }

  // Fase 2: Descenso de Gradiente Proyectado
  let lr = 0.04;
  const iterations = 1500;

  for (let iter = 0; iter < iterations; iter++) {
    const currP = (hasP ? FP * baseContributions.protein.p : 0) + 
                  (hasC ? FC * baseContributions.carbs.p : 0) + 
                  (hasF ? FF * baseContributions.fat.p : 0) + 
                  baseContributions.neutral.p;

    const currC = (hasP ? FP * baseContributions.protein.c : 0) + 
                  (hasC ? FC * baseContributions.carbs.c : 0) + 
                  (hasF ? FF * baseContributions.fat.c : 0) + 
                  baseContributions.neutral.c;

    const currF = (hasP ? FP * baseContributions.protein.f : 0) + 
                  (hasC ? FC * baseContributions.carbs.f : 0) + 
                  (hasF ? FF * baseContributions.fat.f : 0) + 
                  baseContributions.neutral.f;

    let errP = 0;
    if (currP < targets.protein.min) errP = currP - targets.protein.min;
    else if (currP > targets.protein.max) errP = currP - targets.protein.max;

    let errC = 0;
    if (currC < targets.carbs.min) errC = currC - targets.carbs.min;
    else if (currC > targets.carbs.max) errC = currC - targets.carbs.max;

    let errF = 0;
    if (currF < targets.fat.min) errF = currF - targets.fat.min;
    else if (currF > targets.fat.max) errF = currF - targets.fat.max;

    if (errP === 0 && errC === 0 && errF === 0) {
      break;
    }

    if (hasP) {
      const gradP = 20 * errP * (baseContributions.protein.p / 100) + 
                    10 * errC * (baseContributions.protein.c / 100) + 
                    10 * errF * (baseContributions.protein.f / 100);
      FP -= lr * gradP;
      if (FP < 0.15) FP = 0.15;
      if (FP > 5.0) FP = 5.0;
    }

    if (hasC) {
      const gradC = 10 * errP * (baseContributions.carbs.p / 100) + 
                    20 * errC * (baseContributions.carbs.c / 100) + 
                    10 * errF * (baseContributions.carbs.f / 100);
      FC -= lr * gradC;
      if (FC < 0.15) FC = 0.15;
      if (FC > 5.0) FC = 5.0;
    }

    if (hasF) {
      const gradF = 10 * errP * (baseContributions.fat.p / 100) + 
                    10 * errC * (baseContributions.fat.c / 100) + 
                    20 * errF * (baseContributions.fat.f / 100);
      FF -= lr * gradF;
      if (FF < 0.15) FF = 0.15;
      if (FF > 5.0) FF = 5.0;
    }

    lr *= 0.998;
  }

  // Fase 3: Conversión final con garantía de cantidad > 0
  const finalQuantities: Record<string, number> = {};

  items.forEach((it) => {
    let factor = 1.0;
    if (it.category === 'protein') factor = FP;
    else if (it.category === 'carbs') factor = FC;
    else if (it.category === 'fat') factor = FF;

    const scaledGrams = it.initialGrams * factor;

    if (it.req.mode === 'portions') {
      let portionGrams = 100;
      if (it.req.ingredient) {
        portionGrams = getGramsForQuantity(it.req.ingredient, 1, 'portions') || 100;
      } else if (it.req.sub_dish) {
        const totalW = Number(it.req.sub_dish.total_weight_grams) || 0;
        const portions = Number(it.req.sub_dish.portions) || 1;
        portionGrams = totalW > 0 ? totalW / portions : 100;
      }

      let portionsVal = portionGrams > 0 ? (scaledGrams / portionGrams) : scaledGrams;
      portionsVal = Math.round(portionsVal * 10) / 10;
      if (portionsVal < 0.1) portionsVal = 0.1;
      finalQuantities[it.key] = portionsVal;
    } else {
      let gramsVal = Math.round(scaledGrams);
      if (gramsVal < 1) gramsVal = 1;
      finalQuantities[it.key] = gramsVal;
    }
  });

  return finalQuantities;
};

// ==========================================
// 3. RECÁLCULO COMPLETO DEL PLATO
// ==========================================

export const recalculatePlateTotals = (
  ingredients: RecipeIngredientItem[],
  quantities: Record<string, number>
) => {
  let p = 0;
  let c = 0;
  let f = 0;
  let weight = 0;

  ingredients.forEach((req, idx) => {
    const key = getItemKey(req, idx);
    const qty = quantities[key] !== undefined ? quantities[key] : req.quantity;

    if (req.ingredient) {
      const grams = getGramsForQuantity(req.ingredient, qty, req.mode);
      const m = calculateIngredientMacros(req.ingredient, grams, 'g');
      p += m.protein;
      c += m.carbs;
      f += m.fat;
      weight += grams;
    }
  });

  const calories = Math.round(p) * 4 + Math.round(c) * 4 + Math.round(f) * 9;

  return {
    total_protein: Math.round(p * 10) / 10,
    total_carbs: Math.round(c * 10) / 10,
    total_fats: Math.round(f * 10) / 10,
    total_calories: calories,
    total_weight_grams: Math.round(weight),
  };
};

// =========================================================
// 4. HELPERS DE INTEGRACIÓN CON MODELOS INTAKE (DishItem / MenuPlan)
// =========================================================

/**
 * Optimiza las cantidades de un DishItem si isOptimizerActive es true
 * y cuenta con optimizerTargets especificados.
 */
export function applyOptimizationToDish(dish: DishItem): DishItem {
  if (!dish.isOptimizerActive || !dish.optimizerTargets) {
    return dish;
  }

  const targets = dish.optimizerTargets;
  if (!targets.protein || !targets.carbs || !targets.fat) {
    return dish;
  }

  if (!dish.ingredients || dish.ingredients.length === 0) {
    return dish;
  }

  const recipeItems: RecipeIngredientItem[] = dish.ingredients.map((ing, idx) => ({
    id: ing.id || `ing_${idx}`,
    ingredient_id: ing.id || `ing_${idx}`,
    quantity: Number(ing.quantity) || 0,
    mode: ing.mode === 'portions' ? 'portions' : 'g',
    ingredient: {
      id: ing.id || `ing_${idx}`,
      name: ing.name,
      protein: Number(ing.protein) || 0,
      carbs: Number(ing.carbs) || 0,
      fats: Number(ing.fats) || 0,
      calories: Number(ing.calories) || 0,
      unit: ing.unit,
      serving_size: Number(ing.serving_size) || 100,
      unit_weight_grams: ing.unit_weight_grams ? Number(ing.unit_weight_grams) : undefined,
    },
  }));

  const optimizedQuantities = optimizeRecipeMacros(recipeItems, targets);
  if (!optimizedQuantities || Object.keys(optimizedQuantities).length === 0) {
    return dish;
  }

  // Actualizar cantidades en los ingredientes del plato
  const optimizedIngredients: DishIngredient[] = dish.ingredients.map((ing, idx) => {
    const key = ing.id || `ing_${idx}`;
    const newQty = optimizedQuantities[key] !== undefined ? optimizedQuantities[key] : ing.quantity;
    return {
      ...ing,
      quantity: newQty,
    };
  });

  // Recalcular métricas totales del plato
  const totals = recalculatePlateTotals(recipeItems, optimizedQuantities);

  return {
    ...dish,
    ingredients: optimizedIngredients,
    totalProtein: totals.total_protein,
    totalCarbs: totals.total_carbs,
    totalFats: totals.total_fats,
    totalCalories: totals.total_calories,
    totalWeightGrams: totals.total_weight_grams,
  };
}

/**
 * Recalcula todos los platillos de un menú que tengan is_optimizer_active = true,
 * y recalcula los totales globales (calorías y macros) del menú.
 */
export function applyOptimizationToMenu(menu: MenuPlan): MenuPlan {
  if (!menu.dishes || menu.dishes.length === 0) {
    return menu;
  }

  let anyOptimized = false;
  const optimizedDishes = menu.dishes.map((dish) => {
    if (dish.isOptimizerActive && dish.optimizerTargets) {
      anyOptimized = true;
      return applyOptimizationToDish(dish);
    }
    return dish;
  });

  if (!anyOptimized) {
    return {
      ...menu,
      dishes: optimizedDishes,
    };
  }

  // Sumar aportes de todos los platos
  let totalKcal = 0;
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;

  for (const d of optimizedDishes) {
    totalKcal += Number(d.totalCalories) || 0;
    totalP += Number(d.totalProtein) || 0;
    totalC += Number(d.totalCarbs) || 0;
    totalF += Number(d.totalFats) || 0;
  }

  // Sumar ingredientes sueltos
  for (const li of menu.looseIngredients || []) {
    const qty = Number(li.quantity) || 0;
    const factor = qty / 100;
    totalKcal += (Number(li.calories) || 0) * factor;
    totalP += (Number(li.protein) || 0) * factor;
    totalC += (Number(li.carbs) || 0) * factor;
    totalF += (Number(li.fats) || 0) * factor;
  }

  const roundedKcal = Math.round(totalKcal);
  const roundedP = Math.round(totalP);
  const roundedC = Math.round(totalC);
  const roundedF = Math.round(totalF);

  return {
    ...menu,
    dishes: optimizedDishes,
    kcal: roundedKcal,
    protein: roundedP,
    carbs: roundedC,
    fats: roundedF,
    macros: `${roundedP}P • ${roundedC}C • ${roundedF}G`,
  };
}
