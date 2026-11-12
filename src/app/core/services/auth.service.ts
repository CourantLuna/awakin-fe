// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { SupabaseClient, Session } from '@supabase/supabase-js'; 
import { supabaseClient } from './supabase.service'; 
import { AthleteService } from './athlete.service';
import { environment } from '../../../environments/environment';

// Interfaz para el control del Avatar en el ecosistema
export interface AthleteSession {
  token: string;
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

  #sessionState = signal<AthleteSession | null>(null);
  public currentSession = computed(() => this.#sessionState());
  public isAuthenticated = computed(() => !!this.#sessionState());

  private isLoggingOut = false;

  constructor() {
    this.hydrateProtocol();
    
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
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.token && parsed.avatar) {
          this.#sessionState.set(parsed);
          return;
        }
      } catch {
        // Formato corrupto
      }
    }
    this.#sessionState.set(null);
  }

  /**
   * Login tradicional contra nuestra API Gateway
   */
  public signInWithEmail(email: string, password: string): Observable<AthleteSession> {
    return this.http.post<AthleteSession>(`${this.AUTH_URL}/login`, { email, password }).pipe(
      tap((session) => this.initializeProtocol(session)),
      catchError((error) => throwError(() => new Error(error.error?.message || 'Error de autenticación')))
    );
  }

  /**
   * Login directo con SDK de Supabase para Google
   */
  public async loginWithGoogle(): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`
      }
    });
    if (error) throw error;
  }

  /**
   * Sincroniza el usuario de Supabase con nuestro modelo interno
   */
  private syncSessionFromSupabase(session: Session): void {
    if (this.isLoggingOut) return;
    console.log('⚡ Sesión de Supabase detectada:', session);
    const sessionData: AthleteSession = {
      token: session.access_token,
      avatar: {
        id: session.user.id,
        email: session.user.email || '',
        fullName: session.user.user_metadata['full_name'] || 'Atleta',
        photoUrl: session.user.user_metadata['picture'] || 'https://i.pravatar.cc/150', // URL de Google o fallback
        level: 1,
        streak: 0
      }
    };
    this.initializeProtocol(sessionData);
    if (this.router.url.includes('/login') || this.router.url === '/') {
      this.router.navigate(['/home']);
    }
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

    // 5. Redirigir a login
    if (!this.router.url.includes('/login')) {
      this.router.navigate(['/login']);
    }
  }
}
