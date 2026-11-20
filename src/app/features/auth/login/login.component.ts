import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { supabaseClient } from '../../../core/services/supabase.service';
import { firstValueFrom } from 'rxjs';

export type UserRole = 'ATHLETE' | 'INSTRUCTOR';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Arquitectura del Estado con Angular Signals
  selectedRole = signal<UserRole>('ATHLETE');
  email = signal<string>('');
  password = signal<string>('');
  showPassword = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');
  currentYear = new Date().getFullYear();

  // Configuración dinámica contextual según el rol seleccionado
  roleConfig = computed(() => {
    if (this.selectedRole() === 'INSTRUCTOR') {
      return {
        title: 'Acceso Instructor',
        badge: 'Coach / Staff',
        subtitle: 'Gestiona atletas, asigna protocolos nutricionales y supervisa progresos.',
        emailPlaceholder: 'instructor@awakin.com',
        icon: 'pi pi-shield'
      };
    }
    return {
      title: 'Acceso Atleta',
      badge: 'Atleta Activo',
      subtitle: 'Registra tus comidas diarias, planifica listas y da seguimiento a tu entrenamiento.',
      emailPlaceholder: 'atleta@awakin.com',
      icon: 'pi pi-bolt'
    };
  });

  ngOnInit(): void {
    // Si ya existe sesión activa, redirigir de inmediato a la última ruta activa
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.authService.getLastRoute()]);
    }
  }

  setRole(role: UserRole): void {
    this.selectedRole.set(role);
    this.errorMessage.set('');
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
      this.errorMessage.set('Por favor ingresa tu correo y clave de acceso.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      // 1. Intentar inicio de sesión mediante la API Gateway del backend
      await firstValueFrom(this.authService.signInWithEmail(userEmail, userPass));
      localStorage.setItem('awakin_selected_role', this.selectedRole());
      this.router.navigate([this.authService.getLastRoute()]);
    } catch (backendError: any) {
      // 2. Si el backend falla o no reconoce las credenciales, intentar Supabase Auth directo
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: userEmail,
          password: userPass
        });

        if (error) throw error;

        if (data?.session) {
          localStorage.setItem('awakin_selected_role', this.selectedRole());
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
    localStorage.setItem('awakin_selected_role', this.selectedRole());
    this.authService.loginWithGoogle();
  }
}
