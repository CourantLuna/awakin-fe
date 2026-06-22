import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs'; // Protocolo de conversión RxJS a Promesa

// UI Kit: Componentes Premium de PrimeNG
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    MessageModule
  ],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Arquitectura del Estado con Angular Signals
  email = signal<string>('');
  password = signal<string>('');
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');

  /**
   * Ejecuta el protocolo de autenticación tradicional por correo
   * Procesando la respuesta reactiva de nuestra API Gateway
   */
  async onSecureSubmit() {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Vectores incompletos. Se requiere ID y Clave de acceso.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      // Forzamos la resolución del flujo HTTP antes de dar el pase de navegación
      await firstValueFrom(this.authService.signInWithEmail(this.email(), this.password()));
      
      // Si la API responde con éxito, el interceptor o el tap ya habrán guardado la sesión
      this.router.navigate(['/home']);
    } catch (error: any) {
      // Captura el error arrojado por el bloque catchError de nuestro servicio central
      this.errorMessage.set(error.message || 'Fallo de autenticación en la matriz.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Dispara el flujo OAuth Prestige con Google Workspace
   * Redirige el hilo de ejecución directamente al origen de autenticación externa
   */
  initiateGoogleHandshake(): void {
    this.errorMessage.set('');
    // Al ser un redireccionamiento nativo de ventana, no requiere await ni verificación local
    this.authService.loginWithGoogle();
  }
}