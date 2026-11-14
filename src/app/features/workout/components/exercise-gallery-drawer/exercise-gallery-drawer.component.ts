import { Component, model, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { PopoverModule } from 'primeng/popover';
import { BodyMapComponent, BodyMapGender, BodyMapAnatomyMode, MuscleRegion } from '../body-map/body-map.component';

export interface ExerciseItem {
  id: string;
  name: string;
  primaryMuscleId: string;
  primaryMuscleName: string;
  equipment: string;
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  thumbnailUrl?: string;
  tags?: string[];
}

export const AVAILABLE_EQUIPMENT: string[] = [
  'Barra',
  'Mancuernas',
  'Poleas',
  'Máquinas',
  'Peso Corporal',
  'Bandas',
  'Kettlebell',
  'Banco'
];

// Mock de base inicial para demostración y prototipado
const MOCK_EXERCISES: ExerciseItem[] = [
  {
    id: 'ex-1',
    name: 'Press de Banca Plano con Barra',
    primaryMuscleId: 'mid-lower-pectoralis',
    primaryMuscleName: 'Pectoral medio e inferior',
    equipment: 'Barra',
    difficulty: 'Intermedio',
    tags: ['Pecho', 'Empuje', 'Fuerza']
  },
  {
    id: 'ex-2',
    name: 'Press Inclinado con Mancuernas',
    primaryMuscleId: 'upper-pectoralis',
    primaryMuscleName: 'Pectoral superior',
    equipment: 'Mancuernas',
    difficulty: 'Intermedio',
    tags: ['Pecho', 'Clavicular']
  },
  {
    id: 'ex-3',
    name: 'Sentadilla Libre Trasera',
    primaryMuscleId: 'rectus-femoris',
    primaryMuscleName: 'Cuádriceps',
    equipment: 'Barra',
    difficulty: 'Avanzado',
    tags: ['Piernas', 'Cuádriceps', 'Compuesto']
  },
  {
    id: 'ex-4',
    name: 'Prensa de Piernas 45°',
    primaryMuscleId: 'outer-quadricep',
    primaryMuscleName: 'Cuádriceps lateral',
    equipment: 'Máquinas',
    difficulty: 'Principiante',
    tags: ['Piernas', 'Hipertrofia']
  },
  {
    id: 'ex-5',
    name: 'Dominadas Pronas (Pull-ups)',
    primaryMuscleId: 'lats',
    primaryMuscleName: 'Dorsal ancho',
    equipment: 'Peso Corporal',
    difficulty: 'Avanzado',
    tags: ['Espalda', 'Tracción', 'Calistenia']
  },
  {
    id: 'ex-6',
    name: 'Jalón al Pecho en Polea',
    primaryMuscleId: 'lats',
    primaryMuscleName: 'Dorsal ancho',
    equipment: 'Poleas',
    difficulty: 'Principiante',
    tags: ['Espalda', 'Amplitud']
  },
  {
    id: 'ex-7',
    name: 'Remo con Barra Pendlay',
    primaryMuscleId: 'traps-middle',
    primaryMuscleName: 'Trapecio medio',
    equipment: 'Barra',
    difficulty: 'Avanzado',
    tags: ['Espalda', 'Densidad']
  },
  {
    id: 'ex-8',
    name: 'Elevaciones Laterales con Mancuerna',
    primaryMuscleId: 'lateral-deltoid',
    primaryMuscleName: 'Deltoides lateral',
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    tags: ['Hombros', 'Aislamiento']
  },
  {
    id: 'ex-9',
    name: 'Press Militar de Pie (Overhead Press)',
    primaryMuscleId: 'anterior-deltoid',
    primaryMuscleName: 'Deltoides anterior',
    equipment: 'Barra',
    difficulty: 'Intermedio',
    tags: ['Hombros', 'Fuerza']
  },
  {
    id: 'ex-10',
    name: 'Curl de Bíceps en Banco Scott con Barra Z',
    primaryMuscleId: 'short-head-bicep',
    primaryMuscleName: 'Bíceps (cabeza corta)',
    equipment: 'Barra',
    difficulty: 'Intermedio',
    tags: ['Brazos', 'Bíceps']
  },
  {
    id: 'ex-11',
    name: 'Extensión de Tríceps en Polea Alta',
    primaryMuscleId: 'lateral-head-triceps',
    primaryMuscleName: 'Tríceps (cabeza lateral)',
    equipment: 'Poleas',
    difficulty: 'Principiante',
    tags: ['Brazos', 'Tríceps']
  },
  {
    id: 'ex-12',
    name: 'Peso Muerto Rumano con Barra',
    primaryMuscleId: 'lateral-hamstrings',
    primaryMuscleName: 'Isquiotibiales',
    equipment: 'Barra',
    difficulty: 'Intermedio',
    tags: ['Piernas', 'Cadena Posterior']
  },
  {
    id: 'ex-13',
    name: 'Hip Thrust con Barra en Banco',
    primaryMuscleId: 'gluteus-maximus',
    primaryMuscleName: 'Glúteo mayor',
    equipment: 'Barra',
    difficulty: 'Intermedio',
    tags: ['Glúteos', 'Potencia']
  },
  {
    id: 'ex-14',
    name: 'Elevación de Gemelos en Máquina de Pie',
    primaryMuscleId: 'gastrocnemius',
    primaryMuscleName: 'Gastrocnemio (Gemelos)',
    equipment: 'Máquinas',
    difficulty: 'Principiante',
    tags: ['Pantorrillas']
  },
  {
    id: 'ex-15',
    name: 'Abdominales en Polea Alta (Kneeling Cable Crunch)',
    primaryMuscleId: 'upper-abdominals',
    primaryMuscleName: 'Abdominales superiores',
    equipment: 'Poleas',
    difficulty: 'Intermedio',
    tags: ['Core', 'Abdomen']
  }
];

@Component({
  selector: 'app-exercise-gallery-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimeNGModule,
    PopoverModule,
    BodyMapComponent
  ],
  templateUrl: './exercise-gallery-drawer.component.html'
})
export class ExerciseGalleryDrawerComponent {
  isOpen = model<boolean>(false);

