import { Component, inject, signal, computed, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNGModule } from '../../../../shared/prime-ng.module';
import { ProgressMetricRecord } from '../../../../core/services/athlete.service';
import { ChartImageExportService, ShareChartData } from '../../services/chart-image-export.service';

@Component({
    selector: 'app-share-charts-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, PrimeNGModule],
    templateUrl: './share-charts-modal.component.html',
    styleUrl: './share-charts-modal.component.css'
})
export class ShareChartsModalComponent implements OnInit {
    private chartExportService = inject(ChartImageExportService);

    // Inputs via signals
    records = signal<ProgressMetricRecord[]>([]);
    userName = signal<string>('');
    userImageUrl = signal<string | null>(null);
    kinLogoUrl = signal<string | null>(null);
    weightUnit = signal<'kg' | 'lb'>('lb');
    isOpen = signal<boolean>(false);

    // Outputs
    @Output() close = new EventEmitter<void>();
    @Output() imageGenerated = new EventEmitter<string>();

    // Estado interno
    selectedDates = signal<string[]>([]);
    isGenerating = signal<boolean>(false);
    generatedImageUrl = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    showPreview = signal<boolean>(false);

    // Computed
    availableDates = computed(() => {
        return this.records()
            .map(r => r.timestamp.split('T')[0])
            .filter((date, index, arr) => arr.indexOf(date) === index)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    });

    canGenerate = computed(() => {
        return this.selectedDates().length >= 2 && this.selectedDates().length <= 8 && !this.isGenerating();
    });

    selectedRecords = computed(() => {
        const dates = this.selectedDates();
        return this.records().filter(r => dates.includes(r.timestamp.split('T')[0]));
    });

    ngOnInit() {
        // Auto-seleccionar las últimas 2 fechas si hay suficientes
        const dates = this.availableDates();
        if (dates.length >= 2) {
            this.selectedDates.set(dates.slice(-2));
        }
    }

    toggleDate(date: string) {
        const current = this.selectedDates();
        if (current.includes(date)) {
            this.selectedDates.set(current.filter(d => d !== date));
        } else if (current.length < 8) {
            this.selectedDates.set([...current, date]);
        }
    }

    isDateSelected(date: string): boolean {
        return this.selectedDates().includes(date);
    }

    formatDate(dateStr: string): string {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    async generateImage() {
        if (!this.canGenerate()) return;

        this.isGenerating.set(true);
        this.errorMessage.set(null);
        this.generatedImageUrl.set(null);
        this.showPreview.set(false);

        try {
            const data: ShareChartData = {
                records: this.selectedRecords(),
                userName: this.userName(),
                userImageUrl: this.userImageUrl(),
                kinLogoUrl: this.kinLogoUrl(),
                weightUnit: this.weightUnit()
            };

            const imageUrl = await this.chartExportService.generateShareImage(data);
            this.generatedImageUrl.set(imageUrl);
            this.showPreview.set(true);
            this.imageGenerated.emit(imageUrl);
        } catch (err: any) {
            console.error('Error generando imagen:', err);
            this.errorMessage.set(err?.message || 'Error al generar la imagen. Intenta nuevamente.');
        } finally {
            this.isGenerating.set(false);
        }
    }

    async downloadImage() {
        if (!this.generatedImageUrl()) return;

        const link = document.createElement('a');
        link.href = this.generatedImageUrl()!;
        link.download = `awakin-progreso-${this.userName()}-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
    }

    async shareImage() {
        if (!this.generatedImageUrl()) return;

        try {
            // Convertir data URL a blob para compartir
            const response = await fetch(this.generatedImageUrl()!);
            const blob = await response.blob();
            const file = new File([blob], `awakin-progreso-${this.userName()}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Mi Progreso Corporal - ${this.userName()}`,
                    text: 'Mi evolución de peso y medidas en Awakin OS',
                    files: [file]
                });
            } else {
                // Fallback: descargar
                await this.downloadImage();
            }
        } catch (err) {
            console.error('Error compartiendo:', err);
            await this.downloadImage();
        }
    }

    closeModal() {
        this.isOpen.set(false);
        this.close.emit();
    }

    onBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.closeModal();
        }
    }
}