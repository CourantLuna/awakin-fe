import { Component, Input, Output, EventEmitter, computed, signal, OnInit, Signal } from '@angular/core';
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

  // El componente gestiona su propia semana y selección
  days = signal<CalendarDay[]>([]);
  @Output() selectedDate = signal<CalendarDay | null>(null);

  // EVENTOS DE SALIDA (Lo que notifica al padre)
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onDaySelect = new EventEmitter<CalendarDay>();
  @Output() onMenuClick = new EventEmitter<void>();

  @Output() onDateChange = new EventEmitter<Date>();


  ngOnInit() {
    this.generateCurrentWeek();
  }

  // Helpers de comparación solicitados
  compareDates(f1: Date, f2: Date): number {
    const d1 = new Date(f1).setHours(0, 0, 0, 0);
    const d2 = new Date(f2).setHours(0, 0, 0, 0);
    if (d1 > d2) return 1;
    if (d1 < d2) return -1;
    return 0;
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
    const selected = this.selectedDate();
    return selected ? this.compareDates(day.fullDate, selected.fullDate) === 0 : false;
  }

  // Generación automática de la semana (Lunes a Domingo)
  private generateCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push({
        date: d.getDate(),
        fullDate: d,
        dayName: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()],
        status: 'none' // Esto se conectará con los datos reales
      });
    }
    this.days.set(week);
  }

  selectDay(day: CalendarDay) {
    this.selectedDate.set(day);
    this.onDateChange.emit(day.fullDate);
  }

  // Label dinámico central
  displayLabel = computed(() => {
    const selected = this.selectedDate();
    if (!selected) return '';
    if (this.isToday(selected.fullDate)) return 'Hoy';
    if (this.compareDates(selected.fullDate, new Date(new Date().setDate(new Date().getDate() - 1))) === 0) return 'Ayer';
    if (this.compareDates(selected.fullDate, new Date(new Date().setDate(new Date().getDate() + 1))) === 0) return 'Mañana';
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selected.fullDate);
  });

  // Método para evitar errores de parseo en el HTML
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
      'border-b-2 border-awakin-stone': this.isSelected(day),
      'border border-stone-400': this.isFuture(day.fullDate),
      'bg-stone-600': this.isPast(day.fullDate) && day.status === 'none'
    };
  }
}