import { Component, OnInit, signal, computed, inject, effect, untracked, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DrawerModule } from 'primeng/drawer';
import { DialogModule } from 'primeng/dialog';
import { WeekCalendarHeaderComponent } from '../../components/week-calendar/week-calendar-header.component';
import { AthleteService } from '../../core/services/athlete.service';
import { AuthService } from '../../core/services/auth.service';
import { StreakService, formatToDateKey } from '../../core/services/streak.service';
import { ThemeService } from '../../core/services/theme.service';
import { WorkoutSupabaseService } from './services/workout-supabase.service';
import { ActiveWorkoutSessionService } from './services/active-workout-session.service';
import { ExerciseApiService } from './services/exercise-api.service';
import { ExerciseSummary, ExerciseDetail } from './models/exercises.models';
import {
  ActiveSessionExercise,
  WEEK_DAY_LABELS,
  WorkoutLog,
  WorkoutPlanRoutine,
  WorkoutRoutine,
  WorkoutRoutineExercise,
  WorkoutSetType,
  WORKOUT_SET_TYPE_LABELS
} from './models/workout.models';
import { ExerciseGalleryDrawerComponent } from './components/exercise-gallery-drawer/exercise-gallery-drawer.component';
import { CustomExerciseModalComponent } from './components/custom-exercise-modal/custom-exercise-modal.component';
import { getEquipmentMeta } from './components/exercise-gallery-drawer/equipment-icons';
import { WorkoutMiniBodyMapComponent, WorkoutMuscleLegendItem, getAwakinSunTone } from './components/body-map/workout-mini-body-map.component';
import { WorkoutLogDetailModalComponent } from './components/workout-log-detail-modal/workout-log-detail-modal.component';
import { WorkoutLogCardComponent } from './components/workout-log-card/workout-log-card.component';
import { WorkoutLogEditModalComponent } from './components/workout-log-edit-modal/workout-log-edit-modal.component';
import { WorkoutStoryModalComponent } from './components/workout-story-modal/workout-story-modal.component';
import { WorkoutLoaderComponent } from '../../components/workout-loader/workout-loader-component';
import { ChartImageExportService } from '../profile/services/chart-image-export.service';
import { BodyMapGender } from './components/body-map/body-map.component';

const DOMINICAN_MOTIVATIONAL_TEMPLATES: string[] = [
  '¡Mete mano, {nombre}, que hoy se rompe ese hierro!',
  '¡Dímelo {nombre}! ¡Hoy no se vino a hacer bulto, a darle con to\' el pie!',
  '¡Actívate {nombre}, que la disciplina no coge esa!',
  '¡{nombre}, dale sin miedo que tú \'tá prendío\' en candela!',
  '¡Con to\' el power, {nombre}! ¡Hoy rompemo\' la liga!',
  '¡{nombre}, no le baje\' ni un chin, que la para ere\' tú!',
  '¡Klk {nombre}! ¡Hoy se guaya el hierro con to\' el peso!',
  '¡Métale candela, {nombre}, que ese cuerpo lo que pide e\' hierro!',
  '¡{nombre}, suéltate en banda y concéntrate en la meta!',
  '¡Hoy se entrena como un titán, {nombre}! ¡Cero bulto y to\' peso!',
  '¡Dando la para en el gym, {nombre}! ¡A sudar con orgullo!',
  '¡{nombre}, tú ere\' una fiera! ¡Métele con fe y sin frenos!',
  '¡Tranquilo pero pesado, {nombre}! ¡A meter mano que pa\' luego e\' tarde!',
  '¡{nombre}, hoy no hay excusas que valgan, e\' pa\' lante que vamo\'!',
  '¡A romper las barras, {nombre}! ¡Que se sienta la presión!',
  '¡{nombre}, ponte pa\' tu número y dale con el corazón!',
  '¡Tú \'tá dur@, {nombre}! ¡Que no te cuenten, sal a demostrarlo!',
  '¡{nombre}, con Dios y con to\' el peso, hoy no se afloja!'
];

@Component({
  selector: 'app-workout-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimeNGModule,
    ChartModule,
    SelectModule,
    DrawerModule,
    DialogModule,
    WeekCalendarHeaderComponent,
    ExerciseGalleryDrawerComponent,
    CustomExerciseModalComponent,
    WorkoutMiniBodyMapComponent,
    WorkoutLogDetailModalComponent,
    WorkoutLogCardComponent,
    WorkoutLogEditModalComponent,
    WorkoutStoryModalComponent,
    WorkoutLoaderComponent
  ],
  templateUrl: './workout-user.component.html'
})
export class WorkoutUserComponent implements OnInit {
  @ViewChild(WeekCalendarHeaderComponent) calendar!: WeekCalendarHeaderComponent;

  public athleteService = inject(AthleteService);
  public authService = inject(AuthService);
  public workoutService = inject(WorkoutSupabaseService);
  public streakService = inject(StreakService);
  public themeService = inject(ThemeService);
  public activeSession = inject(ActiveWorkoutSessionService);
  public exerciseApi = inject(ExerciseApiService);

  readonly weekDayLabels = WEEK_DAY_LABELS;
  readonly weekDays = [1, 2, 3, 4, 5, 6, 7];

  // Estado del calendario
  currentLabel = signal<string>('Hoy');
  selectedDate = signal<Date>(new Date());

