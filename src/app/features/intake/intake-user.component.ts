import { Component, computed, OnInit, signal, ViewChild, inject, effect } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import * as htmlToImage from 'html-to-image';

export interface StoryShareData {
  photoUrl: string;
  dateFormatted: string;
  mealTitle: string;
  dishName: string;
  emoji: string;
  portionText: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: any[] | null;
  dishId?: string;
}
import {
  CalendarDay,
  WeekCalendarHeaderComponent,
} from '../../components/week-calendar/week-calendar-header.component';
import { IntakeScaleWidgetComponent } from './components/intake-scale-widget/intake-scale-widget';
import { ProtocolMatrixDrawer } from './components/protocol-matrix-drawer/protocol-matrix-drawer';
import { ShoppingListDrawer } from './components/shopping-list-drawer/shopping-list-drawer';
import { WeeklyTemplate, MenuPlan, DayAssignment, ManualMenuSelection, DishItem } from './models/intake.models';
import { FormsModule } from '@angular/forms';
import { IntakeService, determineCoverIcon } from '../../core/services/intake.service';
import { AthleteService } from '../../core/services/athlete.service';
import { AuthService } from '../../core/services/auth.service';
import { IntakeTopBar } from '../../components/intake-top-bar/intake-top-bar';
import {
  formatQuantity,
  toFraction,
  applyOptimizationToDish,
  getGramsForQuantity,
  calculateIngredientMacros,
} from '../../core/helpers/nutrition-optimizer';

// 1. Tipos de comida del protocolo
export type MealType =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'SNACK_AM'
  | 'SNACK_PM'
  | 'SNACK_EXTRA'
  | 'DRINK';

export interface MealConfig {
  type: MealType;
  title: string;
  icon: string;
  badgeBg: string;
}

export const MEAL_DEFINITIONS: Record<MealType, MealConfig> = {
  BREAKFAST: {
    type: 'BREAKFAST',
    title: 'Desayuno',
    icon: 'pi pi-sun',
    badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-200/50',
  },
  SNACK_AM: {
    type: 'SNACK_AM',
    title: 'Snack Mañana',
    icon: 'pi pi-apple',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50',
  },
  LUNCH: {
    type: 'LUNCH',
    title: 'Almuerzo',
    icon: 'pi pi-compass',
    badgeBg: 'bg-orange-500/10 text-orange-600 border-orange-200/50',
  },
  SNACK_PM: {
    type: 'SNACK_PM',
    title: 'Snack Tarde',
    icon: 'pi pi-bolt',
    badgeBg: 'bg-purple-500/10 text-purple-600 border-purple-200/50',
  },
  DINNER: {
    type: 'DINNER',
    title: 'Cena',
    icon: 'pi pi-moon',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 border-indigo-200/50',
  },
  SNACK_EXTRA: {
    type: 'SNACK_EXTRA',
    title: 'Snack Extra',
    icon: 'pi pi-star',
    badgeBg: 'bg-pink-500/10 text-pink-600 border-pink-200/50',
  },
  DRINK: {
    type: 'DRINK',
    title: 'Bebidas',
    icon: 'pi pi-filter',
    badgeBg: 'bg-cyan-500/10 text-cyan-600 border-cyan-200/50',
  },
};

// Modelo de alimento
export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  mealType: MealType;
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

@Component({
  selector: 'app-intake-user',
  standalone: true,
  imports: [
    CommonModule,
    ChartModule,
    PrimeNGModule,
    WeekCalendarHeaderComponent,
    IntakeScaleWidgetComponent,
    DragDropModule,
    ProtocolMatrixDrawer,
    ShoppingListDrawer,
    FormsModule,
    IntakeTopBar,
  ],
  templateUrl: './intake-user.component.html',
})
export class IntakeUserComponent implements OnInit {
  public athleteService = inject(AthleteService);
  public authService = inject(AuthService);
  public intakeService = inject(IntakeService);
  readonly Math = Math;

  currentAthleteId = computed(() => {
    return (
      this.athleteService.currentAthlete()?.id ||
      this.authService.currentSession()?.avatar?.id ||
      localStorage.getItem('awakin_active_athlete_id')
    );
  });

  athleteKin = computed(() => {
    return this.athleteService.currentAthlete()?.kin || null;
  });

  activeTemplateId = signal<string | null>(null);

  streak = signal<number>(12);
  weekDays = signal<CalendarDay[]>([]); // Se llenará dinámicamente
  selectedDay = signal<CalendarDay | null>(null);
  selectedDate = signal<Date>(new Date());

