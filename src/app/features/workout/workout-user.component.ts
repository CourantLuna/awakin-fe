import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { ChartModule } from 'primeng/chart';
import { WeekCalendarHeaderComponent } from '../../components/week-calendar/week-calendar-header.component';
// 👇 NUEVAS IMPORTACIONES
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';

interface WorkoutPlan {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  exercisesCount: number;
  focus: string[];
  isCompleted: boolean;
}

@Component({
  selector: 'app-workout-user',
  standalone: true,
  // 👇 AÑADIR A IMPORTS
  imports: [
    CommonModule,
    PrimeNGModule,
    ChartModule,
    WeekCalendarHeaderComponent,
    SelectModule,
    FormsModule,
  ],
  templateUrl: './workout-user.component.html',
})
export class WorkoutUserComponent implements OnInit {
  @ViewChild(WeekCalendarHeaderComponent) calendar!: WeekCalendarHeaderComponent;

  currentLabel = signal<string>('Hoy');
  streak = signal<number>(12);

  // ==========================================
  // ESTADO DE ENTRENAMIENTOS
  // ==========================================

  // 1. Catálogo de rutinas del día/semana
  availableRoutines = signal<WorkoutPlan[]>([
    {
      id: 'w-1',
      title: 'Hipertrofia Inferior',
      subtitle: 'Fase 2: Sobrecarga Progresiva',
      duration: 65,
      exercisesCount: 7,
      focus: ['Cuádriceps', 'Glúteos', 'Core'],
      isCompleted: false,
    },
    {
      id: 'w-2',
      title: 'Empuje Pesado',
      subtitle: 'Fase 2: Fuerza Máxima',
      duration: 55,
      exercisesCount: 5,
      focus: ['Pecho', 'Hombros', 'Tríceps'],
      isCompleted: false,
    },
    {
      id: 'w-3',
      title: 'Día de Descanso Activo',
      subtitle: 'Recuperación y Flujo',
      duration: 30,
      exercisesCount: 4,
      focus: ['Movilidad', 'Cardio LISS'],
      isCompleted: false,
    },
  ]);

  // 2. ID de la rutina seleccionada
  selectedRoutineId = signal<string>('w-1');

  // 3. EL ENTRENAMIENTO DEL DÍA (El que se pinta en la Hero Card gigante)
  todayWorkout = signal<WorkoutPlan>(this.availableRoutines()[0]);

  // Función que se ejecuta al cambiar la rutina en el dropdown
  onRoutineChange(newId: string) {
    this.selectedRoutineId.set(newId);

    // Sincronizamos la Hero Card con la nueva selección
    const selected = this.availableRoutines().find((r) => r.id === newId);
    if (selected) {
      this.todayWorkout.set(selected);
      console.log('⚡ Pivot de Rutina. Nueva rutina seleccionada:', selected.title);
    }
  }

  // ... (Resto de tu código: updateLabel, initRadarChart, etc. se mantiene igual)

  updateLabel(label: string) {
    this.currentLabel.set(label);
  }

  handleTopBtnAction() {
    this.calendar.goToToday();
  }

  toggleCalendarViewMode() {
    this.calendar.toggleViewMode();
  }

  radarData: any;
  radarOptions: any;

  ngOnInit() {
    this.initRadarChart();
  }

  initRadarChart() {
    // ... se mantiene intacto
    const documentStyle = getComputedStyle(document.documentElement);
    const colorSun = '#FE970A';
    const colorSunLight = 'rgba(254, 151, 10, 0.2)';

    this.radarData = {
      labels: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'],
      datasets: [
        {
          label: 'Volumen Semanal',
          backgroundColor: colorSunLight,
          borderColor: colorSun,
          pointBackgroundColor: colorSun,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: colorSun,
          data: [65, 59, 90, 81, 56, 40],
        },
      ],
    };

    this.radarOptions = {
      plugins: { legend: { display: false } },
      scales: {
        r: {
          grid: { color: '#e7e5e4' },
          pointLabels: {
            color: '#57534e',
            font: { family: 'ui-sans-serif', size: 10, weight: 'bold' },
          },
          ticks: { display: false },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  startWorkout() {
    console.log('🚀 Iniciando Motor de Entrenamiento para:', this.todayWorkout().title);
  }
}
