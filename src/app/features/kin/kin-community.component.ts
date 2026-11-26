import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AthleteProfile, AthleteService } from '../../core/services/athlete.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  KinAuthorSummary,
  KinCalendarEvent,
  KinFeedPostItem,
  KinMealPhotoItem,
  KinMemberItem,
  KinService,
} from '../../core/services/kin.service';
import { WorkoutLog } from '../workout/models/workout.models';
import { WorkoutLogCardComponent } from '../workout/components/workout-log-card/workout-log-card.component';
import { WorkoutLogDetailModalComponent } from '../workout/components/workout-log-detail-modal/workout-log-detail-modal.component';
import { WorkoutLogEditModalComponent } from '../workout/components/workout-log-edit-modal/workout-log-edit-modal.component';
import { WorkoutStoryModalComponent } from '../workout/components/workout-story-modal/workout-story-modal.component';
import { BodyMapGender } from '../workout/components/body-map/body-map.component';
import { KinMealsCollageModalComponent } from './components/kin-meals-collage-modal/kin-meals-collage-modal.component';
import { KinRankingStoryModalComponent } from './components/kin-ranking-story-modal/kin-ranking-story-modal.component';

type LeaderboardMode = 'streak' | 'workouts' | 'level';
type KinSectionTab = 'feed' | 'meals' | 'leaderboard' | 'agenda';
type AgendaViewMode = 'month' | 'week' | 'list';

export interface KinMuroItem {
  id: string;
  item_type: 'post' | 'workout';
  sort_date: string;
  post?: KinFeedPostItem;
  workout_log?: WorkoutLog;
  author_profile?: AthleteProfile;
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: KinCalendarEvent[];
}

@Component({
  selector: 'app-kin-community.component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WorkoutLogCardComponent,
    WorkoutLogDetailModalComponent,
    WorkoutLogEditModalComponent,
    WorkoutStoryModalComponent,
    KinMealsCollageModalComponent,
    KinRankingStoryModalComponent,
  ],
  templateUrl: './kin-community.component.html',
  styleUrl: './kin-community.component.css',
})
export class KinCommunityComponent {
  public athleteService = inject(AthleteService);
  public themeService = inject(ThemeService);
  public kinService = inject(KinService);
  private router = inject(Router);

  public activeTab = signal<KinSectionTab>('feed');
  public agendaViewMode = signal<AgendaViewMode>('month');
  public leaderboardMode = signal<LeaderboardMode>('streak');
  public selectedEvent = signal<KinCalendarEvent | null>(null);
  public selectedMeal = signal<KinMealPhotoItem | null>(null);
  public selectedPost = signal<KinFeedPostItem | null>(null);

  public selectedWorkoutLog = signal<WorkoutLog | null>(null);
  public selectedWorkoutGender = signal<BodyMapGender | null>(null);
  public showWorkoutDetail = signal<boolean>(false);

  public isWorkoutEditModalOpen = signal<boolean>(false);
  public logToEdit = signal<WorkoutLog | null>(null);
  public isShareWorkoutModalOpen = signal<boolean>(false);
  public shareWorkoutTargetLog = signal<WorkoutLog | null>(null);

  // Modales de Collage Comidas Kin, Podio Ranking 9:16 y Personalización Visual del Kin
  public isMealsCollageModalOpen = signal<boolean>(false);
  public isRankingStoryModalOpen = signal<boolean>(false);
  public isBrandingModalOpen = signal<boolean>(false);
  public brandingHeaderUrl = signal<string>('');
  public brandingMealsBannerUrl = signal<string>('');
  public brandingRankingBgUrl = signal<string>('');
  public brandingAgendaBgUrl = signal<string>('');
  public isSavingBranding = signal<boolean>(false);
  public uploadingBrandingSlot = signal<'header' | 'meals' | 'ranking' | 'agenda' | null>(null);
  public brandingError = signal<string | null>(null);

