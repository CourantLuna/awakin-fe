import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { KinService } from '../../../core/services/kin.service';

@Component({
  selector: 'app-join-invite',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-[#0C0A09] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(254,151,10,0.22)_0%,rgba(12,10,9,0.97)_68%)] pointer-events-none">
      </div>

      <div class="relative z-10 w-full max-w-md bg-stone-900/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        @if (isLoading()) {
        <div class="p-10 text-center space-y-3">
          <i class="pi pi-spin pi-spinner text-2xl text-awakin-sun"></i>
          <p class="text-xs font-bold text-stone-300">Validando enlace de invitación...</p>
        </div>
        } @else if (errorMessage()) {
        <div class="p-6 text-center space-y-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
            <i class="pi pi-link text-2xl"></i>
          </div>
          <div class="space-y-1">
            <h2 class="text-base font-black uppercase tracking-tight">Invitación no disponible</h2>
            <p class="text-xs text-stone-300 leading-relaxed">{{ errorMessage() }}</p>
          </div>
          <button type="button" (click)="goToLogin()"
            class="w-full py-3 rounded-xl bg-white text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer">
            Ir a Iniciar Sesión
          </button>
        </div>
        } @else if (invite(); as inv) {
        <!-- Banner del Kin -->
        <div class="relative h-32 bg-stone-950 flex items-center justify-center overflow-hidden">
          @if (inv.kin?.header_image_url) {
          <img [src]="inv.kin!.header_image_url!" alt="Kin" class="absolute inset-0 w-full h-full object-cover opacity-55" />
          <div class="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent"></div>
          } @else {
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(254,151,10,0.35),transparent_70%)]"></div>
          }
          @if (inv.kin?.team_logo_url) {
          <img [src]="inv.kin!.team_logo_url!" [alt]="inv.kin?.team_name || 'Kin'"
            class="relative z-10 h-16 w-auto object-contain drop-shadow-lg" />
          } @else {
          <img src="/icons/awakin-isotipo.png" alt="Awakin" class="relative z-10 w-12 h-12 object-contain" />
          }
        </div>

        <div class="p-6 pt-3 text-center space-y-4">
          <div class="space-y-1">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-awakin-sun/15 border border-awakin-sun/35 text-awakin-sun text-[9px] font-black uppercase tracking-widest">
              <i class="pi pi-shield text-[9px]"></i>
              <span>Invitación Privada</span>
            </span>
            <h1 class="text-xl font-black uppercase tracking-tight text-white pt-1">
              {{ inv.kin?.team_name || 'Awakin Kin' }}
            </h1>
            @if (inv.kin?.head_coach_name) {
            <p class="text-xs font-bold text-stone-300">
              {{ inv.kin!.head_coach_name }} · <span class="text-awakin-sun">Fitness Coach</span>
            </p>
            }
            @if (inv.kin?.manifesto) {
            <p class="text-[11px] text-stone-400 italic leading-relaxed pt-1">
              "{{ inv.kin!.manifesto }}"
            </p>
            }
          </div>

          @if (actionError()) {
          <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-bold">
            {{ actionError() }}
          </div>
          }

          @if (authService.hasRawSession()) {
          <button type="button" (click)="claimAsLoggedInUser()" [disabled]="isSubmitting()"
            class="w-full py-3.5 rounded-xl bg-awakin-sun hover:bg-awakin-sun-dim text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-awakin-sun/25 transition-all active:scale-[0.99] disabled:opacity-50">
            @if (isSubmitting()) {
            <i class="pi pi-spin pi-spinner text-xs"></i>
            <span>Enviando solicitud...</span>
            } @else {
            <i class="pi pi-check-circle text-xs"></i>
            <span>{{ inv.requires_approval ? 'Solicitar Acceso al Kin' : 'Unirme al Kin Ahora' }}</span>
            }
          </button>
          } @else {
          <button type="button" (click)="continueWithGoogle()" [disabled]="isSubmitting()"
            class="w-full py-3.5 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer shadow-lg transition-all active:scale-[0.99] disabled:opacity-50">
            <i class="pi pi-google text-sm text-awakin-sun"></i>
            <span>{{ inv.requires_approval ? 'Solicitar Acceso con Google' : 'Unirme con Google' }}</span>
          </button>
          }

          <p class="text-[10px] text-stone-400">
            {{ inv.requires_approval
              ? 'Tu entrenador revisará y aprobará tu solicitud para activar tu cuenta.'
              : 'Este enlace activa tu cuenta directamente dentro del Kin.' }}
          </p>
        </div>
        }
      </div>
    </div>
  `,
})
export class JoinInviteComponent implements OnInit {
  public authService = inject(AuthService);
  private kinService = inject(KinService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = signal<string>('');
  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  invite = signal<any | null>(null);
  errorMessage = signal<string | null>(null);
  actionError = signal<string | null>(null);

  ngOnInit(): void {
    const rawToken = (this.route.snapshot.paramMap.get('token') || '').trim();
    this.token.set(rawToken);
    if (!rawToken) {
      this.errorMessage.set('Enlace de invitación inválido.');
      this.isLoading.set(false);
      return;
    }

    this.kinService.getInvitePreview(rawToken).subscribe({
      next: (res) => {
        if (!res.valid) {
          this.errorMessage.set(res.invalid_reason || 'Este enlace de invitación ya no es válido.');
        } else {
          this.invite.set(res);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'No se encontró este enlace de invitación.');
        this.isLoading.set(false);
      },
    });
  }

  async continueWithGoogle(): Promise<void> {
    this.isSubmitting.set(true);
    this.actionError.set(null);
    try {
      await this.authService.loginWithGoogle(this.token());
    } catch (err: any) {
      this.actionError.set(err?.message || 'No se pudo iniciar con Google.');
      this.isSubmitting.set(false);
    }
  }

  async claimAsLoggedInUser(): Promise<void> {
    this.isSubmitting.set(true);
    this.actionError.set(null);
    try {
      const res = await this.authService.claimInviteToken(this.token());
      if (res.is_active) {
        this.router.navigate(['/kin']);
      } else {
        this.router.navigate(['/pending-access']);
      }
    } catch (err: any) {
      this.actionError.set(err?.error?.detail || err?.message || 'No se pudo enviar la solicitud.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
