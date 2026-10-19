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
}

export interface DishIngredient {
  id?: string;
  name: string;
  quantity: number;
  mode?: string;
  unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  sourceClassification?: string;
  serving_size?: number;
  unit_weight_grams?: number;
}

export interface DishItem {
  id: string;
  dishId: string;
  name: string;
  mealType: string;
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
  assignments: DayAssignment[];
}

