import { Component, Input, Output, EventEmitter, computed, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DayStatus = 'none' | 'partial' | 'goal' | 'excess' | 'future';
// Definimos la interfaz aquí mismo para que sea portable
export interface CalendarDay {
  date: number;        // Ej: 12
  fullDate: Date; // Asegúrate de que esta propiedad exista en tu interfaz
  dayName: string;     // Ej: 'J'
  status: DayStatus;
}

@Component({
  selector: 'app-week-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-calendar-header.component.html', // <--- Conecta con el archivo HTML
  styles: []
})
export class WeekCalendarHeaderComponent {
  // DATOS DE ENTRADA (Lo que recibe del padre)
  @Input() days: CalendarDay[] = [];
  @Input() streak: number = 0;

  // Añadimos esta señal para controlar el label dinámico
  @Input() selectedDay: Signal<CalendarDay | null> = signal<CalendarDay | null>(null);

  // EVENTOS DE SALIDA (Lo que notifica al padre)
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onDaySelect = new EventEmitter<CalendarDay>();
  @Output() onMenuClick = new EventEmitter<void>();



  displayLabel = computed(() => {
  const selected = this.selectedDay();
  // Si no hay seleccionado o es la fecha de hoy
  if (!selected || this.isToday(selected.fullDate)) return 'Hoy';
  
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selected.fullDate);
});

/**
 * Compara dos fechas ignorando la hora (solo día, mes y año)
 * Devuelve:
 * 1  si f1 > f2 (Futuro)
 * 0  si f1 = f2 (Hoy/Mismo día)
 * -1  si f1 < f2 (Pasado)
 */
compareDates(f1: Date | undefined, f2: Date | undefined): number {
  if (!f1 || !f2) return 0; // Si alguna fecha no es válida, consideramos que son iguales para evitar errores
  const d1 = new Date(f1).setHours(0, 0, 0, 0);
  const d2 = new Date(f2).setHours(0, 0, 0, 0);

  if (d1 > d2) return 1;
  if (d1 < d2) return -1;
  return 0;
}

/**
 * Helper para saber si un día de la tira es hoy
 */
isToday(date: Date): boolean {
  return this.compareDates(date, new Date()) === 0;
}

isFuture(date: Date): boolean {
  return this.compareDates(date, new Date()) === 1;
}

isPast(date: Date): boolean {
  return this.compareDates(date, new Date()) === -1;
}

/**
 * Helper para saber si un día es el seleccionado
 */
isSelected(day: CalendarDay): boolean {
  if (!this.selectedDay()?.fullDate) return false;
    return this.compareDates(day.fullDate, this.selectedDay()?.fullDate) === 0;
}

}