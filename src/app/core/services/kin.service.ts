import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { KinInfo } from './athlete.service';
import { WorkoutLog } from '../../features/workout/models/workout.models';

export interface KinAuthorSummary {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  profile_image_url?: string | null;
  gender?: string | null;
  sexo?: string | null;
  genero?: string | null;
}

export interface KinWorkoutFeedItem {
  author: KinAuthorSummary;
  workout_log: WorkoutLog;
}

export interface KinMealPhotoItem {
  id: string;
  email?: string | null;
  nombre?: string | null;
  plato_estimado?: string | null;
  tipo_comida?: string | null;
  foto_url: string;
  calorias?: number | null;
  proteina_g?: number | null;
  carbohidratos_g?: number | null;
  grasas_g?: number | null;
  timestamp?: string | null;
  items_count?: number;
  dishes?: string[];
  author: KinAuthorSummary;
}

export type AwakinFeedScope = 'all' | 'following' | 'kin';

export interface AwakinFeedItem {
  id: string;
  item_type: 'post' | 'workout';
  sort_date: string;
  author: KinAuthorSummary;
  post?: KinFeedPostItem;
  workout_log?: WorkoutLog;
}

export interface KinMemberItem {
  id: string;
  username: string;
  full_name: string;
  profile_image_url?: string | null;
  current_level: number;
  streak_days: number;
  weekly_workouts: number;
  kin_role: 'head_coach' | 'instructor' | 'member' | string;
}

export interface KinFeedPostItem {
  id: string;
  athlete_id: string;
  media_url: string;
  caption?: string | null;
  module_source?: string | null;
  related_intake_dish_id?: string | null;
  created_at?: string;
  author_name?: string;
  author_username?: string | null;
  author_avatar?: string | null;
}

export interface KinCalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end?: string | null;
  all_day: boolean;
}

export interface KinOverviewResponse {
  kin: KinInfo;
  members_count: number;
  members: KinMemberItem[];
  feed_posts: KinFeedPostItem[];
  workout_logs?: KinWorkoutFeedItem[];
  meal_photos?: KinMealPhotoItem[];
  events: KinCalendarEvent[];
}

const DISMISSED_EVENTS_KEY = 'awakin_dismissed_kin_events';

