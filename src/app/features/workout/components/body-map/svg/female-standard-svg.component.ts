import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-female-standard-svg',
  standalone: true,
  templateUrl: './female-standard-svg.component.html',
  encapsulation: ViewEncapsulation.None
})
export class FemaleStandardSvgComponent {
  @Input({ required: true }) view: 'front' | 'back' = 'front';
  @Input() isJointsMode = false;
}
