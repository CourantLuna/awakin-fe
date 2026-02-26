import { Component, OnInit, signal, ViewChild } from '@angular/core';
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

// 1. NUEVO: Definición estricta del modelo de comida
export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  category: string; // 'Desayuno' | 'Almuerzo' | 'Merienda' | 'Cena'
  portion: number;
  unit: string; // 'unidades', 'g', 'porción', 'ml'
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  isLogged: boolean; // Controla si es sugerencia (false) o registrado (true)
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

  // 2. CONTROL DE DRAWERS
  isMatrixOpen = signal<boolean>(false);
  isShoppingListModalOpen = signal<boolean>(false);

  openFuelMatrix() {
    this.isMatrixOpen.set(true);
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
    console.log('Generando Lista desde Organización Semanal', this.weekAssignments());
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

  // 2. Matriz Semanal (Plantilla genérica, sin números de fecha)
  weekAssignments = signal<DayAssignment[]>([
    { dayName: 'Lunes', menuId: '1' },
    { dayName: 'Martes', menuId: '1' },
    { dayName: 'Miércoles', menuId: '3' },
    { dayName: 'Jueves', menuId: '2' },
    { dayName: 'Viernes', menuId: '1' },
    { dayName: 'Sábado', menuId: '2' },
    { dayName: 'Domingo', menuId: '2' },
  ]);

  openDayMenuIndex = signal<number | null>(null);

  // 2. NUEVO: Señal con las comidas del día (Sugerencias + Registradas)
  foodItems = signal<FoodItem[]>([
    {
      id: '1',
      name: 'Huevos con Aguacate',
      emoji: '🍳',
      category: 'Desayuno',
      portion: 2,
      unit: 'unidades',
      kcal: 450,
      protein: 30,
      carbs: 12,
      fat: 22,
      isLogged: true,
    },
    {
      id: '2',
      name: 'Bowl de Avena y Whey',
      emoji: '🥣',
      category: 'Merienda',
      portion: 120,
      unit: 'g',
      kcal: 320,
      protein: 25,
      carbs: 40,
      fat: 8,
      isLogged: false,
    },
    {
      id: '3',
      name: 'Salmón al Horno con Espárragos',
      emoji: '🍱',
      category: 'Cena',
      portion: 1,
      unit: 'porción',
      kcal: 510,
      protein: 42,
      carbs: 5,
      fat: 30,
      isLogged: false,
    },
  ]);

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

  toggleDayMenu(index: number, event: Event) {
    event.stopPropagation();
    this.openDayMenuIndex.update((current) => (current === index ? null : index));
  }

  assignMenuToDay(dayIndex: number, menuId: string | null, event: Event) {
    event.stopPropagation();
    this.weekAssignments.update((days) => {
      const newDays = [...days];
      newDays[dayIndex].menuId = menuId;
      return newDays;
    });
    this.openDayMenuIndex.set(null);
  }

  getAssignedMenu(menuId: string | null): MenuPlan | null {
    if (!menuId) return null;
    return this.availableMenus().find((m) => m.id === menuId) || null;
  }

  // 3. NUEVO: Lógica de Lista de Compras
  generateShoppingList() {
    // Aquí el sistema AWAKIN multiplicará los ingredientes de los menús
    // según cuántas veces aparezcan en weekAssignments().
    console.log('Generando Lista de Compras para el protocolo actual...');
    // TODO: Abrir modal o navegar a la vista de lista de compras.
  }
}
