import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, from, switchMap, timeout } from 'rxjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabase.service';
import { compressImage } from '../helpers/image-compressor.helper';
import { environment } from '../../../environments/environment';

export interface ActivityLevelOption {
  key: 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'EXTREMELY_ACTIVE';
  label: string;
  factor: number;
  desc: string;
}

export const ACTIVITY_LEVELS: ActivityLevelOption[] = [
  { key: 'SEDENTARY', label: 'Sedentario', factor: 1.20, desc: 'Poco o ningún ejercicio' },
  { key: 'LIGHTLY_ACTIVE', label: 'Ligeramente activo', factor: 1.38, desc: 'Ejercicio ligero 1-3 días/sem' },
  { key: 'MODERATELY_ACTIVE', label: 'Moderadamente activo', factor: 1.55, desc: 'Ejercicio moderado 3-5 días/sem' },
  { key: 'VERY_ACTIVE', label: 'Muy activo / Activo', factor: 1.73, desc: 'Ejercicio fuerte 6-7 días/sem' },
  { key: 'EXTREMELY_ACTIVE', label: 'Extremadamente activo', factor: 1.90, desc: 'Entrenamiento intenso / trabajo físico' }
];

export interface KinInstructor {
  id?: string;
  kin_id?: string;
  instructor_id: string;
  role?: string;
  created_at?: string;
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
}

export interface KinInfo {
  id: string;
  team_name: string;
  team_logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  manifesto?: string | null;
  head_coach_id?: string | null;
  head_coach_name?: string | null;
  instructor_id?: string | null;
  whatsapp_group_url?: string | null;
  google_calendar_id?: string | null;
  google_calendar_ics_url?: string | null;
  header_image_url?: string | null;
  meals_banner_url?: string | null;
  ranking_bg_url?: string | null;
  agenda_bg_url?: string | null;
  role_in_kin?: string;
  instructors?: KinInstructor[];
}

export interface AthleteSearchResult {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  profile_image_url?: string | null;
  bio_description?: string | null;
  current_level: number;
  streak_days: number;
  roles?: string[];
  kin_name?: string | null;
  kin_logo_url?: string | null;
  is_following?: boolean;
}

export interface AthleteFeedPost {
  id: string;
  athlete_id: string;
  media_url: string;
  caption?: string | null;
  module_source?: string | null;
  related_intake_dish_id?: string | null;
  created_at?: string;
}

export interface AthleteProfile {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
  bio_description?: string | null;
  roles?: string[];
  contact_links?: any[];
  current_level?: number;
  streak_days?: number;
  followers_count?: number;
  following_count?: number;
  email?: string | null;
  phone?: string | null;
  has_completed_onboarding?: boolean;
  kin_id?: string | null;
  head_coach_id?: string | null;
  instructor_id?: string | null;
  altura_cm?: number | null;
  gender?: string | null;
  birth_date?: string | null;
  nivel_actividad?: string | null;
  sexo?: string | null;
  genero?: string | null;
  fecha_nacimiento?: string | null;
  edad?: number | null;
  kin?: KinInfo | null;
  kins?: KinInfo[];
  instructor_kins?: KinInfo[];
}

export interface NutritionMealRecord {
  id: string;
  id_original?: string;
  foto_url?: string;
  tipo_comida?: string;
  timestamp?: string;
  nombre?: string;
  plato_estimado?: string;
  adherencia?: string;
  notas?: string;
  is_active?: boolean;
  calorias?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
  dishes?: string[];
  items_count?: number;
}

export interface ProgressMetricRecord {
  id: string;
  id_original?: string | null;
  email?: string;
  timestamp: string;
  peso?: number | null;
  unidad_peso?: string;
  cintura?: number | null;
  cadera?: number | null;
  pecho?: number | null;
  foto_frontal_url?: string | null;
  foto_lateral_url?: string | null;
  foto_espalda_url?: string | null;
  porcentaje_grasa?: number | null;
  masa_muscular?: number | null;
  cuello?: number | null;
  biceps?: number | null;
  muslo?: number | null;
  created_at?: string;
}

export interface AthleteRecordsResponse {
  athlete_id: string;
  meals: NutritionMealRecord[];
  progress: ProgressMetricRecord[];
  posts?: AthleteFeedPost[];
}

