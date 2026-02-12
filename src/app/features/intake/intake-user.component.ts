import { Component, OnInit } from '@angular/core';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'app-intake-user',
  standalone: true,
  imports: [ChartModule],
  templateUrl: './intake-user.component.html'
})
export class IntakeUserComponent implements OnInit {
  macroData: any;
  macroOptions: any;

  ngOnInit() {
    // Colores basados en tu preset
    const sunColor = '#fe970a';     // --color-awakin-sun
    const intakeColor = '#3E9F31';  // --color-module-intake
    const avatarColor = '#C0392B';  // --color-module-avatar
    const surfaceColor = '#F3F4F6'; // --color-awakin-surface

    this.macroData = {
      labels: ['Proteína', 'Carbohidratos', 'Grasas'],
      datasets: [
        {
          data: [120, 210, 45],
          backgroundColor: [intakeColor, sunColor, avatarColor],
          hoverBackgroundColor: [intakeColor, sunColor, avatarColor],
          borderWidth: 0,
          borderRadius: 10,
          cutout: '85%' // Grosor del anillo
        }
      ]
    };

    this.macroOptions = {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }
}