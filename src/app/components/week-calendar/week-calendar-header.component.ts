import { Component, Input, Output, EventEmitter, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DayStatus = 'none' | 'partial' | 'goal' | 'excess' | 'future';

export interface CalendarDay {
  date: number;
  fullDate: Date;
  dayName: string;
  status: DayStatus;
}

@Component({
  selector: 'app-week-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-calendar-header.component.html'
})
export class WeekCalendarHeaderComponent implements OnInit {
  @Input() streak: number = 0;

  // Señales de estado
  @Output() days = signal<CalendarDay[]>([]);

  @Input() setDays(daysToSet: CalendarDay[]) {
    this.days.set(daysToSet);
  }

  selectedDate = signal<Date>(new Date());
  baseDate = signal<Date>(new Date()); // La fecha de referencia para la semana visible

  @Output() onDateChange = new EventEmitter<Date>();
  @Output() onMenuClick = new EventEmitter<void>();
  @Output() onMonthViewClick = new EventEmitter<void>();

  // Coordenadas para Swipe
  private touchStartX = 0;

  ngOnInit() {
    this.generateWeek(this.baseDate());
  }

  // Helpers de comparación (Protocolo de Tiempo)
  compareDates(f1: Date, f2: Date): number {
    const d1 = new Date(f1).setHours(0, 0, 0, 0);
    const d2 = new Date(f2).setHours(0, 0, 0, 0);
    return d1 > d2 ? 1 : d1 < d2 ? -1 : 0;
  }

  isToday(date: Date): boolean { return this.compareDates(date, new Date()) === 0; }
  isPast(date: Date): boolean { return this.compareDates(date, new Date()) === -1; }
  isFuture(date: Date): boolean { return this.compareDates(date, new Date()) === 1; }
  isSelected(day: CalendarDay): boolean { return this.compareDates(day.fullDate, this.selectedDate()) === 0; }

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
        status: 'none'
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

    if (Math.abs(deltaX) > 50) { // Umbral de swipe
      if (deltaX > 0) this.navigateWeek(-7); // Swipe derecha -> Semana anterior
      else this.navigateWeek(7);             // Swipe izquierda -> Semana siguiente
    }
  }


  selectDay(day: CalendarDay) {
    this.selectedDate.set(day.fullDate);
    this.onDateChange.emit(day.fullDate);
  }

private navigateWeek(days: number) {
    // 1. Guardamos el índice del día actual seleccionado (0-6)
    const currentSelectedDayIndex = this.selectedDate().getDay();

    // 2. Movemos la fecha base
    const newBase = new Date(this.baseDate());
    newBase.setDate(newBase.getDate() + days);
    this.baseDate.set(newBase);

    // 3. Generamos la nueva semana
    this.generateWeek(newBase);

    // 4. AUTO-SELECCIÓN: Buscamos el día en la nueva semana con el mismo dayIndex
    const newWeekDays = this.days();
    const sameDayNextWeek = newWeekDays.find(d => d.fullDate.getDay() === currentSelectedDayIndex);

    if (sameDayNextWeek) {
      this.selectDay(sameDayNextWeek);
    }
  }

  // Label dinámico actualizado con tu lógica de 'Mañana' y formato AWAKIN
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

    // Lógica para detectar si estamos en la semana actual del sistema
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
    startOfThisWeek.setHours(0,0,0,0);
    
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
    endOfThisWeek.setHours(23,59,59,999);

    // Si está en la semana actual, nombre completo (ej: Martes)
    if (selected >= startOfThisWeek && selected <= endOfThisWeek) {
      return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selected);
    }

    // Si está fuera de la semana actual, Mes + Día (ej: feb 18)
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
      'bg-transparent': !selected
    };
  }

  getStatusClasses(day: CalendarDay) {
    return {
      'bg-awakin-sun': day.status === 'goal' || this.isToday(day.fullDate),
      'bg-module-intake': day.status === 'partial',
      'bg-module-avatar': day.status === 'excess',
      'border-b-2 border-stone-800': this.isSelected(day),
      'border border-stone-300': this.isFuture(day.fullDate),
      'bg-stone-500': this.isPast(day.fullDate) && day.status === 'none'
    };
  }
}