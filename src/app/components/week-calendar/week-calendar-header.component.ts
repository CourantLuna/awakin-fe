import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  OnInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';

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
export class WeekCalendarHeaderComponent implements OnInit {
  @Input() streak: number = 0;

  // Señales de estado

  @Input() setDays(daysToSet: CalendarDay[]) {
    this.days.set(daysToSet);
  }

  viewMode = signal<CalendarViewMode>('week'); // Control de estado interno

  selectedDate = signal<Date>(new Date());
  baseDate = signal<Date>(new Date());
  @Output() days = signal<CalendarDay[]>([]);

  @Output() onDateChange = new EventEmitter<Date>();
  @Output() onMenuClick = new EventEmitter<void>();
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onLabelChange = new EventEmitter<string>(); // Nuevo: Expone el label al padre

  // Coordenadas para Swipe
  private touchStartX = 0;

  constructor() {
    // Sincroniza el label con el padre automáticamente
    effect(() => {
      this.onLabelChange.emit(this.displayLabel());
    });
  }

  ngOnInit() {
    this.generateWeek(this.baseDate());
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
    this.generateCalendar(); // Regeneramos los días según el nuevo modo
  }

  // Refactorizamos la generación de días
  generateCalendar() {
    const base = new Date(this.baseDate());
    const newDays: CalendarDay[] = [];

    if (this.viewMode() === 'week') {
      // Lógica de semana actual (Lunes a Domingo)
      const start = new Date(base);
      start.setDate(base.getDate() - (base.getDay() === 0 ? 6 : base.getDay() - 1));

      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        newDays.push(this.createDayObject(d));
      }
    } else {
      // MODO MES: Generamos todos los días del mes de la baseDate
      const year = base.getFullYear();
      const month = base.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, month, i);
        newDays.push(this.createDayObject(d));
      }
    }
    this.days.set(newDays);
  }

  private createDayObject(date: Date): CalendarDay {
    return {
      date: date.getDate(),
      fullDate: new Date(date),
      dayName: new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' }).format(date),
      status: 'none', // Aquí conectarías con tu lógica de backend/status
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
    this.generateWeek(today); // Regeneramos la tira
    this.onDateChange.emit(today); // Notificamos al padre
  }

  private generateWeek(referenceDate: Date) {
    const start = new Date(referenceDate);
    const dayOfWeek = start.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diffToMonday);

    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      week.push({
        date: d.getDate(),
        fullDate: d,
        dayName: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()],
        status: 'none',
      });
    }
    this.days.set(week);
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
        this.navigateWeek(-7); // Swipe derecha -> Semana anterior
      else this.navigateWeek(7); // Swipe izquierda -> Semana siguiente
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
    this.navigateWeek(direction * 7);
  }

  // Refactorizamos navigateWeek para que sea más robusto
  private navigateWeek(days: number) {
    const currentDayIndex = this.selectedDate().getDay();
    const newBase = new Date(this.baseDate());
    newBase.setDate(newBase.getDate() + days);

    this.baseDate.set(newBase);
    this.generateWeek(newBase);

    // Mantenemos la selección del mismo día de la semana (protocolo de consistencia)
    const newDay = this.days().find((d) => d.fullDate.getDay() === currentDayIndex);
    if (newDay) this.selectDay(newDay);
  }

  displayLabel = computed(() => {
    const selected = this.selectedDate();
    const today = new Date();

    if (this.isToday(selected)) return 'Hoy';

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (this.compareDates(selected, yesterday) === 0) return 'Ayer';

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (this.compareDates(selected, tomorrow) === 0) return 'Mañana';

    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));

    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);

    if (selected >= startOfThisWeek && selected <= endOfThisWeek) {
      return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selected);
    }

    return new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(selected);
  });

  // Estilos (Ya refactorizados para evitar Parser Errors)
  getNumberClasses(day: CalendarDay) {
    const today = this.isToday(day.fullDate);
    const selected = this.isSelected(day);
    return {
      'text-awakin-sun': today,
      'text-black': selected && !today,
      'text-stone-800': !selected && !today,
      'bg-stone-100 shadow-md scale-110': selected,
      'bg-transparent': !selected,
    };
  }

  getStatusClasses(day: CalendarDay) {
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
