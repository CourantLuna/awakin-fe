import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
    selector: 'app-intake-loader',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './intake-loader.component.html',
    styleUrl: './intake-loader.component.css',
    host: {
        '[class.intake-loader-host--overlay]': "mode() === 'overlay'",
        '[class.intake-loader-host--inline]': "mode() === 'inline'",
    },
})
export class IntakeLoaderComponent {
    mode = input<'inline' | 'overlay'>('inline');
    label = input<string>('Cargando Intake...');
    active = input<boolean>(true);
}