import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-male-standard-svg',
  standalone: true,
  templateUrl: './male-standard-svg.component.html',
  encapsulation: ViewEncapsulation.None
})
export class MaleStandardSvgComponent {
  @Input({ required: true }) view: 'front' | 'back' = 'front';
  @Input() isJointsMode = false;
}
