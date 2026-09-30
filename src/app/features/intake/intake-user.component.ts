import { Component, computed, OnInit, signal, ViewChild } from '@angular/core';
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
import { WeeklyTemplate } from './models/intake.models';
import { FormsModule } from '@angular/forms';
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
}

// 1. INTERFACES ACTUALIZADAS (Arriba en tu archivo)
export interface MenuPlan {
  id: string;
  name: string; // Ej: "Menú 1"
  coverIcon: string; // Para darle identidad visual (Emoji o URL de img)
  tags: string[]; // Ej: ['Alta Demanda', 'Low Carb']
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
  streak = signal<number>(12);
  weekDays = signal<CalendarDay[]>([]); // Se llenará dinámicamente
  selectedDay = signal<CalendarDay | null>(null);
  // Datos Gráfico
  macroData: any;
  macroOptions: any;
  caloriesTarget = 2200;

  // Protocolo de Set Points (Normalmente vendrían de un ProfileService)
  minBasal = signal(700); // Punto A
  targetGoal = signal(885); // Punto B
  maintenanceLevel = signal(1500); // Punto C

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

  // 1. Datos del Coach (Menús Agnósticos con Tags)
  availableMenus = signal<MenuPlan[]>([
    {
      id: '1',
      name: 'Menú 1',
      coverIcon: '🥩',
      tags: ['Alta Demanda', 'Día de Entrenamiento'],
      kcal: 2800,
      macros: '200P • 300C • 80G',
    },
    {
      id: '2',
      name: 'Menú 2',
      coverIcon: '🥗',
      tags: ['Descanso', 'Low Carb'],
      kcal: 1900,
      macros: '160P • 100C • 60G',
    },
    {
      id: '3',
      name: 'Menú 3',
      coverIcon: '🥑',
      tags: ['Mantenimiento', 'Equilibrado'],
      kcal: 2400,
      macros: '180P • 200C • 70G',
    },
  ]);

