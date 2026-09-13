import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ModuleConfigService } from '../../core/services/module-config.service';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.css',
})
export class MaintenanceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public moduleConfig = inject(ModuleConfigService);

  moduleKey = signal<string>('workout');
  meta = signal<{ title: string; description: string; icon: string }>({
    title: 'Módulo en Mantenimiento',
    description: 'Este módulo se encuentra temporalmente deshabilitado por mantenimiento.',
    icon: 'pi pi-cog',
  });

  isChecking = signal<boolean>(false);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const key = (params['module'] as string) || 'workout';
      this.moduleKey.set(key);
      this.meta.set(this.moduleConfig.getModuleMeta(key));
    });
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToIntake() {
    this.router.navigate(['/intake']);
  }

  checkStatus() {
    this.isChecking.set(true);
    this.moduleConfig.syncWithBackend();

    setTimeout(() => {
      this.isChecking.set(false);
      const isNowEnabled = this.moduleConfig.isModuleEnabled(this.moduleKey());
      if (isNowEnabled) {
        this.router.navigate(['/' + this.moduleKey()]);
      }
    }, 1200);
  }
}
