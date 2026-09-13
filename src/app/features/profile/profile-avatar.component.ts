import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { AuthService } from '../../core/services/auth.service';
import { AthleteService, AthleteProfile, NutritionMealRecord, ProgressMetricRecord } from '../../core/services/athlete.service';

@Component({
  selector: 'app-profile-avatar.component',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeNGModule],
  templateUrl: './profile-avatar.component.html',
  styleUrl: './profile-avatar.component.css',
})
export class ProfileAvatarComponent implements OnInit {
  public authService = inject(AuthService);
  public athleteService = inject(AthleteService);

  // Estado del perfil del atleta activo (conectado a la BD Supabase)
  athlete = this.athleteService.currentAthlete;
  athletesList = this.athleteService.availableAthletes;
  records = this.athleteService.currentRecords;
  isLoading = this.athleteService.isLoading;

  // Control de tabs
  activeTab = signal<'grid' | 'stats'>('grid');

  // Control de modales y menús
  isEditModalOpen = signal<boolean>(false);
  isSwitcherOpen = signal<boolean>(false);
  isMenuOpen = signal<boolean>(false);
  selectedMeal = signal<NutritionMealRecord | null>(null);
  selectedProgress = signal<ProgressMetricRecord | null>(null);

  // Formulario de edición reactivo
  editFirstName = signal<string>('');
  editLastName = signal<string>('');
  editUsername = signal<string>('');
  editBio = signal<string>('');
  editPhotoUrl = signal<string>('');
  isSaving = signal<boolean>(false);
  saveSuccess = signal<boolean>(false);

  ngOnInit() {
    console.log('ProfileAvatarComponent inicializado.');
    // Si no hay atleta activo aún, asegurar que se cargue
    const current = this.athlete();
    if (!current) {
      this.athleteService.loadInitialAthletes();
    }
  }

  // Cambiar entre galería de fotos y métricas
  setTab(tab: 'grid' | 'stats') {
    this.activeTab.set(tab);
  }

  // Abrir selector de atleta
  toggleSwitcher() {
    this.isSwitcherOpen.update((v) => !v);
  }

  // Seleccionar un atleta diferente para previsualizar y operar como él
  onSelectAthlete(ath: AthleteProfile) {
    this.athleteService.setActiveAthlete(ath);
    this.authService.devLoginAthlete(
      ath.id,
      ath.email || `${ath.username}@awakin.com`,
      `${ath.first_name || ''} ${ath.last_name || ''}`.trim() || ath.username,
      ath.profile_image_url || undefined
    );
    this.isSwitcherOpen.set(false);
  }

  // Abrir modal de edición con los datos actuales
  openEditProfile() {
    const current = this.athlete();
    if (current) {
      this.editFirstName.set(current.first_name || '');
      this.editLastName.set(current.last_name || '');
      this.editUsername.set(current.username || '');
      this.editBio.set(current.bio_description || '');
      this.editPhotoUrl.set(current.profile_image_url || '');
    }
    this.saveSuccess.set(false);
    this.isEditModalOpen.set(true);
  }

  // Guardar cambios en Supabase mediante PATCH
  saveProfile() {
    const current = this.athlete();
    if (!current) return;

    this.isSaving.set(true);
    this.saveSuccess.set(false);

    const updates = {
      first_name: this.editFirstName(),
      last_name: this.editLastName(),
      username: this.editUsername(),
      bio_description: this.editBio(),
      profile_image_url: this.editPhotoUrl()
    };

    this.athleteService.updateProfile(current.id, updates).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => {
          this.isEditModalOpen.set(false);
          this.saveSuccess.set(false);
        }, 800);
      },
      error: (err) => {
        console.error('Error al actualizar el perfil:', err);
        this.isSaving.set(false);
      }
    });
  }

  // Compartir perfil (copiar enlace)
  shareProfile() {
    const ath = this.athlete();
    const handle = ath?.username || 'atleta';
    const url = `${window.location.origin}/avatar?user=${handle}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`¡Enlace del perfil copiado al portapapeles!\n${url}`);
    }).catch(() => {
      alert(`Perfil de @${handle}`);
    });
  }

  // Cerrar sesión
  logout() {
    this.isMenuOpen.set(false);
    this.authService.logout();
  }

  // Formatear nombres de roles de la base de datos
  formatRole(role: string): string {
    switch (role) {
      case 'ATHLETE':
        return 'Atleta';
      case 'INSTRUCTOR':
        return 'Coach Fitness';
      case 'NUTRITIONIST':
        return 'Coach Nutrición';
      case 'PHYSIOTHERAPIST':
        return 'Fisioterapia';
      case 'ADMINISTRATOR':
        return 'Admin';
      default:
        return role;
    }
  }

  // Color de badge por rol
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'INSTRUCTOR':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'NUTRITIONIST':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ADMINISTRATOR':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'PHYSIOTHERAPIST':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  }

  // Obtener iniciales para avatar de respaldo
  getInitials(): string {
    const ath = this.athlete();
    if (!ath) return 'AW';
    if (ath.first_name) {
      return ath.first_name.slice(0, 2).toUpperCase();
    }
    return (ath.username || 'A').slice(0, 2).toUpperCase();
  }
}