@Injectable({ providedIn: 'root' })
export class KinService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/kin`;

  public overview = signal<KinOverviewResponse | null>(null);
  public events = signal<KinCalendarEvent[]>([]);
  public isLoading = signal<boolean>(false);
  public awakinFeedItems = signal<AwakinFeedItem[]>([]);
  public awakinFeedLoading = signal<boolean>(false);
  private dismissedEventIds = signal<string[]>(this.readDismissedEventIds());

  /** Convierte la fecha del evento respetando eventos de día completo en hora local */
  public parseEventDate(isoOrDate: string, allDay?: boolean): Date {
    if (!isoOrDate) return new Date(NaN);
    if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
      const match = isoOrDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
    }
    return new Date(isoOrDate);
  }

  /** Próximo evento del Kin dentro de las próximas 24 horas que no haya sido descartado */
  public upcomingPopupEvent = computed<KinCalendarEvent | null>(() => {
    const dismissed = new Set(this.dismissedEventIds());
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000;
    const gracePast = now - 2 * 60 * 60 * 1000;

    const candidate = this.events().find((evt) => {
      if (dismissed.has(evt.id)) return false;
      const startDate = this.parseEventDate(evt.start, evt.all_day);
      const startMs = startDate.getTime();
      if (Number.isNaN(startMs)) return false;
      if (evt.all_day) {
        const endOfDayMs = startMs + 24 * 60 * 60 * 1000;
        return endOfDayMs >= now && startMs <= horizon;
      }
      return startMs >= gracePast && startMs <= horizon;
    });

    return candidate || null;
  });

  public loadOverview(kinId: string): void {
    if (!kinId) return;
    this.isLoading.set(true);
    this.http.get<KinOverviewResponse>(`${this.baseUrl}/${kinId}/overview`).subscribe({
      next: (res) => {
        this.overview.set(res);
        this.events.set(res.events || []);
        this.isLoading.set(false);
        this.notifyUpcomingIfPermitted();
      },
      error: (err) => {
        console.error('Error cargando overview del Kin:', err);
        this.isLoading.set(false);
      },
    });
  }

  public loadEvents(kinId: string): void {
    if (!kinId) return;
    this.http
      .get<{ kin_id: string; google_calendar_id?: string | null; events: KinCalendarEvent[] }>(
        `${this.baseUrl}/${kinId}/events`
      )
      .subscribe({
        next: (res) => {
          this.events.set(res.events || []);
          this.notifyUpcomingIfPermitted();
        },
        error: () => {},
      });
  }

  public updateKinBranding(
    kinId: string,
    payload: {
      header_image_url?: string | null;
      meals_banner_url?: string | null;
      ranking_bg_url?: string | null;
      agenda_bg_url?: string | null;
    }
  ) {
    return this.http.patch<{ status: string; kin: KinInfo }>(`${this.baseUrl}/${kinId}/branding`, payload);
  }

  public leaveKin(kinId: string, athleteId: string, scope: 'member' | 'instructor' = 'member') {
    return this.http.post<{ status: string; scope: string; left_kin_id: string; is_active: boolean }>(
      `${this.baseUrl}/${kinId}/leave`,
      { athlete_id: athleteId, scope }
    );
  }

  // =========================================================================
  // INVITACIONES PRIVADAS Y SOLICITUDES DE INGRESO DEL KIN
  // =========================================================================

  public getInvitePreview(token: string) {
    return this.http.get<{
      valid: boolean;
      invalid_reason?: string | null;
      token: string;
      label?: string | null;
      requires_approval: boolean;
      expires_at?: string | null;
      kin?: {
        id?: string;
        team_name?: string;
        team_logo_url?: string | null;
        primary_color?: string;
        manifesto?: string | null;
        header_image_url?: string | null;
        head_coach_name?: string | null;
      };
    }>(`${this.baseUrl}/invites/${encodeURIComponent(token)}`);
  }

  public listKinInvites(kinId: string) {
    return this.http.get<any[]>(`${this.baseUrl}/${kinId}/invites`);
  }

  public createKinInvite(
    kinId: string,
    payload: {
      created_by: string;
      label?: string | null;
      requires_approval: boolean;
      max_uses?: number | null;
      expires_in_hours?: number | null;
    }
  ) {
    return this.http.post<any>(`${this.baseUrl}/${kinId}/invites`, payload);
  }

  public toggleKinInvite(inviteId: string, isActive: boolean) {
    return this.http.patch<any>(`${this.baseUrl}/invites/${inviteId}/toggle`, { is_active: isActive });
  }

  public deleteKinInvite(inviteId: string, deletedBy: string) {
    return this.http.delete<{ status: string; deleted_id: string }>(`${this.baseUrl}/invites/${inviteId}`, {
      params: { deleted_by: deletedBy },
    });
  }

  public listKinJoinRequests(kinId: string, status: string = 'PENDING') {
    return this.http.get<any[]>(`${this.baseUrl}/${kinId}/join-requests`, { params: { status } });
  }

  public approveKinJoinRequest(requestId: string, reviewedBy: string) {
    return this.http.post<any>(`${this.baseUrl}/join-requests/${requestId}/approve`, { reviewed_by: reviewedBy });
  }

  public rejectKinJoinRequest(requestId: string, reviewedBy: string) {
    return this.http.post<any>(`${this.baseUrl}/join-requests/${requestId}/reject`, { reviewed_by: reviewedBy });
  }

  public loadAwakinFeed(athleteId: string, scope: AwakinFeedScope = 'all', kinId?: string | null): void {
    if (!athleteId) return;
    this.awakinFeedLoading.set(true);
    const params: Record<string, string> = { athlete_id: athleteId, scope };
    if (kinId) {
      params['kin_id'] = kinId;
    }
    this.http
      .get<{ scope: AwakinFeedScope; items: AwakinFeedItem[] }>(`${this.baseUrl}/awakin-feed`, {
        params,
      })
      .subscribe({
        next: (res) => {
          this.awakinFeedItems.set(res.items || []);
          this.awakinFeedLoading.set(false);
        },
        error: (err) => {
          console.error('Error cargando Awakin feed:', err);
          this.awakinFeedLoading.set(false);
        },
      });
  }

  public dismissPopupEvent(eventId: string): void {
    if (!eventId) return;
    const next = Array.from(new Set([...this.dismissedEventIds(), eventId])).slice(-50);
    this.dismissedEventIds.set(next);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(DISMISSED_EVENTS_KEY, JSON.stringify(next));
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
  }

  public buildGoogleCalendarEventUrl(evt: KinCalendarEvent): string {
    const startClean = new Date(evt.start).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const endDate = evt.end ? new Date(evt.end) : new Date(new Date(evt.start).getTime() + 60 * 60 * 1000);
    const endClean = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evt.title || 'Evento Kin',
      dates: `${startClean}/${endClean}`,
    });
    if (evt.description) params.set('details', evt.description);
    if (evt.location) params.set('location', evt.location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  private notifyUpcomingIfPermitted(): void {
    const evt = this.upcomingPopupEvent();
    if (!evt || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const sessionKey = `awakin_notified_evt_${evt.id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

    try {
      new Notification(`Actividad Kin: ${evt.title}`, {
        body: evt.location ? `Lugar: ${evt.location}` : 'Evento próximo en el calendario de tu Kin.',
        icon: 'icons/icon-192x192.png',
      });
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(sessionKey, '1');
      }
    } catch {
      // Ignorar en navegadores sin constructor Notification directo
    }
  }

  private readDismissedEventIds(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(DISMISSED_EVENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
