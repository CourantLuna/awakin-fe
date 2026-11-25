import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-pending-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#0C0A09] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(254,151,10,0.22)_0%,rgba(12,10,9,0.97)_68%)] pointer-events-none">
      </div>

      <div class="relative z-10 w-full max-w-md bg-stone-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
        <!-- Logo Awakin -->
        <div class="flex flex-col items-center text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl bg-awakin-sun/15 border border-awakin-sun/35 flex items-center justify-center shadow-lg">
            <img src="/icons/awakin-isotipo.png" alt="Awakin" class="w-8 h-8 object-contain" />
          </div>
          <span class="px-3 py-1 rounded-full bg-awakin-sun/15 border border-awakin-sun/35 text-awakin-sun text-[10px] font-black uppercase tracking-widest">
            Acceso Privado
          </span>
        </div>

        <!-- Perfil de la cuenta conectada -->
        @if (authService.currentSession(); as sess) {
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
          <img [src]="sess.avatar.photoUrl || 'https://i.pravatar.cc/100?u=' + sess.avatar.id" [alt]="sess.avatar.fullName"
            class="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="text-xs font-black text-white truncate">{{ sess.avatar.fullName }}</div>
            <div class="text-[11px] text-stone-400 truncate">{{ sess.avatar.email }}</div>
          </div>
        </div>
        }

        <!-- Estado de Solicitud -->
        @if (authService.pendingJoinRequest(); as req) {
        <div class="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3 text-center">
          @if (req.kin?.team_logo_url) {
          <img [src]="req.kin!.team_logo_url!" [alt]="req.kin?.team_name || 'Kin'"
            class="h-12 w-auto object-contain mx-auto drop-shadow" />
          }
          <div class="space-y-1">
            <div class="text-[10px] font-black uppercase tracking-widest text-awakin-sun">
              {{ req.kin?.team_name || 'Tu Kin' }}
            </div>
            @if (req.status === 'REJECTED') {
            <h2 class="text-base font-black text-white">Solicitud no aprobada</h2>
            <p class="text-xs text-stone-300 leading-relaxed">
              Tu solicitud anterior no fue aprobada por el entrenador. Puedes contactar a tu coach o ingresar un nuevo enlace de invitación.
            </p>
            } @else {
            <h2 class="text-base font-black text-white">Solicitud en revisión</h2>
            <p class="text-xs text-stone-300 leading-relaxed">
              Enviamos tu solicitud a
              <span class="font-black text-white">{{ req.kin?.head_coach_name || req.kin?.team_name || 'tu entrenador' }}</span>.
              En cuanto te apruebe, tendrás acceso completo a la app.
            </p>
            }
          </div>
        </div>
        } @else {
        <div class="text-center space-y-2">
          <h1 class="text-lg font-black uppercase tracking-tight text-white">
            Comunidad Solo por Invitación
          </h1>
          <p class="text-xs text-stone-300 leading-relaxed">
            Tu cuenta aún no está activada. Para acceder a <span class="font-bold text-white">AWAKIN</span>, solicita a tu entrenador su enlace o código de invitación privada.
          </p>
        </div>
        }

        <!-- Campo opcional para pegar enlace o código de invitación -->
        <div class="space-y-2 pt-1">
          <label class="block text-[10px] font-black uppercase tracking-wider text-stone-400">
            ¿Tienes un enlace o código de invitación?
          </label>
          <div class="flex gap-2">
            <input type="text" [ngModel]="inviteInput()" (ngModelChange)="inviteInput.set($event)"
              placeholder="Pega enlace /join/... o código"
              class="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-white placeholder:text-stone-500 focus:outline-none focus:border-awakin-sun" />
            <button type="button" (click)="submitInviteCode()" [disabled]="!inviteInput().trim() || isClaiming()"
              class="px-3.5 py-2.5 rounded-xl bg-awakin-sun hover:bg-awakin-sun-dim text-white font-black text-[11px] uppercase tracking-wider cursor-pointer disabled:opacity-40 shrink-0 transition-all active:scale-95">
              @if (isClaiming()) {
              <i class="pi pi-spin pi-spinner text-xs"></i>
              } @else {
              <span>Enviar</span>
              }
            </button>
          </div>
          @if (feedbackMessage()) {
          <p class="text-[11px] font-bold" [ngClass]="feedbackIsError() ? 'text-rose-400' : 'text-emerald-400'">
            {{ feedbackMessage() }}
          </p>
          }
        </div>

        <!-- Acciones: Verificar Estado + Cerrar Sesión -->
        <div class="flex flex-col gap-2 pt-2 border-t border-white/10">
          <button type="button" (click)="checkStatus()" [disabled]="isChecking()"
            class="w-full py-3 rounded-xl bg-white text-stone-950 hover:bg-stone-100 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50">
            <i class="pi pi-refresh text-xs" [class.animate-spin]="isChecking()"></i>
            <span>{{ isChecking() ? 'Verificando...' : 'Verificar Estado de Acceso' }}</span>
          </button>

          <button type="button" (click)="logout()"
            class="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
            <i class="pi pi-sign-out text-xs"></i>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PendingAccessComponent implements OnInit {
  public authService = inject(AuthService);
  private router = inject(Router);

  inviteInput = signal<string>('');
  isChecking = signal<boolean>(false);
  isClaiming = signal<boolean>(false);
  feedbackMessage = signal<string | null>(null);
  feedbackIsError = signal<boolean>(false);

  ngOnInit(): void {
    if (!this.authService.hasRawSession()) {
      this.router.navigate(['/login']);
      return;
    }
    this.checkStatus();
  }

  async checkStatus(): Promise<void> {
    this.isChecking.set(true);
    try {
      await this.authService.verifyCurrentAccountAccess(true);
    } finally {
      this.isChecking.set(false);
    }
  }

  async submitInviteCode(): Promise<void> {
    const raw = this.inviteInput().trim();
    if (!raw || this.isClaiming()) return;
    this.isClaiming.set(true);
    this.feedbackMessage.set(null);
    this.feedbackIsError.set(false);

    try {
      const res = await this.authService.claimInviteToken(raw);
      this.inviteInput.set('');
      if (res.is_active) {
        this.feedbackMessage.set('¡Acceso aprobado! Entrando a Awakin...');
      } else {
        this.feedbackMessage.set('¡Solicitud enviada! Espera la aprobación de tu entrenador.');
      }
    } catch (err: any) {
      this.feedbackIsError.set(true);
      this.feedbackMessage.set(err?.error?.detail || err?.message || 'Enlace o código de invitación inválido.');
    } finally {
      this.isClaiming.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
