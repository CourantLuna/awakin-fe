import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
    selector: 'app-workout-loader',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './workout-loader.component.html',
    styleUrl: './workout-loader.component.css',
    host: {
        '[class.workout-loader-host--overlay]': "mode() === 'overlay'",
        '[class.workout-loader-host--inline]': "mode() === 'inline'",
    },
})
export class WorkoutLoaderComponent {
    mode = input<'inline' | 'overlay'>('inline');
    label = input<string>('Cargando entrenamientos...');
    active = input<boolean>(true);
}
