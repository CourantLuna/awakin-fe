import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StreakService, formatToDateKey } from '../../core/services/streak.service';

export type DayStatus = 'none' | 'partial' | 'goal' | 'excess' | 'future';

export interface CalendarDay {
  date: number;
  fullDate: Date;
  dayName: string;
  status: DayStatus;
}

export type CalendarViewMode = 'week' | 'month'; //

@Component({
  selector: 'app-week-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-calendar-header.component.html',
})
export class WeekCalendarHeaderComponent implements OnInit, OnChanges {
  public streakService = inject(StreakService);

  // Configuración de Protocolo
  @Input() weekStart: number = 1; // 0: Domingo, 1: Lunes (Default AWAKIN)
  @Input() streak: number = 0;
  @Input() activeDates?: Set<string> | string[];

  // Señales de estado

  @Input() setDays(daysToSet: CalendarDay[]) {
    this.days.set(daysToSet);
  }

 public viewMode = signal<CalendarViewMode>('week'); // Control de estado interno
  selectedDate = signal<Date>(new Date());
  baseDate = signal<Date>(new Date());
  @Output() days = signal<CalendarDay[]>([]);

  @Output() onDateChange = new EventEmitter<Date>();
  @Output() onMenuClick = new EventEmitter<void>();
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onLabelChange = new EventEmitter<string>(); // Nuevo: Expone el label al padre

  // 1. Nombres de días fijos para el Header
weekDayNames = computed(() => {
  const names = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // Orden de lunes
  if (this.weekStart === 0) return ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  return names;
});

// 2. Nueva señal para manejar los huecos del mes
monthPaddingDays = signal<number[]>([]);
public activeVersion = signal<number>(0);

  // Coordenadas para Swipe
  private touchStartX = 0;

  constructor() {
    // Sincroniza el label con el padre automáticamente
    effect(() => {
      this.onLabelChange.emit(this.displayLabel());
    });

    // Reacciona a cambios en las fechas activas de la racha única
    effect(() => {
      this.streakService.activeDates();
      this.activeVersion.update((v) => v + 1);
    });
  }

  ngOnInit() {
    this.generateCalendar();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['activeDates']) {
      this.activeVersion.update((v) => v + 1);
    }
  }

  // Helpers de comparación (Protocolo de Tiempo)
  compareDates(f1: Date, f2: Date): number {
    const d1 = new Date(f1).setHours(0, 0, 0, 0);
    const d2 = new Date(f2).setHours(0, 0, 0, 0);
    return d1 > d2 ? 1 : d1 < d2 ? -1 : 0;
  }

  isToday(date: Date): boolean {
    return this.compareDates(date, new Date()) === 0;
  }
  isPast(date: Date): boolean {
    return this.compareDates(date, new Date()) === -1;
  }
  isFuture(date: Date): boolean {
    return this.compareDates(date, new Date()) === 1;
  }
  isSelected(day: CalendarDay): boolean {
    return this.compareDates(day.fullDate, this.selectedDate()) === 0;
  }

  // Método público para que el padre (IntakeUser) cambie el modo
  toggleViewMode() {
    this.viewMode.update((mode) => (mode === 'week' ? 'month' : 'week'));
    // PROTOCOLO DE ANCLAJE: 
    // Al cambiar de vista, la base debe ser la fecha que el usuario ya seleccionó
    // para que la semana/mes se genere partiendo de esa realidad.
    this.baseDate.set(new Date(this.selectedDate()));
    this.generateCalendar(); // Regeneramos los días según el nuevo modo
  }

generateCalendar() {
  const base = new Date(this.baseDate());
  const newDays: CalendarDay[] = [];

  if (this.viewMode() === 'week') {
    this.monthPaddingDays.set([]); // Sin padding en semana
    const start = new Date(base);
    const day = start.getDay(); 
    const diff = (day < this.weekStart ? 7 : 0) + day - this.weekStart;
    start.setDate(start.getDate() - diff);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      newDays.push(this.createDayObject(d));
    }
  } else {
    // MODO MES
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // Calcular padding: cuántos huecos hay antes del día 1
    // Si weekStart es 1 (Lunes) y el primer día es Domingo (0), el offset es 6
    let padding = (firstDayOfMonth - this.weekStart + 7) % 7;
    this.monthPaddingDays.set(Array(padding).fill(0));

    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      newDays.push(this.createDayObject(new Date(year, month, i)));
    }
  }
  this.days.set(newDays);
}