  // Mensaje motivacional dominicano aleatorio
  private readonly motivationQuoteIndex = signal<number>(
    Math.floor(Math.random() * DOMINICAN_MOTIVATIONAL_TEMPLATES.length)
  );

  userFirstName = computed<string>(() => {
    const raw = this.athleteService.currentAthlete()?.first_name ||
      this.athleteService.currentAthlete()?.username ||
      this.authService.currentSession()?.avatar?.fullName ||
      '';
    if (!raw) return 'Líder';
    const first = raw.trim().split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  });

  dominicanMotivationMessage = computed<string>(() => {
    const name = this.userFirstName();
    const idx = this.motivationQuoteIndex();
    const template = DOMINICAN_MOTIVATIONAL_TEMPLATES[idx % DOMINICAN_MOTIVATIONAL_TEMPLATES.length];
    return template.replace(/\{nombre\}/g, name);
  });

  refreshMotivationMessage(): void {
    let nextIdx = Math.floor(Math.random() * DOMINICAN_MOTIVATIONAL_TEMPLATES.length);
    if (nextIdx === this.motivationQuoteIndex() && DOMINICAN_MOTIVATIONAL_TEMPLATES.length > 1) {
      nextIdx = (nextIdx + 1) % DOMINICAN_MOTIVATIONAL_TEMPLATES.length;
    }
    this.motivationQuoteIndex.set(nextIdx);
  }

  // Drawers y modales
  isExerciseGalleryOpen = signal<boolean>(false);
  isWeeklyPlanDrawerOpen = signal<boolean>(false);
  isHistoryDrawerOpen = signal<boolean>(false);
  isCreateRoutineModalOpen = signal<boolean>(false);
  isCustomExForBuilderOpen = signal<boolean>(false);
  isRoutineDetailModalOpen = signal<boolean>(false);
  selectedRoutineDetailModal = signal<WorkoutRoutine | null>(null);
  isExerciseDetailModalOpen = signal<boolean>(false);
  inspectedExerciseDetail = signal<ExerciseDetail | null>(null);
  isLoadingExerciseDetail = signal<boolean>(false);

  // Override manual de rutina (cuando el usuario elige otra rutina diferente a la del día)
  selectedRoutineOverrideId = signal<string | null>(null);

  // Builder de nueva rutina y banner
  newRoutineName = signal<string>('');
  newRoutineDescription = signal<string>('');
  newRoutineDay = signal<number | null>(null);
  newRoutineBannerFile = signal<File | null>(null);
  newRoutineBannerPreview = signal<string | null>(null);
  newRoutineExercises = signal<ActiveSessionExercise[]>([]);
  builderSearchQuery = signal<string>('');
  builderSearchResults = signal<ExerciseSummary[]>([]);
  isSearchingBuilder = signal<boolean>(false);
  isSavingRoutine = signal<boolean>(false);
  isUploadingBanner = signal<boolean>(false);
  bannerUploadError = signal<string | null>(null);
  private builderSearchTimer: any = null;

  // Atleta activo
  currentAthleteId = computed(() => {
    return (
      this.athleteService.currentAthlete()?.id ||
      this.authService.currentSession()?.avatar?.id ||
      localStorage.getItem('awakin_active_athlete_id') ||
      ''
    );
  });

  streak = computed(() => this.streakService.currentStreak());

  // Datos reactivos desde WorkoutSupabaseService
  athlete = this.athleteService.currentAthlete;
  activePlan = this.workoutService.activePlan;
  availableRoutines = this.workoutService.allRoutines;
  workoutLogs = this.workoutService.workoutLogs;
  // Estado de carga con duración mínima para permitir animación fluida de carga
  isLoadingWorkouts = signal<boolean>(true);
  private workoutLoadingStartTime = Date.now();
  private workoutLoadingTimer: any = null;

  // Fechas con al menos un entrenamiento completado (solo para sombrear el calendario de Workout)
  workoutActiveDates = computed<Set<string>>(() => {
    const dates = new Set<string>();
    for (const log of this.workoutLogs()) {
      const key = formatToDateKey(log.workout_date);
      if (key) dates.add(key);
    }
    return dates;
  });

  // Modal de Detalle de Entrenamiento Estilo HEVY (Historial)
  selectedWorkoutDetail = signal<WorkoutLog | null>(null);
  isWorkoutDetailOpen = signal<boolean>(false);

  openWorkoutDetail(log: WorkoutLog): void {
    this.selectedWorkoutDetail.set(log);
    this.isWorkoutDetailOpen.set(true);
  }

  closeWorkoutDetail(): void {
    this.isWorkoutDetailOpen.set(false);
    this.selectedWorkoutDetail.set(null);
  }

  // Servicio de exportación de historias 9:16
  private readonly chartExportService = inject(ChartImageExportService);

  // Modal de Edición de Entrenamiento
  isWorkoutEditModalOpen = signal<boolean>(false);
  logToEdit = signal<WorkoutLog | null>(null);

  openWorkoutEditModal(log: WorkoutLog): void {
    this.logToEdit.set(log);
    this.isWorkoutEditModalOpen.set(true);
  }

  onWorkoutLogSaved(updatedLog: WorkoutLog): void {
    this.isWorkoutEditModalOpen.set(false);
    this.logToEdit.set(null);
    if (this.selectedWorkoutDetail()?.id === updatedLog.id) {
      this.selectedWorkoutDetail.set(updatedLog);
    }
    if (updatedLog.workout_date) {
      this.streakService.addActiveDate(updatedLog.workout_date);
    }
  }

