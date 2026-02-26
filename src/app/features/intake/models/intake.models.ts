export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  portion: number;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isLogged: boolean;
}

export interface MenuPlan {
  id: string;
  name: string;
  coverIcon: string;
  tags: string[];
  kcal: number;
  macros: string;
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

export interface DayAssignment {
  dayName: string;
  menuId: string | null;
}

// NUEVA INTERFAZ: El contenedor de la semana
export interface WeeklyTemplate {
  id: string;
  name: string;
  isFromCoach: boolean; // REEMPLAZA A isDefault
  assignments: DayAssignment[];
}
