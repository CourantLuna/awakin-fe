import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

// Definimos la interfaz aquí mismo para que sea portable
export interface CalendarDay {
  date: number;        // Ej: 12
  dayName: string;     // Ej: 'J'
  status: 'none' | 'record' | 'goal' | 'future'; // Colores del punto
  isToday: boolean;    // Si está seleccionado visualmente
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

  // EVENTOS DE SALIDA (Lo que notifica al padre)
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onDaySelect = new EventEmitter<CalendarDay>();
  @Output() onMenuClick = new EventEmitter<void>();
}