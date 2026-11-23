import { Component, inject, OnInit, OnDestroy, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { supabaseClient } from '../../core/services/supabase.service';
import {
  AthleteService,
  AthleteProfile,
  AthleteSearchResult,
  AthleteFeedPost,
  AthleteNutritionProtocol,
  AthleteRecordsResponse,
  KinInfo,
  NutritionMealRecord,
  ProgressMetricRecord
} from '../../core/services/athlete.service';
import { WorkoutSupabaseService } from '../workout/services/workout-supabase.service';
import {
  WorkoutLog,
  WorkoutLogExercise,
  WorkoutLogSet,
  WORKOUT_SET_TYPE_LABELS,
  WorkoutSetType
} from '../workout/models/workout.models';
import { ChartImageExportService } from './services/chart-image-export.service';
import { BodyMapGender } from '../workout/components/body-map/body-map.component';
import {
  WorkoutMiniBodyMapComponent,
  WorkoutMuscleLegendItem,
  getAwakinSunTone
} from '../workout/components/body-map/workout-mini-body-map.component';
import { WorkoutLogDetailModalComponent } from '../workout/components/workout-log-detail-modal/workout-log-detail-modal.component';
import { WorkoutLogCardComponent } from '../workout/components/workout-log-card/workout-log-card.component';
import { WorkoutLogEditModalComponent } from '../workout/components/workout-log-edit-modal/workout-log-edit-modal.component';
import { WorkoutStoryModalComponent } from '../workout/components/workout-story-modal/workout-story-modal.component';
import { FoodStoryModalComponent, StoryShareData, translateMealType } from '../intake/components/food-story-modal/food-story-modal.component';

export type ProfileFeedTab = 'posts' | 'meals' | 'workouts' | 'progress';

@Component({
  selector: 'app-profile-avatar.component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimeNGModule,
    WorkoutLogDetailModalComponent,
    WorkoutLogCardComponent,
    WorkoutLogEditModalComponent,
    WorkoutStoryModalComponent,
    FoodStoryModalComponent
  ],
  templateUrl: './profile-avatar.component.html',
  styleUrl: './profile-avatar.component.css',
})
export class ProfileAvatarComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public athleteService = inject(AthleteService);
  public workoutService = inject(WorkoutSupabaseService);
  public themeService = inject(ThemeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private routeSub?: Subscription;

  // Modal de Seguidores / Siguiendo
  public isFollowListModalOpen = signal<boolean>(false);
  public followListTab = signal<'followers' | 'following'>('followers');
  public followListItems = signal<AthleteSearchResult[]>([]);
  public followListLoading = signal<boolean>(false);
  public followListFilter = signal<string>('');
  public followListTogglingId = signal<string | null>(null);

  public filteredFollowList = computed<AthleteSearchResult[]>(() => {
    const q = this.followListFilter().trim().toLowerCase();
    const list = this.followListItems();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.kin_name || '').toLowerCase().includes(q)
    );
  });

  // Modo Perfil Público (solo lectura cuando se navega a /avatar/:identifier de otro atleta)
  public routeIdentifier = signal<string | null>(null);
  private publicAthlete = signal<AthleteProfile | null>(null);
  private publicRecords = signal<AthleteRecordsResponse | null>(null);
  private publicPosts = signal<AthleteFeedPost[]>([]);
  private publicWorkoutLogs = signal<WorkoutLog[]>([]);
  private publicNutritionProtocol = signal<AthleteNutritionProtocol | null>(null);
  private publicLoading = signal<boolean>(false);
  public isFollowingPublic = signal<boolean>(false);
  public isTogglingFollow = signal<boolean>(false);

  public isPublicProfileMode = computed<boolean>(() => {
    const param = (this.routeIdentifier() || '').trim().toLowerCase();
    if (!param) return false;
    const me = this.athleteService.currentAthlete();
    if (me && (me.id.toLowerCase() === param || (me.username || '').toLowerCase() === param)) {
      return false;
    }
    return true;
  });

  // Estado del perfil del atleta activo (propio o público en modo lectura)
  athlete = computed(() => (this.isPublicProfileMode() ? this.publicAthlete() : this.athleteService.currentAthlete()));
  athletesList = this.athleteService.availableAthletes;
  records = computed(() => (this.isPublicProfileMode() ? this.publicRecords() : this.athleteService.currentRecords()));
  posts = computed(() => (this.isPublicProfileMode() ? this.publicPosts() : this.athleteService.currentPosts()));
  workoutLogs = computed(() => (this.isPublicProfileMode() ? this.publicWorkoutLogs() : this.workoutService.workoutLogs()));
  isLoading = computed(() => (this.isPublicProfileMode() ? this.publicLoading() : this.athleteService.isLoading()));
  nutritionProtocol = computed(() =>
    this.isPublicProfileMode() ? this.publicNutritionProtocol() : this.athleteService.currentNutritionProtocol()
  );

  // Protocolo nutricional activo formateado y tipado
  currentProtocol = computed(() => {
    const p = this.nutritionProtocol();
    if (!p) {
      return {
        name: 'Sin Protocolo Asignado',
        colorClass: 'bg-stone-100 border-stone-200 text-stone-600',
        icon: 'pi pi-circle text-stone-400',
        kcal: null,
        hasProtocol: false
      };
    }
    const typeMap: Record<string, { label: string; color: string; icon: string }> = {
      DEFICIT: {
        label: 'Déficit Calórico',
        color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: 'pi pi-arrow-down-right text-emerald-600'
      },
      SURPLUS: {
        label: 'Superávit Calórico',
        color: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: 'pi pi-arrow-up-right text-amber-600'
      },
      MAINTENANCE: {
        label: 'Mantenimiento',
        color: 'bg-stone-100 border-stone-200 text-stone-800',
        icon: 'pi pi-arrows-h text-stone-600'
      },
      RECOMPOSITION: {
        label: 'Recomposición Corporal',
        color: 'bg-sky-50 border-sky-200 text-sky-800',
        icon: 'pi pi-sync text-sky-600'
      }
    };
    const key = (p.protocol || '').toUpperCase().trim();
    const info = typeMap[key] || {
      label: p.protocol || 'Protocolo Activo',
      color: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: 'pi pi-bullseye text-amber-500'
    };
    return {
      name: info.label,
      kcal: p.goal_kcal,
      colorClass: info.color,
      icon: info.icon,
      hasProtocol: true
    };
  });

  private lastLoadedWorkoutAthleteId: string | null = null;

  constructor() {
    effect(() => {
      if (this.isPublicProfileMode()) return;
      const id = this.athlete()?.id;
      if (id && id !== this.lastLoadedWorkoutAthleteId) {
        this.lastLoadedWorkoutAthleteId = id;
        untracked(() => {
          this.workoutService.loadWorkoutLogs(id);
          this.athleteService.loadNutritionProtocol(id);
        });
      }
    });
  }

  // Control de las pestañas del feed (posts, comidas, workouts)
  activeTab = signal<ProfileFeedTab>('posts');

  // Control de modales y menús
  isEditModalOpen = signal<boolean>(false);
  isSwitcherOpen = signal<boolean>(false);
  isMenuOpen = signal<boolean>(false);
  selectedMeal = signal<NutritionMealRecord | null>(null);
  selectedPost = signal<AthleteFeedPost | null>(null);

  // Modal de Historia de Comida Interactiva 9:16
  protected readonly translateMealType = translateMealType;
  isFoodStoryModalOpen = signal<boolean>(false);
  foodStoryData = signal<StoryShareData | null>(null);

  openFoodStoryModal(meal?: NutritionMealRecord | null): void {
    const m = meal || this.selectedMeal();
    if (!m) return;
    const d = m.timestamp ? new Date(m.timestamp) : new Date();
    const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d).replace('.', '');
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d);
    const dateFormatted = `${dayName}, ${d.getDate()} ${monthName}`;

    this.foodStoryData.set({
      photoUrl: m.foto_url || '',
      dateFormatted: dateFormatted,
      mealTitle: translateMealType(m.tipo_comida),
      dishName: m.nombre || m.plato_estimado || 'Plato Registrado',
      emoji: '🍽️',
      portionText: m.items_count && m.items_count > 1 ? `${m.items_count} alimentos` : '1 porción',
      kcal: Math.round(Number(m.calorias || 450)),
      protein: Math.round(Number(m.proteinas || 30)),
      carbs: Math.round(Number(m.carbohidratos || 40)),
      fat: Math.round(Number(m.grasas || 12)),
      dishes: m.dishes?.map((name) => ({
        name,
        portionText: '1 porción',
        kcal: Math.round(Number(m.calorias || 0) / (m.dishes?.length || 1)),
      })),
      adherence: m.adherencia,
    });
    this.isFoodStoryModalOpen.set(true);
  }

  // Modal y controles de Avatar (Zoom, Cut y subida a bucket 'avatars')
  isAvatarModalOpen = signal<boolean>(false);
  rawAvatarImage = signal<string | null>(null);
  avatarZoom = signal<number>(1);
  avatarPanX = signal<number>(0);
  avatarPanY = signal<number>(0);
  isUploadingAvatar = signal<boolean>(false);
  avatarUploadSuccess = signal<boolean>(false);
  public isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  // Modal y controles de Nueva Publicación (Subida a bucket 'feed_posts')
  isNewPostModalOpen = signal<boolean>(false);
  selectedPostFile = signal<File | null>(null);
  postFilePreview = signal<string | null>(null);
  newPostMediaUrl = signal<string>('');
  newPostCaption = signal<string>('');
  newPostModule = signal<'GENERAL' | 'INTAKE' | 'WORKOUT'>('GENERAL');
  isCreatingPost = signal<boolean>(false);
  createPostSuccess = signal<boolean>(false);
  createPostError = signal<string | null>(null);

  // Formulario de edición reactivo
  editFirstName = signal<string>('');
  editLastName = signal<string>('');
  editUsername = signal<string>('');
  editBio = signal<string>('');
  isSaving = signal<boolean>(false);
  saveSuccess = signal<boolean>(false);
  saveError = signal<string | null>(null);

  // Verificación reactiva de username tipo Instagram (disponibilidad en tiempo real)
  usernameCheckStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  usernameFeedbackMessage = signal<string>('');
  private usernameCheckTimer: any = null;

  // Comidas con foto (deduplicadas por foto: 1 sola foto por registro múltiple y solo activos)
  mealPhotos = computed<NutritionMealRecord[]>(() => {
    const list = this.records()?.meals || [];
    // 1. Filtrar solo registros que tengan foto_url y que estén activos (is_active !== false)
    const activeWithPhoto = list.filter((m) => !!m.foto_url && m.is_active !== false);

    // 2. Si hay más de un registro nutricional por foto, debe ser 1 sola foto en la galería
    const photoMap = new Map<string, NutritionMealRecord>();
    for (const m of activeWithPhoto) {
      const url = m.foto_url!.trim();
      const dishName = m.plato_estimado || m.nombre || 'Plato';
      if (!photoMap.has(url)) {
        photoMap.set(url, {
          ...m,
          nombre: dishName,
          plato_estimado: dishName,
          dishes: dishName ? [dishName] : [],
          items_count: 1,
        });
      } else {
        const existing = photoMap.get(url)!;
        if (dishName && !existing.dishes?.includes(dishName)) {
          existing.dishes = [...(existing.dishes || []), dishName];
          existing.nombre = existing.dishes.join(' + ');
          existing.plato_estimado = existing.nombre;
        }
        if (m.calorias) existing.calorias = (existing.calorias || 0) + Number(m.calorias);
        if (m.proteinas) existing.proteinas = (existing.proteinas || 0) + Number(m.proteinas);
        if (m.carbohidratos) existing.carbohidratos = (existing.carbohidratos || 0) + Number(m.carbohidratos);
        if (m.grasas) existing.grasas = (existing.grasas || 0) + Number(m.grasas);
        if (m.notas && !existing.notas?.includes(m.notas)) {
          existing.notas = existing.notas ? `${existing.notas} | ${m.notas}` : m.notas;
        }
        existing.items_count = (existing.items_count || 1) + 1;
      }
    }

    return Array.from(photoMap.values());
  });

  // ==========================================
  // PRIVACIDAD: CONTROL DE ACCESO AL 4TO TAB
  // Solo el dueño de la cuenta puede ver sus medidas corporales y logs de progreso
  // ==========================================
  isOwner = computed(() => {
    if (this.isPublicProfileMode()) return false;
    const current = this.athlete();
    const session = this.authService.currentSession();
    if (!current) return false;

    // 1. Coincide ID del usuario autenticado
    if (session?.avatar?.id && current.id && session.avatar.id === current.id) {
      return true;
    }

    // 2. Coincide email del usuario autenticado
    const sEmail = session?.avatar?.email?.trim().toLowerCase();
    const aEmail = current.email?.trim().toLowerCase();
    if (sEmail && aEmail && sEmail === aEmail) {
      return true;
    }

    // 3. Atleta activo seleccionado en localStorage
    const savedId = localStorage.getItem('awakin_active_athlete_id');
    if (savedId && savedId === current.id) {
      return true;
    }

    // 4. Acceso de gestión: si el usuario autenticado es Head Coach o Instructor del Kin del atleta
    const authId = session?.avatar?.id;
    if (authId && current.kin?.id) {
      if (current.kin.head_coach_id === authId) {
        return true;
      }
      const isKinInstructor = (current.kin.instructors || []).some(
        (inst) => inst.instructor_id === authId
      );
      if (isKinInstructor) {
        return true;
      }
    }

    return false;
  });

  // Preferencia de unidad de peso en visualización ('lb' o 'kg')
  preferredWeightUnit = signal<'kg' | 'lb'>('lb');

  // Registros de progreso
  progressRecords = computed(() => {
    return this.records()?.progress || [];
  });

  // Orden cronológico (antiguo -> nuevo) para gráficos
  chronologicalProgress = computed(() => {
    return [...this.progressRecords()].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });

  // Orden descendente (nuevo -> antiguo) para el log fotográfico
  descendingProgress = computed(() => {
    return [...this.progressRecords()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  // Último registro
  latestRecord = computed(() => {
    const list = this.descendingProgress();
    return list.length > 0 ? list[0] : null;
  });

  // Primer registro
  firstRecord = computed(() => {
    const list = this.chronologicalProgress();
    return list.length > 0 ? list[0] : null;
  });

  // Delta de peso (cambio total desde el inicio)
  weightDelta = computed(() => {
    const first = this.firstRecord();
    const latest = this.latestRecord();
    if (!first || !latest || first.peso == null || latest.peso == null) return null;

    const unit = this.preferredWeightUnit();
    const firstW = this.convertWeight(Number(first.peso), first.unidad_peso, unit);
    const latestW = this.convertWeight(Number(latest.peso), latest.unidad_peso, unit);
    const diff = latestW - firstW;
    return {
      diff: Number(diff.toFixed(1)),
      unit: unit,
      percent: Number(((diff / firstW) * 100).toFixed(1)),
      isLoss: diff < 0
    };
  });

  // TMB, Nivel de Actividad y TDEE compartidos desde AthleteService (solo lectura en estadísticas)
  currentTmb = this.athleteService.currentTmb;
  currentActivityLevel = this.athleteService.currentActivityLevel;
  currentTdee = this.athleteService.currentTdee;

  // Gráfico 1: Evolución de Peso (SVG interactivo)
  weightChartData = computed(() => {
    const items = this.chronologicalProgress();
    const targetUnit = this.preferredWeightUnit();
    const width = 460;
    const height = 190;
    const paddingX = 45;
    const paddingY = 25;

    const validPoints = items
      .filter((item) => item.peso != null && Number(item.peso) > 0)
      .map((item) => {
        const date = new Date(item.timestamp);
        const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
        const weightVal = this.convertWeight(Number(item.peso), item.unidad_peso, targetUnit);
        return {
          id: item.id,
          dateLabel,
          weight: Number(weightVal.toFixed(1)),
          original: item
        };
      });

    if (validPoints.length === 0) {
      return { hasData: false, points: [], path: '', areaPath: '', gridLines: [], width, height, minW: 0, maxW: 100 };
    }

    const weights = validPoints.map((p) => p.weight);
    let minW = Math.min(...weights);
    let maxW = Math.max(...weights);

    if (minW === maxW) {
      minW = Math.max(0, minW - 5);
      maxW = maxW + 5;
    } else {
      const margin = Math.max(2, (maxW - minW) * 0.18);
      minW = Math.max(0, minW - margin);
      maxW = maxW + margin;
    }

    const gridCount = 4;
    const gridLines = [];
    for (let i = 0; i <= gridCount; i++) {
      const val = minW + ((maxW - minW) * (gridCount - i)) / gridCount;
      const y = paddingY + (height - 2 * paddingY) * (i / gridCount);
      gridLines.push({
        y,
        val: Math.round(val)
      });
    }

    const plotWidth = width - 2 * paddingX;
    const plotHeight = height - 2 * paddingY;
    const count = validPoints.length;

    const points = validPoints.map((p, idx) => {
      const x = count === 1 ? width / 2 : paddingX + (plotWidth * idx) / (count - 1);
      const y = paddingY + plotHeight * (1 - (p.weight - minW) / (maxW - minW));
      return { ...p, x, y };
    });

    let path = '';
    let areaPath = '';
    if (points.length === 1) {
      path = `M ${points[0].x - 12} ${points[0].y} L ${points[0].x + 12} ${points[0].y}`;
      areaPath = '';
    } else {
      path = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
      const last = points[points.length - 1];
      const first = points[0];
      const bottomY = height - paddingY;
      areaPath = `${path} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
    }

    return {
      hasData: true,
      points,
      path,
      areaPath,
      gridLines,
      width,
      height,
      minW,
      maxW
    };
  });

  // Gráfico 2: Medidas Corporales (Cadera, Cintura, Pecho)
  bodyMetricsChartData = computed(() => {
    const items = this.chronologicalProgress();
    const width = 460;
    const height = 190;
    const paddingX = 45;
    const paddingY = 25;

    const validItems = items.filter(
      (it) => it.cadera != null || it.cintura != null || it.pecho != null
    );

    if (validItems.length === 0) {
      return { hasData: false, width, height, gridLines: [], caderaPoints: [], cinturaPoints: [], pechoPoints: [], caderaPath: '', cinturaPath: '', pechoPath: '' };
    }

    const allVals: number[] = [];
    validItems.forEach((it) => {
      if (it.cadera != null) allVals.push(Number(it.cadera));
      if (it.cintura != null) allVals.push(Number(it.cintura));
      if (it.pecho != null) allVals.push(Number(it.pecho));
    });

    let minV = Math.min(...allVals);
    let maxV = Math.max(...allVals);
    if (minV === maxV) {
      minV = Math.max(0, minV - 10);
      maxV = maxV + 10;
    } else {
      const margin = Math.max(3, (maxV - minV) * 0.18);
      minV = Math.max(0, minV - margin);
      maxV = maxV + margin;
    }

    const gridCount = 4;
    const gridLines = [];
    for (let i = 0; i <= gridCount; i++) {
      const val = minV + ((maxV - minV) * (gridCount - i)) / gridCount;
      const y = paddingY + (height - 2 * paddingY) * (i / gridCount);
      gridLines.push({
        y,
        val: Math.round(val)
      });
    }

    const plotWidth = width - 2 * paddingX;
    const plotHeight = height - 2 * paddingY;
    const count = validItems.length;

    const buildSeries = (key: 'cadera' | 'cintura' | 'pecho') => {
      return validItems
        .map((it, idx) => {
          const val = it[key] != null ? Number(it[key]) : null;
          if (val == null) return null;
          const x = count === 1 ? width / 2 : paddingX + (plotWidth * idx) / (count - 1);
          const y = paddingY + plotHeight * (1 - (val - minV) / (maxV - minV));
          const date = new Date(it.timestamp);
          const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
          return { id: it.id, dateLabel, val, x, y };
        })
        .filter((pt): pt is { id: string; dateLabel: string; val: number; x: number; y: number } => pt !== null);
    };

    const caderaPoints = buildSeries('cadera');
    const cinturaPoints = buildSeries('cintura');
    const pechoPoints = buildSeries('pecho');

    const toPath = (pts: { x: number; y: number }[]) => {
      if (pts.length <= 1) return '';
      return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
    };

    return {
      hasData: true,
      width,
      height,
      gridLines,
      caderaPoints,
      cinturaPoints,
      pechoPoints,
      caderaPath: toPath(caderaPoints),
      cinturaPath: toPath(cinturaPoints),
      pechoPath: toPath(pechoPoints)
    };
  });

  // Modal de Nuevo / Edición Registro de Progreso
  isNewProgressModalOpen = signal<boolean>(false);
  editingProgressId = signal<string | null>(null);
  progressDate = signal<string>(new Date().toISOString().split('T')[0]);
  progressWeight = signal<number | null>(null);
  progressWeightUnit = signal<'kg' | 'lb'>('lb');
  progressWaist = signal<number | null>(null); // Cintura
  progressHip = signal<number | null>(null);   // Cadera
  progressChest = signal<number | null>(null); // Pecho
  showAdvancedMetrics = signal<boolean>(false);
  progressNeck = signal<number | null>(null);
  progressBiceps = signal<number | null>(null);
  progressThigh = signal<number | null>(null);
  progressBodyFat = signal<number | null>(null);
  progressMuscleMass = signal<number | null>(null);

  // Archivos de fotos y previsualizaciones
  photoFrontFile = signal<File | null>(null);
  photoFrontPreview = signal<string | null>(null);
  photoSideFile = signal<File | null>(null);
  photoSidePreview = signal<string | null>(null);
  photoBackFile = signal<File | null>(null);
  photoBackPreview = signal<string | null>(null);

  isSavingProgress = signal<boolean>(false);
  saveProgressSuccess = signal<boolean>(false);
  saveProgressError = signal<string | null>(null);
  savingStepText = signal<string>('');

  // Lightbox para ver foto grande
  lightboxOpen = signal<boolean>(false);
  lightboxPhotoUrl = signal<string | null>(null);
  lightboxTitle = signal<string>('');
  lightboxDate = signal<string>('');
  lightboxCategory = signal<string>('Entrenamiento');

  // Tooltip interactivo en gráficos
  activeTooltip = signal<{ type: 'weight' | 'metric'; x: number; y: number; text: string; subtext?: string } | null>(null);

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const identifier = params.get('identifier');
      this.routeIdentifier.set(identifier);

      if (this.isPublicProfileMode() && identifier) {
        this.activeTab.set('posts');
        this.loadPublicProfile(identifier);
        return;
      }

      // Modo dueño (perfil propio)
      const current = this.athleteService.currentAthlete();
      if (current?.id) {
        if (!this.athleteService.currentRecords()) {
          this.athleteService.loadAthleteRecords(current.id);
          this.athleteService.loadAthletePosts(current.id);
        }
        this.athleteService.loadNutritionProtocol(current.id);
        this.athleteService.loadAthleteProfile(current.id);
      } else {
        const session = this.authService.currentSession();
        if (session?.avatar?.id) {
          this.athleteService.loadAthleteProfile(session.avatar.id);
        } else {
          const savedId = localStorage.getItem('awakin_active_athlete_id');
          if (savedId) {
            this.athleteService.loadAthleteProfile(savedId);
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  public goBack(): void {
    this.location.back();
  }

  private async loadPublicProfile(identifier: string): Promise<void> {
    this.publicLoading.set(true);
    this.publicAthlete.set(null);
    this.publicRecords.set(null);
    this.publicPosts.set([]);
    this.publicWorkoutLogs.set([]);
    this.publicNutritionProtocol.set(null);
    this.isFollowingPublic.set(false);

    try {
      const profile = await firstValueFrom(this.athleteService.getPublicAthleteProfile(identifier));
      this.publicAthlete.set(profile);

      if (profile?.id) {
        // Cargar posts, comidas (sin progreso privado), protocolo y workouts en paralelo
        this.athleteService.getPublicAthleteRecords(profile.id).subscribe({
          next: (rec) => this.publicRecords.set({ ...rec, progress: [] }),
          error: () => {},
        });
        this.athleteService.getPublicAthletePosts(profile.id).subscribe({
          next: (p) => this.publicPosts.set(p || []),
          error: () => {},
        });
        this.athleteService.getPublicNutritionProtocol(profile.id).then((proto) => {
          this.publicNutritionProtocol.set(proto);
        });
        this.loadPublicWorkoutLogs(profile.id);

        const myId = this.athleteService.currentAthlete()?.id;
        if (myId && myId !== profile.id) {
          this.athleteService.getFollowStatus(myId, profile.id).subscribe({
            next: (res) => this.isFollowingPublic.set(!!res?.is_following),
            error: () => {},
          });
        }
      }
    } catch (err) {
      console.error('Error cargando perfil público:', err);
    } finally {
      this.publicLoading.set(false);
    }
  }

  private async loadPublicWorkoutLogs(athleteId: string): Promise<void> {
    try {
      const { data } = await supabaseClient
        .from('workout_logs')
        .select('*, workout_log_exercises(*, workout_log_sets(*))')
        .eq('athlete_id', athleteId)
        .order('workout_date', { ascending: false })
        .limit(30);

      const normalized: WorkoutLog[] = (data || []).map((log: any) => {
        const exercises = (log.workout_log_exercises || [])
          .map((ex: any) => ({
            ...ex,
            sets: (ex.workout_log_sets || []).sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0)),
          }))
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        return {
          ...log,
          sets_by_muscle: log.sets_by_muscle || {},
          exercises,
        } as WorkoutLog;
      });
      this.publicWorkoutLogs.set(normalized);
    } catch {
      this.publicWorkoutLogs.set([]);
    }
  }

  public toggleFollowPublicAthlete(): void {
    const myId = this.athleteService.currentAthlete()?.id;
    const target = this.publicAthlete();
    if (!myId || !target?.id || myId === target.id || this.isTogglingFollow()) return;

    this.isTogglingFollow.set(true);
    const currentlyFollowing = this.isFollowingPublic();
    const req = currentlyFollowing
      ? this.athleteService.unfollowAthlete(myId, target.id)
      : this.athleteService.followAthlete(myId, target.id);

    req.subscribe({
      next: () => {
        this.isFollowingPublic.set(!currentlyFollowing);
        this.publicAthlete.update((curr) =>
          curr
            ? {
                ...curr,
                followers_count: Math.max(0, (curr.followers_count || 0) + (currentlyFollowing ? -1 : 1)),
              }
            : null
        );
        this.isTogglingFollow.set(false);
      },
      error: () => {
        this.isTogglingFollow.set(false);
      },
    });
  }

  public openFollowListModal(tab: 'followers' | 'following'): void {
    const targetId = this.athlete()?.id;
    if (!targetId) return;
    this.followListTab.set(tab);
    this.followListFilter.set('');
    this.isFollowListModalOpen.set(true);
    this.loadFollowList(targetId, tab);
  }

  public switchFollowListTab(tab: 'followers' | 'following'): void {
    if (this.followListTab() === tab) return;
    this.followListTab.set(tab);
    const targetId = this.athlete()?.id;
    if (targetId) {
      this.loadFollowList(targetId, tab);
    }
  }

  private loadFollowList(athleteId: string, tab: 'followers' | 'following'): void {
    const viewerId = this.athleteService.currentAthlete()?.id;
    this.followListLoading.set(true);
    this.followListItems.set([]);
    const req =
      tab === 'followers'
        ? this.athleteService.getAthleteFollowers(athleteId, viewerId)
        : this.athleteService.getAthleteFollowing(athleteId, viewerId);

    req.subscribe({
      next: (list) => {
        this.followListItems.set(list || []);
        this.followListLoading.set(false);
      },
      error: () => {
        this.followListLoading.set(false);
      },
    });
  }

  public toggleFollowInList(user: AthleteSearchResult, event: Event): void {
    event.stopPropagation();
    const myId = this.athleteService.currentAthlete()?.id;
    if (!myId || myId === user.id || this.followListTogglingId()) return;

    this.followListTogglingId.set(user.id);
    const currentlyFollowing = !!user.is_following;
    const req = currentlyFollowing
      ? this.athleteService.unfollowAthlete(myId, user.id)
      : this.athleteService.followAthlete(myId, user.id);

    req.subscribe({
      next: () => {
        this.followListItems.update((list) =>
          list.map((u) => (u.id === user.id ? { ...u, is_following: !currentlyFollowing } : u))
        );
        this.followListTogglingId.set(null);
      },
      error: () => {
        this.followListTogglingId.set(null);
      },
    });
  }

  public navigateToProfileFromFollowList(user: AthleteSearchResult): void {
    this.isFollowListModalOpen.set(false);
    const myId = this.athleteService.currentAthlete()?.id;
    if (myId && user.id === myId) {
      this.router.navigate(['/avatar']);
    } else {
      this.router.navigate(['/avatar', user.username || user.id]);
    }
  }

  // Cambiar pestaña del feed garantizando privacidad
  setTab(tab: ProfileFeedTab) {
    if (tab === 'progress' && !this.isOwner()) {
      this.activeTab.set('posts');
      return;
    }
    this.activeTab.set(tab);
  }

  // Modal de Detalle de Entrenamiento Estilo HEVY
  selectedWorkoutDetail = signal<WorkoutLog | null>(null);
  isWorkoutDetailOpen = signal<boolean>(false);

  openWorkoutDetail(log: WorkoutLog) {
    this.selectedWorkoutDetail.set(log);
    this.isWorkoutDetailOpen.set(true);
  }

  closeWorkoutDetail() {
    this.isWorkoutDetailOpen.set(false);
    this.selectedWorkoutDetail.set(null);
  }

  // Modal de Edición de Entrenamiento (WORKOUT LOG)
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
  }

  // Diccionario exhaustivo para traducción de grupos musculares a español
  private muscleTranslations: Record<string, string> = {
    // Pectoral / Pecho
    chest: 'Pecho',
    pectorals: 'Pecho',
    pectoral: 'Pecho',
    'upper chest': 'Pecho superior',
    'mid-lower-pectoralis': 'Pecho medio/bajo',
    'upper-pectoralis': 'Pecho superior',

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

  formatMuscleBreakdown(setsByMuscle: Record<string, number> | null | undefined): { muscle: string; sets: number }[] {
    if (!setsByMuscle) return [];
    return Object.entries(setsByMuscle).map(([muscle, sets]) => ({
      muscle: this.translateMuscleName(muscle),
      sets
    }));
  }

  countCompletedSets(sets: { is_completed?: boolean }[] | undefined): number {
    if (!sets) return 0;
    return sets.filter((s) => s.is_completed !== false).length;
  }

  athleteGender = computed<BodyMapGender>(() => {
    const a = this.athlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    if (raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino') {
      return 'female';
    }
    return 'male';
  });

  getExactMuscleBreakdownWithColors(log: WorkoutLog | null | undefined): WorkoutMuscleLegendItem[] {
    const list = this.getExactMuscleBreakdown(log);
    if (list.length === 0) return [];
    const maxSets = Math.max(...list.map((item) => item.sets), 1);
    return list.map((item) => {
      const tone = getAwakinSunTone(item.sets, maxSets);
      return {
        muscle: item.muscle,
        sets: item.sets,
        color: tone.color,
        levelLabel: tone.levelLabel
      };
    });
  }

  // ==========================================
  // GESTIÓN DE AVATAR (ZOOM, CUT & BUCKET 'avatars')
  // ==========================================

  // Manejar selección de archivo para Avatar
  onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.rawAvatarImage.set(e.target?.result as string);
      this.avatarZoom.set(1);
      this.avatarPanX.set(0);
      this.avatarPanY.set(0);
      this.avatarUploadSuccess.set(false);
      this.isAvatarModalOpen.set(true);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  setAvatarZoom(val: number | string) {
    const clamped = Math.max(1, Math.min(3, Number(val)));
    this.avatarZoom.set(clamped);
  }

  zoomInAvatar() {
    this.setAvatarZoom(this.avatarZoom() + 0.2);
  }

  zoomOutAvatar() {
    this.setAvatarZoom(this.avatarZoom() - 0.2);
  }

  resetAvatarCrop() {
    this.avatarZoom.set(1);
    this.avatarPanX.set(0);
    this.avatarPanY.set(0);
  }

  startPan(e: MouseEvent | TouchEvent) {
    this.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.initialPanX = this.avatarPanX();
    this.initialPanY = this.avatarPanY();
  }

  onPan(e: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - this.dragStartX;
    const dy = clientY - this.dragStartY;
    this.avatarPanX.set(this.initialPanX + dx);
    this.avatarPanY.set(this.initialPanY + dy);
  }

  endPan() {
    this.isDragging = false;
  }

  // Cortar imagen circular con HTML5 canvas y subir a Supabase 'avatars'
  applyAndSaveAvatar() {
    const current = this.athlete();
    const imgSrc = this.rawAvatarImage();
    if (!current || !imgSrc) return;

    this.isUploadingAvatar.set(true);
    this.avatarUploadSuccess.set(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.isUploadingAvatar.set(false);
        return;
      }

      // Tamaño visible en viewport CSS del modal: 260px
      const viewportSize = 260;
      const scaleToCanvas = size / viewportSize;

      const aspect = img.width / img.height;
      let drawW: number;
      let drawH: number;
      if (aspect > 1) {
        drawH = viewportSize;
        drawW = viewportSize * aspect;
      } else {
        drawW = viewportSize;
        drawH = viewportSize / aspect;
      }

      const zoom = this.avatarZoom();
      const panX = this.avatarPanX();
      const panY = this.avatarPanY();

      // Dibujar área recortada
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.translate(panX * scaleToCanvas, panY * scaleToCanvas);
      ctx.scale(zoom, zoom);
      ctx.drawImage(
        img,
        (-drawW * scaleToCanvas) / 2,
        (-drawH * scaleToCanvas) / 2,
        drawW * scaleToCanvas,
        drawH * scaleToCanvas
      );
      ctx.restore();

      canvas.toBlob((blob) => {
        if (!blob) {
          this.isUploadingAvatar.set(false);
          return;
        }

        const filename = `avatar_${current.id}_${Date.now()}.jpg`;
        this.athleteService.uploadMedia(blob, 'avatars', filename).subscribe({
          next: (uploadRes) => {
            this.athleteService
              .updateProfile(current.id, { profile_image_url: uploadRes.public_url })
              .subscribe({
                next: () => {
                  this.isUploadingAvatar.set(false);
                  this.avatarUploadSuccess.set(true);
                  setTimeout(() => {
                    this.isAvatarModalOpen.set(false);
                    this.avatarUploadSuccess.set(false);
                    this.rawAvatarImage.set(null);
                  }, 600);
                },
                error: (err) => {
                  console.error('Error guardando URL en BD:', err);
                  this.isUploadingAvatar.set(false);
                }
              });
          },
          error: (err) => {
            console.error('Error subiendo imagen al bucket avatars:', err);
            this.isUploadingAvatar.set(false);
          }
        });
      }, 'image/jpeg', 0.92);
    };
    img.src = imgSrc;
  }

  // ==========================================
  // GESTIÓN DE NUEVO POST (BUCKET 'feed_posts')
  // ==========================================

  // Abrir modal de creación de post
  openCreatePost() {
    this.selectedPostFile.set(null);
    this.postFilePreview.set(null);
    this.newPostMediaUrl.set('');
    this.newPostCaption.set('');
    this.newPostModule.set('GENERAL');
    this.createPostSuccess.set(false);
    this.createPostError.set(null);
    this.isNewPostModalOpen.set(true);
  }

  onPostFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.selectedPostFile.set(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.postFilePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearPostFile() {
    this.selectedPostFile.set(null);
    this.postFilePreview.set(null);
  }

  // Publicar post en athlete_feed_posts (sube archivo a bucket si aplica)
  submitCreatePost() {
    const current = this.athlete();
    if (!current) return;

    this.createPostError.set(null);

    if (!this.athleteService.canCreatePostToday()) {
      this.createPostError.set(
        `Has alcanzado el límite diario de ${this.athleteService.dailyPostLimit} publicaciones por día.`
      );
      return;
    }

    const file = this.selectedPostFile();
    const manualUrl = this.newPostMediaUrl().trim();

    if (!file && !manualUrl) {
      this.createPostError.set('Por favor selecciona una imagen para subir.');
      return;
    }

    this.isCreatingPost.set(true);
    this.createPostSuccess.set(false);

    if (file) {
      // Subir archivo a Supabase Storage bucket 'feed_posts'
      this.athleteService.uploadMedia(file, 'feed_posts', file.name).subscribe({
        next: (uploadRes) => {
          this.athleteService
            .createPost(current.id, {
              media_url: uploadRes.public_url,
              caption: this.newPostCaption().trim() || undefined,
              module_source: this.newPostModule()
            })
            .subscribe({
              next: () => {
                this.isCreatingPost.set(false);
                this.createPostSuccess.set(true);
                setTimeout(() => {
                  this.isNewPostModalOpen.set(false);
                  this.createPostSuccess.set(false);
                  this.clearPostFile();
                  this.activeTab.set('posts');
                }, 800);
              },
              error: (err) => {
                console.error('Error insertando en athlete_feed_posts:', err);
                this.createPostError.set(
                  err?.error?.detail || 'No se pudo publicar el post. Intenta nuevamente.'
                );
                this.isCreatingPost.set(false);
              }
            });
        },
        error: (err) => {
          console.error('Error subiendo imagen al bucket feed_posts:', err);
          this.createPostError.set('Error subiendo la imagen. Intenta nuevamente.');
          this.isCreatingPost.set(false);
        }
      });
    } else {
      // Usar URL ingresada manualmente
      this.athleteService
        .createPost(current.id, {
          media_url: manualUrl,
          caption: this.newPostCaption().trim() || undefined,
          module_source: this.newPostModule()
        })
        .subscribe({
          next: () => {
            this.isCreatingPost.set(false);
            this.createPostSuccess.set(true);
            setTimeout(() => {
              this.isNewPostModalOpen.set(false);
              this.createPostSuccess.set(false);
              this.activeTab.set('posts');
            }, 800);
          },
          error: (err) => {
            console.error('Error creando post con URL:', err);
            this.createPostError.set(
              err?.error?.detail || 'No se pudo publicar el post. Intenta nuevamente.'
            );
            this.isCreatingPost.set(false);
          }
        });
    }
  }


  // Tribu / Kin helpers
  getKin(): KinInfo | null {
    const ath = this.athlete();
    if (ath?.kin) return ath.kin;
    if (ath?.kins && ath.kins.length > 0) return ath.kins[0];
    return null;
  }

  getKins(): KinInfo[] {
    const ath = this.athlete();
    if (ath?.kins && ath.kins.length > 0) {
      return ath.kins;
    }
    return ath?.kin ? [ath.kin] : [];
  }

  hasKin(): boolean {
    return this.getKins().length > 0;
  }

  isMultiKin(): boolean {
    return this.getKins().length > 1;
  }

  getKinRoleBadge(): string {
    const kins = this.getKins();
    if (kins.length === 0) return '';
    if (kins.length > 1) {
      return `Instructor`;
    }
    const kin = kins[0];
    if (kin.role_in_kin === 'HEAD COACH') return 'Líder / Head Coach';
    if (kin.role_in_kin === 'INSTRUCTOR') return 'Instructor / Coach';
    return 'Miembro';
  }

  getKinNamesPreview(): string {
    const kins = this.getKins();
    if (kins.length === 0) return '';
    if (kins.length === 1) return kins[0].team_name;
    if (kins.length === 2) return `${kins[0].team_name} & ${kins[1].team_name}`;
    return `${kins[0].team_name} (+${kins.length - 1} más)`;
  }

  getKinNamesTooltip(): string {
    return this.getKins().map((k) => k.team_name).join(', ');
  }

  getKinInstructors() {
    return this.getKin()?.instructors || [];
  }


  // Abrir selector de atleta
  toggleSwitcher() {
    this.isSwitcherOpen.update((v) => !v);
  }

  // Seleccionar un atleta diferente para previsualizar y operar como él
  onSelectAthlete(ath: AthleteProfile) {
    this.athleteService.setActiveAthlete(ath);
    this.authService.devLoginAthlete(
      ath.id,
      ath.email || `${ath.username}@awakin.com`,
      `${ath.first_name || ''} ${ath.last_name || ''}`.trim() || ath.username,
      ath.profile_image_url || undefined
    );
    this.isSwitcherOpen.set(false);
  }

  // Abrir modal de edición con los datos actuales
  openEditProfile() {
    const current = this.athlete();
    if (current) {
      this.editFirstName.set(current.first_name || '');
      this.editLastName.set(current.last_name || '');
      const uname = (current.username || '').toLowerCase();
      this.editUsername.set(uname);
      this.editBio.set(current.bio_description || '');
      this.usernameCheckStatus.set('available');
      this.usernameFeedbackMessage.set('Nombre de usuario actual');
    } else {
      this.usernameCheckStatus.set('idle');
      this.usernameFeedbackMessage.set('');
    }
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.isEditModalOpen.set(true);
  }

  // Validación reactiva de disponibilidad de username (estilo Instagram)
  onUsernameInput(val: string) {
    const sanitized = (val || '').trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    this.editUsername.set(sanitized);
    this.saveError.set(null);

    if (this.usernameCheckTimer) {
      clearTimeout(this.usernameCheckTimer);
    }

    const currentAth = this.athlete();
    if (!sanitized) {
      this.usernameCheckStatus.set('invalid');
      this.usernameFeedbackMessage.set('El nombre de usuario es obligatorio');
      return;
    }

    if (sanitized.length < 3) {
      this.usernameCheckStatus.set('invalid');
      this.usernameFeedbackMessage.set('Mínimo 3 caracteres (a-z, 0-9, . o _)');
      return;
    }

    // Si es su propio username actual en este perfil
    if (currentAth && currentAth.username && sanitized === currentAth.username.toLowerCase()) {
      this.usernameCheckStatus.set('available');
      this.usernameFeedbackMessage.set('Este es tu nombre de usuario actual');
      return;
    }

    this.usernameCheckStatus.set('checking');
    this.usernameFeedbackMessage.set('Comprobando disponibilidad...');

    this.usernameCheckTimer = setTimeout(() => {
      this.athleteService.checkUsernameAvailability(sanitized, currentAth?.id).subscribe({
        next: (res) => {
          if (res.available) {
            this.usernameCheckStatus.set('available');
            this.usernameFeedbackMessage.set(`✓ @${sanitized} está disponible`);
          } else {
            this.usernameCheckStatus.set('taken');
            this.usernameFeedbackMessage.set(`✗ @${sanitized} ya está en uso por otro atleta`);
          }
        },
        error: (err) => {
          console.warn('Error al verificar username:', err);
          this.usernameCheckStatus.set('idle');
          this.usernameFeedbackMessage.set('');
        }
      });
    }, 300);
  }

  // Guardar cambios en Supabase mediante PATCH
  saveProfile() {
    const current = this.athlete();
    if (!current) return;

    if (this.usernameCheckStatus() === 'taken') {
      this.saveError.set(`El nombre de usuario @${this.editUsername()} ya está ocupado por otro usuario.`);
      return;
    }

    if (this.usernameCheckStatus() === 'invalid' || !this.editUsername().trim()) {
      this.saveError.set('Ingresa un nombre de usuario válido de al menos 3 caracteres.');
      return;
    }

    this.isSaving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);

    const updates = {
      first_name: this.editFirstName().trim(),
      last_name: this.editLastName().trim(),
      username: this.editUsername().trim().toLowerCase(),
      bio_description: this.editBio().trim()
    };

    this.athleteService.updateProfile(current.id, updates).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => {
          this.isEditModalOpen.set(false);
          this.saveSuccess.set(false);
        }, 800);
      },
      error: (err) => {
        console.error('Error al actualizar el perfil:', err);
        this.isSaving.set(false);

        // Extracción clara y amigable del error para retroalimentación al usuario
        let detail = 'Error al actualizar la información de perfil.';
        if (err.error?.detail) {
          if (typeof err.error.detail === 'string') {
            detail = err.error.detail;
          } else if (Array.isArray(err.error.detail)) {
            detail = err.error.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          } else {
            detail = JSON.stringify(err.error.detail);
          }
        } else if (err.statusText) {
          detail = `${err.status} - ${err.statusText}`;
        }
        this.saveError.set(detail);
      }
    });
  }

  // Compartir perfil (copiar enlace)
  shareProfile() {
    const ath = this.athlete();
    const handle = ath?.username || 'atleta';
    const url = `${window.location.origin}/avatar?user=${handle}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`¡Enlace del perfil copiado al portapapeles!\n${url}`);
    }).catch(() => {
      alert(`Perfil de @${handle}`);
    });
  }

  // Cerrar sesión
  logout() {
    this.isMenuOpen.set(false);
    this.authService.logout();
  }

  // Formatear nombres de roles de la base de datos
  formatRole(role: string): string {
    switch (role) {
      case 'ATHLETE':
        return 'Atleta';
      case 'INSTRUCTOR':
        return 'Coach Fitness';
      case 'NUTRITIONIST':
        return 'Coach Nutrición';
      case 'PHYSIOTHERAPIST':
        return 'Fisioterapia';
      case 'ADMINISTRATOR':
        return 'Admin';
      default:
        return role;
    }
  }

  // Color de badge por rol
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'INSTRUCTOR':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'NUTRITIONIST':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ADMINISTRATOR':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'PHYSIOTHERAPIST':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  }

  // Obtener iniciales para avatar de respaldo
  getInitials(): string {
    const ath = this.athlete();
    if (!ath) return 'AW';
    if (ath.first_name) {
      return ath.first_name.slice(0, 2).toUpperCase();
    }
    return (ath.username || 'A').slice(0, 2).toUpperCase();
  }

  // ==========================================
  // GESTIÓN DE MÉTRICAS Y PROGRESO CORPORAL
  // ==========================================

  // Conversión reactiva de pesos entre KG y LB
  convertWeight(val: number, fromUnit?: string, toUnit: 'kg' | 'lb' = 'lb'): number {
    if (val == null) return 0;
    const from = (fromUnit || 'kg').toLowerCase();
    const to = toUnit.toLowerCase();
    if (from === to) return val;
    if (from === 'kg' && to === 'lb') {
      return val * 2.20462;
    }
    if (from === 'lb' && to === 'kg') {
      return val / 2.20462;
    }
    return val;
  }

  // Alternar unidad entre KG y LB
  toggleWeightUnit(unit?: 'kg' | 'lb') {
    if (unit) {
      this.preferredWeightUnit.set(unit);
    } else {
      this.preferredWeightUnit.update((u) => (u === 'lb' ? 'kg' : 'lb'));
    }
  }

  // Alternar visualización de medidas avanzadas
  toggleAdvancedMetrics() {
    this.showAdvancedMetrics.update((v) => !v);
  }

  // Abrir modal de nuevo registro
  openNewProgressModal() {
    this.editingProgressId.set(null);
    this.progressDate.set(new Date().toISOString().split('T')[0]);
    this.progressWeight.set(null);
    this.progressWeightUnit.set(this.preferredWeightUnit());
    this.progressWaist.set(null);
    this.progressHip.set(null);
    this.progressChest.set(null);
    this.showAdvancedMetrics.set(false);
    this.progressNeck.set(null);
    this.progressBiceps.set(null);
    this.progressThigh.set(null);
    this.progressBodyFat.set(null);
    this.progressMuscleMass.set(null);

    this.photoFrontFile.set(null);
    this.photoFrontPreview.set(null);
    this.photoSideFile.set(null);
    this.photoSidePreview.set(null);
    this.photoBackFile.set(null);
    this.photoBackPreview.set(null);

    this.isSavingProgress.set(false);
    this.saveProgressSuccess.set(false);
    this.saveProgressError.set(null);
    this.savingStepText.set('');

    this.isNewProgressModalOpen.set(true);
  }

  // Abrir modal para editar registro existente
  openEditProgressModal(rec: ProgressMetricRecord) {
    this.editingProgressId.set(rec.id);
    this.progressDate.set(rec.timestamp ? rec.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]);
    this.progressWeight.set(rec.peso != null ? rec.peso : null);
    this.progressWeightUnit.set((rec.unidad_peso as 'kg' | 'lb') || this.preferredWeightUnit());
    this.progressWaist.set(rec.cintura != null ? rec.cintura : null);
    this.progressHip.set(rec.cadera != null ? rec.cadera : null);
    this.progressChest.set(rec.pecho != null ? rec.pecho : null);

    const hasAdvanced = !!(rec.cuello || rec.biceps || rec.muslo || rec.porcentaje_grasa || rec.masa_muscular);
    this.showAdvancedMetrics.set(hasAdvanced);
    this.progressNeck.set(rec.cuello != null ? rec.cuello : null);
    this.progressBiceps.set(rec.biceps != null ? rec.biceps : null);
    this.progressThigh.set(rec.muslo != null ? rec.muslo : null);
    this.progressBodyFat.set(rec.porcentaje_grasa != null ? rec.porcentaje_grasa : null);
    this.progressMuscleMass.set(rec.masa_muscular != null ? rec.masa_muscular : null);

    this.photoFrontFile.set(null);
    this.photoFrontPreview.set(rec.foto_frontal_url || null);
    this.photoSideFile.set(null);
    this.photoSidePreview.set(rec.foto_lateral_url || null);
    this.photoBackFile.set(null);
    this.photoBackPreview.set(rec.foto_espalda_url || null);

    this.isSavingProgress.set(false);
    this.saveProgressSuccess.set(false);
    this.saveProgressError.set(null);
    this.savingStepText.set('');

    this.isNewProgressModalOpen.set(true);
  }

  closeNewProgressModal() {
    this.isNewProgressModalOpen.set(false);
  }

  // Selección de foto para frontal, lateral o espalda
  onProgressPhotoSelected(event: Event, angle: 'front' | 'side' | 'back') {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (angle === 'front') {
        this.photoFrontFile.set(file);
        this.photoFrontPreview.set(preview);
      } else if (angle === 'side') {
        this.photoSideFile.set(file);
        this.photoSidePreview.set(preview);
      } else if (angle === 'back') {
        this.photoBackFile.set(file);
        this.photoBackPreview.set(preview);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // Quitar foto seleccionada
  removeProgressPhoto(angle: 'front' | 'side' | 'back') {
    if (angle === 'front') {
      this.photoFrontFile.set(null);
      this.photoFrontPreview.set(null);
    } else if (angle === 'side') {
      this.photoSideFile.set(null);
      this.photoSidePreview.set(null);
    } else if (angle === 'back') {
      this.photoBackFile.set(null);
      this.photoBackPreview.set(null);
    }
  }

  // Guardar nuevo registro o cambios en BD Supabase
  async saveProgress() {
    const ath = this.athlete();
    if (!ath) {
      this.saveProgressError.set('No se ha podido identificar el perfil del atleta.');
      return;
    }

    if (
      this.progressWeight() == null &&
      !this.progressWaist() &&
      !this.photoFrontFile() &&
      !this.photoFrontPreview() &&
      !this.photoSideFile() &&
      !this.photoSidePreview() &&
      !this.photoBackFile() &&
      !this.photoBackPreview()
    ) {
      this.saveProgressError.set('Por favor ingresa al menos el peso, una medida o una foto.');
      return;
    }

    this.isSavingProgress.set(true);
    this.saveProgressError.set(null);
    this.saveProgressSuccess.set(false);

    try {
      let fotoFrontUrl: string | null | undefined = this.photoFrontPreview() || null;
      let fotoSideUrl: string | null | undefined = this.photoSidePreview() || null;
      let fotoBackUrl: string | null | undefined = this.photoBackPreview() || null;

      // 1. Subir fotos si se seleccionaron archivos nuevos
      if (this.photoFrontFile()) {
        this.savingStepText.set('Subiendo foto frontal...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoFrontFile()!, 'fotos_progreso', `front_${Date.now()}.jpg`)
        );
        fotoFrontUrl = res.public_url;
      }

      if (this.photoSideFile()) {
        this.savingStepText.set('Subiendo foto lateral...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoSideFile()!, 'fotos_progreso', `side_${Date.now()}.jpg`)
        );
        fotoSideUrl = res.public_url;
      }

      if (this.photoBackFile()) {
        this.savingStepText.set('Subiendo foto espalda...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoBackFile()!, 'fotos_progreso', `back_${Date.now()}.jpg`)
        );
        fotoBackUrl = res.public_url;
      }

      // 2. Construir payload de progreso
      this.savingStepText.set('Guardando métricas en tu expediente...');
      const dateVal = this.progressDate() ? new Date(this.progressDate()).toISOString() : new Date().toISOString();

      const payload: Partial<ProgressMetricRecord> = {
        timestamp: dateVal,
        peso: this.progressWeight() != null ? Number(this.progressWeight()) : null,
        unidad_peso: this.progressWeightUnit(),
        cintura: this.progressWaist() != null ? Number(this.progressWaist()) : null,
        cadera: this.progressHip() != null ? Number(this.progressHip()) : null,
        pecho: this.progressChest() != null ? Number(this.progressChest()) : null,
        foto_frontal_url: fotoFrontUrl,
        foto_lateral_url: fotoSideUrl,
        foto_espalda_url: fotoBackUrl,
        cuello: this.progressNeck() != null ? Number(this.progressNeck()) : null,
        biceps: this.progressBiceps() != null ? Number(this.progressBiceps()) : null,
        muslo: this.progressThigh() != null ? Number(this.progressThigh()) : null,
        porcentaje_grasa: this.progressBodyFat() != null ? Number(this.progressBodyFat()) : null,
        masa_muscular: this.progressMuscleMass() != null ? Number(this.progressMuscleMass()) : null
      };

      if (this.editingProgressId()) {
        await firstValueFrom(this.athleteService.updateProgressRecord(ath.id, this.editingProgressId()!, payload));
      } else {
        await firstValueFrom(this.athleteService.createProgressRecord(ath.id, payload));
      }

      this.isSavingProgress.set(false);
      this.saveProgressSuccess.set(true);
      setTimeout(() => {
        this.isNewProgressModalOpen.set(false);
        this.editingProgressId.set(null);
        this.saveProgressSuccess.set(false);
      }, 700);
    } catch (err: any) {
      console.error('Error guardando progreso:', err);
      this.isSavingProgress.set(false);
      this.saveProgressError.set(err?.error?.detail || err?.message || 'Error al guardar el registro.');
    }
  }

  // Eliminar un registro de progreso
  deleteProgress(progressId: string) {
    const ath = this.athlete();
    if (!ath) return;

    if (!confirm('¿Deseas eliminar este registro de progreso y sus fotos?')) {
      return;
    }

    this.athleteService.deleteProgressRecord(ath.id, progressId).subscribe({
      next: () => {
        // Registro eliminado reactivamente
      },
      error: (err) => {
        console.error('Error al eliminar registro:', err);
        alert('No se pudo eliminar el registro. Intenta nuevamente.');
      }
    });
  }

  // ==========================================
  // MODAL DE COMPARTIR GRÁFICOS (NUEVO)
  // ==========================================

  // Servicio de generación de imágenes para gráficos
  private chartExportService = inject(ChartImageExportService);

  // Estado del modal de compartir progreso
  isShareChartsModalOpen = signal<boolean>(false);
  shareChartRecords = signal<ProgressMetricRecord[]>([]);
  shareChartUserName = signal<string>('');
  shareChartUserFullName = signal<string | null>(null);
  shareChartUserImageUrl = signal<string | null>(null);
  shareChartKinLogoUrl = signal<string | null>(null);
  shareChartKinName = signal<string | null>(null);
  shareChartWeightUnit = signal<'kg' | 'lb'>('lb');
  shareChartSelectedRecordIds = signal<string[]>([]);
  shareChartIncludePhotos = signal<boolean>(true);
  shareChartCollageLayout = signal<'cards' | 'fullbleed'>('fullbleed');
  shareChartIsGenerating = signal<boolean>(false);
  shareChartIsExporting = signal<boolean>(false);
  shareChartGeneratedImageUrl = signal<string | null>(null);
  shareChartErrorMessage = signal<string | null>(null);
  shareChartShowPreview = signal<boolean>(false);

  // Posición arrastrable del backdrop de Logros (ratios relativos al lienzo 9:16)
  backdropPos = signal<{ xRatio: number; yRatio: number }>({ xRatio: 0.5, yRatio: 0.81 });
  isDraggingBackdrop = signal<boolean>(false);
  private backdropDragStart = { pointerX: 0, pointerY: 0, startXRatio: 0.5, startYRatio: 0.81, containerW: 280, containerH: 498 };

  // Métricas calculadas para el backdrop arrastrable en la vista previa
  sharePreviewMetrics = computed(() => {
    const selected = [...this.shareChartSelectedRecords()].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const unit = this.shareChartWeightUnit();
    const isComparison = selected.length >= 2;
    const first = selected[0];
    const last = selected[selected.length - 1];
    const cells: Array<{ label: string; value: string; delta?: string; deltaGood?: boolean }> = [];

    if (last?.peso) {
      const lastW = this.convertWeight(Number(last.peso), last.unidad_peso, unit);
      let delta: string | undefined;
      let deltaGood = true;
      if (isComparison && first?.peso) {
        const firstW = this.convertWeight(Number(first.peso), first.unidad_peso, unit);
        const diff = Number((lastW - firstW).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} ${unit}`;
        deltaGood = diff <= 0;
      }
      cells.push({ label: 'PESO', value: `${lastW.toFixed(1)} ${unit}`, delta, deltaGood });
    }

    if (last?.cintura) {
      let delta: string | undefined;
      let deltaGood = true;
      if (isComparison && first?.cintura) {
        const diff = Number((last.cintura - first.cintura).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
        deltaGood = diff <= 0;
      }
      cells.push({ label: 'CINTURA', value: `${last.cintura} cm`, delta, deltaGood });
    }

    if (last?.cadera) {
      let delta: string | undefined;
      if (isComparison && first?.cadera) {
        const diff = Number((last.cadera - first.cadera).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
      }
      cells.push({ label: 'CADERA', value: `${last.cadera} cm`, delta, deltaGood: true });
    }

    if (last?.pecho) {
      let delta: string | undefined;
      if (isComparison && first?.pecho) {
        const diff = Number((last.pecho - first.pecho).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
      }
      cells.push({ label: 'PECHO', value: `${last.pecho} cm`, delta, deltaGood: true });
    }

    const tmb = this.currentTmb()?.kcal;
    if (tmb && cells.length < 4) {
      cells.push({ label: 'TMB ACTUAL', value: `${tmb} kcal` });
    }

    return {
      title: isComparison ? 'LOGROS • INICIO VS ACTUAL' : 'MIS MEDIDAS',
      cells
    };
  });

  // Logs disponibles ordenados del más reciente al más antiguo
  availableShareChartRecords = computed(() => {
    return [...this.shareChartRecords()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  // Registros seleccionados para el collage/comparación
  shareChartSelectedRecords = computed(() => {
    const ids = this.shareChartSelectedRecordIds();
    return this.shareChartRecords().filter(r => ids.includes(r.id));
  });

  // Puede generar imagen (min 1, max 4 registros)
  canGenerateShareChart = computed(() => {
    const count = this.shareChartSelectedRecordIds().length;
    return count >= 1 && count <= 4 && !this.shareChartIsGenerating();
  });

  // Abrir modal de compartir progreso con datos del atleta
  shareProgressCharts(preselectedRecordId?: string) {
    const ath = this.athlete();
    if (!ath) return;

    const records = this.progressRecords();
    const kin = ath.kin;
    const fullName = [ath.first_name, ath.last_name].filter(Boolean).join(' ').trim() || null;

    this.shareChartRecords.set(records);
    this.shareChartUserName.set(ath.username || 'atleta');
    this.shareChartUserFullName.set(fullName);
    this.shareChartUserImageUrl.set(ath.profile_image_url || null);
    // Solo el Kin asociado al atleta actual
    this.shareChartKinLogoUrl.set(kin?.team_logo_url || null);
    this.shareChartKinName.set(kin?.team_name || null);
    this.shareChartWeightUnit.set(this.preferredWeightUnit());
    this.shareChartIncludePhotos.set(true);

    if (preselectedRecordId) {
      this.shareChartSelectedRecordIds.set([preselectedRecordId]);
    } else if (records.length > 0) {
      const sorted = [...records].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      this.shareChartSelectedRecordIds.set([sorted[0].id]);
    } else {
      this.shareChartSelectedRecordIds.set([]);
    }

    this.shareChartIsGenerating.set(false);
    this.shareChartGeneratedImageUrl.set(null);
    this.shareChartErrorMessage.set(null);
    this.shareChartShowPreview.set(false);
    this.isShareChartsModalOpen.set(true);
  }

  // Generar imagen 9:16 para compartir
  async generateShareChartImage() {
    if (!this.canGenerateShareChart()) return;

    this.shareChartIsGenerating.set(true);
    this.shareChartErrorMessage.set(null);
    this.shareChartGeneratedImageUrl.set(null);
    this.shareChartShowPreview.set(false);

    try {
      const isFullBleed = this.shareChartIncludePhotos() && this.shareChartCollageLayout() === 'fullbleed';
      const data = {
        records: this.shareChartSelectedRecords(),
        userName: this.shareChartUserName(),
        userFullName: this.shareChartUserFullName(),
        userImageUrl: this.shareChartUserImageUrl(),
        kinLogoUrl: this.shareChartKinLogoUrl(),
        kinName: this.shareChartKinName(),
        weightUnit: this.shareChartWeightUnit(),
        includePhotos: this.shareChartIncludePhotos(),
        collageLayout: this.shareChartCollageLayout(),
        tmbKcal: this.currentTmb()?.kcal ?? null,
        // En vista previa de IG Layout, omitimos el backdrop en el canvas para hacerlo arrastrable en HTML
        omitMetricsBackdrop: isFullBleed
      };

      const imageUrl = await this.chartExportService.generateShareImage(data);
      this.shareChartGeneratedImageUrl.set(imageUrl);
      this.shareChartShowPreview.set(true);
    } catch (err: any) {
      console.error('Error generando imagen:', err);
      this.shareChartErrorMessage.set(err?.message || 'Error al generar la imagen. Intenta nuevamente.');
    } finally {
      this.shareChartIsGenerating.set(false);
    }
  }

  // Renderiza la imagen final con la posición exacta del backdrop arrastrable
  private async getFinalExportImageUrl(): Promise<string | null> {
    const isFullBleed = this.shareChartIncludePhotos() && this.shareChartCollageLayout() === 'fullbleed';
    if (!isFullBleed) {
      return this.shareChartGeneratedImageUrl();
    }

    this.shareChartIsExporting.set(true);
    try {
      const pos = this.backdropPos();
      return await this.chartExportService.generateShareImage({
        records: this.shareChartSelectedRecords(),
        userName: this.shareChartUserName(),
        userFullName: this.shareChartUserFullName(),
        userImageUrl: this.shareChartUserImageUrl(),
        kinLogoUrl: this.shareChartKinLogoUrl(),
        kinName: this.shareChartKinName(),
        weightUnit: this.shareChartWeightUnit(),
        includePhotos: true,
        collageLayout: 'fullbleed',
        tmbKcal: this.currentTmb()?.kcal ?? null,
        omitMetricsBackdrop: false,
        metricsBackdropXRatio: pos.xRatio,
        metricsBackdropYRatio: pos.yRatio
      });
    } finally {
      this.shareChartIsExporting.set(false);
    }
  }

  // Handlers de arrastre (Pointer Events para mouse y touch)
  onBackdropPointerDown(event: PointerEvent, containerEl: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    const rect = containerEl.getBoundingClientRect();
    const pos = this.backdropPos();
    this.isDraggingBackdrop.set(true);
    this.backdropDragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startXRatio: pos.xRatio,
      startYRatio: pos.yRatio,
      containerW: rect.width || 280,
      containerH: rect.height || 498
    };
  }

  onBackdropPointerMove(event: PointerEvent) {
    if (!this.isDraggingBackdrop()) return;
    event.preventDefault();

    const dx = event.clientX - this.backdropDragStart.pointerX;
    const dy = event.clientY - this.backdropDragStart.pointerY;

    const newXRatio = this.backdropDragStart.startXRatio + dx / this.backdropDragStart.containerW;
    const newYRatio = this.backdropDragStart.startYRatio + dy / this.backdropDragStart.containerH;

    // Limitar dentro del lienzo 9:16 respetando márgenes seguros
    const clampedX = Math.max(0.42, Math.min(0.58, newXRatio));
    const clampedY = Math.max(0.08, Math.min(0.81, newYRatio));

    this.backdropPos.set({ xRatio: clampedX, yRatio: clampedY });
  }

  onBackdropPointerUp(event: PointerEvent) {
    if (!this.isDraggingBackdrop()) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.isDraggingBackdrop.set(false);
  }

  resetBackdropPosition() {
    this.backdropPos.set({ xRatio: 0.5, yRatio: 0.81 });
  }

  // Cambiar diseño de collage y regenerar si está en vista previa
  setShareCollageLayout(layout: 'cards' | 'fullbleed') {
    this.shareChartCollageLayout.set(layout);
    if (this.shareChartShowPreview()) {
      this.generateShareChartImage();
    }
  }

  // Volver de vista previa a selección
  backToShareSelection() {
    this.shareChartShowPreview.set(false);
  }

  // Descargar imagen generada
  async downloadShareChartImage() {
    const finalUrl = await this.getFinalExportImageUrl();
    if (!finalUrl) return;

    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `awakin-progreso-${this.shareChartUserName()}-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  }

  // Compartir imagen generada
  async shareShareChartImage() {
    const finalUrl = await this.getFinalExportImageUrl();
    if (!finalUrl) return;

    try {
      const response = await fetch(finalUrl);
      const blob = await response.blob();
      const file = new File([blob], `awakin-progreso-${this.shareChartUserName()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Mi Progreso Corporal - ${this.shareChartUserName()}`,
          text: 'Mi evolución en Awakin',
          files: [file]
        });
      } else {
        const link = document.createElement('a');
        link.href = finalUrl;
        link.download = `awakin-progreso-${this.shareChartUserName()}-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
      }
    } catch (err) {
      console.error('Error compartiendo:', err);
    }
  }

  // Cerrar modal de compartir progreso
  closeShareChartsModal() {
    this.isShareChartsModalOpen.set(false);
    this.shareChartSelectedRecordIds.set([]);
    this.shareChartGeneratedImageUrl.set(null);
    this.shareChartShowPreview.set(false);
  }

  // ==========================================
  // COMPARTIR HISTORIA 9:16 DE ENTRENAMIENTO
  // ==========================================
  isShareWorkoutModalOpen = signal<boolean>(false);
  isGeneratingWorkoutStory = signal<boolean>(false);
  shareWorkoutStoryImageUrl = signal<string | null>(null);
  shareWorkoutTargetLog = signal<WorkoutLog | null>(null);

  openWorkoutStoryModal(log: WorkoutLog): void {
    this.shareWorkoutTargetLog.set(log);
    this.isShareWorkoutModalOpen.set(true);
  }

  closeWorkoutStoryModal(): void {
    this.isShareWorkoutModalOpen.set(false);
    this.shareWorkoutStoryImageUrl.set(null);
    this.shareWorkoutTargetLog.set(null);
  }

  // Alternar selección de registro (max 4)
  toggleShareChartRecord(recordId: string) {
    const current = this.shareChartSelectedRecordIds();
    if (current.includes(recordId)) {
      this.shareChartSelectedRecordIds.set(current.filter(id => id !== recordId));
    } else if (current.length < 4) {
      this.shareChartSelectedRecordIds.set([...current, recordId]);
    }
  }

  // Verificar si un registro está seleccionado
  isShareChartRecordSelected(recordId: string): boolean {
    return this.shareChartSelectedRecordIds().includes(recordId);
  }

  hasRecordPhotos(rec: ProgressMetricRecord): boolean {
    return !!(rec.foto_frontal_url || rec.foto_lateral_url || rec.foto_espalda_url);
  }

  // Formatear fecha para mostrar
  formatShareChartDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // Compartir un registro puntual abriendo el modal preseleccionado
  shareProgressRecord(record: ProgressMetricRecord) {
    this.shareProgressCharts(record.id);
  }

  // Visualizador Lightbox de fotos
  openLightbox(url: string, title: string, dateStr: string, category: string = 'Entrenamiento') {
    this.lightboxPhotoUrl.set(url);
    this.lightboxTitle.set(title);
    this.lightboxDate.set(this.formatDateSpanish(dateStr));
    this.lightboxCategory.set(category);
    this.lightboxOpen.set(true);
  }

  closeLightbox() {
    this.lightboxOpen.set(false);
    this.lightboxPhotoUrl.set(null);
  }

  // Tooltip interactivo sobre puntos del gráfico
  showTooltip(type: 'weight' | 'metric', x: number, y: number, text: string, subtext?: string) {
    this.activeTooltip.set({ type, x, y, text, subtext });
  }

  hideTooltip() {
    this.activeTooltip.set(null);
  }

  // Formato de fecha amigable en español
  formatDateSpanish(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
      const d = new Date(parts);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}

