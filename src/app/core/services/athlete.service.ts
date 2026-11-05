import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, from, switchMap, timeout } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { compressImage } from '../helpers/image-compressor.helper';
import { environment } from '../../../environments/environment';

export interface KinInfo {
  id: string;
  team_name: string;
  team_logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  manifesto?: string | null;
  head_coach_id?: string | null;
  instructor_id?: string | null;
  role_in_kin?: string;
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
  kin_id?: string | null;
  head_coach_id?: string | null;
  instructor_id?: string | null;
  kin?: KinInfo | null;
}

export interface NutritionMealRecord {
  id: string;
  foto_url?: string;
  tipo_comida?: string;
  timestamp?: string;
  nombre?: string;
  adherencia?: string;
  notas?: string;
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

export interface AthleteProfileUpdate {
  first_name?: string;
  last_name?: string;
  username?: string;
  bio_description?: string;
  profile_image_url?: string;
}


@Injectable({ providedIn: 'root' })
export class AthleteService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/athletes`;
  private supabase: SupabaseClient = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY);

  // Reactive State
  public currentAthlete = signal<AthleteProfile | null>(null);
  public availableAthletes = signal<AthleteProfile[]>([]);
  public currentRecords = signal<AthleteRecordsResponse | null>(null);
  public currentPosts = signal<AthleteFeedPost[]>([]);
  public isLoading = signal<boolean>(false);

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
    this.http.get<AthleteProfile>(`${this.baseUrl}/${identifier}`).pipe(timeout(3500)).subscribe({
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
   * Carga la lista de atletas desde el backend
   */
  public loadInitialAthletes(preferredIdentifier?: string): void {
    this.isLoading.set(true);
    this.http.get<AthleteProfile[]>(this.baseUrl).pipe(timeout(3500)).subscribe({
      next: (athletes) => {
        this.processAthletesList(athletes, preferredIdentifier);
      },
      error: async (err) => {
        console.warn('Backend timeout/error cargando atletas, recurriendo a Supabase:', err);
        try {
          const { data } = await this.supabase
            .from('athletes')
            .select('*')
            .order('first_name');
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
          } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
    bucket: 'avatars' | 'feed_posts' | 'progress_photos' | 'fotos_comidas' = 'feed_posts',
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
}



