import { NgModule } from '@angular/core';

// Importa aquí todo lo que vayas a usar
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { DatePickerModule } from 'primeng/datepicker';

@NgModule({
  exports: [
    ButtonModule,
    CardModule,
    InputTextModule,
    AvatarModule,
    MenuModule,
    DialogModule,
    ToastModule,
    ChartModule,
    ProgressBarModule,
    DatePickerModule
    // Agrega aquí más módulos si los necesitas en el futuro
  ]
})
export class PrimeNGModule { }