import { Component, Input, ViewEncapsulation } from '@angular/core';
import { BodyMapAnatomyMode, BodyMapGender } from '../body-map.component';
import { MaleAdvancedSvgComponent } from './male-advanced-svg.component';
import { FemaleAdvancedSvgComponent } from './female-advanced-svg.component';
import { MaleStandardSvgComponent } from './male-standard-svg.component';
import { FemaleStandardSvgComponent } from './female-standard-svg.component';

@Component({
  selector: 'app-body-map-model-svg',
  standalone: true,
  imports: [
    MaleAdvancedSvgComponent,
    FemaleAdvancedSvgComponent,
    MaleStandardSvgComponent,
    FemaleStandardSvgComponent
  ],
  templateUrl: './body-map-model-svg.component.html',
  encapsulation: ViewEncapsulation.None
})
export class BodyMapModelSvgComponent {
  @Input({ required: true }) gender: BodyMapGender = 'male';
  @Input({ required: true }) anatomyMode: BodyMapAnatomyMode = 'advanced';
  @Input({ required: true }) view: 'front' | 'back' = 'front';
  @Input() isJointsMode = false;
}
