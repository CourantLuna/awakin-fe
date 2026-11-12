import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-female-advanced-svg',
  standalone: true,
  templateUrl: './female-advanced-svg.component.html',
  encapsulation: ViewEncapsulation.None
})
export class FemaleAdvancedSvgComponent {
  @Input({ required: true }) view: 'front' | 'back' = 'front';
}
