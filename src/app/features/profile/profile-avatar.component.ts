import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PrimeNGModule } from '../../shared/prime-ng.module';
import { AuthService } from '../../core/services/auth.service';
import {
  AthleteService,
  AthleteProfile,
  AthleteFeedPost,
  KinInfo,
  NutritionMealRecord,
  ProgressMetricRecord
} from '../../core/services/athlete.service';

export type ProfileFeedTab = 'posts' | 'meals' | 'workouts' | 'progress';

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

  // ==========================================
  // PRIVACIDAD: CONTROL DE ACCESO AL 4TO TAB
  // Solo el dueño de la cuenta puede ver sus medidas corporales y logs de progreso
  // ==========================================
  isOwner = computed(() => {
    const current = this.athlete();
    const session = this.authService.currentSession();
    if (!current) return false;

    // 1. Coincide ID del usuario autenticado
    if (session?.avatar?.id && current.id && session.avatar.id === current.id) {
      return true;
    }

    // 2. Coincide email del usuario autenticado
    const sEmail = session?.avatar?.email?.trim().toLowerCase();
    const aEmail = current.email?.trim().toLowerCase();
    if (sEmail && aEmail && sEmail === aEmail) {
      return true;
    }

    // 3. Atleta activo seleccionado en localStorage
    const savedId = localStorage.getItem('awakin_active_athlete_id');
    if (savedId && savedId === current.id) {
      return true;
    }

    return false;
  });

  // Preferencia de unidad de peso en visualización ('lb' o 'kg')
  preferredWeightUnit = signal<'kg' | 'lb'>('lb');

  // Registros de progreso
  progressRecords = computed(() => {
    return this.records()?.progress || [];
  });

  // Orden cronológico (antiguo -> nuevo) para gráficos
  chronologicalProgress = computed(() => {
    return [...this.progressRecords()].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });

  // Orden descendente (nuevo -> antiguo) para el log fotográfico
  descendingProgress = computed(() => {
    return [...this.progressRecords()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  // Último registro
  latestRecord = computed(() => {
    const list = this.descendingProgress();
    return list.length > 0 ? list[0] : null;
  });

  // Primer registro
  firstRecord = computed(() => {
    const list = this.chronologicalProgress();
    return list.length > 0 ? list[0] : null;
  });

  // Delta de peso (cambio total desde el inicio)
  weightDelta = computed(() => {
    const first = this.firstRecord();
    const latest = this.latestRecord();
    if (!first || !latest || first.peso == null || latest.peso == null) return null;

    const unit = this.preferredWeightUnit();
    const firstW = this.convertWeight(Number(first.peso), first.unidad_peso, unit);
    const latestW = this.convertWeight(Number(latest.peso), latest.unidad_peso, unit);
    const diff = latestW - firstW;
    return {
      diff: Number(diff.toFixed(1)),
      unit: unit,
      percent: Number(((diff / firstW) * 100).toFixed(1)),
      isLoss: diff < 0
    };
  });

  // Gráfico 1: Evolución de Peso (SVG interactivo)
  weightChartData = computed(() => {
    const items = this.chronologicalProgress();
    const targetUnit = this.preferredWeightUnit();
    const width = 460;
    const height = 190;
    const paddingX = 45;
    const paddingY = 25;

    const validPoints = items
      .filter((item) => item.peso != null && Number(item.peso) > 0)
      .map((item) => {
        const date = new Date(item.timestamp);
        const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
        const weightVal = this.convertWeight(Number(item.peso), item.unidad_peso, targetUnit);
        return {
          id: item.id,
          dateLabel,
          weight: Number(weightVal.toFixed(1)),
          original: item
        };
      });

    if (validPoints.length === 0) {
      return { hasData: false, points: [], path: '', areaPath: '', gridLines: [], width, height, minW: 0, maxW: 100 };
    }

    const weights = validPoints.map((p) => p.weight);
    let minW = Math.min(...weights);
    let maxW = Math.max(...weights);

    if (minW === maxW) {
      minW = Math.max(0, minW - 5);
      maxW = maxW + 5;
    } else {
      const margin = Math.max(2, (maxW - minW) * 0.18);
      minW = Math.max(0, minW - margin);
      maxW = maxW + margin;
    }

    const gridCount = 4;
    const gridLines = [];
    for (let i = 0; i <= gridCount; i++) {
      const val = minW + ((maxW - minW) * (gridCount - i)) / gridCount;
      const y = paddingY + (height - 2 * paddingY) * (i / gridCount);
      gridLines.push({
        y,
        val: Math.round(val)
      });
    }

    const plotWidth = width - 2 * paddingX;
    const plotHeight = height - 2 * paddingY;
    const count = validPoints.length;

    const points = validPoints.map((p, idx) => {
      const x = count === 1 ? width / 2 : paddingX + (plotWidth * idx) / (count - 1);
      const y = paddingY + plotHeight * (1 - (p.weight - minW) / (maxW - minW));
      return { ...p, x, y };
    });

    let path = '';
    let areaPath = '';
    if (points.length === 1) {
      path = `M ${points[0].x - 12} ${points[0].y} L ${points[0].x + 12} ${points[0].y}`;
      areaPath = '';
    } else {
      path = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
      const last = points[points.length - 1];
      const first = points[0];
      const bottomY = height - paddingY;
      areaPath = `${path} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
    }

    return {
      hasData: true,
      points,
      path,
      areaPath,
      gridLines,
      width,
      height,
      minW,
      maxW
    };
  });

  // Gráfico 2: Medidas Corporales (Cadera, Cintura, Pecho)
  bodyMetricsChartData = computed(() => {
    const items = this.chronologicalProgress();
    const width = 460;
    const height = 190;
    const paddingX = 45;
    const paddingY = 25;

    const validItems = items.filter(
      (it) => it.cadera != null || it.cintura != null || it.pecho != null
    );

    if (validItems.length === 0) {
      return { hasData: false, width, height, gridLines: [], caderaPoints: [], cinturaPoints: [], pechoPoints: [], caderaPath: '', cinturaPath: '', pechoPath: '' };
    }

    const allVals: number[] = [];
    validItems.forEach((it) => {
      if (it.cadera != null) allVals.push(Number(it.cadera));
      if (it.cintura != null) allVals.push(Number(it.cintura));
      if (it.pecho != null) allVals.push(Number(it.pecho));
    });

    let minV = Math.min(...allVals);
    let maxV = Math.max(...allVals);
    if (minV === maxV) {
      minV = Math.max(0, minV - 10);
      maxV = maxV + 10;
    } else {
      const margin = Math.max(3, (maxV - minV) * 0.18);
      minV = Math.max(0, minV - margin);
      maxV = maxV + margin;
    }

    const gridCount = 4;
    const gridLines = [];
    for (let i = 0; i <= gridCount; i++) {
      const val = minV + ((maxV - minV) * (gridCount - i)) / gridCount;
      const y = paddingY + (height - 2 * paddingY) * (i / gridCount);
      gridLines.push({
        y,
        val: Math.round(val)
      });
    }

    const plotWidth = width - 2 * paddingX;
    const plotHeight = height - 2 * paddingY;
    const count = validItems.length;

    const buildSeries = (key: 'cadera' | 'cintura' | 'pecho') => {
      return validItems
        .map((it, idx) => {
          const val = it[key] != null ? Number(it[key]) : null;
          if (val == null) return null;
          const x = count === 1 ? width / 2 : paddingX + (plotWidth * idx) / (count - 1);
          const y = paddingY + plotHeight * (1 - (val - minV) / (maxV - minV));
          const date = new Date(it.timestamp);
          const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;
          return { id: it.id, dateLabel, val, x, y };
        })
        .filter((pt): pt is { id: string; dateLabel: string; val: number; x: number; y: number } => pt !== null);
    };

    const caderaPoints = buildSeries('cadera');
    const cinturaPoints = buildSeries('cintura');
    const pechoPoints = buildSeries('pecho');

    const toPath = (pts: { x: number; y: number }[]) => {
      if (pts.length <= 1) return '';
      return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
    };

    return {
      hasData: true,
      width,
      height,
      gridLines,
      caderaPoints,
      cinturaPoints,
      pechoPoints,
      caderaPath: toPath(caderaPoints),
      cinturaPath: toPath(cinturaPoints),
      pechoPath: toPath(pechoPoints)
    };
  });

  // Modal de Nuevo Registro de Progreso
  isNewProgressModalOpen = signal<boolean>(false);
  progressDate = signal<string>(new Date().toISOString().split('T')[0]);
  progressWeight = signal<number | null>(null);
  progressWeightUnit = signal<'kg' | 'lb'>('lb');
  progressWaist = signal<number | null>(null); // Cintura
  progressHip = signal<number | null>(null);   // Cadera
  progressChest = signal<number | null>(null); // Pecho
  showAdvancedMetrics = signal<boolean>(false);
  progressNeck = signal<number | null>(null);
  progressBiceps = signal<number | null>(null);
  progressThigh = signal<number | null>(null);
  progressBodyFat = signal<number | null>(null);
  progressMuscleMass = signal<number | null>(null);

  // Archivos de fotos y previsualizaciones
  photoFrontFile = signal<File | null>(null);
  photoFrontPreview = signal<string | null>(null);
  photoSideFile = signal<File | null>(null);
  photoSidePreview = signal<string | null>(null);
  photoBackFile = signal<File | null>(null);
  photoBackPreview = signal<string | null>(null);

  isSavingProgress = signal<boolean>(false);
  saveProgressSuccess = signal<boolean>(false);
  saveProgressError = signal<string | null>(null);
  savingStepText = signal<string>('');

  // Lightbox para ver foto grande
  lightboxOpen = signal<boolean>(false);
  lightboxPhotoUrl = signal<string | null>(null);
  lightboxTitle = signal<string>('');
  lightboxDate = signal<string>('');

  // Tooltip interactivo en gráficos
  activeTooltip = signal<{ type: 'weight' | 'metric'; x: number; y: number; text: string; subtext?: string } | null>(null);

  ngOnInit() {
    // Cargar bajo demanda el perfil del atleta autenticado
    const current = this.athlete();
    if (!current) {
      const session = this.authService.currentSession();
      if (session?.avatar?.id) {
        this.athleteService.loadAthleteProfile(session.avatar.id);
      } else {
        const savedId = localStorage.getItem('awakin_active_athlete_id');
        if (savedId) {
          this.athleteService.loadAthleteProfile(savedId);
        }
      }
    }
  }

  // Cambiar pestaña del feed garantizando privacidad
  setTab(tab: ProfileFeedTab) {
    if (tab === 'progress' && !this.isOwner()) {
      this.activeTab.set('posts');
      return;
    }
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

  // ==========================================
  // GESTIÓN DE MÉTRICAS Y PROGRESO CORPORAL
  // ==========================================

  // Conversión reactiva de pesos entre KG y LB
  convertWeight(val: number, fromUnit?: string, toUnit: 'kg' | 'lb' = 'lb'): number {
    if (val == null) return 0;
    const from = (fromUnit || 'kg').toLowerCase();
    const to = toUnit.toLowerCase();
    if (from === to) return val;
    if (from === 'kg' && to === 'lb') {
      return val * 2.20462;
    }
    if (from === 'lb' && to === 'kg') {
      return val / 2.20462;
    }
    return val;
  }

  // Alternar unidad entre KG y LB
  toggleWeightUnit(unit?: 'kg' | 'lb') {
    if (unit) {
      this.preferredWeightUnit.set(unit);
    } else {
      this.preferredWeightUnit.update((u) => (u === 'lb' ? 'kg' : 'lb'));
    }
  }

  // Alternar visualización de medidas avanzadas
  toggleAdvancedMetrics() {
    this.showAdvancedMetrics.update((v) => !v);
  }

  // Abrir modal de nuevo registro
  openNewProgressModal() {
    this.progressDate.set(new Date().toISOString().split('T')[0]);
    this.progressWeight.set(null);
    this.progressWeightUnit.set(this.preferredWeightUnit());
    this.progressWaist.set(null);
    this.progressHip.set(null);
    this.progressChest.set(null);
    this.showAdvancedMetrics.set(false);
    this.progressNeck.set(null);
    this.progressBiceps.set(null);
    this.progressThigh.set(null);
    this.progressBodyFat.set(null);
    this.progressMuscleMass.set(null);

    this.photoFrontFile.set(null);
    this.photoFrontPreview.set(null);
    this.photoSideFile.set(null);
    this.photoSidePreview.set(null);
    this.photoBackFile.set(null);
    this.photoBackPreview.set(null);

    this.isSavingProgress.set(false);
    this.saveProgressSuccess.set(false);
    this.saveProgressError.set(null);
    this.savingStepText.set('');

    this.isNewProgressModalOpen.set(true);
  }

  closeNewProgressModal() {
    this.isNewProgressModalOpen.set(false);
  }

  // Selección de foto para frontal, lateral o espalda
  onProgressPhotoSelected(event: Event, angle: 'front' | 'side' | 'back') {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (angle === 'front') {
        this.photoFrontFile.set(file);
        this.photoFrontPreview.set(preview);
      } else if (angle === 'side') {
        this.photoSideFile.set(file);
        this.photoSidePreview.set(preview);
      } else if (angle === 'back') {
        this.photoBackFile.set(file);
        this.photoBackPreview.set(preview);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // Quitar foto seleccionada
  removeProgressPhoto(angle: 'front' | 'side' | 'back') {
    if (angle === 'front') {
      this.photoFrontFile.set(null);
      this.photoFrontPreview.set(null);
    } else if (angle === 'side') {
      this.photoSideFile.set(null);
      this.photoSidePreview.set(null);
    } else if (angle === 'back') {
      this.photoBackFile.set(null);
      this.photoBackPreview.set(null);
    }
  }

  // Guardar nuevo registro en BD Supabase
  async saveProgress() {
    const ath = this.athlete();
    if (!ath) {
      this.saveProgressError.set('No se ha podido identificar el perfil del atleta.');
      return;
    }

    if (this.progressWeight() == null && !this.progressWaist() && !this.photoFrontFile()) {
      this.saveProgressError.set('Por favor ingresa al menos el peso, una medida o una foto.');
      return;
    }

    this.isSavingProgress.set(true);
    this.saveProgressError.set(null);
    this.saveProgressSuccess.set(false);

    try {
      let fotoFrontUrl: string | undefined;
      let fotoSideUrl: string | undefined;
      let fotoBackUrl: string | undefined;

      // 1. Subir fotos si se seleccionaron
      if (this.photoFrontFile()) {
        this.savingStepText.set('Subiendo foto frontal...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoFrontFile()!, 'progress_photos', `front_${Date.now()}.jpg`)
        );
        fotoFrontUrl = res.public_url;
      }

      if (this.photoSideFile()) {
        this.savingStepText.set('Subiendo foto lateral...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoSideFile()!, 'progress_photos', `side_${Date.now()}.jpg`)
        );
        fotoSideUrl = res.public_url;
      }

      if (this.photoBackFile()) {
        this.savingStepText.set('Subiendo foto espalda...');
        const res = await firstValueFrom(
          this.athleteService.uploadMedia(this.photoBackFile()!, 'progress_photos', `back_${Date.now()}.jpg`)
        );
        fotoBackUrl = res.public_url;
      }

      // 2. Construir payload de progreso
      this.savingStepText.set('Guardando métricas en tu expediente...');
      const dateVal = this.progressDate() ? new Date(this.progressDate()).toISOString() : new Date().toISOString();

      const payload: Partial<ProgressMetricRecord> = {
        timestamp: dateVal,
        peso: this.progressWeight() != null ? Number(this.progressWeight()) : null,
        unidad_peso: this.progressWeightUnit(),
        cintura: this.progressWaist() != null ? Number(this.progressWaist()) : null,
        cadera: this.progressHip() != null ? Number(this.progressHip()) : null,
        pecho: this.progressChest() != null ? Number(this.progressChest()) : null,
        foto_frontal_url: fotoFrontUrl,
        foto_lateral_url: fotoSideUrl,
        foto_espalda_url: fotoBackUrl,
        cuello: this.progressNeck() != null ? Number(this.progressNeck()) : null,
        biceps: this.progressBiceps() != null ? Number(this.progressBiceps()) : null,
        muslo: this.progressThigh() != null ? Number(this.progressThigh()) : null,
        porcentaje_grasa: this.progressBodyFat() != null ? Number(this.progressBodyFat()) : null,
        masa_muscular: this.progressMuscleMass() != null ? Number(this.progressMuscleMass()) : null
      };

      await firstValueFrom(this.athleteService.createProgressRecord(ath.id, payload));

      this.isSavingProgress.set(false);
      this.saveProgressSuccess.set(true);
      setTimeout(() => {
        this.isNewProgressModalOpen.set(false);
        this.saveProgressSuccess.set(false);
      }, 700);
    } catch (err: any) {
      console.error('Error guardando progreso:', err);
      this.isSavingProgress.set(false);
      this.saveProgressError.set(err?.error?.detail || err?.message || 'Error al guardar el registro.');
    }
  }

  // Eliminar un registro de progreso
  deleteProgress(progressId: string) {
    const ath = this.athlete();
    if (!ath) return;

    if (!confirm('¿Deseas eliminar este registro de progreso y sus fotos?')) {
      return;
    }

    this.athleteService.deleteProgressRecord(ath.id, progressId).subscribe({
      next: () => {
        // Registro eliminado reactivamente
      },
      error: (err) => {
        console.error('Error al eliminar registro:', err);
        alert('No se pudo eliminar el registro. Intenta nuevamente.');
      }
    });
  }

  // Compartir resumen de gráficos
  shareProgressCharts() {
    const latest = this.latestRecord();
    const delta = this.weightDelta();
    let text = '⚡ Mi Progreso Corporal en Awakin:\n';
    if (latest && latest.peso) {
      text += `• Peso Actual: ${latest.peso} ${latest.unidad_peso || 'lb'}\n`;
    }
    if (delta) {
      text += `• Evolución Total: ${delta.diff > 0 ? '+' : ''}${delta.diff} ${delta.unit} (${delta.percent}%)\n`;
    }
    if (latest?.cintura) text += `• Cintura: ${latest.cintura} cm\n`;
    if (latest?.cadera) text += `• Cadera: ${latest.cadera} cm\n`;
    if (latest?.pecho) text += `• Pecho: ${latest.pecho} cm\n`;
    text += `Construyendo disciplina un día a la vez. 🔥`;

    if (navigator.share) {
      navigator.share({
        title: 'Mi Progreso Corporal - Awakin',
        text
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert('¡Resumen de métricas copiado al portapapeles!');
      });
    }
  }

  // Compartir un registro fotográfico puntual
  shareProgressRecord(record: ProgressMetricRecord) {
    const dateFormatted = this.formatDateSpanish(record.timestamp);
    let text = `📸 Check-in de Progreso (${dateFormatted})\n`;
    if (record.peso) text += `• Peso: ${record.peso} ${record.unidad_peso || 'lb'}\n`;
    if (record.cintura) text += `• Cintura: ${record.cintura} cm\n`;
    if (record.cadera) text += `• Cadera: ${record.cadera} cm\n`;
    if (record.pecho) text += `• Pecho: ${record.pecho} cm\n`;
    text += `Awakin OS.`;

    if (navigator.share) {
      navigator.share({
        title: `Check-in ${dateFormatted}`,
        text
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert('¡Datos del check-in copiados al portapapeles!');
      });
    }
  }

  // Visualizador Lightbox de fotos
  openLightbox(url: string, title: string, dateStr: string) {
    this.lightboxPhotoUrl.set(url);
    this.lightboxTitle.set(title);
    this.lightboxDate.set(this.formatDateSpanish(dateStr));
    this.lightboxOpen.set(true);
  }

  closeLightbox() {
    this.lightboxOpen.set(false);
    this.lightboxPhotoUrl.set(null);
  }

  // Tooltip interactivo sobre puntos del gráfico
  showTooltip(type: 'weight' | 'metric', x: number, y: number, text: string, subtext?: string) {
    this.activeTooltip.set({ type, x, y, text, subtext });
  }

  hideTooltip() {
    this.activeTooltip.set(null);
  }

  // Formato de fecha amigable en español
  formatDateSpanish(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}