  // Modal de Compartir Historia de Entrenamiento
  isShareWorkoutModalOpen = signal<boolean>(false);
  shareWorkoutTargetLog = signal<WorkoutLog | null>(null);

  openWorkoutStoryModal(log: WorkoutLog): void {
    this.shareWorkoutTargetLog.set(log);
    this.isShareWorkoutModalOpen.set(true);
  }

  closeWorkoutStoryModal(): void {
    this.isShareWorkoutModalOpen.set(false);
    this.shareWorkoutTargetLog.set(null);
  }

  getInitials(): string {
    const ath = this.athlete();
    if (!ath) return 'AW';
    if (ath.first_name) {
      return ath.first_name.slice(0, 2).toUpperCase();
    }
    return (ath.username || 'AW').slice(0, 2).toUpperCase();
  }

  // Día de la semana (1 = Lunes .. 7 = Domingo) de la fecha seleccionada en el calendario
  selectedDayOfWeek = computed(() => {
    const jsDay = this.selectedDate().getDay(); // 0=Dom, 1=Lun .. 6=Sab
    return jsDay === 0 ? 7 : jsDay;
  });

  // Comprueba si la fecha seleccionada en el calendar header corresponde exactamente a hoy
  isSelectedDateToday = computed<boolean>(() => {
    const sel = this.selectedDate();
    const today = new Date();
    return (
      sel.getFullYear() === today.getFullYear() &&
      sel.getMonth() === today.getMonth() &&
      sel.getDate() === today.getDate()
    );
  });

