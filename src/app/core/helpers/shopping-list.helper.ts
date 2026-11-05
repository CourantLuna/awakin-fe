import { jsPDF } from 'jspdf';
import {
  MenuPlan,
  WeeklyTemplate,
  DishItem,
  DishIngredient,
  LooseIngredientItem,
} from '../../features/intake/models/intake.models';
import { applyOptimizationToDish, applyOptimizationToMenu } from './nutrition-optimizer';

export type ShoppingCategory = 'Proteínas' | 'Carbohidratos' | 'Grasas' | 'Frutas y Verduras' | 'Otros';

export interface AggregatedShoppingItem {
  id: string;
  name: string;
  quantity: number;
  mode: 'g' | 'unidades' | 'porciones';
  unitLabel: string;
  displayQuantity: string;
  category: ShoppingCategory;
  checked: boolean;
  sourceRecipes: string[];
  unitWeightGrams?: number;
  servingSize?: number;
  rawIngredient?: any;
}

export interface ShoppingListResult {
  title: string;
  subtitle: string;
  dateGenerated: string;
  items: AggregatedShoppingItem[];
  totalUniqueItems: number;
  totalWeightGrams: number;
  categories: { name: ShoppingCategory; count: number; emoji: string }[];
  sourcesSummary: string[];
}

export interface WeeklyPlanSelectionInput {
  rowId: string;
  templateId: string | null;
  quantity: number;
}

export interface ManualMenuSelectionInput {
  menuId: string;
  selected: boolean;
  quantity: number;
}

/**
 * Normaliza cadenas para comparaciones culinarias sin tildes ni caracteres especiales
 */
export function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Convierte un número decimal a fracción culinaria legible (ej. 0.5 -> "1/2", 1.25 -> "1 1/4")
 */
export function toCookingFraction(value: number): string {
  const whole = Math.floor(value);
  const decimal = value - whole;

  const fractions = [
    { val: 0, text: '' },
    { val: 0.25, text: '1/4' },
    { val: 0.333, text: '1/3' },
    { val: 0.5, text: '1/2' },
    { val: 0.666, text: '2/3' },
    { val: 0.75, text: '3/4' },
    { val: 1, text: '' },
  ];

  let closest = fractions[0];
  let minDiff = Math.abs(decimal - closest.val);

  for (let i = 1; i < fractions.length; i++) {
    const diff = Math.abs(decimal - fractions[i].val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = fractions[i];
    }
  }

  let finalWhole = whole;
  if (closest.val === 1) finalWhole += 1;

  if (finalWhole === 0 && closest.text === '') return '0';
  if (finalWhole === 0) return closest.text;
  if (closest.val === 1 || closest.val === 0) return `${finalWhole}`;

  return `${finalWhole} ${closest.text}`;
}

/**
 * Clasifica un ingrediente dentro de las 5 categorías principales de compra
 */
