import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-male-advanced-svg',
  standalone: true,
  templateUrl: './male-advanced-svg.component.html',
  encapsulation: ViewEncapsulation.None
})
export class MaleAdvancedSvgComponent {
  @Input({ required: true }) view: 'front' | 'back' = 'front';
}
