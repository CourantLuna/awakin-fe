import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { AuthService } from '../../core/services/auth.service';
import {
  AthleteService,
  AthleteProfile,
  AthleteFeedPost,
  KinInfo,
  NutritionMealRecord
} from '../../core/services/athlete.service';

export type ProfileFeedTab = 'posts' | 'meals' | 'workouts';

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
  posts = this.athleteService.currentPosts;
  isLoading = this.athleteService.isLoading;

  // Control de las pestañas del feed (posts, comidas, workouts)
  activeTab = signal<ProfileFeedTab>('posts');

  // Control de modales y menús
  isEditModalOpen = signal<boolean>(false);
  isSwitcherOpen = signal<boolean>(false);
  isMenuOpen = signal<boolean>(false);
  selectedMeal = signal<NutritionMealRecord | null>(null);
  selectedPost = signal<AthleteFeedPost | null>(null);

  // Modal y controles de Avatar (Zoom, Cut y subida a bucket 'avatars')
  isAvatarModalOpen = signal<boolean>(false);
  rawAvatarImage = signal<string | null>(null);
  avatarZoom = signal<number>(1);
  avatarPanX = signal<number>(0);
  avatarPanY = signal<number>(0);
  isUploadingAvatar = signal<boolean>(false);
  avatarUploadSuccess = signal<boolean>(false);
  public isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  // Modal y controles de Nueva Publicación (Subida a bucket 'feed_posts')
  isNewPostModalOpen = signal<boolean>(false);
  selectedPostFile = signal<File | null>(null);
  postFilePreview = signal<string | null>(null);
  newPostMediaUrl = signal<string>('');
  newPostCaption = signal<string>('');
  newPostModule = signal<'GENERAL' | 'INTAKE' | 'WORKOUT'>('GENERAL');
  isCreatingPost = signal<boolean>(false);
  createPostSuccess = signal<boolean>(false);

  // Formulario de edición reactivo
  editFirstName = signal<string>('');
  editLastName = signal<string>('');
  editUsername = signal<string>('');
  editBio = signal<string>('');
  isSaving = signal<boolean>(false);
  saveSuccess = signal<boolean>(false);
  saveError = signal<string | null>(null);

  // Verificación reactiva de username tipo Instagram (disponibilidad en tiempo real)
  usernameCheckStatus = signal<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  usernameFeedbackMessage = signal<string>('');
  private usernameCheckTimer: any = null;

  // Comidas con foto
  mealPhotos = computed(() => {
    const list = this.records()?.meals || [];
    return list.filter((m) => !!m.foto_url);
  });

  ngOnInit() {
    console.log('ProfileAvatarComponent inicializado.');
    // Si no hay atleta activo aún, asegurar que se cargue
    const current = this.athlete();
    if (!current) {
      this.athleteService.loadInitialAthletes();
    }
  }

  // Cambiar pestaña del feed
  setTab(tab: ProfileFeedTab) {
    this.activeTab.set(tab);
  }

  // ==========================================
  // GESTIÓN DE AVATAR (ZOOM, CUT & BUCKET 'avatars')
  // ==========================================

  // Manejar selección de archivo para Avatar
  onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.rawAvatarImage.set(e.target?.result as string);
      this.avatarZoom.set(1);
      this.avatarPanX.set(0);
      this.avatarPanY.set(0);
      this.avatarUploadSuccess.set(false);
      this.isAvatarModalOpen.set(true);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  setAvatarZoom(val: number | string) {
    const clamped = Math.max(1, Math.min(3, Number(val)));
    this.avatarZoom.set(clamped);
  }

  zoomInAvatar() {
    this.setAvatarZoom(this.avatarZoom() + 0.2);
  }

  zoomOutAvatar() {
    this.setAvatarZoom(this.avatarZoom() - 0.2);
  }

  resetAvatarCrop() {
    this.avatarZoom.set(1);
    this.avatarPanX.set(0);
    this.avatarPanY.set(0);
  }

  startPan(e: MouseEvent | TouchEvent) {
    this.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.initialPanX = this.avatarPanX();
    this.initialPanY = this.avatarPanY();
  }

  onPan(e: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - this.dragStartX;
    const dy = clientY - this.dragStartY;
    this.avatarPanX.set(this.initialPanX + dx);
    this.avatarPanY.set(this.initialPanY + dy);
  }

  endPan() {
    this.isDragging = false;
  }

  // Cortar imagen circular con HTML5 canvas y subir a Supabase 'avatars'
  applyAndSaveAvatar() {
    const current = this.athlete();
    const imgSrc = this.rawAvatarImage();
    if (!current || !imgSrc) return;

    this.isUploadingAvatar.set(true);
    this.avatarUploadSuccess.set(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.isUploadingAvatar.set(false);
        return;
      }

      // Tamaño visible en viewport CSS del modal: 260px
      const viewportSize = 260;
      const scaleToCanvas = size / viewportSize;

      const aspect = img.width / img.height;
      let drawW: number;
      let drawH: number;
      if (aspect > 1) {
        drawH = viewportSize;
        drawW = viewportSize * aspect;
      } else {
        drawW = viewportSize;
        drawH = viewportSize / aspect;
      }

      const zoom = this.avatarZoom();
      const panX = this.avatarPanX();
      const panY = this.avatarPanY();

      // Dibujar área recortada
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.translate(panX * scaleToCanvas, panY * scaleToCanvas);
      ctx.scale(zoom, zoom);
      ctx.drawImage(
        img,
        (-drawW * scaleToCanvas) / 2,
        (-drawH * scaleToCanvas) / 2,
        drawW * scaleToCanvas,
        drawH * scaleToCanvas
      );
      ctx.restore();

      canvas.toBlob((blob) => {
        if (!blob) {
          this.isUploadingAvatar.set(false);
          return;
        }

        const filename = `avatar_${current.id}_${Date.now()}.jpg`;
        this.athleteService.uploadMedia(blob, 'avatars', filename).subscribe({
          next: (uploadRes) => {
            this.athleteService
              .updateProfile(current.id, { profile_image_url: uploadRes.public_url })
              .subscribe({
                next: () => {
                  this.isUploadingAvatar.set(false);
                  this.avatarUploadSuccess.set(true);
                  setTimeout(() => {
                    this.isAvatarModalOpen.set(false);
                    this.avatarUploadSuccess.set(false);
                    this.rawAvatarImage.set(null);
                  }, 600);
                },
                error: (err) => {
                  console.error('Error guardando URL en BD:', err);
                  this.isUploadingAvatar.set(false);
                }
              });
          },
          error: (err) => {
            console.error('Error subiendo imagen al bucket avatars:', err);
            this.isUploadingAvatar.set(false);
          }
        });
      }, 'image/jpeg', 0.92);
    };
    img.src = imgSrc;
  }

  // ==========================================
  // GESTIÓN DE NUEVO POST (BUCKET 'feed_posts')
  // ==========================================

  // Abrir modal de creación de post
  openCreatePost() {
    this.selectedPostFile.set(null);
    this.postFilePreview.set(null);
    this.newPostMediaUrl.set('');
    this.newPostCaption.set('');
    this.newPostModule.set('GENERAL');
    this.createPostSuccess.set(false);
    this.isNewPostModalOpen.set(true);
  }

  onPostFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.selectedPostFile.set(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.postFilePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearPostFile() {
    this.selectedPostFile.set(null);
    this.postFilePreview.set(null);
  }

  // Publicar post en athlete_feed_posts (sube archivo a bucket si aplica)
  submitCreatePost() {
    const current = this.athlete();
    if (!current) return;

    const file = this.selectedPostFile();
    const manualUrl = this.newPostMediaUrl().trim();

    if (!file && !manualUrl) {
      alert('Por favor selecciona una imagen para subir.');
      return;
    }

    this.isCreatingPost.set(true);
    this.createPostSuccess.set(false);

    if (file) {
      // Subir archivo a Supabase Storage bucket 'feed_posts'
      this.athleteService.uploadMedia(file, 'feed_posts', file.name).subscribe({
        next: (uploadRes) => {
          this.athleteService
            .createPost(current.id, {
              media_url: uploadRes.public_url,
              caption: this.newPostCaption().trim() || undefined,
              module_source: this.newPostModule()
            })
            .subscribe({
              next: () => {
                this.isCreatingPost.set(false);
                this.createPostSuccess.set(true);
                setTimeout(() => {
                  this.isNewPostModalOpen.set(false);
                  this.createPostSuccess.set(false);
                  this.clearPostFile();
                  this.activeTab.set('posts');
                }, 800);
              },
              error: (err) => {
                console.error('Error insertando en athlete_feed_posts:', err);
                this.isCreatingPost.set(false);
              }
            });
        },
        error: (err) => {
          console.error('Error subiendo imagen al bucket feed_posts:', err);
          this.isCreatingPost.set(false);
        }
      });
    } else {
      // Usar URL ingresada manualmente
      this.athleteService
        .createPost(current.id, {
          media_url: manualUrl,
          caption: this.newPostCaption().trim() || undefined,
          module_source: this.newPostModule()
        })
        .subscribe({
          next: () => {
            this.isCreatingPost.set(false);
            this.createPostSuccess.set(true);
            setTimeout(() => {
              this.isNewPostModalOpen.set(false);
              this.createPostSuccess.set(false);
              this.activeTab.set('posts');
            }, 800);
          },
          error: (err) => {
            console.error('Error creando post con URL:', err);
            this.isCreatingPost.set(false);
          }
        });
    }
  }


  // Tribu / Kin helpers
  getKin(): KinInfo | null {
    return this.athlete()?.kin || null;
  }

  hasKin(): boolean {
    return !!this.athlete()?.kin;
  }

  getKinRoleBadge(): string {
    const kin = this.athlete()?.kin;
    if (!kin) return '';
    return kin.role_in_kin === 'LEADER' ? 'Líder / Coach' : 'Miembro';
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
      const uname = (current.username || '').toLowerCase();
      this.editUsername.set(uname);
      this.editBio.set(current.bio_description || '');
      this.usernameCheckStatus.set('available');
      this.usernameFeedbackMessage.set('Nombre de usuario actual');
    } else {
      this.usernameCheckStatus.set('idle');
      this.usernameFeedbackMessage.set('');
    }
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.isEditModalOpen.set(true);
  }

  // Validación reactiva de disponibilidad de username (estilo Instagram)
  onUsernameInput(val: string) {
    const sanitized = (val || '').trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    this.editUsername.set(sanitized);
    this.saveError.set(null);

    if (this.usernameCheckTimer) {
      clearTimeout(this.usernameCheckTimer);
    }

    const currentAth = this.athlete();
    if (!sanitized) {
      this.usernameCheckStatus.set('invalid');
      this.usernameFeedbackMessage.set('El nombre de usuario es obligatorio');
      return;
    }

    if (sanitized.length < 3) {
      this.usernameCheckStatus.set('invalid');
      this.usernameFeedbackMessage.set('Mínimo 3 caracteres (a-z, 0-9, . o _)');
      return;
    }

    // Si es su propio username actual en este perfil
    if (currentAth && currentAth.username && sanitized === currentAth.username.toLowerCase()) {
      this.usernameCheckStatus.set('available');
      this.usernameFeedbackMessage.set('Este es tu nombre de usuario actual');
      return;
    }

    this.usernameCheckStatus.set('checking');
    this.usernameFeedbackMessage.set('Comprobando disponibilidad...');

    this.usernameCheckTimer = setTimeout(() => {
      this.athleteService.checkUsernameAvailability(sanitized, currentAth?.id).subscribe({
        next: (res) => {
          if (res.available) {
            this.usernameCheckStatus.set('available');
            this.usernameFeedbackMessage.set(`✓ @${sanitized} está disponible`);
          } else {
            this.usernameCheckStatus.set('taken');
            this.usernameFeedbackMessage.set(`✗ @${sanitized} ya está en uso por otro atleta`);
          }
        },
        error: (err) => {
          console.warn('Error al verificar username:', err);
          this.usernameCheckStatus.set('idle');
          this.usernameFeedbackMessage.set('');
        }
      });
    }, 300);
  }

  // Guardar cambios en Supabase mediante PATCH
  saveProfile() {
    const current = this.athlete();
    if (!current) return;

    if (this.usernameCheckStatus() === 'taken') {
      this.saveError.set(`El nombre de usuario @${this.editUsername()} ya está ocupado por otro usuario.`);
      return;
    }

    if (this.usernameCheckStatus() === 'invalid' || !this.editUsername().trim()) {
      this.saveError.set('Ingresa un nombre de usuario válido de al menos 3 caracteres.');
      return;
    }

    this.isSaving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);

    const updates = {
      first_name: this.editFirstName().trim(),
      last_name: this.editLastName().trim(),
      username: this.editUsername().trim().toLowerCase(),
      bio_description: this.editBio().trim()
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

        // Extracción clara y amigable del error para retroalimentación al usuario
        let detail = 'Error al actualizar la información de perfil.';
        if (err.error?.detail) {
          if (typeof err.error.detail === 'string') {
            detail = err.error.detail;
          } else if (Array.isArray(err.error.detail)) {
            detail = err.error.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          } else {
            detail = JSON.stringify(err.error.detail);
          }
        } else if (err.statusText) {
          detail = `${err.status} - ${err.statusText}`;
        }
        this.saveError.set(detail);
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