export function classifyIngredient(name: string, sourceClassification?: string): ShoppingCategory {
  const normClass = normalizeString(sourceClassification || '');
  if (normClass.includes('proteina') || normClass.includes('protein')) return 'Proteínas';
  if (normClass.includes('carbohidrato') || normClass.includes('carb')) return 'Carbohidratos';
  if (normClass.includes('grasa') || normClass.includes('fat') || normClass.includes('lipido')) return 'Grasas';
  if (normClass.includes('vegetal') || normClass.includes('fruta') || normClass.includes('fibra')) return 'Frutas y Verduras';

  const n = normalizeString(name);

  // Proteínas
  if (
    n.includes('pollo') ||
    n.includes('carne') ||
    n.includes('pavo') ||
    n.includes('res') ||
    n.includes('cerdo') ||
    n.includes('pescado') ||
    n.includes('atun') ||
    n.includes('salmon') ||
    n.includes('sardina') ||
    n.includes('huevo') ||
    n.includes('clara') ||
    n.includes('yema') ||
    n.includes('queso') ||
    n.includes('jamon') ||
    n.includes('whey') ||
    n.includes('proteina') ||
    n.includes('yogur') ||
    n.includes('tofu')
  ) {
    return 'Proteínas';
  }

  // Carbohidratos
  if (
    n.includes('arroz') ||
    n.includes('avena') ||
    n.includes('papa') ||
    n.includes('batata') ||
    n.includes('camote') ||
    n.includes('pasta') ||
    n.includes('pan') ||
    n.includes('arepa') ||
    n.includes('quinoa') ||
    n.includes('tortilla') ||
    n.includes('platano') ||
    n.includes('yuca') ||
    n.includes('lenteja') ||
    n.includes('frijol') ||
    n.includes('garbanzo') ||
    n.includes('maiz') ||
    n.includes('granola')
  ) {
    return 'Carbohidratos';
  }

  // Grasas
  if (
    n.includes('aceite') ||
    n.includes('oliva') ||
    n.includes('aguacate') ||
    n.includes('mantequilla') ||
    n.includes('ghee') ||
    n.includes('almendra') ||
    n.includes('nuez') ||
    n.includes('mani') ||
    n.includes('cacahuate') ||
    n.includes('semilla') ||
    n.includes('chia') ||
    n.includes('linaza') ||
    n.includes('coco') ||
    n.includes('mayonesa')
  ) {
    return 'Grasas';
  }

  // Frutas y Verduras
  if (
    n.includes('tomate') ||
    n.includes('cebolla') ||
    n.includes('lechuga') ||
    n.includes('espinaca') ||
    n.includes('zanahoria') ||
    n.includes('pepino') ||
    n.includes('brocoli') ||
    n.includes('coliflor') ||
    n.includes('pimenton') ||
    n.includes('pimiento') ||
    n.includes('calabacin') ||
    n.includes('zucchini') ||
    n.includes('champinon') ||
    n.includes('seta') ||
    n.includes('manzana') ||
    n.includes('banana') ||
    n.includes('platano maduro') ||
    n.includes('fresa') ||
    n.includes('arandano') ||
    n.includes('limon') ||
    n.includes('naranja') ||
    n.includes('verde')
  ) {
    return 'Frutas y Verduras';
  }

  return 'Otros';
}

/**
 * Da formato culinario y métrico a la cantidad del producto
 */
export function formatShoppingQuantity(
  quantity: number,
  mode: 'g' | 'unidades' | 'porciones',
  unitLabel: string,
  unitWeight?: number
): string {
  const currentAmount = Math.max(0, quantity);

  if (mode === 'g') {
    const g = Math.round(currentAmount);
    if (g >= 1000) {
      const kg = (g / 1000).toFixed(2).replace(/\.00$/, '');
      const lb = (g / 453.592).toFixed(2);
      return `${kg} kg (${g}g · ${lb} lb)`;
    } else if (g >= 454) {
      const lb = (g / 453.592).toFixed(2);
      return `${g}g (${lb} lb)`;
    } else {
      return `${g}g`;
    }
  }

  if (mode === 'unidades') {
    const isWhole = Math.abs(currentAmount - Math.round(currentAmount)) < 0.05;
    const countStr = isWhole ? `${Math.round(currentAmount)}` : toCookingFraction(currentAmount);
    if (unitWeight && unitWeight > 0) {
      const totalGrams = Math.round(currentAmount * unitWeight);
      return `${countStr} ${unitLabel} (${totalGrams}g)`;
    }
    return `${countStr} ${unitLabel}`;
  }

  return `${toCookingFraction(currentAmount)} ${unitLabel || 'porción'}`;
}

export interface RawIngredientInput {
  name: string;
  quantity: number;
  mode?: string;
  unit?: string;
  unit_weight_grams?: number;
  serving_size?: number;
  sourceClassification?: string;
  rawIngredient?: any;
  sourceRecipe?: string;
}

/**
 * Motor central de Agregación y Conversión de Unidades
 */
