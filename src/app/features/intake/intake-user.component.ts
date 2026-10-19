import { Component, computed, OnInit, signal, ViewChild, inject, effect } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import {
  CalendarDay,
  WeekCalendarHeaderComponent,
} from '../../components/week-calendar/week-calendar-header.component';
import { IntakeScaleWidgetComponent } from './components/intake-scale-widget/intake-scale-widget';
import { ProtocolMatrixDrawer } from './components/protocol-matrix-drawer/protocol-matrix-drawer';
import { ShoppingListDrawer } from './components/shopping-list-drawer/shopping-list-drawer';
import { WeeklyTemplate, MenuPlan, DayAssignment, ManualMenuSelection } from './models/intake.models';
import { FormsModule } from '@angular/forms';
import { IntakeService, determineCoverIcon } from '../../core/services/intake.service';
import { AthleteService } from '../../core/services/athlete.service';
import { AuthService } from '../../core/services/auth.service';
import { formatQuantity, toFraction } from '../../core/helpers/nutrition-optimizer';
import { IntakeTopBar } from '../../components/intake-top-bar/intake-top-bar';

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

  currentAthleteId = computed(() => {
    return (
      this.athleteService.currentAthlete()?.id ||
      this.authService.currentSession()?.avatar?.id ||
      localStorage.getItem('awakin_active_athlete_id')
    );
  });

  activeTemplateId = signal<string | null>(null);

  streak = signal<number>(12);
  weekDays = signal<CalendarDay[]>([]); // Se llenará dinámicamente
  selectedDay = signal<CalendarDay | null>(null);
  selectedDate = signal<Date>(new Date());
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

  // Protocolo de Set Points reactivos según el menú asignado del día
  minBasal = computed(() => {
    const menu = this.currentDayMenu();
    return menu ? Math.round(menu.kcal * 0.6) : 700;
  });

  targetGoal = computed(() => {
    const menu = this.currentDayMenu();
    return menu ? menu.kcal : 885;
  });

  maintenanceLevel = computed(() => {
    const menu = this.currentDayMenu();
    return menu ? Math.round(menu.kcal * 1.2) : 1500;
  });

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

  // Cálculos de macros totales registrados (dinámicos para el scale-widget)
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
  uploadedPhotoUrl = signal<string | null>(null);
  selectedMealType = signal<MealType>('LUNCH');
  selectedAdherence = signal<'100' | 'ADAPTATION' | 'FREE' | null>('100');
  notesText = signal<string>('');

  // Opciones de tipo de comida para el formulario (mockup: Desayuno, Almuerzo, Merienda, Cena, Bebida)
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

  // Validación: foto obligatoria, tipo de comida obligatorio, evaluación de adherencia obligatoria
  isRegisterFormValid = computed(() => {
    return (
      !!this.uploadedPhotoUrl() &&
      !!this.selectedMealType() &&
      !!this.selectedAdherence()
    );
  });

  // Handler al presionar el check de alguna receta
  handleFoodCheckClick(food: FoodItem) {
    this.toggleFoodLog(food);
  }

  // Abrir modal de registro
  openRegisterModal(mealType?: MealType, food?: FoodItem) {
    this.targetFoodItem.set(food || null);
    this.selectedMealType.set(food ? food.mealType : (mealType || 'LUNCH'));
    this.uploadedPhotoUrl.set(null);
    this.selectedAdherence.set('100');
    this.notesText.set(food ? `${food.name} (${this.formatQuantity(food.portion, food.unit)})` : '');
    this.isRegisterModalOpen.set(true);
  }

  // Manejar selección de foto desde input file
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
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
  }

  // Foto de prueba para agilizar testing
  useDemoPhoto() {
    this.uploadedPhotoUrl.set(
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    );
  }

  // Enviar reporte y registrar comida/bebida mock
  submitRegisterFood() {
    if (!this.isRegisterFormValid()) return;

    const target = this.targetFoodItem();
    if (target) {
      // Marcar como consumido el alimento específico
      const key = this.getLogKey(target.id);
      this.loggedFoodMap.update((map) => ({ ...map, [key]: true }));
    } else {
      // Registrar un nuevo alimento en la comida elegida
      const def = this.mealDefinitions[this.selectedMealType()];
      const curDateStr = this.formatDateYMD(this.selectedDate());
      const newFood: FoodItem & { targetDate: string } = {
        id: 'mock_' + Date.now().toString(),
        targetDate: curDateStr,
        name: this.notesText()?.trim() || `Registro de ${def.title}`,
        emoji:
          this.selectedMealType() === 'BREAKFAST'
            ? '🍳'
            : this.selectedMealType() === 'LUNCH'
              ? '🍲'
              : this.selectedMealType() === 'DINNER'
                ? '🥗'
                : this.selectedMealType() === 'DRINK'
                  ? '🥤'
                  : '🥪',
        mealType: this.selectedMealType(),
        portion: 1,
        unit: 'porción',
        kcal: 450,
        protein: 35,
        carbs: 45,
        fat: 14,
        isLogged: true,
      };
      this.additionalMockFoods.update((items) => [...items, newFood]);
      const key = this.getLogKey(newFood.id);
      this.loggedFoodMap.update((map) => ({ ...map, [key]: true }));
    }

    this.isRegisterModalOpen.set(false);
    this.targetFoodItem.set(null);
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
