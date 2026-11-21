import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { KinInfo } from './athlete.service';

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
