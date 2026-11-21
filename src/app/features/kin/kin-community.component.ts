import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AthleteService } from '../../core/services/athlete.service';
import { ThemeService } from '../../core/services/theme.service';
import { KinCalendarEvent, KinMemberItem, KinService } from '../../core/services/kin.service';

type LeaderboardMode = 'streak' | 'workouts' | 'level';
type KinSectionTab = 'agenda' | 'leaderboard' | 'feed';
type AgendaViewMode = 'month' | 'list';

@Component({
  selector: 'app-kin-community.component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kin-community.component.html',
  styleUrl: './kin-community.component.css',
})
export class KinCommunityComponent {
  public athleteService = inject(AthleteService);
  public themeService = inject(ThemeService);
  public kinService = inject(KinService);
  private sanitizer = inject(DomSanitizer);

  public activeTab = signal<KinSectionTab>('agenda');
  public agendaViewMode = signal<AgendaViewMode>('month');
  public leaderboardMode = signal<LeaderboardMode>('streak');
  public selectedEvent = signal<KinCalendarEvent | null>(null);

  public activeKin = computed(() => this.themeService.activeKin());
  public currentAthleteId = computed(() => this.athleteService.currentAthlete()?.id || '');

  public kinSummary = computed(() => {
    return this.kinService.overview()?.kin || this.activeKin();
  });

  public googleCalendarEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const calId = this.kinSummary()?.google_calendar_id?.trim();
    if (!calId) return null;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const params = new URLSearchParams({
      src: calId,
      mode: 'MONTH',
      showTitle: '0',
      showPrint: '0',
      showTabs: '0',
      showCalendars: '0',
      showTz: '0',
      wkst: '2',
    });
    if (tz) {
      params.set('ctz', tz);
    }
    const url = `https://calendar.google.com/calendar/embed?${params.toString()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  public sortedLeaderboard = computed<KinMemberItem[]>(() => {
    const members = [...(this.kinService.overview()?.members || [])];
    const mode = this.leaderboardMode();

    return members.sort((a, b) => {
      if (mode === 'workouts') {
        return b.weekly_workouts - a.weekly_workouts || b.streak_days - a.streak_days;
      }
      if (mode === 'level') {
        return b.current_level - a.current_level || b.streak_days - a.streak_days;
      }
      return b.streak_days - a.streak_days || b.weekly_workouts - a.weekly_workouts;
    });
  });

  public feedPosts = computed(() => this.kinService.overview()?.feed_posts || []);
  public calendarEvents = computed(() => this.kinService.events());

  constructor() {
    effect(() => {
      const kinId = this.activeKin()?.id;
      if (!kinId) return;
      untracked(() => {
        this.kinService.loadOverview(kinId);
      });
    });
  }

  public refreshKin(): void {
    const kinId = this.activeKin()?.id;
    if (kinId) {
      this.kinService.loadOverview(kinId);
    }
  }

  public openWhatsAppGroup(): void {
    const url = this.kinSummary()?.whatsapp_group_url?.trim();
    if (!url || typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public addToMyGoogleCalendar(evt: KinCalendarEvent, event?: Event): void {
    event?.stopPropagation();
    if (typeof window === 'undefined') return;
    const url = this.kinService.buildGoogleCalendarEventUrl(evt);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public isTodayEvent(evt: KinCalendarEvent): boolean {
    const d = this.kinService.parseEventDate(evt.start, evt.all_day);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  public formatEventDay(evt: KinCalendarEvent): string {
    const d = this.kinService.parseEventDate(evt.start, evt.all_day);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  public formatEventTime(evt: KinCalendarEvent): string {
    if (evt.all_day) return 'Todo el día';
    const d = new Date(evt.start);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  public getMetricValue(member: KinMemberItem): string {
    switch (this.leaderboardMode()) {
      case 'workouts':
        return `${member.weekly_workouts} ${member.weekly_workouts === 1 ? 'entreno' : 'entrenos'}`;
      case 'level':
        return `Nv. ${member.current_level}`;
      case 'streak':
      default:
        return `${member.streak_days} 🔥`;
    }
  }
}
