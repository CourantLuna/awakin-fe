// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'; 
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
  private supabase: SupabaseClient; 
  private readonly AUTH_URL = `${environment.apiUrl}/auth`;

  #sessionState = signal<AthleteSession | null>(null);
  public currentSession = computed(() => this.#sessionState());
  public isAuthenticated = computed(() => !!this.#sessionState());

  constructor() {
    this.supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY);
    this.hydrateProtocol();
    
    // Escuchar cambios de sesión de Supabase
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
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
        this.#sessionState.set(JSON.parse(savedSession));
      } catch {
        this.clearProtocolState();
      }
    }
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
  }

  /**
   * Logout y limpieza de estado
   */
  public logout(): void {
    this.http.post(`${this.AUTH_URL}/logout`, {}).subscribe({
      next: () => this.clearProtocolState(),
      error: () => this.clearProtocolState()
    });
  }

  private initializeProtocol(session: AthleteSession): void {
    localStorage.setItem('awakin_session', JSON.stringify(session));
    this.#sessionState.set(session);
  }

  private clearProtocolState(): void {
    localStorage.removeItem('awakin_session');
    this.#sessionState.set(null);
    this.router.navigate(['/login']);
  }
}