private createDayObject(date: Date): CalendarDay {
    return {
      date: date.getDate(),
      fullDate: new Date(date),
      // Forzamos que el nombre del día sea consistente con la localización
      dayName: new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' }).format(date).toUpperCase(),
      status: 'none',
    };
  }

  /**
   * PROTOCOLO: Regresar a la fecha actual
   * Este método será llamado por el padre cuando se pulse el botón proyectado
   */
  public goToToday() {
    const today = new Date();
    this.baseDate.set(today); // Reset de la semana visible
    this.selectedDate.set(today); // Seleccionamos hoy
    this.generateCalendar() // Regeneramos la tira
    this.onDateChange.emit(today); // Notificamos al padre
  }

  // --- LÓGICA DE NAVEGACIÓN (SWIPE) ---
  handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  handleTouchEnd(event: TouchEvent) {
    const touchEndX = event.changedTouches[0].clientX;
    const deltaX = touchEndX - this.touchStartX;

    if (Math.abs(deltaX) > 50) {
      // Umbral de swipe
      if (deltaX > 0)
        this.navigateTime(-7, 'days'); // Swipe derecha -> Semana anterior
      else this.navigateTime(7, 'days'); // Swipe izquierda -> Semana siguiente
    }
  }

  selectDay(day: CalendarDay) {
    this.selectedDate.set(day.fullDate);
    this.onDateChange.emit(day.fullDate);
  }

  /**
   * Navegación manual por flechas o swipe
   * @param direction -1 para atrás, 1 para adelante
   */
  public navigate(direction: number) {
    // Multiplicamos por 7 porque nos movemos por semanas completas
   if (this.viewMode()==='week'){
    this.navigateTime(direction * 7, 'days');
   } else if (this.viewMode()==='month'){
    this.navigateTime(direction *1, 'months')
   }
  }
private navigateTime(amount: number, unit: 'days' | 'months') {
    const currentDayOfWeek = this.selectedDate().getDay();
    const newTarget = new Date(this.selectedDate()); // Usamos el seleccionado como target

    if (unit === 'days') {
      newTarget.setDate(newTarget.getDate() + amount);
    } else {
      newTarget.setMonth(newTarget.getMonth() + amount);
    }

    // Actualizamos ambos: la selección y la base de la vista
    this.selectedDate.set(newTarget);
    this.baseDate.set(newTarget); 
    
    this.generateCalendar();

    // Re-seleccionamos el día exacto tras regenerar para disparar eventos al padre
    const newDay = this.days().find((d) => d.fullDate.getDay() === currentDayOfWeek);
    if (newDay) {
        this.selectDay(newDay);
    } else {
        this.selectDay(this.days()[0]);
    }
  }
  displayLabel = computed(() => {
    const selected = this.selectedDate();
    const today = new Date();
    const isDifferentYear = selected.getFullYear() !== today.getFullYear();

    // 1. Casos Especiales (Solo si es el mismo año)
    if (!isDifferentYear) {
      if (this.isToday(selected)) return 'Hoy';

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (this.compareDates(selected, yesterday) === 0) return 'Ayer';

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      if (this.compareDates(selected, tomorrow) === 0) return 'Mañana';
    }

    // 2. Protocolo de Semana Actual
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);

    if (!isDifferentYear && selected >= startOfThisWeek && selected <= endOfThisWeek) {
      return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selected);
    }

    // 3. Formato dinámico (Día Mes, Año si aplica)
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    
    if (isDifferentYear) {
      options.year = 'numeric';
    }

    return new Intl.DateTimeFormat('es-ES', options).format(selected);
  });



  // Helper de actividad física o nutricional del día
  hasActivity(day: CalendarDay): boolean {
    this.activeVersion();
    const key = formatToDateKey(day.fullDate);
    if (!key) return false;
    if (this.activeDates) {
      if (this.activeDates instanceof Set) return this.activeDates.has(key);
      if (Array.isArray(this.activeDates)) return this.activeDates.includes(key);
    }
    return this.streakService.activeDates().has(key);
  }

  // Estilos del número del día (Días con entreno o comida sombreados en Awakin Sun con texto blanco)
  getNumberClasses(day: CalendarDay) {
    const today = this.isToday(day.fullDate);
    const selected = this.isSelected(day);
    const active = this.hasActivity(day);

    if (active) {
      return {
        'bg-awakin-sun text-white font-black shadow-xs shadow-awakin-sun/30': true,
        'ring-2 ring-stone-900 ring-offset-2 scale-110 shadow-md': selected,
        'scale-100': !selected,
      };
    }

    return {
      'text-awakin-sun font-bold': today && !selected,
      'text-stone-900 font-bold': selected,
      'text-stone-800': !selected && !today && !this.isFuture(day.fullDate),
      'text-stone-300': this.isFuture(day.fullDate),
      'bg-stone-100 shadow-md scale-110': selected,
      'bg-transparent': !selected,
    };
  }

  getStatusClasses(day: CalendarDay) {
    const active = this.hasActivity(day);
    if (active) {
      return {
        'bg-awakin-sun': true,
        'opacity-80': true,
      };
    }

    return {
      'bg-awakin-sun': day.status === 'goal' || this.isToday(day.fullDate),
      'bg-module-intake': day.status === 'partial',
      'bg-module-avatar': day.status === 'excess',
      'border-b-2 border-stone-800': this.isSelected(day),
      'border border-stone-300': this.isFuture(day.fullDate),
      'bg-stone-500': this.isPast(day.fullDate) && day.status === 'none',
    };
  }
}