  // Gestión de Invitaciones Privadas y Solicitudes (Solo Coach/Instructor)
  public isInvitesModalOpen = signal<boolean>(false);
  public invitesModalTab = signal<'links' | 'requests'>('links');
  public kinInvites = signal<any[]>([]);
  public kinJoinRequests = signal<any[]>([]);
  public isLoadingInvites = signal<boolean>(false);
  public isCreatingInvite = signal<boolean>(false);
  public newInviteLabel = signal<string>('');
  public newInviteRequiresApproval = signal<boolean>(true);
  public newInviteMaxUses = signal<number | null>(null);
  public newInviteExpiresHours = signal<number | null>(168);
  public copiedInviteId = signal<string | null>(null);
  public copiedCodeId = signal<string | null>(null);
  public reviewingRequestId = signal<string | null>(null);
  public invitesError = signal<string | null>(null);

  // Salida voluntaria del Kin (Atleta o Instructor secundario; Head Coach no puede salirse directamente)
  public isLeaveKinModalOpen = signal<boolean>(false);
  public isLeavingKin = signal<boolean>(false);
  public leaveKinError = signal<string | null>(null);

  public isHeadCoachOfActiveKin = computed<boolean>(() => {
    const a = this.athleteService.currentAthlete();
    const k: any = this.kinSummary();
    if (!a || !k?.id) return false;
    return k.head_coach_id === a.id || k.instructor_id === a.id;
  });

  public leaveKinScope = computed<'member' | 'instructor' | null>(() => {
    const a = this.athleteService.currentAthlete();
    const k: any = this.kinSummary();
    if (!a || !k?.id || this.isHeadCoachOfActiveKin()) return null;
    if (this.canEditKinBranding()) return 'instructor';
    if (String(a.kin_id || '') === String(k.id)) return 'member';
    return null;
  });

  public canEditKinBranding = computed<boolean>(() => {
    const a = this.athleteService.currentAthlete();
    const k: any = this.kinSummary();
    if (!a || !k?.id) return false;

    // Estrictamente por pertenencia como coach de ESTE Kin:
    // 1. Head Coach en tabla public.kin
    if (k.head_coach_id === a.id || k.instructor_id === a.id) return true;

    // 2. Asignación explícita en tabla public.kin_instructors para ESTE kin_id
    if (Array.isArray(k.instructor_ids) && k.instructor_ids.includes(a.id)) return true;
    if (Array.isArray(k.instructors) && k.instructors.some((i: any) => i.instructor_id === a.id)) return true;
    if ((a.instructor_kins || []).some((ik) => ik.id === k.id)) return true;

    const ov = this.kinService.overview();
    if (ov && ov.kin?.id === k.id) {
      const overviewMember = ov.members?.find((m) => m.id === a.id);
      if (overviewMember && overviewMember.kin_role && overviewMember.kin_role !== 'member') {
        return true;
      }
    }

    // Si solo pertenece al Kin como miembro (athletes.kin_id), NO es coach en este Kin
    // independientemente de sus roles globales (ADMINISTRATOR / INSTRUCTOR).
    return false;
  });

  // Estado de navegación del calendario (Mes / Semana)
  public calendarCursor = signal<Date>(new Date());
  public selectedDateKey = signal<string>(this.toDateKey(new Date()));

  public activeKin = computed(() => this.themeService.activeKin());
  public currentAthleteId = computed(() => this.athleteService.currentAthlete()?.id || '');
  public currentAthleteGender = computed<BodyMapGender>(() => {
    const a = this.athleteService.currentAthlete();
    const raw = (a?.gender || a?.sexo || a?.genero || '').toLowerCase().trim();
    return raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino' ? 'female' : 'male';
  });