  // ==========================================
  // ESTADO GLOBAL: PLANTILLAS SEMANALES (Protocolos)
  // ==========================================
  weeklyTemplates = signal<WeeklyTemplate[]>([
    {
      id: 'coach-t1',
      name: 'Semana 1 y 2 (Adaptación)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lunes', menuId: '1' },
        { dayName: 'Martes', menuId: '1' },
        { dayName: 'Miércoles', menuId: '3' },
        { dayName: 'Jueves', menuId: '2' },
        { dayName: 'Viernes', menuId: '1' },
        { dayName: 'Sábado', menuId: '2' },
        { dayName: 'Domingo', menuId: '2' },
      ],
    },
    {
      id: 'coach-t2',
      name: 'Semana 3 y 4 (Sobrecarga)',
      isFromCoach: true,
      assignments: [
        { dayName: 'Lunes', menuId: '1' },
        { dayName: 'Martes', menuId: '3' },
        { dayName: 'Miércoles', menuId: '1' },
        { dayName: 'Jueves', menuId: '3' },
        { dayName: 'Viernes', menuId: '1' },
        { dayName: 'Sábado', menuId: '2' },
        { dayName: 'Domingo', menuId: '3' },
      ],
    },
  ]);

  openDayMenuIndex = signal<number | null>(null);

  // Definiciones de tipos de comida y configuración activa (mockup con las 5 opciones)
  mealDefinitions = MEAL_DEFINITIONS;

  configuredMealTypes = signal<MealType[]>([
    'BREAKFAST',
    'SNACK_AM',
    'LUNCH',
    'SNACK_PM',
    'DINNER',
  ]);

  // Señal con las comidas del día agrupadas por MealType (Sugerencias + Registradas)
  foodItems = signal<FoodItem[]>([
    {
      id: '1',
      name: 'Pechuga de Pavo con Tostadas',
      emoji: '🥪',
      mealType: 'BREAKFAST',
      portion: 2,
      unit: 'tostadas (180g)',
      kcal: 290,
      protein: 26,
      carbs: 32,
      fat: 6,
      isLogged: true,
    },
    {
      id: '2',
      name: 'Huevos Revueltos con Aguacate',
      emoji: '🍳',
      mealType: 'BREAKFAST',
      portion: 2,
      unit: 'huevos',
      kcal: 310,
      protein: 18,
      carbs: 4,
      fat: 24,
      isLogged: true,
    },
    {
      id: '3',
      name: 'Bowl de Avena con Whey y Frutos Rojos',
      emoji: '🥣',
      mealType: 'SNACK_AM',
      portion: 120,
      unit: 'g',
      kcal: 320,
      protein: 25,
      carbs: 40,
      fat: 8,
      isLogged: true,
    },
    {
      id: '4',
      name: 'Pechuga De Pollo Con Pasta Y Tomate',
      emoji: '🍗',
      mealType: 'LUNCH',
      portion: 1,
      unit: 'porción (456 g)',
      kcal: 549,
      protein: 44,
      carbs: 50,
      fat: 19,
      isLogged: true,
    },
    {
      id: '5',
      name: 'Omelet De Huevo Y Claras Con Papa',
      emoji: '🥚',
      mealType: 'DINNER',
      portion: 1,
      unit: 'porción (489 g)',
      kcal: 370,
      protein: 29,
      carbs: 34,
      fat: 13,
      isLogged: false,
    },
  ]);

  // Cálculos de macros totales registrados (dinámicos para el scale-widget)
  totalLoggedProtein = computed(() =>
    this.foodItems()
      .filter((f) => f.isLogged)
      .reduce((sum, f) => sum + f.protein, 0),
  );

  totalLoggedCarbs = computed(() =>
    this.foodItems()
      .filter((f) => f.isLogged)
      .reduce((sum, f) => sum + f.carbs, 0),
  );

  totalLoggedFat = computed(() =>
    this.foodItems()
      .filter((f) => f.isLogged)
      .reduce((sum, f) => sum + f.fat, 0),
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
    if (food.isLogged) {
      // Si ya estaba marcada, la desmarca directamente
      this.toggleFoodLog(food);
    } else {
      // Si no estaba marcada, abre primero el modal para registrar
      this.openRegisterModal(food.mealType, food);
    }
  }

  // Abrir modal de registro
  openRegisterModal(mealType?: MealType, food?: FoodItem) {
    this.targetFoodItem.set(food || null);
    this.selectedMealType.set(food ? food.mealType : (mealType || 'LUNCH'));
    this.uploadedPhotoUrl.set(null);
    this.selectedAdherence.set('100');
    this.notesText.set(food ? `${food.name} (${food.portion} ${food.unit})` : '');
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

  // Enviar reporte y registrar comida/bebida
  submitRegisterFood() {
    if (!this.isRegisterFormValid()) return;

    const target = this.targetFoodItem();
    if (target) {
      // Marcar como consumido el alimento específico
      this.foodItems.update((items) =>
        items.map((i) => (i.id === target.id ? { ...i, isLogged: true } : i)),
      );
    } else {
      // Registrar un nuevo alimento en la comida elegida
      const def = this.mealDefinitions[this.selectedMealType()];
      const newFood: FoodItem = {
        id: Date.now().toString(),
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
      this.foodItems.update((items) => [...items, newFood]);
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

  // 3. NUEVO: Lógica para marcar/desmarcar la comida
  toggleFoodLog(item: FoodItem) {
    this.foodItems.update((items) =>
      items.map((i) => (i.id === item.id ? { ...i, isLogged: !i.isLogged } : i)),
    );
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
    this.foodItems.update((items) =>
      items.map((item) => (item.id === foodId ? { ...item, category: newCategory } : item)),
    );
    this.openMenuId.set(null); // Cerramos el menú tras elegir
  }
}