  // Día de hoy según reloj local del sistema (1 = Lun .. 7 = Dom)
  todayDayOfWeek = computed(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  });

  // Género del atleta para el Body Map anatómico
  athleteGender = computed<BodyMapGender>(() => {
    const a = this.athleteService.currentAthlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    if (raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino') {
      return 'female';
    }
    return 'male';
  });

  // Mapa día (1..7) -> WorkoutPlanRoutine del plan activo
  weeklyScheduleMap = computed(() => {
    const map = new Map<number, WorkoutPlanRoutine>();
    const plan = this.activePlan();
    if (plan?.plan_routines) {
      for (const link of plan.plan_routines) {
        if (!map.has(link.day_of_week)) {
          map.set(link.day_of_week, link);
        }
      }
    }
    return map;
  });

  // Lista ordenada de rutinas programadas en el plan semanal activo para el carrusel
  scheduledPlanRoutines = computed<WorkoutPlanRoutine[]>(() => {
    const plan = this.activePlan();
    if (!plan?.plan_routines) return [];
    const all = this.availableRoutines();
    return plan.plan_routines
      .map((pr) => {
        if (!pr.routine && pr.routine_id) {
          const found = all.find((r) => r.id === pr.routine_id);
          if (found) {
            return { ...pr, routine: { ...found, day_of_week: pr.day_of_week } };
          }
        }
        return pr;
      })
      .filter((pr): pr is WorkoutPlanRoutine & { routine: WorkoutRoutine } => !!pr.routine)
      .sort((a, b) => a.day_of_week - b.day_of_week);
  });

  // Rutina asignada por el calendario para el día seleccionado
  scheduledRoutineForDay = computed<WorkoutRoutine | null>(() => {
    const link = this.weeklyScheduleMap().get(this.selectedDayOfWeek());
    return link?.routine || null;
  });

  // Rutina activa mostrada en la Hero Card (override manual si existe, sino la del día)
  activeDisplayedRoutine = computed<WorkoutRoutine | null>(() => {
    const overrideId = this.selectedRoutineOverrideId();
    if (overrideId) {
      const found = this.availableRoutines().find((r) => r.id === overrideId);
      if (found) return found;
    }
    return this.scheduledRoutineForDay();
  });

  // ID enlazado al dropdown p-select
  selectedRoutineId = computed(() => this.activeDisplayedRoutine()?.id || null);

  // Todos los logs de entrenamiento completados en la fecha seleccionada del header calendar
  selectedDayLogs = computed<WorkoutLog[]>(() => {
    const sel = this.selectedDate();
    const ymd = `${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}-${String(sel.getDate()).padStart(2, '0')}`;
    return this.workoutLogs().filter((log) => {
      const d = new Date(log.workout_date);
      const logYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return logYmd === ymd;
    });
  });

  // Log de entrenamiento registrado en la fecha seleccionada
  logForSelectedDate = computed<WorkoutLog | null>(() => {
    const logs = this.selectedDayLogs();
    return logs.length > 0 ? logs[0] : null;
  });

  // Label dinámico para el banner completado según el día seleccionado
  completedBannerLabel = computed<string>(() => {
    const raw = (this.currentLabel() || '').trim().toUpperCase();
    if (raw === 'HOY') return 'COMPLETADO HOY';
    if (raw === 'AYER') return 'COMPLETADO AYER';
    if (['LUNES', 'MARTES', 'MIÉRCOLES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'SABADO', 'DOMINGO'].includes(raw)) {
      return `COMPLETADO EL ${raw}`;
    }
    return `COMPLETADO (${raw})`;
  });

  // Analytics / Gráficos con rango temporal seleccionable
  analyticsRange = signal<'7d' | '14d' | '30d' | 'year'>('7d');
  activeChartType = signal<'heatmap' | 'radar' | 'volume' | 'trend'>('heatmap');

  readonly analyticsRangeOptions: Array<{ key: '7d' | '14d' | '30d' | 'year'; label: string; title: string }> = [
    { key: '7d', label: '7D', title: 'Últimos 7 días' },
    { key: '14d', label: '14D', title: 'Últimos 14 días' },
    { key: '30d', label: '30D', title: 'Últimos 30 días' },
    { key: 'year', label: 'Año', title: 'Este año' }
  ];

  readonly chartTypeOptions: Array<{ key: 'heatmap' | 'radar' | 'volume' | 'trend'; label: string; icon: string }> = [
    { key: 'heatmap', label: 'Mapa', icon: 'pi-user' },
    { key: 'radar', label: 'Radar', icon: 'pi-chart-pie' },
    { key: 'volume', label: 'Volumen', icon: 'pi-chart-bar' },
    { key: 'trend', label: 'Series', icon: 'pi-chart-line' }
  ];

  analyticsRangeTitle = computed(() => {
    const found = this.analyticsRangeOptions.find((o) => o.key === this.analyticsRange());
    return found?.title || 'Últimos 7 días';
  });

  filteredAnalyticsLogs = computed<WorkoutLog[]>(() => {
    const logs = this.workoutLogs();
    const range = this.analyticsRange();
    const now = new Date();
    let cutoffMs: number;

    if (range === 'year') {
      cutoffMs = new Date(now.getFullYear(), 0, 1).getTime();
    } else {
      const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
      cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
    }

    return logs
      .filter((log) => new Date(log.workout_date).getTime() >= cutoffMs)
      .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime());
  });

  analyticsSummary = computed(() => {
    const logs = this.filteredAnalyticsLogs();
    let totalVolume = 0;
    let totalSets = 0;
    let totalMinutes = 0;
    const unit = logs[logs.length - 1]?.volume_unit || 'lb';

    for (const log of logs) {
      totalVolume += Number(log.total_volume || 0);
      totalSets += Number(log.total_sets || 0);
      totalMinutes += Number(log.duration_minutes || 0);
    }

    return {
      sessions: logs.length,
      totalVolume: Math.round(totalVolume),
      totalSets,
      totalMinutes,
      unit
    };
  });

  // Mapa de calor muscular agregado en el rango seleccionado (Body Map + Leyenda)
  rangeMuscleBreakdownWithColors = computed<WorkoutMuscleLegendItem[]>(() => {
    const logs = this.filteredAnalyticsLogs();
    const muscleMap = new Map<string, number>();

    for (const log of logs) {
      const byMuscle = log.sets_by_muscle || {};
      let usedSetsByMuscle = false;
      for (const [rawMuscle, sets] of Object.entries(byMuscle)) {
        const count = Number(sets || 0);
        if (count <= 0) continue;
        usedSetsByMuscle = true;
        const translated = this.translateMuscleName(rawMuscle);
        muscleMap.set(translated, (muscleMap.get(translated) || 0) + count);
      }
      if (!usedSetsByMuscle && log.exercises) {
        for (const ex of log.exercises) {
          const completed = (ex.sets || []).filter((s) => s.is_completed !== false).length;
          if (completed <= 0) continue;
          const translated = this.translateMuscleName(ex.target_muscle || 'General');
          muscleMap.set(translated, (muscleMap.get(translated) || 0) + completed);
        }
      }
    }

    const sorted = Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);

    return this.buildMuscleBreakdownWithColors(sorted);
  });

  // Radar Chart dinámico de Carga Muscular según el rango seleccionado
  radarData = computed(() => {
    const logs = this.filteredAnalyticsLogs();
    const buckets: Record<string, number> = {
      Pecho: 0,
      Espalda: 0,
      Piernas: 0,
      Hombros: 0,
      Brazos: 0,
      Core: 0
    };

    for (const log of logs) {
      const byMuscle = log.sets_by_muscle || {};
      for (const [rawMuscle, sets] of Object.entries(byMuscle)) {
        const m = rawMuscle.toLowerCase();
        const val = Number(sets || 0);
        if (m.includes('pec') || m.includes('chest') || m.includes('pecho')) buckets['Pecho'] += val;
        else if (m.includes('lat') || m.includes('back') || m.includes('espalda') || m.includes('trap') || m.includes('rhomb')) buckets['Espalda'] += val;
        else if (m.includes('glute') || m.includes('quad') || m.includes('ham') || m.includes('calv') || m.includes('pierna') || m.includes('cuádriceps') || m.includes('glúteo') || m.includes('isquio') || m.includes('pantorrilla')) buckets['Piernas'] += val;
        else if (m.includes('delt') || m.includes('shoulder') || m.includes('hombro')) buckets['Hombros'] += val;
        else if (m.includes('bicep') || m.includes('tricep') || m.includes('forearm') || m.includes('brazo') || m.includes('bícep') || m.includes('trícep')) buckets['Brazos'] += val;
        else if (m.includes('core') || m.includes('ab') || m.includes('waist')) buckets['Core'] += val;
      }
    }

    const values = Object.values(buckets);
    const hasAnyData = values.some((v) => v > 0);
    const colorPrimary = this.themeService.kinPrimaryColor();
    const colorSecondary = this.themeService.kinSecondaryColor();
    const colorPrimaryLight = this.themeService.withAlpha(colorPrimary, 0.22);

    return {
      labels: Object.keys(buckets),
      datasets: [
        {
          label: `Series (${this.analyticsRangeTitle()})`,
          backgroundColor: colorPrimaryLight,
          borderColor: colorPrimary,
          pointBackgroundColor: colorSecondary,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: colorPrimary,
          data: hasAnyData ? values : [0, 0, 0, 0, 0, 0]
        }
      ]
    };
  });

  // Gráfico de Barras: Volumen levantado por sesión en el rango
  volumeChartData = computed(() => {
    const logs = this.filteredAnalyticsLogs();
    const colorPrimary = this.themeService.kinPrimaryColor();
    const colorSecondary = this.themeService.kinSecondaryColor();
    return {
      labels: logs.map((l) => this.formatShortChartDate(l.workout_date)),
      datasets: [
        {
          label: `Volumen (${this.analyticsSummary().unit})`,
          data: logs.map((l) => Math.round(Number(l.total_volume || 0))),
          backgroundColor: this.themeService.withAlpha(colorPrimary, 0.85),
          hoverBackgroundColor: colorSecondary,
          borderRadius: 8,
          barThickness: logs.length > 10 ? 12 : 22
        }
      ]
    };
  });

  // Gráfico de Línea: Series completadas por sesión en el rango
  setsTrendChartData = computed(() => {
    const logs = this.filteredAnalyticsLogs();
    return {
      labels: logs.map((l) => this.formatShortChartDate(l.workout_date)),
      datasets: [
        {
          label: 'Series totales',
          data: logs.map((l) => Number(l.total_sets || 0)),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff',
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }
      ]
    };
  });

  cartesianChartOptions = {
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#78716c', font: { size: 10, weight: 'bold' } }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f5f5f4' },
        ticks: { color: '#a8a29e', font: { size: 10 } }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  radarOptions = {
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        grid: { color: '#e7e5e4' },
        pointLabels: {
          color: '#57534e',
          font: { family: 'ui-sans-serif', size: 10, weight: 'bold' }
        },
        ticks: { display: false }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  constructor() {
    effect(() => {
      const athleteId = this.currentAthleteId();
      if (!athleteId) return;
      untracked(() => {
        this.workoutService.loadAthleteWorkoutData(athleteId);
      });
    });

    effect(() => {
      const serviceLoading = this.workoutService.isLoading();
      if (serviceLoading) {
        clearTimeout(this.workoutLoadingTimer);
        this.workoutLoadingStartTime = Date.now();
        this.isLoadingWorkouts.set(true);
      } else {
        const elapsed = Date.now() - this.workoutLoadingStartTime;
        const remaining = Math.max(0, 2000 - elapsed);
        clearTimeout(this.workoutLoadingTimer);
        this.workoutLoadingTimer = setTimeout(() => {
          this.isLoadingWorkouts.set(false);
        }, remaining);
      }
    });
  }

  ngOnInit(): void {
    const athleteId = this.currentAthleteId();
    if (athleteId) {
      this.workoutService.loadAthleteWorkoutData(athleteId);
    }
  }

  // Navegación del calendario
  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    // Al cambiar de día en el calendario, volver a la rutina asignada a ese día
    this.selectedRoutineOverrideId.set(null);
  }

  updateLabel(label: string): void {
    this.currentLabel.set(label);
  }

  handleTopBtnAction(): void {
    this.calendar.goToToday();
  }

  toggleCalendarViewMode(): void {
    this.calendar.toggleViewMode();
  }

  // Cambiar rutina manualmente desde el dropdown o desde el Plan Semanal
  onRoutineChange(newId: string): void {
    this.selectedRoutineOverrideId.set(newId);
  }

  selectPlanDayRoutine(dayNumber: number): void {
    const link = this.weeklyScheduleMap().get(dayNumber);
    if (link?.routine) {
      this.selectedRoutineOverrideId.set(link.routine.id);
    }
  }

  // Iniciar sesión de entrenamiento
  startWorkout(routine?: WorkoutRoutine | null): void {
    const target = routine !== undefined ? routine : this.activeDisplayedRoutine();
    if (this.activeSession.hasActiveSession() && target && this.activeSession.routineId() === target.id) {
      this.activeSession.reopenDrawer();
      return;
    }
    this.activeSession.startSession({
      athleteId: this.currentAthleteId(),
      planId: this.activePlan()?.id || null,
      routine: target,
      workoutDate: new Date()
    });
  }

  startFreeWorkout(): void {
    if (this.activeSession.hasActiveSession() && !this.activeSession.routineId()) {
      this.activeSession.reopenDrawer();
      return;
    }
    this.activeSession.startSession({
      athleteId: this.currentAthleteId(),
      planId: this.activePlan()?.id || null,
      routine: null,
      workoutDate: new Date()
    });
  }

  openExerciseGallery(): void {
    this.isExerciseGalleryOpen.set(true);
  }

  async onRoutineBannerSelected(event: Event, routine: WorkoutRoutine): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.isUploadingBanner()) return;

    this.isUploadingBanner.set(true);
    this.bannerUploadError.set(null);
    try {
      await this.workoutService.updateRoutineBanner(routine.id, file);
    } catch (e: any) {
      this.bannerUploadError.set(e?.message || 'Error subiendo banner de la rutina.');
    } finally {
      this.isUploadingBanner.set(false);
    }
  }

  onNewRoutineBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.newRoutineBannerFile.set(file);
    const reader = new FileReader();
    reader.onload = (e: any) => this.newRoutineBannerPreview.set(e.target.result);
    reader.readAsDataURL(file);
  }

  clearNewRoutineBanner(): void {
    this.newRoutineBannerFile.set(null);
    this.newRoutineBannerPreview.set(null);
  }

  // ==========================================
  // BUILDER DE NUEVA RUTINA
  // ==========================================
  openCreateRoutineModal(): void {
    this.newRoutineName.set('');
    this.newRoutineDescription.set('');
    this.newRoutineDay.set(this.selectedDayOfWeek());
    this.clearNewRoutineBanner();
    this.newRoutineExercises.set([]);
    this.isCreateRoutineModalOpen.set(true);
    if (this.builderSearchResults().length === 0) {
      this.searchBuilderExercises();
    }
  }

  onBuilderSearchInput(): void {
    if (this.builderSearchTimer) clearTimeout(this.builderSearchTimer);
    this.builderSearchTimer = setTimeout(() => this.searchBuilderExercises(), 300);
  }

  searchBuilderExercises(): void {
    this.isSearchingBuilder.set(true);
    this.exerciseApi.searchExercises({
      search: this.builderSearchQuery().trim() || undefined,
      limit: 12
    }).subscribe({
      next: (res) => {
        this.builderSearchResults.set(res.data || []);
        this.isSearchingBuilder.set(false);
      },
      error: () => {
        this.isSearchingBuilder.set(false);
      }
    });
  }

  async addBuilderLibraryExercise(item: ExerciseSummary): Promise<void> {
    const detail = await this.workoutService.getCachedExerciseDetail(item.id);
    const ex: ActiveSessionExercise = {
      tempId: `b_${item.id}_${Date.now()}`,
      exercise_api_id: item.id,
      is_custom: false,
      exercise_name: detail?.name || item.name,
      target_muscle: detail?.target || item.target,
      secondary_muscles: detail?.secondary_muscles || item.secondary_muscles || [],
      equipment: detail?.equipment || item.equipment,
      image_url: this.exerciseApi.getMediaUrl(detail?.image || item.image),
      media_urls: [],
      rest_seconds: 90,
      notes: null,
      sets: [
        { set_number: 1, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 2, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false },
        { set_number: 3, set_type: 'WORKING', target_reps: '10-12', reps_completed: 10, weight_used: 0, weight_unit: 'lb', is_completed: false }
      ]
    };
    this.newRoutineExercises.update((list) => [...list, ex]);
  }

  onBuilderCustomExerciseCreated(ex: ActiveSessionExercise): void {
    this.newRoutineExercises.update((list) => [...list, ex]);
  }

  removeBuilderExercise(idx: number): void {
    this.newRoutineExercises.update((list) => list.filter((_, i) => i !== idx));
  }

  async saveNewRoutine(): Promise<void> {
    const athleteId = this.currentAthleteId();
    if (!athleteId || !this.newRoutineName().trim() || this.newRoutineExercises().length === 0 || this.isSavingRoutine()) {
      return;
    }

    this.isSavingRoutine.set(true);
    try {
      const created = await this.workoutService.createRoutine({
        athleteId,
        name: this.newRoutineName(),
        description: this.newRoutineDescription(),
        bannerFile: this.newRoutineBannerFile(),
        planId: this.activePlan()?.id || null,
        dayOfWeek: this.newRoutineDay(),
        exercises: this.newRoutineExercises().map((ex) => ({
          exercise_api_id: ex.exercise_api_id,
          is_custom: ex.is_custom,
          exercise_name: ex.exercise_name,
          target_muscle: ex.target_muscle,
          secondary_muscles: ex.secondary_muscles,
          equipment: ex.equipment,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          sets: ex.sets.map((s) => ({
            set_number: s.set_number,
            set_type: s.set_type,
            target_reps: s.target_reps,
            weight_unit: s.weight_unit
          }))
        }))
      });
      this.selectedRoutineOverrideId.set(created.id);
      this.isCreateRoutineModalOpen.set(false);
    } catch (e) {
      console.error('Error creando rutina:', e);
    } finally {
      this.isSavingRoutine.set(false);
    }
  }

  formatLogDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  }

  getMuscleEntries(setsByMuscle: Record<string, number> | undefined): Array<{ muscle: string; sets: number }> {
    if (!setsByMuscle) return [];
    return Object.entries(setsByMuscle).map(([muscle, sets]) => ({ muscle, sets }));
  }

  // =========================================================================
  // MODAL DETALLE DE RUTINA DESDE EL PLAN SEMANAL (BODY MAP + SERIES + NOTAS)
  // =========================================================================

  openRoutineDetailModal(routine: WorkoutRoutine | null | undefined, dayNum?: number): void {
    if (!routine) return;
    const routineWithDay = dayNum && !routine.day_of_week
      ? { ...routine, day_of_week: dayNum }
      : routine;
    this.selectedRoutineDetailModal.set(routineWithDay);
    this.isRoutineDetailModalOpen.set(true);

    // Hidratar apiDetail en segundo plano para asegurar que las miniaturas y nombres se muestren
    for (const ex of routineWithDay.exercises) {
      if (!ex.is_custom && ex.exercise_api_id && !ex.apiDetail) {
        this.workoutService.getCachedExerciseDetail(ex.exercise_api_id).then((detail) => {
          if (detail) {
            ex.apiDetail = detail;
            ex.exercise_name = ex.exercise_name || detail.name;
            ex.target_muscle = ex.target_muscle || detail.target;
            if (!ex.secondary_muscles || ex.secondary_muscles.length === 0) {
              ex.secondary_muscles = detail.secondary_muscles || [];
            }
            ex.equipment = ex.equipment || detail.equipment;
          }
        });
      }
    }
  }

  getExerciseThumbnail(ex: WorkoutRoutineExercise): string | null {
    if (ex.apiDetail?.image) {
      return this.exerciseApi.getMediaUrl(ex.apiDetail.image);
    }
    if (ex.media_urls && ex.media_urls.length > 0) {
      return this.exerciseApi.getMediaUrl(ex.media_urls[0]);
    }
    return null;
  }

  async inspectRoutineExercise(ex: WorkoutRoutineExercise): Promise<void> {
    if (ex.apiDetail) {
      this.inspectedExerciseDetail.set(ex.apiDetail);
      this.isExerciseDetailModalOpen.set(true);
      return;
    }

    if (ex.exercise_api_id) {
      this.isLoadingExerciseDetail.set(true);
      try {
        const cached = await this.workoutService.getCachedExerciseDetail(ex.exercise_api_id);
        if (cached) {
          ex.apiDetail = cached;
          this.inspectedExerciseDetail.set(cached);
          this.isExerciseDetailModalOpen.set(true);
          return;
        }
      } finally {
        this.isLoadingExerciseDetail.set(false);
      }
    }

    this.inspectedExerciseDetail.set({
      id: ex.id,
      name: ex.exercise_name || 'Ejercicio',
      category: 'General',
      muscle_group: ex.target_muscle || 'General',
      target: ex.target_muscle || 'General',
      secondary_muscles: ex.secondary_muscles || [],
      equipment: ex.equipment || 'General',
      body_part: 'General',
      image: ex.media_urls?.[0] || '',
      gif_url: '',
      attribution: '',
      created_at: new Date().toISOString(),
      instruction: ex.notes || undefined
    });
    this.isExerciseDetailModalOpen.set(true);
  }

  translateEquipmentName(raw: string | null | undefined): string {
    if (!raw) return 'Peso Corporal';
    return getEquipmentMeta(raw).label;
  }

  closeRoutineDetailModal(): void {
    this.isRoutineDetailModalOpen.set(false);
    this.selectedRoutineDetailModal.set(null);
  }

  startWorkoutFromModal(routine: WorkoutRoutine): void {
    this.closeRoutineDetailModal();
    this.startWorkout(routine);
  }

  private muscleTranslations: Record<string, string> = {
    // Pectoral / Pecho
    chest: 'Pecho',
    pectorals: 'Pecho',
    pectoral: 'Pecho',
    'upper chest': 'Pecho superior',
    'mid-lower-pectoralis': 'Pecho medio/bajo',
    'upper-pectoralis': 'Pecho superior',
    'pectoralis major': 'Pecho',

    // Deltoides / Hombros
    delts: 'Hombros',
    deltoids: 'Hombros',
    deltoid: 'Hombros',
    shoulders: 'Hombros',
    'front-shoulders': 'Hombro anterior',
    'anterior-deltoid': 'Hombro anterior',
    'lateral-deltoid': 'Hombro lateral',
    'posterior-deltoid': 'Hombro posterior',
    'rear-shoulders': 'Hombro posterior',

    // Espalda y dorsales
    back: 'Espalda',
    lats: 'Dorsales',
    'latissimus dorsi': 'Dorsales',
    'upper back': 'Espalda alta',
    'lower back': 'Zona lumbar',
    lowerback: 'Zona lumbar',
    'lower-spine': 'Zona lumbar',
    'upper-spine': 'Columna cervical/torácica',
    traps: 'Trapecios',
    trapezius: 'Trapecios',
    'upper-trapezius': 'Trapecio superior',
    'upper-trapzeius': 'Trapecio superior',
    'traps-middle': 'Trapecio medio',
    'lower-trapezius': 'Trapecio inferior',
    scapula: 'Escápula',
    rhomboids: 'Romboides',

    // Brazos
    biceps: 'Bíceps',
    'long-head-bicep': 'Bíceps',
    'short-head-bicep': 'Bíceps',
    triceps: 'Tríceps',
    'medial-head-triceps': 'Tríceps',
    'long-head-triceps': 'Tríceps',
    'lateral-head-triceps': 'Tríceps',
    'later-head-triceps': 'Tríceps',
    forearms: 'Antebrazos',
    forearm: 'Antebrazos',
    'wrist-extensors': 'Antebrazos',
    'wrist-flexors': 'Antebrazos',
    hands: 'Manos',
    wrist: 'Muñecas',
    elbow: 'Codos',

    // Piernas
    quads: 'Cuádriceps',
    quadriceps: 'Cuádriceps',
    'outer-quadricep': 'Cuádriceps',
    'inner-quadricep': 'Cuádriceps',
    'rectus-femoris': 'Cuádriceps',
    hamstrings: 'Isquiotibiales',
    'medial-hamstrings': 'Isquiotibiales',
    'lateral-hamstrings': 'Isquiotibiales',
    glutes: 'Glúteos',
    gluteus: 'Glúteos',
    'gluteus-maximus': 'Glúteos',
    'gluteus-medius': 'Glúteos',
    calves: 'Pantorrillas',
    gastrocnemius: 'Pantorrillas',
    soleus: 'Pantorrillas',
    tibialis: 'Tibial',
    'inner-thigh': 'Aductores',
    adductors: 'Aductores',
    abductors: 'Abductores',
    groin: 'Ingle',
    hips: 'Caderas',
    knees: 'Rodillas',
    ankles: 'Tobillos',
    feet: 'Pies',

    // Core / Abdomen
    abs: 'Abdomen',
    abdominals: 'Abdomen',
    core: 'Core',
    obliques: 'Oblicuos',
    'upper-abdominals': 'Abdomen alto',
    'lower-abdominals': 'Abdomen bajo',

    // General / Otros
    neck: 'Cuello',
    cardio: 'Cardio',
    general: 'General'
  };

  translateMuscleName(raw: string | null | undefined): string {
    if (!raw) return 'General';
    const clean = raw.trim().toLowerCase().replace(/_/g, '-');
    if (this.muscleTranslations[clean]) {
      return this.muscleTranslations[clean];
    }
    const rawLower = raw.trim().toLowerCase();
    if (this.muscleTranslations[rawLower]) {
      return this.muscleTranslations[rawLower];
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  getRoutineMuscleBreakdown(routine: WorkoutRoutine | null | undefined): { muscle: string; sets: number }[] {
    if (!routine) return [];

    const muscleMap = new Map<string, number>();

    if (routine.exercises && routine.exercises.length > 0) {
      for (const ex of routine.exercises) {
        const setsCount = ex.sets?.length || 1;
        const target = ex.target_muscle || ex.apiDetail?.target || 'General';
        const muscleKey = this.translateMuscleName(target);
        muscleMap.set(muscleKey, (muscleMap.get(muscleKey) || 0) + setsCount);
      }
    }

    if (muscleMap.size === 0 && routine.focus_muscles && routine.focus_muscles.length > 0) {
      const perMuscleSets = Math.max(1, Math.round((routine.total_sets || 12) / routine.focus_muscles.length));
      for (const focus of routine.focus_muscles) {
        const muscleKey = this.translateMuscleName(focus);
        muscleMap.set(muscleKey, perMuscleSets);
      }
    }

    return Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
  }

  getRoutineMuscleBreakdownWithColors(routine: WorkoutRoutine | null | undefined): WorkoutMuscleLegendItem[] {
    return this.buildMuscleBreakdownWithColors(this.getRoutineMuscleBreakdown(routine));
  }

  private buildMuscleBreakdownWithColors(list: { muscle: string; sets: number }[]): WorkoutMuscleLegendItem[] {
    if (list.length === 0) return [];
    const primary = this.themeService.kinPrimaryColor();
    const secondary = this.themeService.kinSecondaryColor();
    const maxSets = Math.max(...list.map((item) => item.sets), 1);
    return list.map((item) => {
      const tone = getAwakinSunTone(item.sets, maxSets, primary, secondary);
      return {
        muscle: item.muscle,
        sets: item.sets,
        color: tone.color,
        levelLabel: tone.levelLabel
      };
    });
  }

  private formatShortChartDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return dateStr;
    }
  }

  getSetTypeInfo(setType?: string): { label: string; short: string; badgeClass: string } {
    if (!setType) {
      return { label: 'Efectiva', short: 'E', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    const key = setType.toUpperCase() as WorkoutSetType;
    return (
      WORKOUT_SET_TYPE_LABELS[key] || {
        label: setType,
        short: setType.charAt(0).toUpperCase(),
        badgeClass: 'bg-stone-100 text-stone-700 border-stone-200'
      }
    );
  }

  getExactMuscleBreakdown(log: WorkoutLog | null | undefined): { muscle: string; sets: number }[] {
    if (!log) return [];

    const muscleMap = new Map<string, number>();

    // 1. Contar directamente desde los ejercicios y series completadas
    if (log.exercises && log.exercises.length > 0) {
      for (const ex of log.exercises) {
        const completedCount = (ex.sets || []).filter((s) => s.is_completed !== false).length;
        if (completedCount === 0) continue;

        const muscleKey = this.translateMuscleName(ex.target_muscle || 'General');
        muscleMap.set(muscleKey, (muscleMap.get(muscleKey) || 0) + completedCount);
      }
    }

    // 2. Si no había ejercicios cargados o el map quedó vacío, usar sets_by_muscle traduciendo los nombres
    if (muscleMap.size === 0 && log.sets_by_muscle) {
      for (const [key, count] of Object.entries(log.sets_by_muscle)) {
        if (count > 0) {
          const muscleKey = this.translateMuscleName(key);
          muscleMap.set(muscleKey, (muscleMap.get(muscleKey) || 0) + count);
        }
      }
    }

    // Retornar ordenado de mayor a menor número de series
    return Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
  }

  getExactMuscleBreakdownWithColors(log: WorkoutLog | null | undefined): WorkoutMuscleLegendItem[] {
    const list = this.getExactMuscleBreakdown(log);
    if (list.length === 0) return [];
    const primary = this.themeService.kinPrimaryColor();
    const secondary = this.themeService.kinSecondaryColor();
    const maxSets = Math.max(...list.map((item) => item.sets), 1);
    return list.map((item) => {
      const tone = getAwakinSunTone(item.sets, maxSets, primary, secondary);
      return {
        muscle: item.muscle,
        sets: item.sets,
        color: tone.color,
        levelLabel: tone.levelLabel
      };
    });
  }
}
