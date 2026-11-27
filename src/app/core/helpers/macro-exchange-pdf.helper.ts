export interface MacroExchangeMealInput {
  meal_type: string;
  label: string;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  kcal: number;
}

export interface MacroExchangeIngredientRow {
  id?: string;
  name: string;
  unit?: string | null;
  serving_size?: number | null;
  reference_quantity?: number | null;
  unit_weight_grams?: number | null;
  weight_grams?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  source_classification?: string | null;
}

export interface MacroExchangePdfData {
  kin: {
    team_name: string;
    team_logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
  };
  athlete: {
    full_name: string;
    username?: string | null;
    protocol_label: string;
    protocol_key: string;
    diet_name: string;
  };
  meals: MacroExchangeMealInput[];
  onboarding: {
    favorite_proteins?: string[] | null;
    favorite_carbs?: string[] | null;
    favorite_fats?: string[] | null;
    disliked_foods?: string | null;
    allergies_intolerances?: string | null;
  } | null;
  ingredients: MacroExchangeIngredientRow[];
}

type MacroCategory = 'protein' | 'carbs' | 'fat';

interface IngredientPair {
  baseName: string;
  key: string;
  raw?: MacroExchangeIngredientRow;
  cooked?: MacroExchangeIngredientRow;
  category: MacroCategory;
}

const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'en',
  'al',
  'con',
  'sin',
  'por',
  'para',
  'o',
  'y',
  'a',
  'un',
  'una',
  'tipo',
]);

const VEGETABLE_KEYWORDS = [
  'tomate',
  'lechuga',
  'zanahoria',
  'brocoli',
  'berenjena',
  'pepino',
  'espinaca',
  'calabacin',
  'zucchini',
  'coliflor',
  'pimenton',
  'pimiento',
  'cebolla',
  'esparrago',
  'repollo',
  'col',
  'apio',
  'vainita',
  'ejote',
  'rucula',
  'acelga',
  'champinon',
  'hongo',
  'rabano',
  'remolacha',
  'calabaza',
  'auyama',
];

const FRUIT_KEYWORDS = [
  'fresa',
  'manzana',
  'banana',
  'guineo',
  'platano',
  'pina',
  'papaya',
  'lechosa',
  'sandia',
  'melon',
  'kiwi',
  'naranja',
  'mandarina',
  'pera',
  'durazno',
  'melocoton',
  'mango',
  'uva',
  'arandano',
  'blueberry',
  'frambuesa',
  'mora',
  'cereza',
  'toronja',
  'pomelo',
  'ciruela',
  'higo',
  'datil',
  'maracuya',
  'chinola',
  'granada',
];

