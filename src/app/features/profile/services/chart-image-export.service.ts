import { Injectable } from '@angular/core';
import { ProgressMetricRecord } from '../../../core/services/athlete.service';

export interface ChartImageConfig {
    width: number;
    height: number;
    bgColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
}

export interface ShareChartData {
    records: ProgressMetricRecord[];
    userName: string;
    userImageUrl: string | null;
    kinLogoUrl: string | null;
    weightUnit: 'kg' | 'lb';
}

@Injectable({ providedIn: 'root' })
export class ChartImageExportService {
    private readonly DEFAULT_CONFIG: ChartImageConfig = {
        width: 1080,
        height: 1920,
        bgColor: '#0a0f1d',
        textColor: '#ffffff',
        accentColor: '#10b981',
        fontFamily: 'Inter, system-ui, sans-serif'
    };

    /**
     * Genera una imagen 9:16 con los gráficos de progreso seleccionados
     * Incluye: logo Kin, foto de perfil, nombre de usuario, gráfico de peso, gráfico de medidas
     */
    async generateShareImage(data: ShareChartData): Promise<string> {
        const config = { ...this.DEFAULT_CONFIG };
        const canvas = document.createElement('canvas');
        canvas.width = config.width;
        canvas.height = config.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No se pudo crear el contexto del canvas');
        }

        // Fondo
        ctx.fillStyle = config.bgColor;
        ctx.fillRect(0, 0, config.width, config.height);

