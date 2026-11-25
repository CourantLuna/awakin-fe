import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { supabaseClient } from '../../../core/services/supabase.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = signal<string>('');
  password = signal<string>('');
  showPassword = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');
  currentYear = new Date().getFullYear();

  public readonly moduleIcons = [
    { src: 'icons/intake-active.png', alt: 'Intake' },
    { src: 'icons/workout-active.png', alt: 'Workout' },
    { src: 'icons/home-active.png', alt: 'Awakin' },
    { src: 'icons/kin-active.png', alt: 'Kin' },
    { src: 'icons/avatar-active.png', alt: 'Avatar' },
  ];

  ngOnInit(): void {
    // Si ya existe sesión activa, redirigir de inmediato a la última ruta activa
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.authService.getLastRoute()]);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * Ejecuta el protocolo de autenticación por correo y clave
   */
  async onSecureSubmit(): Promise<void> {
    const userEmail = this.email().trim();
    const userPass = this.password().trim();

    if (!userEmail || !userPass) {
      this.errorMessage.set('Por favor ingresa tu correo y contraseña.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await firstValueFrom(this.authService.signInWithEmail(userEmail, userPass));
      localStorage.setItem('awakin_selected_role', 'ATHLETE');
      this.router.navigate([this.authService.getLastRoute()]);
    } catch (backendError: any) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userPass,
        });

        if (error) throw error;

        if (data?.session) {
          localStorage.setItem('awakin_selected_role', 'ATHLETE');
          this.router.navigate([this.authService.getLastRoute()]);
          return;
        }
      } catch (sbError: any) {
        console.warn('Fallo en autenticación Supabase:', sbError);
      }

      this.errorMessage.set(
        backendError.message || 'Credenciales inválidas. Verifica tu correo y contraseña.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Dispara el flujo OAuth con Google
   */
  initiateGoogleHandshake(): void {
    this.errorMessage.set('');
    localStorage.setItem('awakin_selected_role', 'ATHLETE');
    this.authService.loginWithGoogle();
  }
}
