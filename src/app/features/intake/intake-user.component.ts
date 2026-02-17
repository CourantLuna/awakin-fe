import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { CalendarDay, WeekCalendarHeaderComponent } from '../../components/week-calendar/week-calendar-header.component';

@Component({
  selector: 'app-intake-user',
  standalone: true,
  imports: [CommonModule, ChartModule, PrimeNGModule, WeekCalendarHeaderComponent],
  templateUrl: './intake-user.component.html'
})
export class IntakeUserComponent implements OnInit {
  streak = signal<number>(12);
  weekDays = signal<CalendarDay[]>([]); // Se llenará dinámicamente
  selectedDay = signal<CalendarDay | null>(null);
  // Datos Gráfico
  macroData: any;
  macroOptions: any;
  caloriesConsumed = 1850;
  caloriesTarget = 2200;

  // En intake-user.component.ts
currentLabel = signal<string>('Hoy');
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
        status: isToday ? 'none' : (i < 4 ? 'none' : 'future'), 
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
          borderWidth: 0,
          borderRadius: 5,
          cutout: '88%'
        }
      ]
    };

    this.macroOptions = {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateScale: true, animateRotate: true }
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
}