  // Estados de Búsqueda y Filtros
  searchQuery = signal<string>('');
  selectedEquipment = signal<string | null>(null);
  selectedMuscle = signal<MuscleRegion | null>(null);

  // Estados de visualización del mapa corporal
  activeView = signal<'bodymap' | 'list'>('bodymap');
  bodyMapGender = signal<BodyMapGender>('male');
  bodyMapAnatomy = signal<BodyMapAnatomyMode>('advanced');

  // Catálogos
  equipmentOptions = AVAILABLE_EQUIPMENT;
  exercises = signal<ExerciseItem[]>(MOCK_EXERCISES);

  // Conteo de filtros activos
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.selectedEquipment()) count++;
    if (this.selectedMuscle()) count++;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  // Ejercicios filtrados reactivamente
  filteredExercises = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const equip = this.selectedEquipment();
    const muscle = this.selectedMuscle();

    return this.exercises().filter((ex) => {
      // Filtro por texto libre
      if (query) {
        const matchesName = ex.name.toLowerCase().includes(query);
        const matchesMuscle = ex.primaryMuscleName.toLowerCase().includes(query);
        const matchesTags = ex.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesMuscle && !matchesTags) {
          return false;
        }
      }

      // Filtro por equipamiento
      if (equip && equip !== 'Todos' && ex.equipment !== equip) {
        return false;
      }

      // Filtro por músculo del mapa
      if (muscle && ex.primaryMuscleId !== muscle.id) {
        // Validación de coincidencia directa o por categoría estándar
        const muscleId = muscle.id.toLowerCase();
        const exMuscleId = ex.primaryMuscleId.toLowerCase();
        if (!exMuscleId.includes(muscleId) && !muscleId.includes(exMuscleId)) {
          return false;
        }
      }

      return true;
    });
  });

  // Handlers del Body Map
  onMuscleSelected(muscle: MuscleRegion): void {
    if (this.selectedMuscle()?.id === muscle.id) {
      this.selectedMuscle.set(null);
    } else {
      this.selectedMuscle.set(muscle);
    }
  }

  onMuscleSelectionCleared(): void {
    this.selectedMuscle.set(null);
  }

  // Métodos de filtros
  setEquipment(eq: string | null): void {
    this.selectedEquipment.set(eq === 'Todos' ? null : eq);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearMuscleFilter(): void {
    this.selectedMuscle.set(null);
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.selectedEquipment.set(null);
    this.selectedMuscle.set(null);
  }

  close(): void {
    this.isOpen.set(false);
  }
}

