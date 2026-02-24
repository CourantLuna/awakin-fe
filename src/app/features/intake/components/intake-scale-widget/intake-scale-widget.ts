import { Component, input, computed, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('scalePath') scalePath!: ElementRef<SVGPathElement>;
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

  // Calculamos el total de calorías ingeridas (sin restar el ejercicio aún para esta barra)
  totalEated = computed(
    () => this.proteinEated() * 4 + this.carbsEated() * 4 + this.fatsEated() * 9,
  );

  // Definimos el límite máximo común para que las barras sean comparables
  // Usamos el goal o el valor más alto actual + un margen del 10%
  scaleMaxLimit = computed(() => {
    const values = [this.targetGoal(), this.totalEated(), this.burnedKcals()];
    return Math.max(...values) * 1.33;
  });

  // Cálculo de stroke-dasharray para las barras
  getStrokeDash(value: number) {
    if (!this.scalePath) return '0, 1000';
    const pathLength = 320; // Aproximación del path curvo
    const percentage = Math.min(value / this.scaleMaxLimit(), 1);
    return `${percentage * pathLength}, 1000`;
  }

  // Posicionamiento responsive del marcador de Meta
  getMarkerTransform(value: number) {
    if (!this.scalePath) return 'translate(0,0)';
    const path = this.scalePath.nativeElement;
    const totalLength = path.getTotalLength();
    const distance = (value / this.scaleMaxLimit()) * totalLength;
    const point = path.getPointAtLength(distance);
    return `translate(${point.x} ${point.y})`;
  }

  // Función para calcular el stroke-dasharray basado en un valor
  getScaleStroke(value: number) {
    const percentage = Math.min(value / this.scaleMaxLimit(), 1);
    const totalLength = 325; // Longitud aproximada del path curvo de 320px
    return `${percentage * totalLength}, 1000`;
  }

  // Posición de la línea de meta (dash line)
  getGoalMarkerTransform() {
    // Aquí reutilizaríamos una lógica similar a getMarkerTransform si fuera necesario,
    // pero para la línea vertical central usaremos el porcentaje sobre el ancho
    const percentage = (this.targetGoal() / this.scaleMaxLimit()) * 100;
    return `translateX(${percentage}%)`;
  }
}