  // Validación de rango permitido para registrar/marcar alimentos:
  // - No se permite en días futuros (diffDays > 0)
  // - No se permite en días anteriores que pasen de 7 días (diffDays < -7)
  // - Días permitidos: hoy y los 7 días anteriores (-7 <= diff <= 0)
  dateLogStatus = computed(() => {
    const sel = new Date(this.selectedDate());
    sel.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = sel.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        canLog: false,
        reason: 'future' as const,
        message: 'No se puede agregar ni marcar comida de días futuros.',
      };
    }
    if (diffDays < -7) {
      return {
        canLog: false,
        reason: 'expired' as const,
        message: 'No se puede agregar ni marcar comida de más de 7 días anteriores.',
      };
    }
    return {
      canLog: true,
      reason: 'valid' as const,
      message: '',
    };
  });

  canLogForSelectedDate = computed(() => this.dateLogStatus().canLog);
  // Datos Gráfico
  macroData: any;
  macroOptions: any;
  caloriesTarget = 2200;

  formatDateYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateSelected(date: Date) {
    this.selectedDate.set(new Date(date));
    this.selectedDay.set({
      date: date.getDate(),
      fullDate: new Date(date),
      dayName: new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' }).format(date).toUpperCase(),
      status: 'none',
    });
    this.loadDayRecords();
  }

  loadDayRecords() {
    const athlete = this.athleteService.currentAthlete();
    const email = athlete?.email || this.authService.currentSession()?.avatar?.email || 'heydi0811@gmail.com';
    const curDateStr = this.formatDateYMD(this.selectedDate());

    this.intakeService.loadFoodRecords(email, curDateStr).subscribe({
      next: (records) => {
        const regMap: Record<string, any> = {};
        const logMap: Record<string, boolean> = { ...this.loggedFoodMap() };

        if (Array.isArray(records)) {
          for (const rec of records) {
            const prefix = `${curDateStr}_`;
            let foodId = rec.id_original;
            if (rec.id_original && rec.id_original.startsWith(prefix)) {
              foodId = rec.id_original.substring(prefix.length);
            }
            if (foodId) {
              regMap[foodId] = rec;
              const logKey = `${curDateStr}_${foodId}`;
              logMap[logKey] = !!rec.is_active;
            }
          }
        }
        this.registeredRecords.set(regMap);
        this.loggedFoodMap.set(logMap);
      },
      error: (err) => console.error('Error cargando registros nutricionales:', err),
    });
  }

  constructor() {
    effect(() => {
      const ath = this.athleteService.currentAthlete();
      const athleteId = ath?.id || this.currentAthleteId();
      if (athleteId) {
        this.intakeService.loadWeeklyPlansForAthlete(athleteId).subscribe((plans) => {
          if (plans.length > 0 && (!this.activeTemplateId() || !plans.some((p) => p.id === this.activeTemplateId()))) {
            this.activeTemplateId.set(plans[0].id);
          }
        });
      }
      this.loadDayRecords();
    });
  }

  activeWeeklyPlan = computed<WeeklyTemplate | null>(() => {
    const plans = this.weeklyTemplates();
    if (!plans || plans.length === 0) return null;

    const selDate = this.selectedDate();
    const dateStr = this.formatDateYMD(selDate);

    // 1. Prioriza plan que contenga la fecha seleccionada en su rango [startDate, endDate]
    const matchingPlan = plans.find((p) => {
      if (!p.startDate || !p.endDate) return false;
      return dateStr >= p.startDate && dateStr <= p.endDate;
    });

    if (matchingPlan) return matchingPlan;

    // 2. Fallback a activeTemplateId si coincide
    const activeId = this.activeTemplateId();
    if (activeId) {
      const byId = plans.find((p) => p.id === activeId);
      if (byId) return byId;
    }

    // 3. Fallback al primer plan
    return plans[0];
  });

  currentDayIndex = computed<number>(() => {
    const d = this.selectedDate();
    return (d.getDay() + 6) % 7; // Lunes=0, Domingo=6
  });

  currentDayMenu = computed<MenuPlan | null>(() => {
    const plan = this.activeWeeklyPlan();
    if (!plan || !plan.assignments) return null;

    const dayIdx = this.currentDayIndex();
    const assignment = plan.assignments[dayIdx];
    if (!assignment || !assignment.menuId) return null;

    return this.availableMenus().find((m) => m.id === assignment.menuId) || null;
  });

  // Metas nutricionales independientes del perfil / protocolo (Hardcodeadas por ahora, desacopladas del menú)
  // Valores definidos: Goal = 2100 kcal, Maint = 1850 kcal, TBM = 1450 kcal (Protocolo: Superávit)
  readonly defaultProfileNutrition = {
    calories: 2100,
    protein: 150,
    carbs: 250,
    fats: 55,
    tbm: 1450,
    maintenance: 1850,
  };

  // Metas nutricionales independientes del día
  dailyGoalCalories = signal<number>(2100);
  dailyGoalProtein = signal<number>(150);
  dailyGoalCarbs = signal<number>(250);
  dailyGoalFats = signal<number>(55);

  // Set Points del protocolo (TBM, Goal, Maint)
  minBasal = signal<number>(1450);         // TBM = 1450 kcal
  targetGoal = signal<number>(2100);       // GOAL = 2100 kcal
  maintenanceLevel = signal<number>(1850); // MAINT = 1850 kcal

  // En intake-user.component.ts
  currentLabel = signal<string>('Hoy');

  // Label dinámico para el selector de plan según el día seleccionado en el header calendar
  planLabel = computed(() => {
    const label = this.currentLabel()?.trim() || 'Hoy';
    const lower = label.toLowerCase();
    if (lower === 'hoy') return 'Plan de Hoy';
    if (lower === 'ayer') return 'Plan de Ayer';
    if (lower === 'mañana') return 'Plan de Mañana';
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return `Plan del ${capitalized}`;
  });

  // 2. CONTROL DE DRAWERS
  isMatrixOpen = signal<boolean>(false);
  isShoppingListModalOpen = signal<boolean>(false);

  openFuelMatrix() {
    this.isMatrixOpen.set(true);
  }

  // ==========================================
  // NUEVO: SISTEMA DE PIVOT TÁCTICO (Daily Override)
  // ==========================================

  // 1. Simulamos que el sistema detectó que hoy (según la matriz) toca el Menú 1
  baselineMenuId = signal<string | null>('1');

  // 2. El menú que realmente rige HOY (por defecto es el baseline, pero el usuario puede cambiarlo)
  activeMenuForToday = signal<string | null>(this.baselineMenuId());

  // 3. Función que se dispara al cambiar el menú desde el tag
  onDailyMenuChange(newMenuId: string) {
    this.activeMenuForToday.set(newMenuId);
    console.log('⚡ PIVOT TÁCTICO: Hoy aplicaremos el protocolo:', newMenuId);

    // Aquí en el futuro llamarías a tu API:
    // this.foodService.getSuggestionsForMenu(newMenuId).subscribe(...)
  }

  // NUEVO: Método para volver al plan asignado por el Coach/Matriz
  resetToBaseline() {
    this.activeMenuForToday.set(this.baselineMenuId());
    console.log('🔄 PIVOT CANCELADO: Volviendo al plan sugerido:', this.baselineMenuId());
  }

  // ==========================================
  // PROTOCOLO: MOTOR DE LISTA DE COMPRAS
  // ==========================================

  manualSelections = signal<ManualMenuSelection[]>([]);

  // Este método reemplaza al anterior generateShoppingList()
  openShoppingListModal() {
    // 1. Inicializamos la vista manual con los menús en cantidad 1 y deseleccionados
    const initial = this.availableMenus().map((m) => ({
      menuId: m.id,
      selected: false,
      quantity: 1,
    }));
    this.manualSelections.set(initial);

    // 2. Abrimos el Drawer de Compras
    this.isShoppingListModalOpen.set(true);
  }

  getManualSelection(menuId: string): ManualMenuSelection | undefined {
    return this.manualSelections().find((s) => s.menuId === menuId);
  }

  toggleManualSelection(menuId: string) {
    this.manualSelections.update((sels) =>
      sels.map((s) => (s.menuId === menuId ? { ...s, selected: !s.selected } : s)),
    );
  }

  updateManualQuantity(menuId: string, delta: number, event: Event) {
    event.stopPropagation(); // Evitamos que el click del botón afecte otras áreas
    this.manualSelections.update((sels) =>
      sels.map((s) => {
        if (s.menuId === menuId) {
          const newQuantity = Math.max(1, s.quantity + delta);
          // Si sube la cantidad, marcamos el checkbox automáticamente por UX
          return { ...s, quantity: newQuantity, selected: true };
        }
        return s;
      }),
    );
  }

  generateFromWeekly() {
    console.log('Generando Lista desde Organización Semanal', this.weeklyTemplates());
    // TODO: Enviar a tu servicio/backend
    this.isShoppingListModalOpen.set(false);
  }

  generateFromManual() {
    const selected = this.manualSelections().filter((s) => s.selected);
    console.log('Generando Lista desde Selección Manual', selected);
    // TODO: Enviar a tu servicio/backend
    this.isShoppingListModalOpen.set(false);
  }

  // Catálogo de Menús Diarios y Plantillas Semanales reactivas desde IntakeService
  availableMenus = this.intakeService.availableMenus;
  weeklyTemplates = this.intakeService.weeklyPlans;


  openDayMenuIndex = signal<number | null>(null);

  // Definiciones de tipos de comida y configuración activa (mockup con las 5 opciones)
  mealDefinitions = MEAL_DEFINITIONS;

  // Formateadores culinarios para porciones e ingredientes sin decimales
  formatQuantity = formatQuantity;
  toFraction = toFraction;

  // Mapa de registro mock de alimentos (clave: fecha_idAlimento)
  loggedFoodMap = signal<Record<string, boolean>>({});
  additionalMockFoods = signal<Array<FoodItem & { targetDate: string }>>([]);

  getLogKey(foodId: string, date?: Date): string {
    const d = date || this.selectedDate();
    return `${this.formatDateYMD(d)}_${foodId}`;
  }

  isFoodLogged(foodId: string): boolean {
    return !!this.loggedFoodMap()[this.getLogKey(foodId)];
  }

  // Comidas reactivas sincronizadas con el menú del día seleccionado en el calendario
  foodItems = computed<FoodItem[]>(() => {
    const menu = this.currentDayMenu();
    const curDateStr = this.formatDateYMD(this.selectedDate());
    const items: FoodItem[] = [];

    if (menu) {
      if (menu.dishes && menu.dishes.length > 0) {
        for (const dish of menu.dishes) {
          const fid = `dish_${dish.dishId || dish.id}_${dish.mealType}`;
          items.push({
            id: fid,
            name: dish.name,
            emoji: determineCoverIcon(dish.name, dish.tags || [dish.mealType]),
            coverImageUrl: dish.coverImageUrl,
            mealType: (dish.mealType?.toUpperCase() as MealType) || 'LUNCH',
            portion: dish.portions || 1,
            unit: 'porción',
            kcal: Math.round(dish.totalCalories || 0),
            protein: Math.round(dish.totalProtein || 0),
            carbs: Math.round(dish.totalCarbs || 0),
            fat: Math.round(dish.totalFats || 0),
            isLogged: this.isFoodLogged(fid),
            dishItem: dish,
          });
        }
      }

      if (menu.looseIngredients && menu.looseIngredients.length > 0) {
        for (const ing of menu.looseIngredients) {
          const fid = `loose_${ing.id || ing.name}_${ing.mealType}`;
          items.push({
            id: fid,
            name: ing.name,
            emoji: determineCoverIcon(ing.name, [ing.mealType]),
            mealType: (ing.mealType?.toUpperCase() as MealType) || 'SNACK_PM',
            portion: ing.quantity || 1,
            unit: ing.unit || 'g',
            kcal: Math.round(ing.calories || 0),
            protein: Math.round(ing.protein || 0),
            carbs: Math.round(ing.carbs || 0),
            fat: Math.round(ing.fats || 0),
            isLogged: this.isFoodLogged(fid),
          });
        }
      }
    }

    const extra = this.additionalMockFoods()
      .filter((f) => f.targetDate === curDateStr)
      .map((f) => ({
        ...f,
        isLogged: this.isFoodLogged(f.id),
      }));

    items.push(...extra);
    return items;
  });

  configuredMealTypes = computed<MealType[]>(() => {
    const defaultTypes: MealType[] = ['BREAKFAST', 'SNACK_AM', 'LUNCH', 'SNACK_PM', 'DINNER'];
    const activeFoodMealTypes = new Set(this.foodItems().map((f) => f.mealType));
    const all = [...defaultTypes];
    for (const mt of ['SNACK_EXTRA', 'DRINK'] as MealType[]) {
      if (activeFoodMealTypes.has(mt) && !all.includes(mt)) {
        all.push(mt);
      }
    }
    return all;
  });

  // Cálculos de macros y calorías totales registrados (dinámicos para el scale-widget)
  totalLoggedCalories = computed(() =>
    Math.round(
      this.foodItems()
        .filter((f) => f.isLogged)
        .reduce((sum, f) => sum + f.kcal, 0),
    ),
  );

  totalLoggedProtein = computed(() =>
    Math.round(
      this.foodItems()
        .filter((f) => f.isLogged)
        .reduce((sum, f) => sum + f.protein, 0),
    ),
  );

  totalLoggedCarbs = computed(() =>
    Math.round(
      this.foodItems()
        .filter((f) => f.isLogged)
        .reduce((sum, f) => sum + f.carbs, 0),
    ),
  );

  totalLoggedFat = computed(() =>
    Math.round(
      this.foodItems()
        .filter((f) => f.isLogged)
        .reduce((sum, f) => sum + f.fat, 0),
    ),
  );

  getFoodsForMeal(type: MealType): FoodItem[] {
    return this.foodItems().filter((f) => f.mealType === type);
  }

  getMealTotals(type: MealType) {
    const foods = this.getFoodsForMeal(type);
    return {
      kcal: foods.reduce((sum, f) => sum + f.kcal, 0),
      protein: foods.reduce((sum, f) => sum + f.protein, 0),
      carbs: foods.reduce((sum, f) => sum + f.carbs, 0),
      fat: foods.reduce((sum, f) => sum + f.fat, 0),
      count: foods.length,
    };
  }

  // ==========================================
  // MODAL DE REGISTRO DE COMIDA (Nutritional Report)
  // ==========================================
  isRegisterModalOpen = signal<boolean>(false);
  targetFoodItem = signal<FoodItem | null>(null);
  selectedDishFor100 = signal<FoodItem | null>(null);
  uploadedPhotoUrl = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  isSubmittingFood = signal<boolean>(false);
  selectedMealType = signal<MealType>('LUNCH');
  selectedAdherence = signal<'100' | 'ADAPTATION' | 'FREE' | null>(null);
  notesText = signal<string>('');
  registeredRecords = signal<Record<string, any>>({});
  registerError = signal<string | null>(null);

  // ==========================================
  // MODAL DE HISTORIA COMPARTIBLE (Awakin Food Story)
  // ==========================================
  isStoryModalOpen = signal<boolean>(false);
  storyData = signal<StoryShareData | null>(null);
  showIngredientsInCard = signal<boolean>(false);
  cardScale = signal<number>(1);
  isGeneratingStory = signal<boolean>(false);
  storyShareSuccess = signal<string | null>(null);

  // Modal para compartir en Awakin Feed
  isShareFeedModalOpen = signal<boolean>(false);
  feedPostCaption = signal<string>('');
  feedPostPreviewBlob = signal<Blob | null>(null);
  feedPostPreviewUrl = signal<string | null>(null);
  isPublishingFeed = signal<boolean>(false);
  kinLogoDataUrl = signal<string | null>(null);

  availableDishesForSelectedDay = computed<FoodItem[]>(() => {
    return this.foodItems().filter((f) => !f.id.startsWith('mock_') && !f.id.startsWith('custom_'));
  });

  // Opciones de tipo de comida para el formulario (Desayuno, Almuerzo, Merienda, Cena, Bebida)
  modalMealOptions: { type: MealType; label: string; icon: string }[] = [
    { type: 'BREAKFAST', label: 'Desayuno', icon: 'pi pi-sun' },
    { type: 'LUNCH', label: 'Almuerzo', icon: 'pi pi-compass' },
    { type: 'SNACK_AM', label: 'Merienda', icon: 'pi pi-apple' },
    { type: 'DINNER', label: 'Cena', icon: 'pi pi-moon' },
    { type: 'DRINK', label: 'Bebida', icon: 'pi pi-filter' },
  ];

  // Opciones de evaluación de adherencia
  adherenceOptions = [
    {
      id: '100' as const,
      title: 'Sí, 100% en el plan',
      desc: 'Ingredientes y porciones exactas',
      pts: 10,
    },
    {
      id: 'ADAPTATION' as const,
      title: 'Adaptación de macros',
      desc: 'Sustituciones equivalentes que cuadran',
      pts: 5,
    },
    {
      id: 'FREE' as const,
      title: 'Comida libre / Fuera de plan',
      desc: 'No se ajusta a los requerimientos',
      pts: 2,
    },
  ];

  // Validación: foto obligatoria, tipo de comida obligatorio, evaluación de adherencia obligatoria.
  // Si es 100% en el plan y hay platillos disponibles, debe seleccionarse el platillo correspondiente.
  isRegisterFormValid = computed(() => {
    if (!this.uploadedPhotoUrl() || !this.selectedMealType() || !this.selectedAdherence()) {
      return false;
    }
    if (this.selectedAdherence() === '100') {
      const dishes = this.availableDishesForSelectedDay();
      if (dishes.length > 0 && !this.selectedDishFor100() && !this.targetFoodItem()) {
        return false;
      }
    }
    return true;
  });

  onAdherenceChange(adh: '100' | 'ADAPTATION' | 'FREE' | null) {
    this.selectedAdherence.set(adh);
    if (adh === '100') {
      if (!this.selectedDishFor100()) {
        if (this.targetFoodItem()) {
          this.selectDishFor100(this.targetFoodItem()!);
        } else {
          const match =
            this.availableDishesForSelectedDay().find((d) => d.mealType === this.selectedMealType()) ||
            this.availableDishesForSelectedDay()[0] ||
            null;
          if (match) {
            this.selectDishFor100(match);
          }
        }
      }
    }
  }

  selectDishFor100(dish: FoodItem) {
    this.selectedDishFor100.set(dish);
    this.selectedMealType.set(dish.mealType);
    this.notesText.set(`${dish.name} (${this.formatQuantity(dish.portion, dish.unit)})`);
  }

  // Handler al presionar el check de alguna receta:
  // - Si no está registrado ese día: se presenta obligatoriamente el formulario de registrar comida.
  // - Si ya está registrado: al hacer uncheck se deshabilita (is_active = false) sin borrarlo; un segundo check lo vuelve a habilitar.
  handleFoodCheckClick(food: FoodItem) {
    if (!this.canLogForSelectedDate()) {
      return;
    }

    const rec = this.registeredRecords()[food.id];
    const curDateStr = this.formatDateYMD(this.selectedDate());
    const idOriginal = `${curDateStr}_${food.id}`;
    const logKey = this.getLogKey(food.id);

    if (!rec) {
      this.openRegisterModal(food.mealType, food);
    } else {
      const nextActive = !food.isLogged;
      this.intakeService.updateFoodRecordStatus(idOriginal, nextActive).subscribe({
        next: () => {
          this.registeredRecords.update((curr) => ({
            ...curr,
            [food.id]: { ...(curr[food.id] || {}), is_active: nextActive },
          }));
          this.loggedFoodMap.update((map) => ({
            ...map,
            [logKey]: nextActive,
          }));
        },
        error: (err) => {
          console.error('Error actualizando is_active en registros_nutricionales_pruebas:', err);
          this.registeredRecords.update((curr) => ({
            ...curr,
            [food.id]: { ...(curr[food.id] || {}), is_active: nextActive },
          }));
          this.loggedFoodMap.update((map) => ({
            ...map,
            [logKey]: nextActive,
          }));
        },
      });
    }
  }

  // Abrir modal de registro
  openRegisterModal(mealType?: MealType, food?: FoodItem) {
    if (!this.canLogForSelectedDate()) {
      return;
    }
    this.registerError.set(null);
    this.targetFoodItem.set(food || null);
    this.selectedDishFor100.set(food || null);
    this.selectedMealType.set(food ? food.mealType : (mealType || 'LUNCH'));
    this.uploadedPhotoUrl.set(null);
    this.selectedFile.set(null);
    this.selectedAdherence.set(food ? '100' : null);
    this.notesText.set(food ? `${food.name} (${this.formatQuantity(food.portion, food.unit)})` : '');
    this.isRegisterModalOpen.set(true);
  }

  // Manejar selección de foto desde input file
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.registerError.set(null);
      const file = input.files[0];
      this.selectedFile.set(file);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.uploadedPhotoUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // Remover foto seleccionada
  removePhoto() {
    this.uploadedPhotoUrl.set(null);
    this.selectedFile.set(null);
    this.registerError.set(null);
  }

  // Foto de prueba para agilizar testing
  useDemoPhoto() {
    this.registerError.set(null);
    this.uploadedPhotoUrl.set(
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    );
    this.selectedFile.set(null);
  }

  // Enviar reporte y registrar comida en Supabase Storage (Intake_Food_Report) y registros_nutricionales_pruebas
  async submitRegisterFood() {
    if (!this.canLogForSelectedDate() || !this.isRegisterFormValid() || this.isSubmittingFood()) return;

    this.registerError.set(null);
    this.isSubmittingFood.set(true);
    try {
      const curDateStr = this.formatDateYMD(this.selectedDate());
      const athlete = this.athleteService.currentAthlete();
      const email = athlete?.email || this.authService.currentSession()?.avatar?.email || 'heydi0811@gmail.com';
      const athleteName = athlete?.first_name
        ? `${athlete.first_name} ${athlete.last_name || ''}`.trim()
        : (athlete?.username || 'Atleta');
      const athleteId = this.currentAthleteId() || 'ath';

      // 1. Subir imagen al bucket Intake_Food_Report de Supabase
      let photoUrl = this.uploadedPhotoUrl() || '';
      const file = this.selectedFile();
      if (file) {
        try {
          photoUrl = await this.intakeService.uploadFoodReportImage(file, athleteId);
        } catch (uploadErr: any) {
          console.error('Error subiendo imagen al bucket Intake_Food_Report:', uploadErr);
          const detailMsg = uploadErr?.message || uploadErr?.error?.detail || 'Error subiendo la foto a Supabase Storage.';
          this.registerError.set(`No se pudo subir la foto: ${detailMsg}. Asegúrate de crear el bucket "Intake_Food_Report" en Supabase Storage.`);
          this.isSubmittingFood.set(false);
          return; // DETIENE EL REGISTRO: no se guarda en la base de datos si la foto falló
        }
      }

      // Validar que la foto no sea una cadena base64 local si se seleccionó archivo
      if (file && (!photoUrl || photoUrl.startsWith('data:'))) {
        this.registerError.set('La foto no pudo guardarse en Supabase Storage. El registro ha sido cancelado.');
        this.isSubmittingFood.set(false);
        return;
      }

      // 2. Determinar platillo vinculado
      const targetDish =
        this.selectedAdherence() === '100'
          ? (this.selectedDishFor100() || this.targetFoodItem())
          : (this.targetFoodItem() || null);

      const chosenMealType = targetDish ? targetDish.mealType : this.selectedMealType();
      const foodId = targetDish ? targetDish.id : `custom_${Date.now()}`;
      const idOriginal = `${curDateStr}_${foodId}`;

      const calories = targetDish ? targetDish.kcal : 450;
      const protein = targetDish ? targetDish.protein : 35;
      const carbs = targetDish ? targetDish.carbs : 45;
      const fat = targetDish ? targetDish.fat : 14;
      const dishTitle = targetDish
        ? targetDish.name
        : (this.notesText()?.trim() || `Registro de ${chosenMealType}`);

      // 3. Obtener lista de ingredientes del platillo (con cantidades optimizadas si el optimizador está activo)
      let formattedIngredients: any[] | null = null;
      if (targetDish && targetDish.dishItem) {
        const dish = targetDish.dishItem;
        const activeDish = (dish.isOptimizerActive && dish.optimizerTargets)
          ? applyOptimizationToDish(dish)
          : dish;

        formattedIngredients = (activeDish.ingredients || []).map((di: any) => {
          const raw = di.rawIngredientObj || {};
          const ingObj = {
            id: di.ingredient_id || raw.id || di.id,
            name: di.name || raw.name || 'Ingrediente',
            unit: di.unit || raw.unit || 'g',
            calories: Number(di.calories ?? raw.calories ?? 0),
            protein: Number(di.protein ?? raw.protein ?? 0),
            carbs: Number(di.carbs ?? raw.carbs ?? 0),
            fats: Number(di.fats ?? raw.fats ?? 0),
            serving_size: Number(di.serving_size ?? raw.serving_size ?? 100),
            unit_weight_grams: Number(di.unit_weight_grams ?? raw.unit_weight_grams ?? (di.serving_size ?? 100)),
          };

          const grams = getGramsForQuantity(ingObj, Number(di.quantity || 0), di.mode);
          const macros = calculateIngredientMacros(ingObj, Number(di.quantity || 0), di.mode);
          const displayQty = formatQuantity(Number(di.quantity || 0), di.unit || ingObj.unit, di.mode);

          return {
            nombre: ingObj.name,
            cantidad_display: displayQty,
            cantidad_original: Number(di.quantity || 0),
            unidad_original: di.unit || ingObj.unit || 'g',
            modo: di.mode || 'g',
            cantidad_g: Math.round(grams * 10) / 10,
            kcals: Math.round(macros.calories),
            proteinas_g: Math.round(macros.protein * 10) / 10,
            grasas_g: Math.round(macros.fat * 10) / 10,
            carbohidratos_g: Math.round(macros.carbs * 10) / 10,
          };
        });
      }

      // 4. Crear registro en tabla public.registros_nutricionales_pruebas
      const recordPayload = {
        id_original: idOriginal,
        email: email,
        nombre: athleteName,
        tipo_comida: chosenMealType,
        adherencia: this.selectedAdherence(),
        foto_url: photoUrl,
        notas: this.notesText()?.trim() || null,
        is_active: true,
        calorias: calories,
        proteinas: protein,
        carbohidratos: carbs,
        grasas: fat,
        plato_estimado: dishTitle,
        ingredientes: formattedIngredients,
      };

      await this.intakeService.createFoodRecord(recordPayload).toPromise();

      // 4. Si era custom (fuera de menú), añadirlo a additionalMockFoods
      if (!targetDish) {
        const newFood: FoodItem & { targetDate: string } = {
          id: foodId,
          targetDate: curDateStr,
          name: dishTitle,
          emoji:
            chosenMealType === 'BREAKFAST'
              ? '🍳'
              : chosenMealType === 'LUNCH'
                ? '🍲'
                : chosenMealType === 'DINNER'
                  ? '🥗'
                  : chosenMealType === 'DRINK'
                    ? '🥤'
                    : '🥪',
          mealType: chosenMealType,
          portion: 1,
          unit: 'porción',
          kcal: calories,
          protein: protein,
          carbs: carbs,
          fat: fat,
          isLogged: true,
        };
        this.additionalMockFoods.update((items) => [...items, newFood]);
      }

      // 5. Actualizar mapas reactivos locales
      const logKey = this.getLogKey(foodId);
      this.registeredRecords.update((curr) => ({
        ...curr,
        [foodId]: recordPayload,
      }));
      this.loggedFoodMap.update((map) => ({ ...map, [logKey]: true }));

      const localPhotoData = this.uploadedPhotoUrl() || photoUrl || '';

      // Cerrar modal
      this.isRegisterModalOpen.set(false);
      this.targetFoodItem.set(null);
      this.selectedDishFor100.set(null);
      this.selectedFile.set(null);
      this.uploadedPhotoUrl.set(null);
      this.selectedAdherence.set(null);
      this.notesText.set('');

      // 6. Abrir automáticamente la vista de Historia para compartir
      this.openStoryShareModal({
        photoUrl: localPhotoData,
        dateFormatted: this.getStoryDateFormatted(this.selectedDate()),
        mealTitle: this.mealDefinitions[chosenMealType]?.title || chosenMealType,
        dishName: dishTitle,
        emoji:
          targetDish?.emoji ||
          (chosenMealType === 'BREAKFAST' ? '🍳' : chosenMealType === 'LUNCH' ? '🍲' : '🥗'),
        portionText: `${targetDish ? targetDish.portion : 1} ${targetDish ? targetDish.unit : 'porción'}`,
        kcal: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        ingredients: formattedIngredients,
        dishId: targetDish?.id,
      });
    } catch (err: any) {
      console.error('Error guardando en registros_nutricionales_pruebas:', err);
      const detail = err?.error?.detail || err?.message || 'Error guardando en la base de datos.';
      this.registerError.set(`Error al guardar en registros nutricionales: ${detail}`);
    } finally {
      this.isSubmittingFood.set(false);
    }
  }

  // ==========================================
  // MÉTODOS DE HISTORIA Y COMPARTIR
  // ==========================================

  getStoryDateFormatted(date?: Date): string {
    const d = date || this.selectedDate();
    const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d);
    const dayNum = d.getDate();
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d);
    const cleanDay = dayName.replace('.', '');
    return `${cleanDay}, ${dayNum} de ${monthName}`;
  }

  async toDataUrl(url: string): Promise<string> {
    if (!url || url.startsWith('data:')) return url;
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve(url);
          }
        };
        img.onerror = () => resolve(url);
        img.src = url;
      });
    }
  }

  async openStoryShareModal(data: StoryShareData) {
    this.storyData.set(data);
    this.showIngredientsInCard.set(false);
    this.cardScale.set(1);
    this.storyShareSuccess.set(null);
    this.isStoryModalOpen.set(true);

    if (data.photoUrl && !data.photoUrl.startsWith('data:')) {
      const safeUrl = await this.toDataUrl(data.photoUrl);
      if (this.storyData()?.photoUrl === data.photoUrl) {
        this.storyData.update((curr) => (curr ? { ...curr, photoUrl: safeUrl } : null));
      }
    }

    if (this.athleteKin()?.team_logo_url) {
      this.toDataUrl(this.athleteKin()!.team_logo_url!).then((safeKinLogo) => {
        this.kinLogoDataUrl.set(safeKinLogo);
      });
    } else {
      this.kinLogoDataUrl.set(null);
    }
  }

  openStoryForFood(food: FoodItem, event?: Event) {
    if (event) event.stopPropagation();
    const rec = this.registeredRecords()[food.id];
    const photoUrl =
      rec?.foto_url ||
      food.coverImageUrl ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';

    let formattedIngs: any[] | null = null;
    const dish = food.dishItem;
    if (dish && dish.ingredients && dish.ingredients.length > 0) {
      const activeDish = dish.isOptimizerActive && dish.optimizerTargets ? applyOptimizationToDish(dish) : dish;
      formattedIngs = (activeDish.ingredients || []).map((di: any) => {
        const raw = di.rawIngredientObj || {};
        const ingObj = {
          id: di.ingredient_id || raw.id || di.id,
          name: di.name || raw.name || 'Ingrediente',
          unit: di.unit || raw.unit || 'g',
          calories: Number(di.calories ?? raw.calories ?? 0),
          protein: Number(di.protein ?? raw.protein ?? 0),
          carbs: Number(di.carbs ?? raw.carbs ?? 0),
          fats: Number(di.fats ?? raw.fats ?? 0),
          serving_size: Number(di.serving_size ?? raw.serving_size ?? 100),
          unit_weight_grams: Number(di.unit_weight_grams ?? raw.unit_weight_grams ?? (di.serving_size ?? 100)),
        };

        const grams = getGramsForQuantity(ingObj, Number(di.quantity || 0), di.mode);
        const macros = calculateIngredientMacros(ingObj, Number(di.quantity || 0), di.mode);
        const displayQty = formatQuantity(Number(di.quantity || 0), di.unit || ingObj.unit, di.mode);

        return {
          nombre: ingObj.name,
          cantidad_display: displayQty,
          cantidad_original: Number(di.quantity || 0),
          unidad_original: di.unit || ingObj.unit || 'g',
          modo: di.mode || 'g',
          cantidad_g: Math.round(grams * 10) / 10,
          kcals: Math.round(macros.calories),
          proteinas_g: Math.round(macros.protein * 10) / 10,
          grasas_g: Math.round(macros.fat * 10) / 10,
          carbohidratos_g: Math.round(macros.carbs * 10) / 10,
        };
      });
    } else if (rec && rec.ingredientes && Array.isArray(rec.ingredientes)) {
      formattedIngs = rec.ingredientes;
    }

    this.openStoryShareModal({
      photoUrl: photoUrl,
      dateFormatted: this.getStoryDateFormatted(this.selectedDate()),
      mealTitle: this.mealDefinitions[food.mealType]?.title || food.mealType,
      dishName: food.name,
      emoji: food.emoji,
      portionText: `${food.portion} ${food.unit}`,
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      ingredients: formattedIngs,
      dishId: food.dishItem?.id || food.id,
    });
  }

  adjustCardScale(delta: number) {
    this.cardScale.update((s) => {
      const next = Math.round((s + delta) * 10) / 10;
      return Math.min(1.4, Math.max(0.7, next));
    });
  }

  resetCardScale() {
    this.cardScale.set(1);
  }

  async generateStoryBlob(): Promise<Blob | null> {
    const element = document.getElementById('storyCanvas');
    if (!element) return null;

    this.isGeneratingStory.set(true);
    try {
      const blob = await htmlToImage.toBlob(element, {
        pixelRatio: 2,
        backgroundColor: '#000000',
        cacheBust: false,
      });
      if (blob) return blob;

      const dataUrl = await htmlToImage.toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#000000',
        cacheBust: false,
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('Error generating story image with html-to-image:', err);
      return null;
    } finally {
      this.isGeneratingStory.set(false);
    }
  }

  async saveStoryToGallery() {
    this.storyShareSuccess.set('Preparando descarga...');
    const blob = await this.generateStoryBlob();
    if (!blob) {
      this.storyShareSuccess.set('Error al generar la imagen.');
      setTimeout(() => this.storyShareSuccess.set(null), 3500);
      return;
    }

    const filename = `awakin-comida-${Date.now()}.png`;

    // 1. Descarga directa en navegador (100% confiable en PC, Android y navegadores)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    // 2. Si es dispositivo móvil y soporta compartir archivos, ofrecerlo para guardar en carrete
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const file = new File([blob], filename, { type: 'image/png' });
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Mi Comida Awakin',
        });
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    this.storyShareSuccess.set('¡Imagen descargada con éxito!');
    setTimeout(() => this.storyShareSuccess.set(null), 3500);
  }

  async openSocialFeedModal() {
    this.isGeneratingStory.set(true);
    this.storyShareSuccess.set('Preparando publicación...');
    try {
      const blob = await this.generateStoryBlob();
      if (!blob) {
        this.storyShareSuccess.set('Error preparando la imagen.');
        setTimeout(() => this.storyShareSuccess.set(null), 3500);
        return;
      }

      this.feedPostPreviewBlob.set(blob);
      if (this.feedPostPreviewUrl()) {
        URL.revokeObjectURL(this.feedPostPreviewUrl()!);
      }
      this.feedPostPreviewUrl.set(URL.createObjectURL(blob));

      const data = this.storyData();
      const defaultCaption = `🍽️ ${data?.mealTitle || 'Comida'}: ${data?.dishName || 'Platillo'} (${data?.kcal || 0} kcal · ${data?.protein || 0}P ${data?.carbs || 0}C ${data?.fat || 0}G)`;
      this.feedPostCaption.set(defaultCaption);
      this.storyShareSuccess.set(null);
      this.isShareFeedModalOpen.set(true);
    } finally {
      this.isGeneratingStory.set(false);
    }
  }

  async confirmPublishFeed() {
    const athleteId = this.currentAthleteId();
    const blob = this.feedPostPreviewBlob();
    if (!athleteId || !blob || this.isPublishingFeed()) return;

    this.isPublishingFeed.set(true);
    try {
      const filename = `story_feed_${Date.now()}.png`;
      const uploadRes = await this.athleteService.uploadMedia(blob, 'feed_posts', filename).toPromise();
      const mediaUrl = uploadRes?.public_url || this.storyData()?.photoUrl || '';

      const caption = this.feedPostCaption()?.trim() || '';
      await this.athleteService
        .createPost(athleteId, {
          media_url: mediaUrl,
          caption: caption,
          module_source: 'intake',
          related_intake_dish_id: this.storyData()?.dishId || undefined,
        })
        .toPromise();

      this.isShareFeedModalOpen.set(false);
      this.storyShareSuccess.set('¡Publicado con éxito en tu Feed de Awakin!');
      setTimeout(() => this.storyShareSuccess.set(null), 4000);
    } catch (err) {
      console.error('Error publicando en feed de Awakin:', err);
      this.storyShareSuccess.set('Error al publicar en el feed.');
      setTimeout(() => this.storyShareSuccess.set(null), 4000);
    } finally {
      this.isPublishingFeed.set(false);
    }
  }

  async shareStoryWhatsApp() {
    const blob = await this.generateStoryBlob();
    const data = this.storyData();
    const text = `🍽️ Mi comida en Awakin Protocol:\n${data?.mealTitle}: ${data?.dishName}\n🔥 ${data?.kcal} kcal | ${data?.protein}g P | ${data?.carbs}g C | ${data?.fat}g G`;

    if (blob && navigator.canShare) {
      const file = new File([blob], 'comida-awakin.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Awakin Protocol',
            text: text,
          });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }
    }

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  async shareStoryNative(type?: string) {
    const blob = await this.generateStoryBlob();
    if (!blob) return;

    const file = new File([blob], 'historia-awakin.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Historia Awakin',
          text: `Awakin Protocol - ${this.storyData()?.dishName}`,
        });
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    } else {
      await this.saveStoryToGallery();
    }
  }

  @ViewChild(WeekCalendarHeaderComponent) calendar!: WeekCalendarHeaderComponent;
  updateLabel(label: string) {
    this.currentLabel.set(label);
  }

  handleTopBtnAction() {
    // 1. Ejecutamos la acción interna del hijo (Volver a hoy)
    this.calendar.goToToday();
    console.log('El padre controla esta acción para:', this.currentLabel());
    // Aquí podrías abrir el calendario de PrimeNG, cambiar de vista, etc.
  }

  toggleCalendarViewMode() {
    this.calendar.toggleViewMode(); // Ejecuta el cambio en el hijo
  }

  ngOnInit() {
    this.generateCurrentWeek(); // <--- Generar fechas reales al iniciar
    this.initChart();
    this.intakeService.loadAvailableMenus().subscribe();

    const athleteId = this.currentAthleteId();
    if (athleteId) {
      if (!this.athleteService.currentAthlete()) {
        this.athleteService.loadAthleteProfile(athleteId);
      }
      this.intakeService.loadWeeklyPlansForAthlete(athleteId).subscribe((plans) => {
        if (plans.length > 0 && !this.activeTemplateId()) {
          this.activeTemplateId.set(plans[0].id);
        }
      });
    } else {
      this.athleteService.loadInitialAthletes();
    }
  }


  // Lógica para generar la semana actual real
  generateCurrentWeek() {
    const today = new Date(); // Fecha real del sistema
    const currentDay = today.getDay(); // 0 (Domingo) a 6 (Sábado)

    // Calcular la diferencia para llegar al Lunes (considerando Domingo como día 7 para el cálculo)
    const diff = currentDay === 0 ? 6 : currentDay - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - diff); // Restamos días para volver al Lunes

    const days: CalendarDay[] = [];
    const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      // Comparamos sin hora para saber si es "HOY"
      const isToday = d.toDateString() === today.toDateString();

      days.push({
        date: d.getDate(), // Número del día (ej: 15)
        dayName: dayNames[i],
        fullDate: d, // Guardamos la fecha completa para futuras comparaciones o usos
        // Lógica simulada de estado (esto vendría de BD)
        status: isToday ? 'none' : i < 4 ? 'none' : 'future',
      });
    }
    this.weekDays.set(days);
  }

  initChart() {
    const documentStyle = getComputedStyle(document.documentElement);
    const colorSun = documentStyle.getPropertyValue('--color-awakin-sun') || '#FE970A';
    const colorIntake = documentStyle.getPropertyValue('--color-module-intake') || '#3E9F31';
    const colorAvatar = documentStyle.getPropertyValue('--color-module-avatar') || '#C0392B';

    this.macroData = {
      labels: ['Proteína', 'Carbohidratos', 'Grasas'],
      datasets: [
        {
          data: [120, 210, 45],
          backgroundColor: [colorIntake, colorSun, colorAvatar],
          hoverBackgroundColor: [colorIntake, colorSun, colorAvatar],
          borderWidth: 5,
          borderRadius: 4,
          cutout: '60%',
        },
      ],
    };

    this.macroOptions = {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateScale: true, animateRotate: true },
    };
  }

  handleDaySelect(selectedDay: CalendarDay) {
    // Al seleccionar, marcamos visualmente
    // this.weekDays.update(days => days.map(d => ({
    //   ...d,
    //   isToday: d.date === selectedDay.date // Truco visual: hacemos que el seleccionado se comporte como "hoy" para el estilo
    // })));
    this.selectedDay.set(selectedDay);
  }

  handleMonthView() {
    console.log('Abrir calendario completo');
  }

  // Lógica para marcar/desmarcar alimento consumido en mock frontend
  toggleFoodLog(item: FoodItem) {
    if (!this.canLogForSelectedDate()) {
      return;
    }
    const key = this.getLogKey(item.id);
    this.loggedFoodMap.update((map) => ({
      ...map,
      [key]: !map[key],
    }));
  }

  // 1. Opciones de ingesta (Protocolo de Categorías)
  mealCategories = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];

  // 2. Control del menú activo
  openMenuId = signal<string | null>(null);

  // 3. Método para abrir/cerrar el menú
  toggleCategoryMenu(foodId: string, event: Event) {
    event.stopPropagation(); // Evitamos que el click afecte a elementos padre
    this.openMenuId.update((current) => (current === foodId ? null : foodId));
  }

  // 4. Método para aplicar el cambio
  changeCategory(foodId: string, newCategory: string, event: Event) {
    event.stopPropagation();
    this.additionalMockFoods.update((items) =>
      items.map((item) => (item.id === foodId ? { ...item, category: newCategory } : item)),
    );
    this.openMenuId.set(null); // Cerramos el menú tras elegir
  }
}