export function aggregateIngredients(items: RawIngredientInput[]): AggregatedShoppingItem[] {
  const map = new Map<string, {
    id: string;
    name: string;
    quantity: number;
    mode: 'g' | 'unidades' | 'porciones';
    unitLabel: string;
    category: ShoppingCategory;
    unitWeightGrams?: number;
    servingSize?: number;
    sourceRecipes: Set<string>;
    rawIngredient?: any;
  }>();

  for (const item of items) {
    const rawName = String(item.name || 'Ingrediente').trim();
    if (!rawName) continue;

    const normName = normalizeString(rawName);
    const unitName = normalizeString(item.unit || '');

    // Detección de ítems de conteo discreto (huevos, piezas, rebanadas, etc.)
    const isUnitBased =
      unitName.includes('unidad') ||
      unitName.includes('pieza') ||
      unitName.includes('und') ||
      unitName.includes('ud') ||
      normName.includes('huevo') ||
      normName.includes('clara') ||
      normName.includes('yema') ||
      normName.includes('rebanada') ||
      normName.includes('tajada');

    let w = Number(item.unit_weight_grams || item.serving_size || 0);
    if (w <= 0 && isUnitBased) {
      if (normName.includes('clara')) w = 33;
      else if (normName.includes('huevo')) w = 50;
      else if (normName.includes('yema')) w = 17;
      else w = 50;
    }

    let q = Number(item.quantity) || 0;
    let modeStr: 'g' | 'unidades' | 'porciones' = 'unidades';

    const rawMode = String(item.mode || '').toLowerCase();

    if (rawMode === 'portions' || rawMode === 'porciones') {
      if (isUnitBased) {
        modeStr = 'unidades';
      } else if (w > 0) {
        q = q * w;
        modeStr = 'g';
      } else {
        modeStr = 'porciones';
      }
    } else if (rawMode === 'g' || rawMode === 'grams') {
      if (isUnitBased && w > 0) {
        q = q / w;
        modeStr = 'unidades';
      } else {
        modeStr = 'g';
      }
    } else {
      // Modo por defecto
      if (isUnitBased) {
        modeStr = 'unidades';
      } else if (w > 0) {
        modeStr = 'g';
      } else {
        modeStr = 'unidades';
      }
    }

    // Etiqueta de unidad adecuada
    let unitLabel = item.unit || 'g';
    if (modeStr === 'unidades') {
      if (normName.includes('clara')) unitLabel = q > 1 ? 'claras' : 'clara';
      else if (normName.includes('huevo')) unitLabel = q > 1 ? 'huevos' : 'huevo';
      else if (normName.includes('yema')) unitLabel = q > 1 ? 'yemas' : 'yema';
      else if (normName.includes('rebanada')) unitLabel = q > 1 ? 'rebanadas' : 'rebanada';
      else unitLabel = q > 1 ? 'unidades' : 'unidad';
    } else if (modeStr === 'g') {
      unitLabel = 'g';
    } else {
      unitLabel = q > 1 ? 'porciones' : 'porción';
    }

    const key = `${normName}::${modeStr}`;
    const category = classifyIngredient(rawName, item.sourceClassification);

    const existing = map.get(key);
    if (existing) {
      existing.quantity += q;
      if (item.sourceRecipe) existing.sourceRecipes.add(item.sourceRecipe);
    } else {
      const srcSet = new Set<string>();
      if (item.sourceRecipe) srcSet.add(item.sourceRecipe);
      map.set(key, {
        id: `shop_${map.size + 1}_${Math.random().toString(36).substring(2, 6)}`,
        name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
        quantity: q,
        mode: modeStr,
        unitLabel,
        category,
        unitWeightGrams: w,
        servingSize: item.serving_size,
        sourceRecipes: srcSet,
        rawIngredient: item.rawIngredient,
      });
    }
  }

  const categoryOrder: Record<ShoppingCategory, number> = {
    Proteínas: 1,
    Carbohidratos: 2,
    Grasas: 3,
    'Frutas y Verduras': 4,
    Otros: 5,
  };

  return Array.from(map.values())
    .map((item) => ({
      id: item.id,
      key: `${item.name}::${item.mode}`,
      name: item.name,
      quantity: item.quantity,
      mode: item.mode,
      unitLabel: item.unitLabel,
      displayQuantity: formatShoppingQuantity(item.quantity, item.mode, item.unitLabel, item.unitWeightGrams),
      category: item.category,
      checked: false,
      sourceRecipes: Array.from(item.sourceRecipes),
      unitWeightGrams: item.unitWeightGrams,
      servingSize: item.servingSize,
      rawIngredient: item.rawIngredient,
    }))
    .sort((a, b) => {
      const catDiff = (categoryOrder[a.category] || 9) - (categoryOrder[b.category] || 9);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name, 'es');
    });
}

