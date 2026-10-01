import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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
  foto_frontal_url?: string;
  foto_lateral_url?: string;
  foto_espalda_url?: string;
  peso?: number;
  unidad_peso?: string;
  cintura?: number;
  cadera?: number;
  pecho?: number;
  timestamp?: string;
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

  // Reactive State
  public currentAthlete = signal<AthleteProfile | null>(null);
  public availableAthletes = signal<AthleteProfile[]>([]);
  public currentRecords = signal<AthleteRecordsResponse | null>(null);
  public currentPosts = signal<AthleteFeedPost[]>([]);
  public isLoading = signal<boolean>(false);

  constructor() {
    this.loadInitialAthletes();
  }

  /**
   * Carga la lista de atletas desde el backend
   */
  public loadInitialAthletes(preferredIdentifier?: string): void {
    this.isLoading.set(true);
    this.http.get<AthleteProfile[]>(this.baseUrl).subscribe({
      next: (athletes) => {
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
            // Intentar recuperar el último atleta seleccionado guardado en localStorage
            const savedId = localStorage.getItem('awakin_active_athlete_id');
            if (savedId) {
              selected = athletes.find((a) => a.id === savedId);
            }
          }
          this.setActiveAthlete(selected || athletes[0]);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando atletas:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Establece el atleta activo y carga sus registros de fotos, progreso y posts de feed
   */
  public setActiveAthlete(athlete: AthleteProfile): void {
    this.currentAthlete.set(athlete);
    localStorage.setItem('awakin_active_athlete_id', athlete.id);
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
    bucket: 'avatars' | 'feed_posts' = 'feed_posts',
    filename: string = 'media.jpg'
  ): Observable<{ status: string; bucket: string; filename: string; public_url: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    return this.http.post<{ status: string; bucket: string; filename: string; public_url: string }>(
      `${this.baseUrl}/upload-media?bucket=${bucket}`,
      formData
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