function esc(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#FE970A').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(254, 151, 10, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

/**
 * Normaliza texto para pattern matching: sin tildes, minúsculas y espacios colapsados.
 */
export function normalizeMatchText(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/(),.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function extractTokens(text: string): string[] {
  return normalizeMatchText(text)
    .replace(/[(),./-]/g, ' ')
    .split(/\s+/)
    .map((t) => singularizeToken(t.trim()))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function stripStateAndParen(name: string): string {
  return String(name || '')
    .replace(/\(\s*(crudo|cocido)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pattern matching dinámico entre una lista de preferencias (ej. onboarding) y el nombre del ingrediente en Supabase.
 */
export function matchesIngredientPattern(ingredientName: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  const normName = normalizeMatchText(stripStateAndParen(ingredientName));
  const ingTokens = extractTokens(normName);
  if (!normName) return false;

  for (const rawPattern of patterns) {
    // Separar variantes tipo "Huevos enteros / claras" o "Papa / Patata"
    const variants = String(rawPattern || '')
      .split(/[/,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    for (const variant of variants) {
      const normVar = normalizeMatchText(variant);
      if (!normVar) continue;

      if (normName.includes(normVar)) return true;

      const varTokens = extractTokens(normVar);
      if (varTokens.length === 0) continue;

      // Todos los tokens de la variante deben coincidir (por prefijo o igualdad singularizada) en el ingrediente
      const allMatched = varTokens.every((vt) =>
        ingTokens.some((it) => it === vt || it.startsWith(vt) || vt.startsWith(it))
      );
      if (allMatched) return true;
    }
  }
  return false;
}

function matchesKeywordList(ingredientName: string, keywords: string[]): boolean {
  const ingTokens = extractTokens(stripStateAndParen(ingredientName));
  return keywords.some((kw) => ingTokens.some((it) => it === kw || it.startsWith(kw)));
}

function isGramUnit(unit?: string | null): boolean {
  const u = String(unit || 'g').toLowerCase().trim();
  return u === 'g' || u === 'gramos' || u === 'ml' || u === 'mililitros';
}

function getGramsPerServing(ing: MacroExchangeIngredientRow): number {
  const gramUnit = isGramUnit(ing.unit);
  const serving = Number(ing.serving_size ?? ing.reference_quantity ?? 0);
  const unitWeight = Number(ing.unit_weight_grams ?? ing.weight_grams ?? 0);

  if (gramUnit) {
    if (serving > 0) return serving;
    if (unitWeight > 0) return unitWeight;
    return 100;
  }

  const effectiveUnitW = unitWeight > 0 ? unitWeight : 100;
  return effectiveUnitW * (serving > 0 ? serving : 1);
}

function getKcalPer100g(ing: MacroExchangeIngredientRow): number {
  const gps = getGramsPerServing(ing);
  if (gps <= 0) return 0;
  return (Number(ing.calories || 0) / gps) * 100;
}

function inferCategory(ing: MacroExchangeIngredientRow): MacroCategory {
  const cls = normalizeMatchText(ing.source_classification || '');
  if (cls.includes('prot')) return 'protein';
  if (cls.includes('gras') || cls.includes('fat')) return 'fat';
  if (cls.includes('carb')) return 'carbs';

  const p = Number(ing.protein || 0);
  const c = Number(ing.carbs || 0);
  const f = Number(ing.fats || 0);
  if (f >= p && f >= c && f * 9 >= p * 4 && f * 9 >= c * 4) return 'fat';
  if (p >= c && p >= f) return 'protein';
  return 'carbs';
}

function formatIngredientAmount(ing: MacroExchangeIngredientRow | undefined, category: MacroCategory, targetMacroG: number): string {
  if (!ing || targetMacroG <= 0) return '—';
  const gps = getGramsPerServing(ing);
  if (gps <= 0) return '—';

  const macroVal =
    category === 'protein'
      ? Number(ing.protein || 0)
      : category === 'carbs'
        ? Number(ing.carbs || 0)
        : Number(ing.fats || 0);

  const macroPerGram = macroVal / gps;
  if (macroPerGram <= 0.001) return '<=250g';

  const neededGrams = targetMacroG / macroPerGram;

  if (!isGramUnit(ing.unit)) {
    const unitWeight = Number(ing.unit_weight_grams ?? ing.weight_grams ?? 0);
    const effectiveUnitW = unitWeight > 0 ? unitWeight : gps;
    const units = neededGrams / effectiveUnitW;
    if (units >= 0.5) {
      const roundedUnits = Math.max(1, Math.round(units));
      const unitLabel = normalizeMatchText(ing.unit || 'un');
      const shortUnit = unitLabel.startsWith('un') || unitLabel === 'ud' ? 'un' : (ing.unit || 'un').trim();
      return `${roundedUnits} ${shortUnit}`;
    }
  }

  if (neededGrams > 250) {
    return '<=250g';
  }

  const suffix = normalizeMatchText(ing.unit || '') === 'ml' ? 'ml' : 'g';
  return `${Math.max(1, Math.round(neededGrams))}${suffix}`;
}

function buildCombinedEggsRow(
  ingredients: MacroExchangeIngredientRow[],
  meals: MacroExchangeMealInput[]
): { label: string; cells: Array<{ raw: string; cooked: string }> } | null {
  const wholeEgg = ingredients.find((i) => {
    const n = normalizeMatchText(i.name);
    return (n.includes('huevo entero') || n.includes('huevos enteros')) && !n.includes('clara');
  });
  const eggWhite = ingredients.find((i) => {
    const n = normalizeMatchText(i.name);
    return n.includes('clara') || n.includes('sin yema');
  });

  if (!wholeEgg || !eggWhite) return null;

  const wholeGps = getGramsPerServing(wholeEgg);
  const wholeUnitW = Number(wholeEgg.unit_weight_grams ?? wholeEgg.weight_grams ?? 0) || (isGramUnit(wholeEgg.unit) ? 50 : wholeGps);
  const wholeProtPerEgg = (Number(wholeEgg.protein || 0) / wholeGps) * wholeUnitW;
  const wholeFatPerEgg = (Number(wholeEgg.fats || 0) / wholeGps) * wholeUnitW;

  const whiteGps = getGramsPerServing(eggWhite);
  const whiteUnitW = Number(eggWhite.unit_weight_grams ?? eggWhite.weight_grams ?? 0) || (isGramUnit(eggWhite.unit) ? 33 : whiteGps);
  const whiteProtPerUnit = (Number(eggWhite.protein || 0) / whiteGps) * whiteUnitW;

  if (wholeProtPerEgg <= 0 || wholeFatPerEgg <= 0 || whiteProtPerUnit <= 0) return null;

  const cells = meals.map((m) => {
    // Regla: caso combinado huevos enteros + claras siempre que la grasa de la comida >= 5g
    if (m.fats_g >= 5) {
      const maxEggsByFat = Math.floor(m.fats_g / wholeFatPerEgg);
      const maxEggsByProt = Math.floor(m.protein_g / wholeProtPerEgg);
      const wholeCount = Math.max(1, Math.min(maxEggsByFat || 1, maxEggsByProt || 1));
      const remainingProt = Math.max(0, m.protein_g - wholeCount * wholeProtPerEgg);
      const whitesCount = Math.max(0, Math.round(remainingProt / whiteProtPerUnit));
      const text =
        whitesCount > 0
          ? `${wholeCount} huevo${wholeCount > 1 ? 's' : ''} entero${wholeCount > 1 ? 's' : ''} + ${whitesCount} clara${whitesCount > 1 ? 's' : ''}`
          : `${wholeCount} huevo${wholeCount > 1 ? 's' : ''} entero${wholeCount > 1 ? 's' : ''}`;
      return { raw: text, cooked: text };
    }

    const whitesOnly = Math.max(1, Math.round(m.protein_g / whiteProtPerUnit));
    const text = `${whitesOnly} clara${whitesOnly > 1 ? 's' : ''}`;
    return { raw: text, cooked: text };
  });

  return {
    label: 'Huevos enteros + Claras',
    cells,
  };
}

function groupIngredientPairs(list: MacroExchangeIngredientRow[], forcedCategory?: MacroCategory): IngredientPair[] {
  const map = new Map<string, IngredientPair>();

  for (const ing of list) {
    const rawTag = /\(\s*crudo\s*\)/i.test(ing.name);
    const cookedTag = /\(\s*cocido\s*\)/i.test(ing.name);
    const baseName = stripStateAndParen(ing.name);
    const key = normalizeMatchText(baseName);
    if (!key) continue;

    const existing = map.get(key) || {
      baseName,
      key,
      category: forcedCategory || inferCategory(ing),
    };

    if (rawTag && !existing.raw) {
      existing.raw = ing;
    } else if (cookedTag && !existing.cooked) {
      existing.cooked = ing;
    } else if (!existing.raw && !existing.cooked) {
      existing.raw = ing;
      existing.cooked = ing;
    } else if (!existing.raw) {
      existing.raw = ing;
    } else if (!existing.cooked) {
      existing.cooked = ing;
    }

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName, 'es'));
}

export function openMacroExchangePdf(data: MacroExchangePdfData): boolean {
  const win = window.open('', '_blank', 'width=1240,height=880');
  if (!win) return false;

  const primary = data.kin.primary_color || '#FE970A';
  const primarySoft = hexToRgba(primary, 0.1);
  const secondary = data.kin.secondary_color || '#1c1917';
  const meals = data.meals || [];
  const ob = data.onboarding || {};

  const excludedPatterns: string[] = [];
  if (ob.disliked_foods) excludedPatterns.push(ob.disliked_foods);
  if (ob.allergies_intolerances) excludedPatterns.push(ob.allergies_intolerances);

  const allowedIngredients = (data.ingredients || []).filter((ing) => {
    if (excludedPatterns.length === 0) return true;
    return !matchesIngredientPattern(ing.name, excludedPatterns);
  });

  const favProteins = ob.favorite_proteins || [];
  const favCarbs = ob.favorite_carbs || [];
  const favFats = ob.favorite_fats || [];

  // 1. Proteínas seleccionadas (excluyendo huevos individuales si armamos la fila combinada)
  const matchedProteins = allowedIngredients.filter(
    (ing) =>
      matchesIngredientPattern(ing.name, favProteins) &&
      !normalizeMatchText(ing.name).includes('huevo') &&
      !normalizeMatchText(ing.name).includes('clara')
  );
  const proteinPairs = groupIngredientPairs(matchedProteins, 'protein');

  // Fila combinada Huevos + Claras (si el atleta seleccionó huevos o si ambos existen en catálogo)
  const wantsEggs = favProteins.length === 0 || favProteins.some((p) => normalizeMatchText(p).includes('huevo'));
  const combinedEggsRow = wantsEggs ? buildCombinedEggsRow(allowedIngredients, meals) : null;

  // 2. Carbohidratos subdivididos: primero Favoritos del atleta, luego Vegetales y luego Frutas (sin duplicar)
  const isSurplus = String(data.athlete.protocol_key || '').toUpperCase() === 'SURPLUS';
  const matchedFavCarbs = allowedIngredients.filter((ing) => matchesIngredientPattern(ing.name, favCarbs));
  const favCarbPairs = groupIngredientPairs(matchedFavCarbs, 'carbs');
  const favCarbKeys = new Set(favCarbPairs.map((p) => p.key));

  const vegetableCarbs = allowedIngredients.filter(
    (ing) => matchesKeywordList(ing.name, VEGETABLE_KEYWORDS) && inferCategory(ing) === 'carbs'
  );
  const vegetablePairs = groupIngredientPairs(vegetableCarbs, 'carbs').filter((p) => !favCarbKeys.has(p.key));
  const vegKeys = new Set(vegetablePairs.map((p) => p.key));

  const fruitCarbs = allowedIngredients.filter((ing) => {
    if (!matchesKeywordList(ing.name, FRUIT_KEYWORDS)) return false;
    const kcal100 = getKcalPer100g(ing);
    // Déficit / Mantenimiento -> baja densidad calórica (<= 62 kcal / 100g); Superávit -> alta densidad (> 62 kcal / 100g)
    return isSurplus ? kcal100 > 62 : kcal100 <= 62;
  });
  const fruitPairs = groupIngredientPairs(fruitCarbs, 'carbs').filter(
    (p) => !favCarbKeys.has(p.key) && !vegKeys.has(p.key)
  );

  // 3. Grasas seleccionadas
  const matchedFats = allowedIngredients.filter((ing) => matchesIngredientPattern(ing.name, favFats));
  const fatPairs = groupIngredientPairs(matchedFats, 'fat');

  const buildSectionRows = (pairs: IngredientPair[], extraCombinedRow?: { label: string; cells: Array<{ raw: string; cooked: string }> } | null) => {
    const rows: string[] = [];

    if (extraCombinedRow) {
      const cellsHtml = extraCombinedRow.cells
        .map((c) => `<td colspan="2" class="center combined-cell">${esc(c.raw)}</td>`)
        .join('');
      rows.push(`<tr><td class="ing-name">${esc(extraCombinedRow.label)}</td>${cellsHtml}</tr>`);
    }

    for (const pair of pairs) {
      // Si solo existe crudo o solo existe cocido, se repite el valor en ambas columnas
      const rawIng = pair.raw || pair.cooked;
      const cookedIng = pair.cooked || pair.raw;

      const cellsHtml = meals
        .map((m) => {
          const target =
            pair.category === 'protein' ? m.protein_g : pair.category === 'carbs' ? m.carbs_g : m.fats_g;
          const rawVal = formatIngredientAmount(rawIng, pair.category, target);
          const cookedVal = formatIngredientAmount(cookedIng, pair.category, target);
          return `<td class="center">${esc(rawVal)}</td><td class="center">${esc(cookedVal)}</td>`;
        })
        .join('');

      rows.push(`<tr><td class="ing-name">${esc(pair.baseName)}</td>${cellsHtml}</tr>`);
    }

    if (rows.length === 0) {
      rows.push(
        `<tr><td colspan="${1 + meals.length * 2}" class="center empty-row">No se encontraron ingredientes coincidentes en el catálogo para las preferencias de este atleta.</td></tr>`
      );
    }

    return rows.join('');
  };

  const buildCarbSubsectionsHtml = () => {
    const totalCols = 1 + meals.length * 2;
    const sections: Array<{ title: string; pairs: IngredientPair[] }> = [
      { title: 'Carbohidratos Favoritos (Prioritarios)', pairs: favCarbPairs },
      { title: 'Vegetales', pairs: vegetablePairs },
      {
        title: isSurplus
          ? 'Frutas (Densidad Calórica Alta · Superávit)'
          : 'Frutas (Densidad Calórica Baja · Déficit / Mantenimiento)',
        pairs: fruitPairs,
      },
    ];

    const blocks: string[] = [];
    for (const sec of sections) {
      if (sec.pairs.length === 0) continue;
      blocks.push(`<tr><td colspan="${totalCols}" class="sub-cat">${esc(sec.title)}</td></tr>`);
      blocks.push(buildSectionRows(sec.pairs));
    }

    if (blocks.length === 0) {
      blocks.push(
        `<tr><td colspan="${totalCols}" class="center empty-row">No se encontraron carbohidratos coincidentes en el catálogo para las preferencias de este atleta.</td></tr>`
      );
    }
    return blocks.join('');
  };

  const mealHeadersTop = meals
    .map((m) => `<th colspan="2" class="center meal-head">${esc(m.label)}</th>`)
    .join('');
  const mealSubHeaders = meals
    .map(() => `<th class="center sub-head">Crudo</th><th class="center sub-head">Cocido</th>`)
    .join('');

  const summaryColsHead = meals
    .map((m) => `<th class="center meal-head">${esc(m.label)}</th><th class="center sub-head">gramos</th>`)
    .join('');
  const summaryProtRow = meals
    .map((m) => `<td class="lbl-sm">Proteína Objetivo</td><td class="center bold">${Math.round(m.protein_g)} g</td>`)
    .join('');
  const summaryCarbRow = meals
    .map((m) => `<td class="lbl-sm">Carbohidrato Objetivo</td><td class="center bold">${Math.round(m.carbs_g)} g</td>`)
    .join('');
  const summaryFatRow = meals
    .map((m) => `<td class="lbl-sm">Grasa Objetivo</td><td class="center bold">${Math.round(m.fats_g)} g</td>`)
    .join('');
  const summaryKcalRow = meals
    .map((m) => `<td class="lbl-sm bold">Calorías máx</td><td class="center bold kcal-cell">${Math.round(m.kcal)}</td>`)
    .join('');

  const todayLabel = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  const fruitRuleLabel = isSurplus
    ? 'Frutas incluidas: densidad calórica alta (>62 kcal/100g) para Superávit'
    : 'Frutas incluidas: densidad calórica baja (≤62 kcal/100g) para Déficit / Mantenimiento';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Tabla de Macros e Ingredientes — ${esc(data.athlete.full_name)}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      font-family: 'Segoe UI', Inter, Arial, sans-serif;
      color: #1c1917;
      background: #f5f5f4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .toolbar {
      max-width: 1120px;
      margin: 0 auto 10px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: #fff;
      border: 1px solid #e7e5e4;
      padding: 10px 14px;
      border-radius: 12px;
    }
    .toolbar-info { font-size: 12px; color: #57534e; font-weight: 600; }
    .btn-print {
      background: ${primary};
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .sheet {
      max-width: 1120px;
      margin: 0 auto;
      background: #fff;
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${primary};
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { width: 34px; height: 34px; object-fit: contain; border-radius: 8px; }
    .brand-title { font-size: 15px; font-weight: 900; color: ${secondary}; text-transform: uppercase; }
    .brand-sub { font-size: 10px; color: #78716c; font-weight: 600; }
    .ath-meta { text-align: right; font-size: 11px; }
    .ath-meta strong { font-size: 13px; color: #1c1917; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9.5px;
    }
    th, td {
      border: 1px solid #d6d3d1;
      padding: 3.5px 5px;
    }
    .meal-head {
      background: ${secondary};
      color: #fff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
    }
    .sub-head {
      background: #f5f5f4;
      font-weight: 800;
      font-size: 9px;
      color: #44403c;
    }
    .source-head {
      background: ${primary};
      color: #fff;
      font-weight: 900;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
    }
    .ing-name {
      font-weight: 700;
      color: #1c1917;
      min-width: 185px;
    }
    .lbl-sm { font-weight: 600; color: #44403c; background: #fafaf9; }
    .kcal-cell { background: ${primarySoft}; color: #1c1917; }
    .combined-cell { font-weight: 700; background: #fffbeb; color: #92400e; }
    .sub-cat {
      background: ${primarySoft};
      color: ${secondary};
      font-weight: 900;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 4px 6px;
    }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .empty-row { color: #78716c; font-style: italic; padding: 8px; }
    .note {
      font-size: 9px;
      color: #57534e;
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { box-shadow: none; border-radius: 0; max-width: 100%; padding: 0; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-info">Tabla de Equivalencias por Macro (Crudo / Cocido) · ${esc(data.athlete.full_name)}</div>
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${data.kin.team_logo_url ? `<img src="${esc(data.kin.team_logo_url)}" alt="Logo" />` : ''}
        <div>
          <div class="brand-title">${esc(data.kin.team_name)} · Tabla de Alimentos por Macros</div>
          <div class="brand-sub">${esc(data.athlete.protocol_label)} · Dieta: ${esc(data.athlete.diet_name)}</div>
        </div>
      </div>
      <div class="ath-meta">
        <div><strong>${esc(data.athlete.full_name)}</strong></div>
        <div>Generado: ${esc(todayLabel)}</div>
      </div>
    </div>

    <!-- Resumen de Objetivos por Comida -->
    <table>
      <thead><tr>${summaryColsHead}</tr></thead>
      <tbody>
        <tr>${summaryProtRow}</tr>
        <tr>${summaryCarbRow}</tr>
        <tr>${summaryFatRow}</tr>
        <tr>${summaryKcalRow}</tr>
      </tbody>
    </table>

    <!-- Fuente Proteína -->
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="source-head">Fuente Proteína</th>
          ${mealHeadersTop}
        </tr>
        <tr>${mealSubHeaders}</tr>
      </thead>
      <tbody>
        ${buildSectionRows(proteinPairs, combinedEggsRow)}
      </tbody>
    </table>

    <!-- Fuente Carbohidrato -->
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="source-head">Fuente Carbohidrato</th>
          ${mealHeadersTop}
        </tr>
        <tr>${mealSubHeaders}</tr>
      </thead>
      <tbody>
        ${buildCarbSubsectionsHtml()}
      </tbody>
    </table>

    <!-- Fuente Grasa -->
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="source-head">Fuente Grasa</th>
          ${mealHeadersTop}
        </tr>
        <tr>${mealSubHeaders}</tr>
      </thead>
      <tbody>
        ${buildSectionRows(fatPairs)}
      </tbody>
    </table>

    <div class="note">
      <span>* Cantidades calculadas según la distribución de macros por comida. En alimentos sin variante crudo/cocido diferenciada se repite el valor.</span>
      <span>${esc(fruitRuleLabel)}</span>
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