function buildShoppingResult(
  items: AggregatedShoppingItem[],
  title: string,
  subtitle: string,
  sourcesSummary: string[]
): ShoppingListResult {
  const catMap = new Map<ShoppingCategory, number>();
  let totalGrams = 0;

  for (const it of items) {
    catMap.set(it.category, (catMap.get(it.category) || 0) + 1);
    if (it.mode === 'g') {
      totalGrams += it.quantity;
    } else if (it.mode === 'unidades' && it.unitWeightGrams) {
      totalGrams += it.quantity * it.unitWeightGrams;
    }
  }

  const categoryEmojis: Record<ShoppingCategory, string> = {
    Proteínas: '🥩',
    Carbohidratos: '🥔',
    Grasas: '🥑',
    'Frutas y Verduras': '🥦',
    Otros: '🛒',
  };

  const categories: { name: ShoppingCategory; count: number; emoji: string }[] = (
    ['Proteínas', 'Carbohidratos', 'Grasas', 'Frutas y Verduras', 'Otros'] as ShoppingCategory[]
  )
    .filter((cat) => catMap.has(cat))
    .map((cat) => ({
      name: cat,
      count: catMap.get(cat) || 0,
      emoji: categoryEmojis[cat],
    }));

  const now = new Date();
  const dateFormatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return {
    title,
    subtitle,
    dateGenerated: dateFormatted,
    items,
    totalUniqueItems: items.length,
    totalWeightGrams: Math.round(totalGrams),
    categories,
    sourcesSummary,
  };
}

/**
 * 1. Genera la Lista de Compras desde Plantillas Semanales (con optimizadores aplicados)
 */
export function generateShoppingListFromWeeklyPlans(
  weeklyTemplates: WeeklyTemplate[],
  selections: WeeklyPlanSelectionInput[],
  availableMenus: MenuPlan[]
): ShoppingListResult {
  const rawList: RawIngredientInput[] = [];
  const sources: string[] = [];

  const menuMap = new Map<string, MenuPlan>();
  for (const m of availableMenus) {
    menuMap.set(m.id, applyOptimizationToMenu(m));
  }

  for (const sel of selections) {
    if (!sel.templateId || sel.quantity <= 0) continue;
    const template = weeklyTemplates.find((t) => t.id === sel.templateId);
    if (!template) continue;

    const weeks = Math.max(1, sel.quantity);
    sources.push(`${template.name} (${weeks} ${weeks === 1 ? 'semana' : 'semanas'})`);

    for (const assignment of template.assignments || []) {
      if (!assignment.menuId) continue;
      const menu = menuMap.get(assignment.menuId);
      if (!menu) continue;

      // Extraer platos del menú (ya optimizados)
      for (const dish of menu.dishes || []) {
        const activeDish = dish.isOptimizerActive && dish.optimizerTargets ? applyOptimizationToDish(dish) : dish;
        for (const ing of activeDish.ingredients || []) {
          rawList.push({
            name: ing.name,
            quantity: (Number(ing.quantity) || 0) * weeks,
            mode: ing.mode,
            unit: ing.unit,
            unit_weight_grams: ing.unit_weight_grams,
            serving_size: ing.serving_size,
            sourceClassification: ing.sourceClassification,
            rawIngredient: ing.rawIngredientObj,
            sourceRecipe: activeDish.name,
          });
        }
      }

      // Extraer ingredientes sueltos del menú
      for (const li of menu.looseIngredients || []) {
        rawList.push({
          name: li.name,
          quantity: (Number(li.quantity) || 0) * weeks,
          mode: li.mode,
          unit: li.unit,
          sourceClassification: li.sourceClassification,
          sourceRecipe: `Menú ${menu.name}`,
        });
      }
    }
  }

  const items = aggregateIngredients(rawList);
  return buildShoppingResult(
    items,
    'Lista de Compras Semanal',
    sources.join(' · ') || 'Planes Semanales Seleccionados',
    sources
  );
}

/**
 * 2. Genera la Lista de Compras desde Selección Manual de Menús (con optimizadores aplicados)
 */
