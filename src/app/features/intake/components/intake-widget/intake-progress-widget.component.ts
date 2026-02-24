import { Component, input, computed, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-intake-progress-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intake-progress-widget.component.html'
})
export class IntakeProgressWidgetComponent {
  consumed = input.required<number>();
  minA = input.required<number>();
  goalB = input.required<number>();
  maintC = input.required<number>();

  @ViewChild('trackPath') trackPath!: ElementRef<SVGPathElement>;

  maxLimit = computed(() => {
    const maxlimitProtocol: any = {
    'DEFICIT': this.maintC() * 1.33,
    'SURPLUS': this.goalB() * 1.33,
    'MAINTENANCE': this.maintC() * 1.33
  };
  
    return maxlimitProtocol[this.protocolState()];
  });

  // El porcentaje de llenado del arco
  progressStroke = computed(() => {
    const percentage = Math.min(this.consumed() / this.maxLimit(), 1);
    const totalLength = 280; 
    return `${percentage * totalLength}, 1000`;
  });

 // Signal para controlar la alternancia de la pantalla digital
  showTotalMode = signal(false);

  toggleDisplay() {
    this.showTotalMode.update(val => !val);
  }
  /**
   * getMarkerTransform: Posiciona el palito sobre el arco.
   * Mantiene verticalidad absoluta (0 grados).
   */
  getMarkerTransform(value: number) {
    if (!this.trackPath) return 'translate(0 0)';

    const path = this.trackPath.nativeElement;
    const totalLength = path.getTotalLength();
    
    // Calculamos la distancia basada en el valor actual vs el límite máximo
    const distance = (value / this.maxLimit()) * totalLength;
    
    // Obtenemos las coordenadas exactas X e Y del path
    const point = path.getPointAtLength(distance);
    
    // Solo trasladamos al punto (x, y). 
    // No aplicamos 'rotate' para que el palito se quede derecho.
    return `translate(${point.x} ${point.y})`;
  }

  // Dentro de la clase IntakeProgressWidgetComponent

// Determina el estado del protocolo basado en el consumo vs objetivo
  protocolState = computed(() => {
  
  const diff = this.goalB() - this.maintC();
  if (diff < -50) return 'DEFICIT';
  if (diff > 50) return 'SURPLUS';
  return 'MAINTENANCE';
});

getProtocolName() {
  const states: any = {
    'DEFICIT': 'Déficit Activo',
    'SURPLUS': 'Superávit',
    'MAINTENANCE': 'Mantenimiento'
  };
  return states[this.protocolState()];
}

getProtocolClass() {
  const states: any = {
    'DEFICIT': 'bg-emerald-50 border-emerald-100 text-emerald-700',
    'SURPLUS': 'bg-amber-50 border-amber-100 text-amber-700',
    'MAINTENANCE': 'bg-stone-50 border-stone-100 text-stone-600'
  };
  return states[this.protocolState()];
}

getProtocolColor() {
  const colors: any = {
    'DEFICIT': '#10b981', // Emerald 500
    'SURPLUS': '#f59e0b', // Amber 500
    'MAINTENANCE': '#93918B' // Awakin Stone
  };
  return colors[this.protocolState()];
}
}