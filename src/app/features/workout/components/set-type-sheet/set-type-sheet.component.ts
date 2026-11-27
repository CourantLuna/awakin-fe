import { Component, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutSetType } from '../../models/workout.models';

export interface SetTypeOption {
  type: WorkoutSetType;
  letter: string;
  colorClass: string;
  label: string;
  description: string;
}

export const SET_TYPE_OPTIONS: SetTypeOption[] = [
  {
    type: 'WARMUP',
    letter: 'W',
    colorClass: 'text-amber-500',
    label: 'Serie de Calentamiento',
    description: 'Serie ligera para activar el músculo, lubricar articulaciones y preparar el patrón de movimiento antes del peso efectivo.',
  },
  {
    type: 'WORKING',
    letter: '#',
    colorClass: 'text-stone-900',
    label: 'Serie Normal',
    description: 'Serie efectiva estándar dentro del rango de repeticiones y carga objetivo.',
  },
  {
    type: 'FAILURE',
    letter: 'F',
    colorClass: 'text-rose-500',
    label: 'Serie al Fallo',
    description: 'Llevar la serie hasta no poder completar una repetición más con buena técnica.',
  },
  {
    type: 'DROPSET',
    letter: 'D',
    colorClass: 'text-sky-500',
    label: 'Serie Drop',
    description: 'Reducir el peso inmediatamente al terminar las repeticiones para seguir sacando más reps sin descanso.',
  },
  {
    type: 'AMRAP',
    letter: 'A',
    colorClass: 'text-emerald-500',
    label: 'Serie AMRAP',
    description: 'Realizar tantas repeticiones como sea posible (As Many Reps As Possible) manteniendo la técnica.',
  },
  {
    type: 'SUPERSET',
    letter: 'S',
    colorClass: 'text-indigo-500',
    label: 'Superserie',
    description: 'Ejecutar esta serie encadenada sin descanso con el siguiente ejercicio.',
  },
];

export function getCompactSetDisplay(setType: string | undefined, setNumber: number): { text: string; colorClass: string; title: string } {
  const t = String(setType || 'WORKING').toUpperCase() as WorkoutSetType;
  const opt = SET_TYPE_OPTIONS.find((o) => o.type === t) || SET_TYPE_OPTIONS[1];
  return {
    text: opt.type === 'WORKING' ? String(setNumber) : opt.letter,
    colorClass: opt.colorClass,
    title: opt.label,
  };
}

@Component({
  selector: 'app-set-type-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './set-type-sheet.component.html',
})
export class SetTypeSheetComponent {
  visible = model<boolean>(false);
  currentType = input<WorkoutSetType>('WORKING');
  setNumber = input<number>(1);
  canDelete = input<boolean>(false);

  typeSelected = output<WorkoutSetType>();
  deleteSet = output<void>();

  readonly options = SET_TYPE_OPTIONS;
  expandedInfo = signal<WorkoutSetType | null>(null);

  toggleInfo(type: WorkoutSetType, ev: Event): void {
    ev.stopPropagation();
    this.expandedInfo.set(this.expandedInfo() === type ? null : type);
  }

  select(type: WorkoutSetType): void {
    this.typeSelected.emit(type);
    this.visible.set(false);
    this.expandedInfo.set(null);
  }

  remove(): void {
    this.deleteSet.emit();
    this.visible.set(false);
    this.expandedInfo.set(null);
  }
}