export function generateShoppingListFromMenus(
  selections: ManualMenuSelectionInput[],
  availableMenus: MenuPlan[]
): ShoppingListResult {
  const rawList: RawIngredientInput[] = [];
  const sources: string[] = [];

  const menuMap = new Map<string, MenuPlan>();
  for (const m of availableMenus) {
    menuMap.set(m.id, applyOptimizationToMenu(m));
  }

  for (const sel of selections) {
    if (!sel.selected || sel.quantity <= 0) continue;
    const menu = menuMap.get(sel.menuId);
    if (!menu) continue;

    const days = Math.max(1, sel.quantity);
    sources.push(`${menu.name} (${days} ${days === 1 ? 'día' : 'días'})`);

    for (const dish of menu.dishes || []) {
      const activeDish = dish.isOptimizerActive && dish.optimizerTargets ? applyOptimizationToDish(dish) : dish;
      for (const ing of activeDish.ingredients || []) {
        rawList.push({
          name: ing.name,
          quantity: (Number(ing.quantity) || 0) * days,
          mode: ing.mode,
          unit: ing.unit,
          unit_weight_grams: ing.unit_weight_grams,
          serving_size: ing.serving_size,
          sourceClassification: ing.sourceClassification,
          rawIngredient: ing.rawIngredientObj,
          sourceRecipe: activeDish.name,
        });
      }
    }

    for (const li of menu.looseIngredients || []) {
      rawList.push({
        name: li.name,
        quantity: (Number(li.quantity) || 0) * days,
        mode: li.mode,
        unit: li.unit,
        sourceClassification: li.sourceClassification,
        sourceRecipe: `Menú ${menu.name}`,
      });
    }
  }

  const items = aggregateIngredients(rawList);
  return buildShoppingResult(
    items,
    'Lista de Compras por Menú',
    sources.join(' · ') || 'Selección Manual de Menús',
    sources
  );
}

/**
 * 3. Genera la Lista de Compras desde una Receta/Plato individual
 */
export function generateShoppingListFromDish(dish: DishItem, portions: number = 1): ShoppingListResult {
  const activeDish = dish.isOptimizerActive && dish.optimizerTargets ? applyOptimizationToDish(dish) : dish;
  const p = Math.max(1, portions);

  const rawList: RawIngredientInput[] = (activeDish.ingredients || []).map((ing) => ({
    name: ing.name,
    quantity: (Number(ing.quantity) || 0) * p,
    mode: ing.mode,
    unit: ing.unit,
    unit_weight_grams: ing.unit_weight_grams,
    serving_size: ing.serving_size,
    sourceClassification: ing.sourceClassification,
    rawIngredient: ing.rawIngredientObj,
    sourceRecipe: activeDish.name,
  }));

  const items = aggregateIngredients(rawList);
  return buildShoppingResult(
    items,
    `Lista de Compras: ${activeDish.name}`,
    `${p} ${p === 1 ? 'porción calculada' : 'porciones calculadas'}${activeDish.isOptimizerActive ? ' (Optimizado)' : ''}`,
    [activeDish.name]
  );
}

/**
 * Genera el texto formateado con casillas [ ] para copiar al portapapeles (WhatsApp / Notas)
 */
export function formatShoppingListAsText(result: ShoppingListResult): string {
  const lines: string[] = [];
  lines.push(`🛒 *${result.title.toUpperCase()}*`);
  lines.push(`📅 ${result.dateGenerated} · ${result.totalUniqueItems} productos`);
  if (result.subtitle) {
    lines.push(`📋 _${result.subtitle}_`);
  }
  lines.push('');

  const categoryEmojis: Record<ShoppingCategory, string> = {
    Proteínas: '🥩',
    Carbohidratos: '🥔',
    Grasas: '🥑',
    'Frutas y Verduras': '🥦',
    Otros: '🛒',
  };

  const grouped = new Map<ShoppingCategory, AggregatedShoppingItem[]>();
  for (const it of result.items) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  for (const cat of ['Proteínas', 'Carbohidratos', 'Grasas', 'Frutas y Verduras', 'Otros'] as ShoppingCategory[]) {
    const list = grouped.get(cat);
    if (!list || list.length === 0) continue;

    lines.push(`${categoryEmojis[cat]} *${cat.toUpperCase()}*`);
    for (const it of list) {
      const checkMark = it.checked ? '[x]' : '[ ]';
      lines.push(`${checkMark} ${it.name}: ${it.displayQuantity}`);
    }
    lines.push('');
  }

  lines.push('⚡ _Generado con Awakin Protocol_');
  return lines.join('\n');
}

