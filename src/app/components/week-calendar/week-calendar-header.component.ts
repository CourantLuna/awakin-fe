import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

// Definimos la interfaz aquí mismo para que sea portable
export interface CalendarDay {
  date: number;        // Ej: 12
  fullDate: Date; // Asegúrate de que esta propiedad exista en tu interfaz
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

  // Añadimos esta señal para controlar el label dinámico
  @Input() selectedDay: CalendarDay | null = null;

  // EVENTOS DE SALIDA (Lo que notifica al padre)
  @Output() onMonthViewClick = new EventEmitter<void>();
  @Output() onDaySelect = new EventEmitter<CalendarDay>();
  @Output() onMenuClick = new EventEmitter<void>();

  // Label dinámico basado en el Input selectedDay
  displayLabel = computed(() => {
    const selected = this.selectedDay;
    if (!selected) return 'Hoy';

    // Lógica para el label
    const today = new Date().toDateString();
    const selectedDate = selected.fullDate.toDateString();

    if (today === selectedDate) return 'Hoy';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === selectedDate) return 'Ayer';

    return selected.fullDate.toLocaleDateString('es-ES', { weekday: 'long' });
  });
}