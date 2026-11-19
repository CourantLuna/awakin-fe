export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  mealType?: string;
  category?: string;
  portion: number;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isLogged: boolean;
  coverImageUrl?: string | null;
  dishItem?: DishItem;
}

export interface DishIngredient {
  id?: string;
  ingredient_id?: string;
  sub_dish_id?: string | null;
  name: string;
  quantity: number;
  mode?: string;
  unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  micros?: any;
  photo_urls?: string[];
  sourceClassification?: string;
  coverImageUrl?: string | null;
  serving_size?: number;
  unit_weight_grams?: number;
  rawIngredientObj?: any;
}

export interface DishItem {
  id: string;
  dishId: string;
  name: string;
  mealType: string;
  meal_types?: string[];
  type?: string[];
  prepTimeMinutes: number;
  coverImageUrl?: string | null;
  authorName?: string;
  portions: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalFiber?: number;
  totalWeightGrams?: number;
  satietyIndex?: number;
  tags: string[];
  instructions: string[];
  utensils: string[];
  isOptimizerActive?: boolean;
  optimizerTargets?: any;
  optimizerAthleteId?: string | null;
  ingredients: DishIngredient[];
}

export interface LooseIngredientItem {
  id: string;
  ingredientId: string;
  name: string;
  mealType: string;
  quantity: number;
  mode: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sourceClassification?: string;
}

export interface MenuPlan {
  id: string;
  name: string;
  coverIcon: string;
  coverImageUrl?: string | null;
  tags: string[];
  kcal: number;
  macros: string;
  protein?: number;
  carbs?: number;
  fats?: number;
  authorName?: string;
  description?: string | null;
  createdBy?: string | null;
  athleteId?: string | null;
  dishes?: DishItem[];
  looseIngredients?: LooseIngredientItem[];
}

export interface DayAssignment {
  dayName: string;
  menuId: string | null;
  menu?: MenuPlan | null;
}

export interface ManualMenuSelection {
  menuId: string;
  selected: boolean;
  quantity: number;
}

// NUEVA INTERFAZ: El contenedor de la semana
export interface WeeklyTemplate {
  id: string;
  name: string;
  isFromCoach: boolean; // REEMPLAZA A isDefault
  createdBy?: string | null;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  assignments: DayAssignment[];
}

export interface CatalogIngredient {
  id: string;
  name: string;
  unit: string;
  serving_size: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  unit_weight_grams?: number;
  source_classification?: string;
  photo_urls?: string[];
}

export interface FormattedRecordIngredient {
  ingredient_id?: string | null;
  nombre: string;
  cantidad_display: string;
  cantidad_original: number;
  unidad_original: string;
  modo: 'g' | 'portions';
  cantidad_g: number;
  kcals: number;
  proteinas_g: number;
  carbohidratos_g: number;
  grasas_g: number;
}

export interface FoodPhotoEstimationResult {
  dishName: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: FormattedRecordIngredient[];
  provider?: string | null;
}

export interface ManualIngredientRow {
  rowId: string;
  ingredientId: string;
  ingredient: CatalogIngredient;
  quantity: number;
  mode: 'g' | 'portions';
}

export type NutritionEntryMode = 'AI' | 'MACROS' | 'INGREDIENTS';

export interface ResolvedCustomNutrition {
  mode: NutritionEntryMode;
  dishName: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: FormattedRecordIngredient[];
  isValid: boolean;
}

