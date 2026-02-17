import { Component, input, computed, ViewChild, ElementRef } from '@angular/core';
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

  maxLimit = computed(() => this.maintC() * 1.1);

  // El porcentaje de llenado del arco
  progressStroke = computed(() => {
    const percentage = Math.min(this.consumed() / this.maxLimit(), 1);
    const totalLength = 280; 
    return `${percentage * totalLength}, 1000`;
  });

  /**
   * getMarkerTransform: Obtiene las coordenadas exactas del DOM
   * para asegurar que los palitos estén sobre el arco.
   */
  // ... dentro de la clase IntakeProgressWidgetComponent

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
}