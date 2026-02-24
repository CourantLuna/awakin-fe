import { Component, input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { IntakeProgressWidgetComponent } from '../intake-widget/intake-progress-widget.component';

@Component({
  selector: 'app-intake-scale-widget',
  imports: [CommonModule, ChartModule, IntakeProgressWidgetComponent],
  templateUrl: './intake-scale-widget.html',
  styleUrl: './intake-scale-widget.css',
})
export class IntakeScaleWidgetComponent {
  // --- CALORÍAS Y METAS ---
  burnedKcals = input.required<number>();
  minA = input.required<number>();
  maintC = input.required<number>();

  // --- MACROS ---
  proteinEated = input.required<number>();
  proteinGoal = input.required<number>();
  carbsEated = input.required<number>();
  carbsGoal = input.required<number>();
  fatsEated = input.required<number>();
  fatsGoal = input.required<number>();

  targetGoal = computed(() => {
    return this.proteinGoal() * 4 + this.carbsGoal() * 4 + this.fatsGoal() * 9;
  });

  // --- CONTEXTO DEL SISTEMA ---
  kinData = input<{ name: string; logo: string }>({ name: 'Alpha Kin', logo: 'A' });
  // --- CONFIGURACIÓN REACTIVA DEL GRÁFICO (Chart.js) ---
  macroData = computed(() => {
    // Colores del sistema Sunrise Tech (Fallback a Hex en caso de no leer variables CSS)
    const colorIntake = '#3E9F31';
    const colorSun = '#FE970A';
    const colorAvatar = '#C0392B';

    return {
      labels: ['Proteína', 'Carbohidratos', 'Grasas'],
      datasets: [
        {
          data: [this.proteinEated(), this.carbsEated(), this.fatsEated()],
          backgroundColor: [colorIntake, colorSun, colorAvatar],
          hoverBackgroundColor: [colorIntake, colorSun, colorAvatar],
          borderWidth: 5,
          borderRadius: 4,
          cutout: '65%', // Hueco del Doughnut ajustado para Sunrise Tech
        },
      ],
    };
  });

  macroOptions = {
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    responsive: true,
    maintainAspectRatio: false,
    animation: { animateScale: true, animateRotate: true },
  };
}
