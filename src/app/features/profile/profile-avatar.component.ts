import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile-avatar.component',
  imports: [],
  templateUrl: './profile-avatar.component.html',
  styleUrl: './profile-avatar.component.css',
})
export class ProfileAvatarComponent implements OnInit {
// Inyectamos el servicio para tener acceso a la señal reactiva
  private authService = inject(AuthService);

  ngOnInit() {
    console.log('ProfileAvatarComponent inicializado. Sesión actual:', this.authService.currentSession());
    //  podríamos agregar lógica adicional si es necesario, pero la señal ya se actualiza automáticamente
  }
  
  // Exponemos la sesión al HTML de forma reactiva
  user = this.authService.currentSession;
}
