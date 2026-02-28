import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNGModule } from '../../shared/prime-ng.module';

@Component({
  selector: 'app-intake-top-bar',
  standalone: true,
  imports: [CommonModule, PrimeNGModule],
  templateUrl: './intake-top-bar.html',
  styleUrl: './intake-top-bar.css',
})
export class IntakeTopBar {
  // Inputs (Datos que vienen del padre)
  streak = input.required<number>();
  currentLabel = input.required<string>();
  isMonthView = input<boolean>(false);

  // Outputs (Eventos que el padre escuchará para mover el calendario)
  onMenuClick = output<void>();
  onNavigate = output<number>(); // Emite -1 o 1
  onTodayClick = output<void>();
  onToggleView = output<void>();
}