/**
 * Genera un PDF A4 limpio, profesional y listo para imprimir con casillas de verificación en vector
 */
export function generateShoppingListPdf(result: ShoppingListResult): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;

  let y = margin;
  let currentPage = 1;

  // Encabezado
  function drawHeader(isFirstPage: boolean) {
    // Barra superior de color de marca Awakin Sun
    doc.setFillColor(245, 158, 11); // #F59E0B
    doc.rect(margin, y, usableWidth, 2.5, 'F');
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 25, 23); // #1C1917
    doc.text('AWAKIN PROTOCOL', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108); // #78716C
    doc.text(result.dateGenerated, pageWidth - margin, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(245, 158, 11);
    doc.text(result.title.toUpperCase(), margin, y);
    y += 5;

    if (isFirstPage && result.subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const splitSub = doc.splitTextToSize(`Origen: ${result.subtitle}`, usableWidth);
      doc.text(splitSub, margin, y);
      y += splitSub.length * 4 + 2;
    }

    // Línea divisoria suave
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  drawHeader(true);

  // Agrupar ítems por categoría
  const grouped = new Map<ShoppingCategory, AggregatedShoppingItem[]>();
  for (const it of result.items) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  const colWidth = (usableWidth - 8) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 8;

  let currentColumn: 1 | 2 = 1;
  let col1Y = y;
  let col2Y = y;

  const cats: ShoppingCategory[] = ['Proteínas', 'Carbohidratos', 'Grasas', 'Frutas y Verduras', 'Otros'];

  for (const cat of cats) {
    const list = grouped.get(cat);
    if (!list || list.length === 0) continue;

    // Calcular altura estimada de esta sección
    const sectionHeight = 7 + list.length * 6.5;
    const targetY = currentColumn === 1 ? col1Y : col2Y;

    if (targetY + sectionHeight > pageHeight - 16) {
      if (currentColumn === 1) {
        currentColumn = 2;
      } else {
        // Nueva página
        doc.addPage();
        currentPage++;
        y = margin;
        drawHeader(false);
        col1Y = y;
        col2Y = y;
        currentColumn = 1;
      }
    }

    const curX = currentColumn === 1 ? col1X : col2X;
    let curY = currentColumn === 1 ? col1Y : col2Y;

    // Título de categoría con fondo suave
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(curX, curY - 3.5, colWidth, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);
    doc.text(`${cat.toUpperCase()} (${list.length})`, curX + 2.5, curY);
    curY += 5;

    // Ítems de la categoría
    for (const it of list) {
      if (curY > pageHeight - 14) {
        if (currentColumn === 1) {
          col1Y = curY;
          currentColumn = 2;
          curY = col2Y;
        } else {
          doc.addPage();
          currentPage++;
          y = margin;
          drawHeader(false);
          col1Y = y;
          col2Y = y;
          currentColumn = 1;
          curY = y;
        }
      }

      const rowX = currentColumn === 1 ? col1X : col2X;

      // Casilla de verificación cuadrada [ ]
      doc.setDrawColor(156, 163, 175);
      doc.setLineWidth(0.35);
      doc.rect(rowX + 1, curY - 2.8, 3.2, 3.2);

      // Nombre del producto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(17, 24, 39);
      const truncatedName = it.name.length > 25 ? `${it.name.substring(0, 24)}…` : it.name;
      doc.text(truncatedName, rowX + 6, curY);

      // Cantidad a la derecha
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99);
      doc.text(it.displayQuantity, rowX + colWidth - 1, curY, { align: 'right' });

      curY += 5.2;
    }

    curY += 3;
    if (currentColumn === 1) {
      col1Y = curY;
    } else {
      col2Y = curY;
    }
  }

  // Numeración de páginas en el pie
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${i} de ${pageCount} · Awakin Protocol Inteligente`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  return doc;
}