export interface MealMacroDistribution {
  id: string;
  protocol_id: string;
  meal_type: 'DESAYUNO' | 'MERIENDA_AM' | 'ALMUERZO' | 'MERIENDA_PM' | 'CENA';
  protein_pct: number;
  carbs_pct: number;
  fats_pct: number;
  sort_order: number;
}

export interface AthleteNutritionProtocol {
  id: string;
  athlete_id: string;
  protocol: 'DEFICIT' | 'MAINTENANCE' | 'SURPLUS' | 'RECOMPOSITION';
  goal_kcal: number;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fats_target_g?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  athlete_meal_macro_distributions?: MealMacroDistribution[];
}

export interface AthleteProfileUpdate {
  first_name?: string;
  last_name?: string;
  username?: string;
  bio_description?: string;
  profile_image_url?: string;
  nivel_actividad?: string;
}


@Injectable({ providedIn: 'root' })
export class AthleteService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/athletes`;
  private supabase: SupabaseClient = supabaseClient;

  // Reactive State
  public currentAthlete = signal<AthleteProfile | null>(null);
  public availableAthletes = signal<AthleteProfile[]>([]);
  public currentRecords = signal<AthleteRecordsResponse | null>(null);
  public currentPosts = signal<AthleteFeedPost[]>([]);
  public currentNutritionProtocol = signal<AthleteNutritionProtocol | null>(null);
  public isLoading = signal<boolean>(false);

  public readonly dailyPostLimit: number = environment.dailyPostLimit ?? 3;

  public postsTodayCount = computed<number>(() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    return this.currentPosts().filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === todayUtc;
    }).length;
  });

  public remainingPostsToday = computed<number>(() => {
    if (this.dailyPostLimit <= 0) return Number.MAX_SAFE_INTEGER;
    return Math.max(0, this.dailyPostLimit - this.postsTodayCount());
  });

  public canCreatePostToday = computed<boolean>(() => {
    return this.dailyPostLimit <= 0 || this.postsTodayCount() < this.dailyPostLimit;
  });

  // Nivel de actividad del atleta (solo lectura desde Supabase)
  public currentActivityLevel = computed<ActivityLevelOption>(() => {
    const raw = (this.currentAthlete()?.nivel_actividad || 'SEDENTARY').toUpperCase().trim();
    return ACTIVITY_LEVELS.find((a) => a.key === raw) || ACTIVITY_LEVELS[0];
  });

  // TMB Actual (Mifflin-St Jeor) compartido para Perfil e Intake
  public currentTmb = computed(() => {
    const progress = this.currentRecords()?.progress || [];
    const sorted = [...progress]
      .filter((r) => r.peso != null && Number(r.peso) > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latest = sorted[0];
    if (!latest || !latest.peso) return null;

    const rawUnit = (latest.unidad_peso || 'lb').toLowerCase();
    const pesoKg = rawUnit === 'kg' ? Number(latest.peso) : Number(latest.peso) * 0.45359237;
    if (pesoKg <= 0) return null;

    const ath = this.currentAthlete();
    const rawSex = (ath?.gender || ath?.sexo || ath?.genero || '').toLowerCase().trim();

    let alturaCm = 166;
    let isEstimated = true;
    if (ath?.altura_cm && Number(ath.altura_cm) > 0) {
      alturaCm = Number(ath.altura_cm);
      isEstimated = false;
    } else if (['f', 'femenino', 'female', 'mujer'].includes(rawSex)) {
      alturaCm = 159;
    } else if (['m', 'masculino', 'male', 'hombre'].includes(rawSex)) {
      alturaCm = 172;
    }

    let age = 30;
    const birthDateStr = ath?.birth_date || ath?.fecha_nacimiento;
    if (ath?.edad && Number(ath.edad) > 0) {
      age = Number(ath.edad);
    } else if (birthDateStr) {
      const birth = new Date(birthDateStr);
      if (!isNaN(birth.getTime())) {
        const calculatedAge = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (calculatedAge > 10 && calculatedAge < 110) {
          age = calculatedAge;
        }
      }
    }

    let sexOffset = -78;
    if (['m', 'masculino', 'male', 'hombre'].includes(rawSex)) {
      sexOffset = 5;
    } else if (['f', 'femenino', 'female', 'mujer'].includes(rawSex)) {
      sexOffset = -161;
    }

    const kcal = Math.round(10 * pesoKg + 6.25 * alturaCm - 5 * age + sexOffset);
    return { kcal, alturaCm, isEstimated };
  });

  // TDEE = TMB × Factor de Actividad
  public currentTdee = computed<number | null>(() => {
    const tmb = this.currentTmb();
    if (!tmb) return null;
    return Math.round(tmb.kcal * this.currentActivityLevel().factor);
  });

  constructor() {
    this.hydrateAthleteProfile();
  }

  /**
   * Hidratación instantánea del perfil (0ms) desde LocalStorage para PWA móvil
   */
  private hydrateAthleteProfile(): void {
    const cached = localStorage.getItem('awakin_athlete_profile');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AthleteProfile;
        if (parsed && parsed.id) {
          this.currentAthlete.set(parsed);
        }
      } catch (e) {
        console.warn('Error hidratando perfil de atleta:', e);
      }
    }
  }

  public clearActiveAthlete(): void {
    this.currentAthlete.set(null);
    localStorage.removeItem('awakin_active_athlete_id');
    localStorage.removeItem('awakin_athlete_profile');
  }

  /**
   * Carga el perfil específico del atleta autenticado por ID o Username
   */
  public loadAthleteProfile(identifier: string): void {
    this.isLoading.set(true);
    this.http.get<AthleteProfile>(`${this.baseUrl}/${identifier}`).pipe(timeout(5000)).subscribe({
      next: (athlete) => {
        this.setActiveAthlete(athlete);
        this.isLoading.set(false);
      },
      error: async (err) => {
        console.warn(`Backend timeout/error al cargar perfil '${identifier}', recurriendo a Supabase:`, err);
        try {
          const { data } = await this.supabase
            .from('athletes')
            .select('*')
            .or(`id.eq.${identifier},username.eq.${identifier},email.eq.${identifier}`)
            .limit(1)
            .maybeSingle();
          if (data) {
            this.setActiveAthlete(data as AthleteProfile);
          }
        } catch (e) {
          console.error('Error en fallback Supabase de atleta:', e);
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  /**
   * Carga la lista de atletas desde el backend, opcionalmente filtrada por Kin/Team
   */
  public loadInitialAthletes(preferredIdentifier?: string, kinId?: string): void {
    this.isLoading.set(true);
    const url = kinId ? `${this.baseUrl}?kin_id=${encodeURIComponent(kinId)}` : this.baseUrl;
    this.http.get<AthleteProfile[]>(url).pipe(timeout(5000)).subscribe({
      next: (athletes) => {
        this.processAthletesList(athletes, preferredIdentifier);
      },
      error: async (err) => {
        console.warn('Backend timeout/error cargando atletas, recurriendo a Supabase:', err);
        try {
          let query = this.supabase.from('athletes').select('*').order('first_name');
          if (kinId) {
            query = query.eq('kin_id', kinId);
          }
          const { data } = await query;
          this.processAthletesList((data as AthleteProfile[]) || [], preferredIdentifier);
        } catch (e) {
          console.error('Error en fallback Supabase de atletas:', e);
          this.isLoading.set(false);
        }
      }
    });
  }

  private processAthletesList(athletes: AthleteProfile[], preferredIdentifier?: string): void {
    this.availableAthletes.set(athletes);
    if (athletes.length > 0) {
      let selected: AthleteProfile | undefined;

      if (preferredIdentifier) {
        selected = athletes.find(
          (a) =>
            a.id === preferredIdentifier ||
            a.email === preferredIdentifier ||
            a.username === preferredIdentifier
        );
      }

      if (!selected) {
        const sessionRaw = localStorage.getItem('awakin_session');
        if (sessionRaw) {
          try {
            const parsed = JSON.parse(sessionRaw);
            const authId = parsed?.avatar?.id;
            const authEmail = parsed?.avatar?.email;
            if (authId || authEmail) {
              selected = athletes.find(
                (a) => a.id === authId || (authEmail && a.email?.toLowerCase() === authEmail.toLowerCase())
              );
            }
          } catch (e) { }
        }
      }

      const cachedId = localStorage.getItem('awakin_active_athlete_id');
      if (!selected && cachedId) {
        selected = athletes.find((a) => a.id === cachedId);
      }

      this.setActiveAthlete(selected || athletes[0]);
    }
    this.isLoading.set(false);
  }

  /**
   * Establece el atleta activo y carga sus registros de fotos, progreso y posts de feed
   */
  public setActiveAthlete(athlete: AthleteProfile): void {
    this.currentAthlete.set(athlete);
    localStorage.setItem('awakin_active_athlete_id', athlete.id);
    try {
      localStorage.setItem('awakin_athlete_profile', JSON.stringify(athlete));
    } catch (e) {
      console.warn('Error guardando perfil en localStorage:', e);
    }
    this.loadAthleteRecords(athlete.id);
    this.loadAthletePosts(athlete.id);
    this.loadNutritionProtocol(athlete.id);
  }

  /**
   * Carga el protocolo nutricional activo y su distribución de macros por comida desde Supabase
   */
  public async loadNutritionProtocol(athleteId: string): Promise<void> {
    if (!athleteId) return;
    try {
      const { data, error } = await this.supabase
        .from('athlete_nutrition_protocols')
        .select('*, athlete_meal_macro_distributions(*)')
        .eq('athlete_id', athleteId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('No se pudo cargar protocolo nutricional activo:', error.message);
        return;
      }

      if (data) {
        const distributions = Array.isArray(data.athlete_meal_macro_distributions)
          ? [...data.athlete_meal_macro_distributions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          : [];
        this.currentNutritionProtocol.set({
          ...data,
          athlete_meal_macro_distributions: distributions
        } as AthleteNutritionProtocol);
      } else {
        this.currentNutritionProtocol.set(null);
      }
    } catch (e) {
      console.warn('Error consultando protocolo nutricional:', e);
    }
  }

  /**
   * Obtiene el perfil del atleta por ID o Username
   */
  public getAthleteProfile(identifier: string): Observable<AthleteProfile> {
    return this.http.get<AthleteProfile>(`${this.baseUrl}/${identifier}`).pipe(
      tap((athlete) => {
        this.currentAthlete.set(athlete);
        try {
          localStorage.setItem('awakin_athlete_profile', JSON.stringify(athlete));
          localStorage.setItem('awakin_active_athlete_id', athlete.id);
        } catch (e) { }
      })
    );
  }

  /**
   * Actualiza el perfil del atleta en Supabase
   */
  public updateProfile(athleteId: string, updates: AthleteProfileUpdate): Observable<AthleteProfile> {
    return this.http.patch<AthleteProfile>(`${this.baseUrl}/${athleteId}`, updates).pipe(
      tap((updated) => {
        this.currentAthlete.set(updated);
        try {
          localStorage.setItem('awakin_athlete_profile', JSON.stringify(updated));
        } catch (e) { }
        // Actualizar también en la lista local de disponibles
        this.availableAthletes.update((list) =>
          list.map((a) => (a.id === updated.id ? updated : a))
        );
      })
    );
  }

  /**
   * Carga fotos de comidas y progreso del atleta
   */
  public loadAthleteRecords(athleteId: string): void {
    this.http.get<AthleteRecordsResponse>(`${this.baseUrl}/${athleteId}/records`).subscribe({
      next: (records) => {
        this.currentRecords.set(records);
        if (records.posts && records.posts.length > 0) {
          this.currentPosts.set(records.posts);
        }
      },
      error: (err) => {
        console.error('Error cargando registros del atleta:', err);
      }
    });
  }

  /**
   * Carga publicaciones de feed de la tabla athlete_feed_posts
   */
  public loadAthletePosts(athleteId: string): void {
    this.http.get<AthleteFeedPost[]>(`${this.baseUrl}/${athleteId}/posts`).subscribe({
      next: (posts) => {
        this.currentPosts.set(posts);
      },
      error: (err) => {
        console.error('Error cargando posts del atleta:', err);
      }
    });
  }

  /**
   * Publica un nuevo post en athlete_feed_posts
   */
  public createPost(
    athleteId: string,
    post: { media_url: string; caption?: string; module_source?: string; related_intake_dish_id?: string }
  ): Observable<AthleteFeedPost> {
    return this.http.post<AthleteFeedPost>(`${this.baseUrl}/${athleteId}/posts`, post).pipe(
      tap((newPost) => {
        this.currentPosts.update((list) => [newPost, ...list]);
      })
    );
  }

  /**
   * Sube un archivo o blob al bucket de Supabase Storage especificado
   */
  public uploadMedia(
    file: File | Blob,
    bucket: 'avatars' | 'feed_posts' | 'fotos_progreso' | 'progress_photos' | 'fotos_comidas' | 'kin_assets' | 'brand_kin' = 'feed_posts',
    filename: string = 'media.jpg'
  ): Observable<{ status: string; bucket: string; filename: string; public_url: string }> {
    return from(compressImage(file, 1200, 0.82)).pipe(
      switchMap((compressedBlob) => {
        const formData = new FormData();
        formData.append('file', compressedBlob, filename);
        return this.http.post<{ status: string; bucket: string; filename: string; public_url: string }>(
          `${this.baseUrl}/upload-media?bucket=${bucket}`,
          formData
        );
      })
    );
  }

  /**
   * Guarda un nuevo registro de medidas/progreso corporal del atleta en la BD
   */
  public createProgressRecord(
    athleteId: string,
    record: Partial<ProgressMetricRecord>
  ): Observable<ProgressMetricRecord> {
    return this.http.post<ProgressMetricRecord>(`${this.baseUrl}/${athleteId}/progress`, record).pipe(
      tap((newRecord) => {
        this.currentRecords.update((curr) => {
          if (!curr) {
            return { athlete_id: athleteId, meals: [], progress: [newRecord], posts: [] };
          }
          return {
            ...curr,
            progress: [newRecord, ...curr.progress.filter((p) => p.id !== newRecord.id)]
          };
        });
      })
    );
  }

  /**
   * Actualiza un registro existente de medidas/progreso corporal del atleta en la BD
   */
  public updateProgressRecord(
    athleteId: string,
    progressId: string,
    record: Partial<ProgressMetricRecord>
  ): Observable<ProgressMetricRecord> {
    return this.http.put<ProgressMetricRecord>(`${this.baseUrl}/${athleteId}/progress/${progressId}`, record).pipe(
      tap((updated) => {
        this.currentRecords.update((curr) => {
          if (!curr) return null;
          return {
            ...curr,
            progress: curr.progress.map((p) => (p.id === progressId ? { ...p, ...updated } : p))
          };
        });
      })
    );
  }

  /**
   * Elimina un registro de progreso corporal del atleta
   */
  public deleteProgressRecord(
    athleteId: string,
    progressId: string
  ): Observable<{ status: string; id: string }> {
    return this.http.delete<{ status: string; id: string }>(`${this.baseUrl}/${athleteId}/progress/${progressId}`).pipe(
      tap(() => {
        this.currentRecords.update((curr) => {
          if (!curr) return null;
          return {
            ...curr,
            progress: curr.progress.filter((p) => p.id !== progressId)
          };
        });
      })
    );
  }

  /**
   * Verifica en tiempo real si un username está disponible
   */
  public checkUsernameAvailability(
    username: string,
    excludeId?: string
  ): Observable<{ username: string; available: boolean; message: string }> {
    let url = `${this.baseUrl}/check-username?username=${encodeURIComponent(username)}`;
    if (excludeId) {
      url += `&exclude_id=${encodeURIComponent(excludeId)}`;
    }
    return this.http.get<{ username: string; available: boolean; message: string }>(url);
  }

  // ==========================================================================
  // MULTI-INSTRUCTOR Y GESTIÓN DE CLIENTES DE KIN/TEAM
  // ==========================================================================

  /**
   * Obtiene la lista de instructores asignados a un Kin
   */
  public getKinInstructors(kinId: string): Observable<KinInstructor[]> {
    return this.http.get<KinInstructor[]>(`${this.baseUrl}/kin/${kinId}/instructors`);
  }

  /**
   * Asocia un nuevo instructor a un Kin
   */
  public addKinInstructor(kinId: string, instructorId: string, role: string = 'instructor'): Observable<KinInstructor> {
    return this.http.post<KinInstructor>(`${this.baseUrl}/kin/${kinId}/instructors`, {
      instructor_id: instructorId,
      role
    });
  }

  /**
   * Remueve la asignación de un instructor de un Kin
   */
  public removeKinInstructor(kinId: string, instructorId: string): Observable<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(`${this.baseUrl}/kin/${kinId}/instructors/${instructorId}`);
  }

  /**
   * Obtiene los clientes / miembros de un Kin/Team para que cualquier instructor asignado los gestione
   */
  public getTeamAthletes(kinId: string): Observable<AthleteProfile[]> {
    return this.http.get<AthleteProfile[]>(`${this.baseUrl}/kin/${kinId}/athletes`);
  }

  // ==========================================================================
  // BÚSQUEDA GLOBAL, PERFIL PÚBLICO (SOLO LECTURA) Y SEGUIMIENTO SOCIAL
  // ==========================================================================

  /**
   * Búsqueda global de perfiles públicos en Awakin
   */
  public searchAthletes(query: string, viewerId?: string, limit: number = 25): Observable<AthleteSearchResult[]> {
    const params: Record<string, string> = { q: query || '', limit: String(limit) };
    if (viewerId) params['viewer_id'] = viewerId;
    return this.http.get<AthleteSearchResult[]>(`${this.baseUrl}/search`, { params });
  }

  /**
   * Carga un perfil público de atleta por username o UUID sin alterar el atleta autenticado
   */
  public getPublicAthleteProfile(identifier: string): Observable<AthleteProfile> {
    return this.http.get<AthleteProfile>(`${this.baseUrl}/${encodeURIComponent(identifier)}`);
  }

  /**
   * Carga registros (comidas/posts) de un perfil público sin mutar estado global
   */
  public getPublicAthleteRecords(athleteId: string): Observable<AthleteRecordsResponse> {
    return this.http.get<AthleteRecordsResponse>(`${this.baseUrl}/${encodeURIComponent(athleteId)}/records`);
  }

  /**
   * Carga publicaciones de un perfil público sin mutar estado global
   */
  public getPublicAthletePosts(athleteId: string): Observable<AthleteFeedPost[]> {
    return this.http.get<AthleteFeedPost[]>(`${this.baseUrl}/${encodeURIComponent(athleteId)}/posts`);
  }

  /**
   * Carga protocolo nutricional activo de un perfil público (solo lectura)
   */
  public async getPublicNutritionProtocol(athleteId: string): Promise<AthleteNutritionProtocol | null> {
    if (!athleteId) return null;
    try {
      const { data, error } = await this.supabase
        .from('athlete_nutrition_protocols')
        .select('*, athlete_meal_macro_distributions(*)')
        .eq('athlete_id', athleteId)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      const distributions = Array.isArray(data.athlete_meal_macro_distributions)
        ? [...data.athlete_meal_macro_distributions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        : [];
      return {
        ...data,
        athlete_meal_macro_distributions: distributions,
      } as AthleteNutritionProtocol;
    } catch {
      return null;
    }
  }

  /**
   * Lista real de seguidores de un atleta
   */
  public getAthleteFollowers(athleteId: string, viewerId?: string): Observable<AthleteSearchResult[]> {
    const params: Record<string, string> = {};
    if (viewerId) params['viewer_id'] = viewerId;
    return this.http.get<AthleteSearchResult[]>(`${this.baseUrl}/${encodeURIComponent(athleteId)}/followers`, { params });
  }

  /**
   * Lista real de perfiles seguidos por un atleta
   */
  public getAthleteFollowing(athleteId: string, viewerId?: string): Observable<AthleteSearchResult[]> {
    const params: Record<string, string> = {};
    if (viewerId) params['viewer_id'] = viewerId;
    return this.http.get<AthleteSearchResult[]>(`${this.baseUrl}/${encodeURIComponent(athleteId)}/following`, { params });
  }

  /**
   * Verifica si followerId sigue a followingId
   */
  public getFollowStatus(followerId: string, followingId: string): Observable<{ is_following: boolean }> {
    return this.http.get<{ is_following: boolean }>(`${this.baseUrl}/follow/status`, {
      params: { follower_id: followerId, following_id: followingId },
    });
  }

  /**
   * Sigue a un atleta
   */
  public followAthlete(followerId: string, followingId: string): Observable<{ status: string; message: string }> {
    return this.http
      .post<{ status: string; message: string }>(
        `${this.baseUrl}/follow/${encodeURIComponent(followingId)}`,
        null,
        { params: { follower_id: followerId } }
      )
      .pipe(
        tap(() => {
          const me = this.currentAthlete();
          if (me && me.id === followerId) {
            this.currentAthlete.set({ ...me, following_count: (me.following_count || 0) + 1 });
          }
        })
      );
  }

  /**
   * Deja de seguir a un atleta
   */
  public unfollowAthlete(followerId: string, followingId: string): Observable<{ status: string; message: string }> {
    return this.http
      .delete<{ status: string; message: string }>(
        `${this.baseUrl}/follow/${encodeURIComponent(followingId)}`,
        { params: { follower_id: followerId } }
      )
      .pipe(
        tap(() => {
          const me = this.currentAthlete();
          if (me && me.id === followerId) {
            this.currentAthlete.set({ ...me, following_count: Math.max(0, (me.following_count || 0) - 1) });
          }
        })
      );
  }
}