  public kinSummary = computed(() => {
    const active = this.activeKin();
    const ovKin = this.kinService.overview()?.kin;
    if (active && ovKin && ovKin.id === active.id) return ovKin;
    return active || ovKin;
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

  public muroItems = computed<KinMuroItem[]>(() => {
    const ov = this.kinService.overview();
    if (!ov) return [];

    const items: KinMuroItem[] = [];
    for (const post of ov.feed_posts || []) {
      items.push({
        id: `post-${post.id}`,
        item_type: 'post',
        sort_date: post.created_at || '',
        post,
      });
    }
    for (const wItem of ov.workout_logs || []) {
      const log = wItem.workout_log;
      items.push({
        id: `workout-${log.id}`,
        item_type: 'workout',
        sort_date: log.created_at || log.workout_date || '',
        workout_log: log,
        author_profile: this.toAthleteProfile(wItem.author),
      });
    }

    return items.sort((a, b) => (b.sort_date || '').localeCompare(a.sort_date || ''));
  });

  public mealPhotos = computed(() => this.kinService.overview()?.meal_photos || []);
  public calendarEvents = computed(() => this.kinService.events());

  public eventsByDateMap = computed<Map<string, KinCalendarEvent[]>>(() => {
    const map = new Map<string, KinCalendarEvent[]>();
    for (const evt of this.calendarEvents()) {
      const d = this.kinService.parseEventDate(evt.start, evt.all_day);
      if (Number.isNaN(d.getTime())) continue;
      const key = this.toDateKey(d);
      const list = map.get(key) || [];
      list.push(evt);
      map.set(key, list);
    }
    return map;
  });

  public monthLabel = computed(() => {
    const d = this.calendarCursor();
    const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  public weekLabel = computed(() => {
    const days = this.weekDays();
    if (days.length < 7) return '';
    const first = days[0].date;
    const last = days[6].date;
    const startStr = first.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const endStr = last.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  });

  public monthCells = computed<CalendarDayCell[]>(() => {
    const cursor = this.calendarCursor();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Lunes = 0
    const gridStart = new Date(year, month, 1 - startOffset);

    const todayKey = this.toDateKey(new Date());
    const evMap = this.eventsByDateMap();
    const cells: CalendarDayCell[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = this.toDateKey(d);
      cells.push({
        date: d,
        dateKey: key,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === month,
        isToday: key === todayKey,
        events: evMap.get(key) || [],
      });
    }
    return cells;
  });

  public weekDays = computed<CalendarDayCell[]>(() => {
    const cursor = this.calendarCursor();
    const startOffset = (cursor.getDay() + 6) % 7; // Lunes = 0
    const monday = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - startOffset);

    const todayKey = this.toDateKey(new Date());
    const evMap = this.eventsByDateMap();
    const days: CalendarDayCell[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = this.toDateKey(d);
      days.push({
        date: d,
        dateKey: key,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === cursor.getMonth(),
        isToday: key === todayKey,
        events: evMap.get(key) || [],
      });
    }
    return days;
  });

  public selectedDayEvents = computed<KinCalendarEvent[]>(() => {
    return this.eventsByDateMap().get(this.selectedDateKey()) || [];
  });

  public googleCalendarPublicUrl = computed<string | null>(() => {
    const calId = this.kinSummary()?.google_calendar_id?.trim();
    if (!calId) return null;
    return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}`;
  });

  constructor() {
    effect(() => {
      const kinId = this.activeKin()?.id;
      if (!kinId) return;
      untracked(() => {
        this.kinService.loadOverview(kinId);
        if (this.canEditKinBranding()) {
          this.loadPendingJoinRequestsBadge(kinId);
        }
      });
    });
  }

  public refreshKin(): void {
    const kinId = this.activeKin()?.id;
    if (kinId) {
      this.kinService.loadOverview(kinId);
    }
  }

  public navigateCalendar(step: number): void {
    const cur = this.calendarCursor();
    if (this.agendaViewMode() === 'week') {
      this.calendarCursor.set(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + step * 7));
    } else {
      this.calendarCursor.set(new Date(cur.getFullYear(), cur.getMonth() + step, 1));
    }
  }

  public goToToday(): void {
    const now = new Date();
    this.calendarCursor.set(now);
    this.selectedDateKey.set(this.toDateKey(now));
  }

  public selectCalendarDay(cell: CalendarDayCell): void {
    this.selectedDateKey.set(cell.dateKey);
    if (cell.events.length === 1) {
      this.selectedEvent.set(cell.events[0]);
    }
  }

  public openEventDetail(evt: KinCalendarEvent, event?: Event): void {
    event?.stopPropagation();
    this.selectedEvent.set(evt);
  }

  public openWorkoutDetail(log: WorkoutLog, author?: AthleteProfile): void {
    const raw = (author?.gender || author?.sexo || author?.genero || '').toLowerCase().trim();
    const gender: BodyMapGender =
      raw === 'female' || raw === 'f' || raw === 'mujer' || raw === 'femenino' ? 'female' : 'male';
    this.selectedWorkoutLog.set(log);
    this.selectedWorkoutGender.set(gender);
    this.showWorkoutDetail.set(true);
  }

  public openWorkoutEditModal(log: WorkoutLog): void {
    this.showWorkoutDetail.set(false);
    this.logToEdit.set(log);
    this.isWorkoutEditModalOpen.set(true);
  }

  public onWorkoutLogSaved(): void {
    this.isWorkoutEditModalOpen.set(false);
    this.logToEdit.set(null);
    this.refreshKin();
  }

  public openWorkoutStoryModal(log: WorkoutLog): void {
    this.shareWorkoutTargetLog.set(log);
    this.isShareWorkoutModalOpen.set(true);
  }

  public openWhatsAppGroup(): void {
    const url = this.kinSummary()?.whatsapp_group_url?.trim();
    if (!url || typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public openPublicProfile(identifier?: string | null): void {
    if (!identifier) return;
    this.router.navigate(['/avatar', identifier]);
  }

  public openBrandingModal(): void {
    const k = this.kinSummary();
    this.brandingHeaderUrl.set(k?.header_image_url || '');
    this.brandingMealsBannerUrl.set(k?.meals_banner_url || '');
    this.brandingRankingBgUrl.set(k?.ranking_bg_url || '');
    this.brandingAgendaBgUrl.set(k?.agenda_bg_url || '');
    this.brandingError.set(null);
    this.isBrandingModalOpen.set(true);
  }

  private loadPendingJoinRequestsBadge(kinId: string): void {
    this.kinService.listKinJoinRequests(kinId, 'PENDING').subscribe({
      next: (reqs) => this.kinJoinRequests.set(reqs || []),
      error: () => {},
    });
  }

  public openInvitesModal(initialTab: 'links' | 'requests' = 'links'): void {
    const kinId = this.kinSummary()?.id;
    if (!kinId) return;
    this.invitesModalTab.set(initialTab);
    this.invitesError.set(null);
    this.isInvitesModalOpen.set(true);
    this.refreshInvitesData(kinId);
  }

  public refreshInvitesData(kinId?: string): void {
    const id = kinId || this.kinSummary()?.id;
    if (!id) return;
    this.isLoadingInvites.set(true);
    this.kinService.listKinInvites(id).subscribe({
      next: (list) => {
        this.kinInvites.set(list || []);
        this.isLoadingInvites.set(false);
      },
      error: () => this.isLoadingInvites.set(false),
    });
    this.kinService.listKinJoinRequests(id, 'PENDING').subscribe({
      next: (reqs) => this.kinJoinRequests.set(reqs || []),
      error: () => {},
    });
  }

  public createNewInviteLink(): void {
    const kinId = this.kinSummary()?.id;
    const coachId = this.currentAthleteId();
    if (!kinId || !coachId || this.isCreatingInvite()) return;

    this.isCreatingInvite.set(true);
    this.invitesError.set(null);

    this.kinService
      .createKinInvite(kinId, {
        created_by: coachId,
        label: this.newInviteLabel().trim() || null,
        requires_approval: this.newInviteRequiresApproval(),
        max_uses: this.newInviteMaxUses(),
        expires_in_hours: this.newInviteExpiresHours(),
      })
      .subscribe({
        next: (created) => {
          this.kinInvites.update((list) => [created, ...list]);
          this.newInviteLabel.set('');
          this.isCreatingInvite.set(false);
        },
        error: (err) => {
          this.invitesError.set(err?.error?.detail || 'No se pudo generar el enlace.');
          this.isCreatingInvite.set(false);
        },
      });
  }

  public buildInviteUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://awakin.app';
    return `${origin}/join/${token}`;
  }

  public async copyInviteUrl(invite: any): Promise<void> {
    const url = this.buildInviteUrl(invite.token);
    try {
      await navigator.clipboard.writeText(url);
      this.copiedInviteId.set(invite.id);
      setTimeout(() => {
        if (this.copiedInviteId() === invite.id) this.copiedInviteId.set(null);
      }, 2000);
    } catch {
      this.invitesError.set('Copia manualmente: ' + url);
    }
  }

  public async shareInviteUrl(invite: any): Promise<void> {
    const url = this.buildInviteUrl(invite.token);
    const teamName = this.kinSummary()?.team_name || 'Mi Kin';
    const text = `Te invito a unirte a ${teamName} en AWAKIN. Solicita acceso aquí: ${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Invitación a ${teamName}`, text, url });
        return;
      } catch {
        // Usuario canceló
      }
    }
    this.copyInviteUrl(invite);
  }

  public async copyInviteCode(invite: any): Promise<void> {
    const code = String(invite.token || '');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copiedCodeId.set(invite.id);
      setTimeout(() => {
        if (this.copiedCodeId() === invite.id) this.copiedCodeId.set(null);
      }, 2000);
    } catch {
      this.invitesError.set('Copia manualmente el código: ' + code);
    }
  }

  public deleteInviteLink(invite: any): void {
    const coachId = this.currentAthleteId();
    if (!coachId) return;
    this.invitesError.set(null);
    this.kinService.deleteKinInvite(invite.id, coachId).subscribe({
      next: () => {
        this.kinInvites.update((list) => list.filter((i) => i.id !== invite.id));
      },
      error: (err) => {
        this.invitesError.set(err?.error?.detail || 'No se pudo eliminar el enlace.');
      },
    });
  }

  public toggleInviteActive(invite: any): void {
    const next = !invite.is_active;
    this.kinService.toggleKinInvite(invite.id, next).subscribe({
      next: (updated) => {
        this.kinInvites.update((list) => list.map((i) => (i.id === invite.id ? updated : i)));
      },
      error: () => {},
    });
  }

  public approveJoinRequest(req: any): void {
    const coachId = this.currentAthleteId();
    if (!coachId || this.reviewingRequestId()) return;
    this.reviewingRequestId.set(req.id);
    this.kinService.approveKinJoinRequest(req.id, coachId).subscribe({
      next: () => {
        this.kinJoinRequests.update((list) => list.filter((r) => r.id !== req.id));
        this.reviewingRequestId.set(null);
        this.refreshKin();
      },
      error: (err) => {
        this.invitesError.set(err?.error?.detail || 'No se pudo aprobar la solicitud.');
        this.reviewingRequestId.set(null);
      },
    });
  }

  public rejectJoinRequest(req: any): void {
    const coachId = this.currentAthleteId();
    if (!coachId || this.reviewingRequestId()) return;
    this.reviewingRequestId.set(req.id);
    this.kinService.rejectKinJoinRequest(req.id, coachId).subscribe({
      next: () => {
        this.kinJoinRequests.update((list) => list.filter((r) => r.id !== req.id));
        this.reviewingRequestId.set(null);
      },
      error: (err) => {
        this.invitesError.set(err?.error?.detail || 'No se pudo rechazar la solicitud.');
        this.reviewingRequestId.set(null);
      },
    });
  }

  public onBrandingFileSelected(slot: 'header' | 'meals' | 'ranking' | 'agenda', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.uploadingBrandingSlot.set(slot);
    this.brandingError.set(null);

    this.athleteService.uploadMedia(file, 'brand_kin', `kin_${slot}_${Date.now()}.jpg`).subscribe({
      next: (res) => {
        const url = res.public_url;
        if (slot === 'header') this.brandingHeaderUrl.set(url);
        else if (slot === 'meals') this.brandingMealsBannerUrl.set(url);
        else if (slot === 'ranking') this.brandingRankingBgUrl.set(url);
        else if (slot === 'agenda') this.brandingAgendaBgUrl.set(url);
        this.uploadingBrandingSlot.set(null);
        input.value = '';
      },
      error: (err) => {
        this.brandingError.set(err?.error?.detail || 'No se pudo subir la imagen.');
        this.uploadingBrandingSlot.set(null);
        input.value = '';
      },
    });
  }

  public saveKinBranding(): void {
    const kinId = this.kinSummary()?.id;
    if (!kinId || this.isSavingBranding()) return;
    this.isSavingBranding.set(true);
    this.brandingError.set(null);

    this.kinService
      .updateKinBranding(kinId, {
        header_image_url: this.brandingHeaderUrl().trim() || null,
        meals_banner_url: this.brandingMealsBannerUrl().trim() || null,
        ranking_bg_url: this.brandingRankingBgUrl().trim() || null,
        agenda_bg_url: this.brandingAgendaBgUrl().trim() || null,
      })
      .subscribe({
        next: () => {
          this.isSavingBranding.set(false);
          this.isBrandingModalOpen.set(false);
          this.refreshKin();
        },
        error: (err) => {
          this.brandingError.set(err?.error?.detail || 'Error al guardar la personalización visual.');
          this.isSavingBranding.set(false);
        },
      });
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

  public formatWeekDayHeader(date: Date): string {
    return date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
  }

  public formatSelectedDateLabel(): string {
    const [y, m, d] = this.selectedDateKey().split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  public translateMealType(type?: string | null): string {
    const map: Record<string, string> = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Snack',
    };
    const key = (type || '').toLowerCase().trim();
    return map[key] || type || 'Comida';
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

  public openLeaveKinModal(): void {
    this.leaveKinError.set(null);
    this.isLeaveKinModalOpen.set(true);
  }

  public confirmLeaveKin(): void {
    const a = this.athleteService.currentAthlete();
    const k = this.kinSummary();
    const scope = this.leaveKinScope();
    if (!a?.id || !k?.id || !scope) return;

    this.isLeavingKin.set(true);
    this.leaveKinError.set(null);
    this.kinService.leaveKin(k.id, a.id, scope).subscribe({
      next: (res) => {
        this.isLeavingKin.set(false);
        this.isLeaveKinModalOpen.set(false);
        if (a.email || a.id) {
          this.athleteService.loadAthleteProfile(a.email || a.id);
        }
        if (res.is_active === false) {
          this.router.navigateByUrl('/pending-access');
        }
      },
      error: (err) => {
        this.isLeavingKin.set(false);
        this.leaveKinError.set(err?.error?.detail || 'No se pudo salir del Kin.');
      },
    });
  }

  private toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toAthleteProfile(author?: KinAuthorSummary): AthleteProfile | undefined {
    if (!author) return undefined;
    return {
      id: author.id,
      email: '',
      username: author.username,
      first_name: author.first_name || undefined,
      last_name: author.last_name || undefined,
      profile_image_url: author.profile_image_url || undefined,
      gender: author.gender || undefined,
      sexo: author.sexo || undefined,
      genero: author.genero || undefined,
      current_level: 1,
      streak_days: 0,
      roles: ['athlete'],
    };
  }
}