        // Decoración superior (glow)
        const gradient = ctx.createLinearGradient(0, 0, config.width, 0);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
        gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, config.width, 200);

        // Línea divisoria sutil
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 220);
        ctx.lineTo(config.width, 220);
        ctx.stroke();

        // ===== HEADER =====
        let y = 120;

        // Logo Kin (izquierda)
        if (data.kinLogoUrl) {
            try {
                const kinImg = await this.loadImage(data.kinLogoUrl);
                const logoSize = 60;
                ctx.drawImage(kinImg, 60, y - 30, logoSize, logoSize);
            } catch (e) {
                console.warn('No se pudo cargar el logo Kin', e);
            }
        }

        // Título
        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 32px ' + config.fontFamily;
        ctx.textAlign = 'left';
        ctx.fillText('Mi Progreso Corporal', 140, y + 10);

        // Subtítulo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '16px ' + config.fontFamily;
        ctx.fillText('Awakin • Progreso de Entrenamiento', 140, y + 40);

        // Línea separadora
        y += 80;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(config.width - 60, y);
        ctx.stroke();

        // ===== INFO DEL USUARIO =====
        y += 60;

        // Foto de perfil (izquierda)
        if (data.userImageUrl) {
            try {
                const profileImg = await this.loadImage(data.userImageUrl);
                const profileSize = 100;
                const centerX = 110;
                const centerY = y + profileSize / 2;

                // Círculo de fondo
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.arc(centerX, centerY, profileSize / 2 + 8, 0, Math.PI * 2);
                ctx.fill();

                // Borde del círculo
                ctx.strokeStyle = config.accentColor;
                ctx.lineWidth = 3;
                ctx.stroke();

                // Imagen recortada circular
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, profileSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(profileImg, centerX - profileSize / 2, centerY - profileSize / 2, profileSize, profileSize);
                ctx.restore();
            } catch (e) {
                console.warn('No se pudo cargar la foto de perfil', e);
            }
        }

        // Nombre de usuario
        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 28px ' + config.fontFamily;
        ctx.textAlign = 'left';
        ctx.fillText(data.userName, 240, y + 35);

        // Fecha de generación
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px ' + config.fontFamily;
        ctx.fillText(fechaStr, 240, y + 65);

        y += 140;

        // ===== GRÁFICO DE PESO =====
        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 22px ' + config.fontFamily;
        ctx.textAlign = 'left';
        ctx.fillText('Evolución de Peso (' + data.weightUnit.toUpperCase() + ')', 60, y);

        y += 40;

        // Dibujar gráfico de peso en el canvas
        const chartWidth = config.width - 120;
        const chartHeight = 320;
        const chartX = 60;
        const chartY = y;

        this.drawWeightChart(ctx, data.records, chartX, chartY, chartWidth, chartHeight, config, data.weightUnit);

        y += chartHeight + 60;

        // ===== GRÁFICO DE MEDIDAS =====
        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 22px ' + config.fontFamily;
        ctx.textAlign = 'left';
        ctx.fillText('Medidas Corporales (cm)', 60, y);

        y += 40;

        const metricsChartHeight = 320;
        this.drawMetricsChart(ctx, data.records, chartX, chartY, chartWidth, metricsChartHeight, config);

        y += metricsChartHeight + 60;

        // ===== RESUMEN DE ÚLTIMO REGISTRO =====
        const latest = data.records[data.records.length - 1];
        if (latest) {
            ctx.fillStyle = config.textColor;
            ctx.font = 'bold 20px ' + config.fontFamily;
            ctx.fillText('Último Registro', 60, y);
            y += 35;

            const summaryItems: string[] = [];
            if (latest.peso) {
                summaryItems.push(`Peso: ${latest.peso} ${latest.unidad_peso || data.weightUnit}`);
            }
            if (latest.cintura) summaryItems.push(`Cintura: ${latest.cintura} cm`);
            if (latest.cadera) summaryItems.push(`Cadera: ${latest.cadera} cm`);
            if (latest.pecho) summaryItems.push(`Pecho: ${latest.pecho} cm`);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '16px ' + config.fontFamily;
            summaryItems.forEach((item, i) => {
                ctx.fillText('• ' + item, 60, y + i * 28);
            });

            y += summaryItems.length * 28 + 40;
        }

        // ===== FOOTER =====
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '12px ' + config.fontFamily;
        ctx.textAlign = 'center';
        ctx.fillText('Generado con Awakin OS • Construyendo disciplina un día a la vez', config.width / 2, config.height - 60);
        ctx.fillText('@' + data.userName, config.width / 2, config.height - 35);

        return canvas.toDataURL('image/png', 1.0);
    }

    private async loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    private drawWeightChart(
        ctx: CanvasRenderingContext2D,
        records: ProgressMetricRecord[],
        x: number,
        y: number,
        width: number,
        height: number,
        config: ChartImageConfig,
        weightUnit: 'kg' | 'lb'
    ) {
        const validRecords = records.filter(r => r.peso != null);
        if (validRecords.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '16px ' + config.fontFamily;
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de peso', x + width / 2, y + height / 2);
            return;
        }

        const weights = validRecords.map(r => Number(r.peso));
        const minW = Math.min(...weights);
        const maxW = Math.max(...weights);

        const margin = (maxW - minW) * 0.15 || 5;
        const scaleMin = Math.max(0, minW - margin);
        const scaleMax = maxW + margin;

        const paddingX = 60;
        const paddingY = 40;
        const plotWidth = width - paddingX * 2;
        const plotHeight = height - paddingY * 2;
        const count = validRecords.length;

        // Fondo del gráfico
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, y, width, height);

        // Líneas de guía
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        const gridCount = 4;
        for (let i = 0; i <= gridCount; i++) {
            const val = scaleMin + ((scaleMax - scaleMin) * (gridCount - i)) / gridCount;
            const gy = y + paddingY + (plotHeight * i) / gridCount;
            ctx.beginPath();
            ctx.moveTo(x + paddingX, gy);
            ctx.lineTo(x + width - paddingX, gy);
            ctx.stroke();

            // Etiqueta de valor
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '11px ' + config.fontFamily;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(val).toString(), x + paddingX - 10, gy + 4);
        }

        // Área bajo la curva
        const points = validRecords.map((r, idx) => {
            const px = x + paddingX + (plotWidth * idx) / (count - 1);
            const py = y + paddingY + plotHeight * (1 - (Number(r.peso) - scaleMin) / (scaleMax - scaleMin));
            return { x: px, y: py, weight: Number(r.peso) };
        });

        if (points.length > 1) {
            // Gradiente para el área
            const areaGrad = ctx.createLinearGradient(x, y, x, y + height);
            areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

            ctx.beginPath();
            ctx.moveTo(points[0].x, y + height - paddingY);
            for (const p of points) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.lineTo(points[points.length - 1].x, y + height - paddingY);
            ctx.lineTo(points[0].x, y + height - paddingY);
            ctx.closePath();
            ctx.fillStyle = areaGrad;
            ctx.fill();

            // Línea de tendencia
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        // Puntos
        for (const p of points) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Fechas en el eje X
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px ' + config.fontFamily;
        ctx.textAlign = 'center';
        for (let i = 0; i < validRecords.length; i++) {
            const px = x + paddingX + (plotWidth * i) / (count - 1);
            const date = new Date(validRecords[i].timestamp);
            const label = date.getDate() + '/' + (date.getMonth() + 1);
            ctx.fillText(label, px, y + height - 10);
        }

        // Etiqueta de unidad
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 12px ' + config.fontFamily;
        ctx.textAlign = 'right';
        ctx.fillText(weightUnit.toUpperCase(), x + width - 10, y + paddingY - 10);
    }

    private drawMetricsChart(
        ctx: CanvasRenderingContext2D,
        records: ProgressMetricRecord[],
        x: number,
        y: number,
        width: number,
        height: number,
        config: ChartImageConfig
    ) {
        const validRecords = records.filter(r => r.cintura != null || r.cadera != null || r.pecho != null);
        if (validRecords.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '16px ' + config.fontFamily;
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de medidas', x + width / 2, y + height / 2);
            return;
        }

        const allVals: number[] = [];
        validRecords.forEach(r => {
            if (r.cintura != null) allVals.push(Number(r.cintura));
            if (r.cadera != null) allVals.push(Number(r.cadera));
            if (r.pecho != null) allVals.push(Number(r.pecho));
        });

        const minV = Math.min(...allVals);
        const maxV = Math.max(...allVals);
        const margin = (maxV - minV) * 0.15 || 10;
        const scaleMin = Math.max(0, minV - margin);
        const scaleMax = maxV + margin;

        const paddingX = 60;
        const paddingY = 40;
        const plotWidth = width - paddingX * 2;
        const plotHeight = height - paddingY * 2;
        const count = validRecords.length;

        // Fondo del gráfico
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, y, width, height);

        // Líneas de guía
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        const gridCount = 4;
        for (let i = 0; i <= gridCount; i++) {
            const val = scaleMin + ((scaleMax - scaleMin) * (gridCount - i)) / gridCount;
            const gy = y + paddingY + (plotHeight * i) / gridCount;
            ctx.beginPath();
            ctx.moveTo(x + paddingX, gy);
            ctx.lineTo(x + width - paddingX, gy);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '11px ' + config.fontFamily;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(val).toString(), x + paddingX - 10, gy + 4);
        }

        const series: { key: 'cadera' | 'cintura' | 'pecho'; color: string; label: string }[] = [
            { key: 'cadera', color: '#38bdf8', label: 'Cadera' },
            { key: 'cintura', color: '#fbbf24', label: 'Cintura' },
            { key: 'pecho', color: '#f472b6', label: 'Pecho' }
        ];

        for (const s of series) {
            const pts = validRecords
                .map((r, idx) => {
                    const val = r[s.key] != null ? Number(r[s.key]) : null;
                    if (val == null) return null;
                    const px = x + paddingX + (plotWidth * idx) / (count - 1);
                    const py = y + paddingY + plotHeight * (1 - (val - scaleMin) / (scaleMax - scaleMin));
                    return { x: px, y: py, val };
                })
                .filter((p): p is { x: number; y: number; val: number } => p !== null);

            if (pts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            }

            for (const p of pts) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Fechas en el eje X
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '11px ' + config.fontFamily;
        ctx.textAlign = 'center';
        for (let i = 0; i < validRecords.length; i++) {
            const px = x + paddingX + (plotWidth * i) / (count - 1);
            const date = new Date(validRecords[i].timestamp);
            const label = date.getDate() + '/' + (date.getMonth() + 1);
            ctx.fillText(label, px, y + height - 10);
        }

        // Leyenda
        const legendY = y + height + 25;
        const itemWidth = width / 3;
        series.forEach((s, i) => {
            const lx = x + i * itemWidth + 20;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(lx, legendY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '13px ' + config.fontFamily;
            ctx.textAlign = 'left';
            ctx.fillText(s.label, lx + 15, legendY + 5);
        });
    }
}