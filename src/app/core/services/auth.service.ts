// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, firstValueFrom } from 'rxjs';
import { SupabaseClient, Session } from '@supabase/supabase-js'; 
import { supabaseClient } from './supabase.service'; 
import { AthleteService } from './athlete.service';
import { environment } from '../../../environments/environment';

export const LAST_ROUTE_STORAGE_KEY = 'awakin_last_route';
export const PENDING_INVITE_TOKEN_KEY = 'awakin_pending_invite_token';
export const VALID_APP_MODULES = ['intake', 'workout', 'home', 'kin', 'avatar'] as const;

export interface PendingJoinRequestInfo {
  id: string;
  kin_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  created_at?: string;
  kin?: {
    id?: string;
    team_name?: string;
    team_logo_url?: string | null;
    primary_color?: string;
    head_coach_name?: string | null;
  };
}

export interface AccessStatusResponse {
  exists: boolean;
  is_active: boolean;
  athlete_id?: string | null;
  kin_id?: string | null;
  pending_request?: PendingJoinRequestInfo | null;
}

// Interfaz para el control del Avatar en el ecosistema
export interface AthleteSession {
  token: string;
  isActive?: boolean;
  avatar: {
    id: string;
    email: string;
    fullName: string;
    photoUrl: string;
    level: number;
    streak: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private athleteService = inject(AthleteService);
  private supabase: SupabaseClient = supabaseClient; 
  private readonly AUTH_URL = `${environment.apiUrl}/auth`;
  private readonly KIN_URL = `${environment.apiUrl}/kin`;

  #sessionState = signal<AthleteSession | null>(null);
  #isActiveAccount = signal<boolean>(false);
  #pendingJoinRequest = signal<PendingJoinRequestInfo | null>(null);

  public currentSession = computed(() => this.#sessionState());
  public hasRawSession = computed(() => !!this.#sessionState());
  public isActiveAccount = computed(() => this.#isActiveAccount());
  public pendingJoinRequest = computed(() => this.#pendingJoinRequest());
  // Solo autenticado plenamente si tiene sesión Y athletes.is_active === true
  public isAuthenticated = computed(() => !!this.#sessionState() && this.#isActiveAccount());

  private isLoggingOut = false;
  private bootstrappedAthleteId: string | null = null;

  constructor() {
    this.hydrateProtocol();
    if (this.#sessionState()) {
      this.verifyCurrentAccountAccess();
    }
    
    // Escuchar cambios de sesión de Supabase
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log(`⚡ Supabase auth event: [${event}], hasSession: ${!!session}`);
      if (this.isLoggingOut) {
        return;
      }
      if (event === 'SIGNED_OUT' || !session) {
        if (this.#sessionState()) {
          this.clearProtocolState();
        }
      } else if (session) {
        this.syncSessionFromSupabase(session);
      }
    });
  }

  /**
   * Recupera la sesión del LocalStorage al iniciar la app
   */
  private hydrateProtocol(): void {
    const savedSession = localStorage.getItem('awakin_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as AthleteSession;
        if (parsed && parsed.token && parsed.avatar) {
          this.#sessionState.set(parsed);
          this.#isActiveAccount.set(parsed.isActive === true);
          return;
        }
      } catch {
        // Formato corrupto
      }
    }
    this.#sessionState.set(null);
    this.#isActiveAccount.set(false);
  }

  /**
   * Login tradicional contra nuestra API Gateway
   */
  public signInWithEmail(email: string, password: string): Observable<AthleteSession> {
    return this.http.post<AthleteSession>(`${this.AUTH_URL}/login`, { email, password }).pipe(
      tap((session) => {
        this.initializeProtocol({ ...session, isActive: false });
        this.verifyCurrentAccountAccess(true);
      }),
      catchError((error) => throwError(() => new Error(error.error?.message || 'Error de autenticación')))
    );
  }

  /**
   * Login directo con SDK de Supabase para Google (opcionalmente guardando un token de invitación)
   */
  public async loginWithGoogle(inviteToken?: string): Promise<void> {
    if (inviteToken && typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_INVITE_TOKEN_KEY, inviteToken.trim());
    }
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`
      }
    });
    if (error) throw error;
  }

  /**
   * Sincroniza el usuario de Supabase con nuestro modelo interno y verifica athletes.is_active
   */
  private async syncSessionFromSupabase(session: Session): Promise<void> {
    if (this.isLoggingOut) return;
    const prevActive = this.#sessionState()?.avatar?.id === session.user.id ? this.#isActiveAccount() : false;
    const sessionData: AthleteSession = {
      token: session.access_token,
      isActive: prevActive,
      avatar: {
        id: session.user.id,
        email: session.user.email || '',
        fullName: session.user.user_metadata['full_name'] || 'Atleta',
        photoUrl: session.user.user_metadata['picture'] || 'https://i.pravatar.cc/150',
        level: 1,
        streak: 0
      }
    };
    this.initializeProtocol(sessionData);

    // 1. Si hay un token de invitación pendiente en localStorage, reclamarlo automáticamente
    const pendingToken =
      typeof localStorage !== 'undefined' ? (localStorage.getItem(PENDING_INVITE_TOKEN_KEY) || '').trim() : '';
    if (pendingToken) {
      try {
        await this.claimInviteToken(pendingToken);
      } catch (e) {
        console.warn('No se pudo reclamar invitación automática:', e);
      } finally {
        localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
      }
    }

    // 2. Verificar estado real de is_active en Supabase/Backend
    await this.verifyCurrentAccountAccess(true);
  }

  /**
   * Reclama un token de invitación del Kin para el usuario autenticado actual
   */
  public async claimInviteToken(token: string): Promise<{ status: string; is_active: boolean; kin?: any }> {
    const sess = this.#sessionState();
    if (!sess?.avatar?.id) {
      throw new Error('Debes iniciar sesión primero.');
    }
    const cleanToken = this.extractInviteToken(token);
    const res = await firstValueFrom(
      this.http.post<{ status: string; is_active: boolean; kin?: any }>(
        `${this.KIN_URL}/invites/${encodeURIComponent(cleanToken)}/claim`,
        {
          athlete_id: sess.avatar.id,
          email: sess.avatar.email,
          full_name: sess.avatar.fullName,
          photo_url: sess.avatar.photoUrl,
        }
      )
    );
    await this.verifyCurrentAccountAccess(true);
    return res;
  }

  public extractInviteToken(raw: string): string {
    const trimmed = (raw || '').trim();
    const match = trimmed.match(/\/join\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : trimmed;
  }

  /**
   * Consulta en tiempo real si athletes.is_active === true; si es false, bloquea y redirige a /pending-access
   */
  public async verifyCurrentAccountAccess(redirectOnResult: boolean = false): Promise<AccessStatusResponse> {
    const sess = this.#sessionState();
    if (!sess?.avatar?.id && !sess?.avatar?.email) {
      this.#isActiveAccount.set(false);
      return { exists: false, is_active: false, pending_request: null };
    }

    let statusRes: AccessStatusResponse = { exists: false, is_active: false, pending_request: null };

    try {
      const params: Record<string, string> = {};
      if (sess.avatar.id) params['athlete_id'] = sess.avatar.id;
      if (sess.avatar.email) params['email'] = sess.avatar.email;
      statusRes = await firstValueFrom(
        this.http.get<AccessStatusResponse>(`${this.KIN_URL}/access-status`, { params })
      );
    } catch {
      // Fallback directo a Supabase si el backend no responde
      try {
        const { data } = await this.supabase
          .from('athletes')
          .select('id, is_active, kin_id, roles')
          .or(`id.eq.${sess.avatar.id},email.eq.${sess.avatar.email}`)
          .limit(1)
          .maybeSingle();
        if (data) {
          const roles = Array.isArray(data.roles)
            ? data.roles.map((r: any) => String(r).toUpperCase().trim())
            : [];
          const isInstructor = roles.some((r: string) =>
            ['INSTRUCTOR', 'ADMINISTRATOR', 'ADMIN', 'COACH', 'HEAD_COACH'].includes(r)
          );
          statusRes = {
            exists: true,
            is_active: data.is_active === true || isInstructor,
            athlete_id: data.id,
            kin_id: data.kin_id,
            pending_request: null,
          };
        }
      } catch {
        statusRes = { exists: false, is_active: false, pending_request: null };
      }
    }

    const isActive = statusRes.is_active === true;
    this.#isActiveAccount.set(isActive);
    this.#pendingJoinRequest.set(statusRes.pending_request || null);

    // Persistir bandera isActive actualizada en sesión local
    const updatedSession: AthleteSession = { ...sess, isActive };
    localStorage.setItem('awakin_session', JSON.stringify(updatedSession));
    this.#sessionState.set(updatedSession);

    // Precargar inmediatamente perfil completo del atleta, su Kin (colores, logos, banners) y protocolo nutricional
    if (isActive) {
      const resolvedAthleteId = statusRes.athlete_id || sess.avatar.id || sess.avatar.email;
      const currentAth = this.athleteService.currentAthlete();
      const needsLoad =
        !!resolvedAthleteId &&
        (this.bootstrappedAthleteId !== resolvedAthleteId || !currentAth || currentAth.id !== resolvedAthleteId);
      if (needsLoad) {
        this.bootstrappedAthleteId = resolvedAthleteId;
        this.athleteService.loadAthleteProfile(resolvedAthleteId);
      }
    }

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : this.router.url;
    if (!isActive) {
      if (!currentPath.startsWith('/pending-access') && !currentPath.startsWith('/join/')) {
        this.router.navigate(['/pending-access']);
      }
    } else if (
      redirectOnResult &&
      (currentPath.includes('/login') ||
        currentPath.includes('/callback') ||
        currentPath.startsWith('/pending-access') ||
        currentPath.startsWith('/join/') ||
        currentPath === '/' ||
        currentPath === '')
    ) {
      this.router.navigate([this.getLastRoute()]);
    }

    return statusRes;
  }

  /**
   * Persiste el módulo activo actual para restaurarlo al reabrir la PWA
   */
  public saveLastRoute(url: string): void {
    if (typeof localStorage === 'undefined' || !url) return;
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segment = cleanUrl.split('/').filter(Boolean)[0] || '';
    if ((VALID_APP_MODULES as readonly string[]).includes(segment)) {
      try {
        localStorage.setItem(LAST_ROUTE_STORAGE_KEY, `/${segment}`);
      } catch {
        // Ignorar errores de almacenamiento
      }
    }
  }

  /**
   * Recupera la última ruta válida visitada (por defecto /home)
   */
  public getLastRoute(): string {
    if (typeof localStorage === 'undefined') return '/home';
    try {
      const saved = localStorage.getItem(LAST_ROUTE_STORAGE_KEY) || '';
      const clean = saved.split('?')[0].split('#')[0];
      const segment = clean.split('/').filter(Boolean)[0] || '';
      if ((VALID_APP_MODULES as readonly string[]).includes(segment)) {
        return `/${segment}`;
      }
    } catch {
      // Ignorar errores de lectura
    }
    return '/home';
  }

  /**
   * Logout y limpieza completa de estado (Backend, Supabase y LocalStorage)
   */
  public async logout(): Promise<void> {
    this.isLoggingOut = true;
    try {
      // 1. Notificar al backend si está disponible (no bloqueante)
      this.http.post(`${this.AUTH_URL}/logout`, {}).subscribe({
        error: () => {}
      });
    } catch {}

    try {
      // 2. Cerrar sesión en el SDK de Supabase (elimina token interno de GoTrue en LocalStorage)
      await this.supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Advertencia en signOut de Supabase:', e);
    } finally {
      // 3. Limpiar estado de protocolo, perfil y caché local
      this.clearProtocolState();
      this.isLoggingOut = false;
    }
  }

  private initializeProtocol(session: AthleteSession): void {
    localStorage.setItem('awakin_session', JSON.stringify(session));
    this.#sessionState.set(session);
  }

  /**
   * Conecta directamente un atleta como usuario autenticado de la app
   */
  public devLoginAthlete(id: string, email: string, fullName: string, photoUrl?: string): void {
    const sessionData: AthleteSession = {
      token: 'dev-token-' + id,
      avatar: {
        id: id,
        email: email,
        fullName: fullName || 'Atleta AWAKIN',
        photoUrl: photoUrl || 'https://i.pravatar.cc/150',
        level: 1,
        streak: 0
      }
    };
    this.initializeProtocol(sessionData);
  }

  private clearProtocolState(): void {
    // 1. Eliminar datos de sesión propios
    localStorage.removeItem('awakin_session');
    localStorage.removeItem('awakin_active_athlete_id');
    localStorage.removeItem('awakin_athlete_profile');
    localStorage.removeItem('awakin_selected_role');

    // 2. Limpiar claves residuales de Supabase Auth en LocalStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}

    // 3. Limpiar estado reactivo del atleta en memoria
    try {
      this.athleteService.clearActiveAthlete();
    } catch (e) {}

    // 4. Limpiar estado de sesión
    this.#sessionState.set(null);
    this.#isActiveAccount.set(false);
    this.#pendingJoinRequest.set(null);
    this.bootstrappedAthleteId = null;

    // 5. Redirigir a login
    if (!this.router.url.includes('/login')) {
      this.router.navigate(['/login']);
    }
  }
}
