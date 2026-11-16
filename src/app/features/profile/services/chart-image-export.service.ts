import { Injectable } from '@angular/core';
import { ProgressMetricRecord } from '../../../core/services/athlete.service';

export interface ShareChartData {
  records: ProgressMetricRecord[];
  userName: string;
  userFullName?: string | null;
  userImageUrl: string | null;
  kinLogoUrl: string | null;
  kinName?: string | null;
  weightUnit: 'kg' | 'lb';
  includePhotos?: boolean;
  collageLayout?: 'cards' | 'fullbleed';
  tmbKcal?: number | null;
  omitMetricsBackdrop?: boolean;
  metricsBackdropXRatio?: number; // 0..1 (centro X relativo al ancho)
  metricsBackdropYRatio?: number; // 0..1 (top Y relativo al alto)
}

@Injectable({ providedIn: 'root' })
export class ChartImageExportService {
  private readonly WIDTH = 1080;
  private readonly HEIGHT = 1920;
  private readonly FONT = 'Inter, system-ui, -apple-system, sans-serif';

  // Awakin Light Theme Palette
  private readonly BG_COLOR = '#FAFAF9';
  private readonly CARD_BG = '#FFFFFF';
  private readonly BORDER_COLOR = '#E7E5E4';
  private readonly TEXT_PRIMARY = '#1C1917';
  private readonly TEXT_SECONDARY = '#57534E';
  private readonly TEXT_MUTED = '#A8A29E';
  private readonly AWAKIN_SUN = '#FE970A';
  private readonly EMERALD = '#10B981';
  private readonly SKY = '#0EA5E9';
  private readonly PINK = '#EC4899';

  /**
   * Genera una imagen 9:16 (1080x1920) estilo Awakin Light con:
   * - Logo Awakin superpuesto con el logo del Kin (si pertenece a uno)
   * - Collage de 1 a 4 logs con sus 3 fotos (Frontal, Lateral, Espalda) o gráficos si includePhotos = false
   * - Comparación de medidas / logros (Inicio vs Actual)
   * - Avatar y nombre del usuario
   */
  async generateShareImage(data: ShareChartData): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = this.WIDTH;
    canvas.height = this.HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No se pudo crear el contexto del canvas');
    }

    // Orden cronológico (antiguo -> nuevo) para que ANTES esté arriba y AHORA abajo
    const sortedRecords = [...data.records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 1. Fondo Awakin Light con sutil glow cálido Awakin Sun
    ctx.fillStyle = this.BG_COLOR;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    const sunGlow = ctx.createRadialGradient(this.WIDTH / 2, 0, 40, this.WIDTH / 2, 0, 750);
    sunGlow.addColorStop(0, 'rgba(254, 151, 10, 0.14)');
    sunGlow.addColorStop(0.6, 'rgba(254, 151, 10, 0.04)');
    sunGlow.addColorStop(1, 'rgba(254, 151, 10, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, this.WIDTH, 760);

    // Cargar logos en paralelo
    const [awakinLogo, kinLogo, userAvatar] = await Promise.all([
      this.safeLoadImage('/icons/awakin-isotipo.png'),
      data.kinLogoUrl ? this.safeLoadImage(data.kinLogoUrl) : Promise.resolve(null),
      data.userImageUrl ? this.safeLoadImage(data.userImageUrl) : Promise.resolve(null)
    ]);

    // Si es collage full-bleed (estilo IG Layout sin espacios entre fotos)
    if (data.includePhotos && data.collageLayout === 'fullbleed') {
      await this.renderFullBleedCollage(ctx, sortedRecords, awakinLogo, kinLogo, userAvatar, data);
      return canvas.toDataURL('image/png', 0.95);
    }

    // 2. Header (Awakin Logo + Kin Logo superpuesto + Título)
    const headerBottomY = this.drawHeader(ctx, awakinLogo, kinLogo, data.kinName);

    // Definir área útil entre header y bloque inferior (medidas + footer)
    const footerHeight = 140;
    const metricsCardHeight = 250;
    const bottomReserved = footerHeight + metricsCardHeight + 50;
    const contentTopY = headerBottomY + 24;
    const contentAvailableHeight = this.HEIGHT - bottomReserved - contentTopY;

    // 3. Cuerpo principal: Collage de Fotos o Gráficos
    if (data.includePhotos) {
      await this.drawPhotoCollage(ctx, sortedRecords, contentTopY, contentAvailableHeight);
    } else {
      this.drawChartsView(ctx, sortedRecords, contentTopY, contentAvailableHeight, data.weightUnit);
    }

    // 4. Card de Comparación de Medidas / Logros
    const metricsY = this.HEIGHT - footerHeight - metricsCardHeight - 24;
    this.drawMetricsComparisonCard(ctx, sortedRecords, 54, metricsY, this.WIDTH - 108, metricsCardHeight, data.weightUnit, data.tmbKcal);

    // 5. Footer con Avatar + Nombre + Marca
    this.drawFooter(ctx, userAvatar, data.userName, data.userFullName);

    return canvas.toDataURL('image/png', 0.95);
  }

  private drawHeader(
    ctx: CanvasRenderingContext2D,
    awakinLogo: HTMLImageElement | null,
    kinLogo: HTMLImageElement | null,
    kinName?: string | null
  ): number {
    const startY = 64;
    const logoSize = 84;
    const logoX = 60;

    // Logo de Awakin (PNG sin fondo y sin recortes)
    ctx.save();
    if (awakinLogo) {
      this.drawImageContain(ctx, awakinLogo, logoX, startY, logoSize, logoSize);
    } else {
      ctx.fillStyle = this.AWAKIN_SUN;
      ctx.font = `900 34px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', logoX + logoSize / 2, startY + logoSize / 2);
    }
    ctx.restore();

    // Logo del Kin superpuesto (PNG sin fondo y sin recortes, solo si pertenece a uno)
    if (kinLogo) {
      const badgeSize = 52;
      const badgeX = logoX + logoSize - badgeSize / 2 + 4;
      const badgeY = startY + logoSize - badgeSize / 2 + 2;

      ctx.save();
      this.drawImageContain(ctx, kinLogo, badgeX, badgeY, badgeSize, badgeSize);
      ctx.restore();
    }

    // Título y Subtítulo
    const textX = logoX + logoSize + (kinLogo ? 36 : 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = this.AWAKIN_SUN;
    ctx.font = `900 18px ${this.FONT}`;
    const brandTag = kinLogo && kinName ? `AWAKIN  ×  ${kinName.toUpperCase()}` : 'AWAKIN';
    ctx.fillText(brandTag, textX, startY + 28);

    ctx.fillStyle = this.TEXT_PRIMARY;
    ctx.font = `900 44px ${this.FONT}`;
    ctx.fillText('MI PROGRESO', textX, startY + 76);

    // Línea divisoria sutil
    const lineY = startY + logoSize + 28;
    ctx.strokeStyle = this.BORDER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(54, lineY);
    ctx.lineTo(this.WIDTH - 54, lineY);
    ctx.stroke();

    return lineY;
  }

  private async drawPhotoCollage(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    topY: number,
    availableHeight: number
  ): Promise<void> {
    const count = records.length;
    const sidePadding = 54;
    const gridWidth = this.WIDTH - sidePadding * 2;
    const colGap = 18;
    const cardWidth = (gridWidth - colGap * 2) / 3;
    const rowGap = count >= 3 ? 22 : 34;
    const labelHeight = 38;

    // Altura máxima por fila respetando aspect ratio 3:4 y espacio disponible
    const maxRowHeight = (availableHeight - rowGap * (count - 1)) / count;
    const idealPhotoHeight = cardWidth * (4 / 3);
    const photoHeight = Math.min(idealPhotoHeight, maxRowHeight - labelHeight);
    const photoWidth = count >= 3 ? Math.min(cardWidth, photoHeight * (3 / 4)) : cardWidth;

    const totalRowHeight = labelHeight + photoHeight;
    const totalContentHeight = count * totalRowHeight + (count - 1) * rowGap;
    let currentY = topY + Math.max(0, (availableHeight - totalContentHeight) / 2);

    for (let i = 0; i < count; i++) {
      const rec = records[i];
      const dateText = this.formatDateSpanish(rec.timestamp).toUpperCase();
      let rowTitle = dateText;
      if (count === 2) {
        rowTitle = i === 0 ? `ANTES  •  ${dateText}` : `AHORA  •  ${dateText}`;
      } else if (count > 2) {
        if (i === 0) rowTitle = `INICIO  •  ${dateText}`;
        else if (i === count - 1) rowTitle = `ACTUAL  •  ${dateText}`;
      }

      // Pill de fecha / etapa
      ctx.save();
      ctx.font = `800 20px ${this.FONT}`;
      const textWidth = ctx.measureText(rowTitle).width;
      const pillW = textWidth + 36;
      const pillH = 30;
      const pillX = (this.WIDTH - pillW) / 2;

      const isLatest = i === count - 1;
      this.roundRect(ctx, pillX, currentY, pillW, pillH, 15);
      ctx.fillStyle = isLatest ? 'rgba(254, 151, 10, 0.14)' : '#F5F5F4';
      ctx.fill();
      ctx.strokeStyle = isLatest ? 'rgba(254, 151, 10, 0.45)' : this.BORDER_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isLatest ? '#C2410C' : this.TEXT_SECONDARY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rowTitle, this.WIDTH / 2, currentY + pillH / 2 + 1);
      ctx.restore();

      const photosY = currentY + labelHeight;
      const rowTotalW = photoWidth * 3 + colGap * 2;
      const startX = (this.WIDTH - rowTotalW) / 2;

      const photoSlots: Array<{ label: string; url?: string | null }> = [
        { label: 'FRONTAL', url: rec.foto_frontal_url },
        { label: 'LATERAL', url: rec.foto_lateral_url },
        { label: 'ESPALDA', url: rec.foto_espalda_url }
      ];

      const loadedPhotos = await Promise.all(
        photoSlots.map(slot => (slot.url ? this.safeLoadImage(slot.url) : Promise.resolve(null)))
      );

      for (let col = 0; col < 3; col++) {
        const px = startX + col * (photoWidth + colGap);
        const py = photosY;
        const img = loadedPhotos[col];

        ctx.save();
        // Sombra sutil
        ctx.shadowColor = 'rgba(28, 25, 23, 0.08)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        this.roundRect(ctx, px, py, photoWidth, photoHeight, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();

        ctx.save();
        this.roundRect(ctx, px, py, photoWidth, photoHeight, 20);
        ctx.clip();

        if (img) {
          this.drawImageCover(ctx, img, px, py, photoWidth, photoHeight);
          // Gradiente oscuro sutil abajo para legibilidad del tag
          const grad = ctx.createLinearGradient(0, py + photoHeight - 54, 0, py + photoHeight);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.62)');
          ctx.fillStyle = grad;
          ctx.fillRect(px, py + photoHeight - 54, photoWidth, 54);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `800 14px ${this.FONT}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(photoSlots[col].label, px + 14, py + photoHeight - 12);
        } else {
          ctx.fillStyle = '#F5F5F4';
          ctx.fillRect(px, py, photoWidth, photoHeight);
          ctx.fillStyle = this.TEXT_MUTED;
          ctx.font = `700 15px ${this.FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(photoSlots[col].label, px + photoWidth / 2, py + photoHeight / 2 - 10);
          ctx.font = `500 13px ${this.FONT}`;
          ctx.fillText('Sin foto', px + photoWidth / 2, py + photoHeight / 2 + 14);
        }
        ctx.restore();

        // Borde crisp
        ctx.save();
        this.roundRect(ctx, px, py, photoWidth, photoHeight, 20);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = this.BORDER_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      currentY += totalRowHeight + rowGap;
    }
  }

  private drawChartsView(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    topY: number,
    availableHeight: number,
    weightUnit: 'kg' | 'lb'
  ): void {
    const padX = 54;
    const cardW = this.WIDTH - padX * 2;
    const gap = 28;
    const cardH = Math.min(460, (availableHeight - gap) / 2);
    const totalH = cardH * 2 + gap;
    const startY = topY + Math.max(0, (availableHeight - totalH) / 2);

    // Card 1: Evolución de Peso
    this.drawLightCard(ctx, padX, startY, cardW, cardH);
    ctx.fillStyle = this.TEXT_PRIMARY;
    ctx.font = `800 26px ${this.FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Evolución de Peso (${weightUnit.toUpperCase()})`, padX + 32, startY + 48);

    this.drawWeightChartLight(ctx, records, padX + 28, startY + 72, cardW - 56, cardH - 100, weightUnit);

    // Card 2: Medidas Corporales
    const card2Y = startY + cardH + gap;
    this.drawLightCard(ctx, padX, card2Y, cardW, cardH);
    ctx.fillStyle = this.TEXT_PRIMARY;
    ctx.font = `800 26px ${this.FONT}`;
    ctx.fillText('Medidas Corporales (cm)', padX + 32, card2Y + 48);

    this.drawMetricsChartLight(ctx, records, padX + 28, card2Y + 72, cardW - 56, cardH - 132);

    // Leyenda inferior
    const legendY = card2Y + cardH - 28;
    const items = [
      { label: 'Cadera', color: this.SKY },
      { label: 'Cintura', color: this.AWAKIN_SUN },
      { label: 'Pecho', color: this.PINK }
    ];
    let lx = this.WIDTH / 2 - 190;
    ctx.font = `700 18px ${this.FONT}`;
    ctx.textBaseline = 'middle';
    items.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(lx, legendY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.TEXT_SECONDARY;
      ctx.fillText(item.label, lx + 16, legendY);
      lx += 135;
    });
  }

  private drawWeightChartLight(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    x: number,
    y: number,
    width: number,
    height: number,
    unit: 'kg' | 'lb'
  ): void {
    const pts = records
      .filter(r => r.peso != null && r.peso > 0)
      .map(r => ({
        val: this.convertWeight(r.peso!, r.unidad_peso, unit),
        date: this.formatShortDate(r.timestamp)
      }));

    if (pts.length === 0) {
      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `600 20px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Sin registros de peso', x + width / 2, y + height / 2);
      return;
    }

    const minV = Math.min(...pts.map(p => p.val));
    const maxV = Math.max(...pts.map(p => p.val));
    const pad = Math.max((maxV - minV) * 0.25, 2);
    const yMin = Math.floor(minV - pad);
    const yMax = Math.ceil(maxV + pad);
    const range = Math.max(yMax - yMin, 1);

    const padL = 62;
    const padR = 24;
    const padT = 16;
    const padB = 38;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // Gridlines
    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      const ly = y + padT + plotH - ratio * plotH;
      const lVal = Math.round(yMin + ratio * range);

      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x + padL, ly);
      ctx.lineTo(x + padL + plotW, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `700 16px ${this.FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(lVal.toString(), x + padL - 12, ly);
    }

    const coords = pts.map((p, i) => ({
      px: x + padL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW),
      py: y + padT + plotH - ((p.val - yMin) / range) * plotH,
      val: p.val,
      date: p.date
    }));

    // Área
    if (coords.length > 1) {
      const grad = ctx.createLinearGradient(0, y + padT, 0, y + padT + plotH);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(coords[0].px, y + padT + plotH);
      coords.forEach(c => ctx.lineTo(c.px, c.py));
      ctx.lineTo(coords[coords.length - 1].px, y + padT + plotH);
      ctx.closePath();
      ctx.fill();

      // Línea
      ctx.strokeStyle = this.EMERALD;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.px, c.py) : ctx.lineTo(c.px, c.py)));
      ctx.stroke();
    }

    // Puntos + etiquetas
    coords.forEach(c => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(c.px, c.py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.EMERALD;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = this.TEXT_PRIMARY;
      ctx.font = `800 16px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${c.val.toFixed(1)}`, c.px, c.py - 12);

      ctx.fillStyle = this.TEXT_SECONDARY;
      ctx.font = `700 15px ${this.FONT}`;
      ctx.textBaseline = 'top';
      ctx.fillText(c.date, c.px, y + padT + plotH + 12);
    });
  }

  private drawMetricsChartLight(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const valid = records.filter(r => r.cadera || r.cintura || r.pecho);
    if (valid.length === 0) {
      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `600 20px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Sin registros de medidas corporales', x + width / 2, y + height / 2);
      return;
    }

    const allVals: number[] = [];
    valid.forEach(r => {
      if (r.cadera) allVals.push(r.cadera);
      if (r.cintura) allVals.push(r.cintura);
      if (r.pecho) allVals.push(r.pecho);
    });

    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const pad = Math.max((maxV - minV) * 0.2, 4);
    const yMin = Math.floor(minV - pad);
    const yMax = Math.ceil(maxV + pad);
    const range = Math.max(yMax - yMin, 1);

    const padL = 62;
    const padR = 24;
    const padT = 16;
    const padB = 34;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      const ly = y + padT + plotH - ratio * plotH;
      const lVal = Math.round(yMin + ratio * range);

      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x + padL, ly);
      ctx.lineTo(x + padL + plotW, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `700 16px ${this.FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(lVal.toString(), x + padL - 12, ly);
    }

    const drawSeries = (getter: (r: ProgressMetricRecord) => number | null | undefined, color: string) => {
      const pts: Array<{ px: number; py: number; date: string }> = [];
      valid.forEach((r, i) => {
        const val = getter(r);
        if (val != null && val > 0) {
          pts.push({
            px: x + padL + (valid.length === 1 ? plotW / 2 : (i / (valid.length - 1)) * plotW),
            py: y + padT + plotH - ((val - yMin) / range) * plotH,
            date: this.formatShortDate(r.timestamp)
          });
        }
      });

      if (pts.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
        ctx.stroke();
      }

      pts.forEach(p => {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.px, p.py, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      });
    };

    drawSeries(r => r.cadera, this.SKY);
    drawSeries(r => r.cintura, this.AWAKIN_SUN);
    drawSeries(r => r.pecho, this.PINK);

    // Fechas eje X
    valid.forEach((r, i) => {
      const px = x + padL + (valid.length === 1 ? plotW / 2 : (i / (valid.length - 1)) * plotW);
      ctx.fillStyle = this.TEXT_SECONDARY;
      ctx.font = `700 15px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(this.formatShortDate(r.timestamp), px, y + padT + plotH + 10);
    });
  }

  private drawMetricsComparisonCard(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    x: number,
    y: number,
    width: number,
    height: number,
    weightUnit: 'kg' | 'lb',
    tmbKcal?: number | null
  ): void {
    this.drawLightCard(ctx, x, y, width, height);

    const isComparison = records.length >= 2;
    const first = records[0];
    const last = records[records.length - 1];

    // Título del bloque
    ctx.fillStyle = this.TEXT_PRIMARY;
    ctx.font = `900 22px ${this.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(isComparison ? 'LOGROS  •  INICIO VS ACTUAL' : 'MIS MEDIDAS', x + width / 2, y + 46);

    // Construir columnas dinámicas
    interface MetricCell {
      label: string;
      value: string;
      delta?: string;
      deltaGood?: boolean;
    }

    const cells: MetricCell[] = [];

    if (last?.peso) {
      const lastW = this.convertWeight(last.peso, last.unidad_peso, weightUnit);
      let delta: string | undefined;
      let deltaGood = true;
      if (isComparison && first?.peso) {
        const firstW = this.convertWeight(first.peso, first.unidad_peso, weightUnit);
        const diff = Number((lastW - firstW).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} ${weightUnit}`;
        deltaGood = diff <= 0;
      }
      cells.push({
        label: 'PESO',
        value: `${lastW.toFixed(1)} ${weightUnit}`,
        delta,
        deltaGood
      });
    }

    if (last?.cintura) {
      let delta: string | undefined;
      let deltaGood = true;
      if (isComparison && first?.cintura) {
        const diff = Number((last.cintura - first.cintura).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
        deltaGood = diff <= 0;
      }
      cells.push({
        label: 'CINTURA',
        value: `${last.cintura} cm`,
        delta,
        deltaGood
      });
    }

    if (last?.cadera) {
      let delta: string | undefined;
      if (isComparison && first?.cadera) {
        const diff = Number((last.cadera - first.cadera).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
      }
      cells.push({
        label: 'CADERA',
        value: `${last.cadera} cm`,
        delta,
        deltaGood: true
      });
    }

    if (last?.pecho) {
      let delta: string | undefined;
      if (isComparison && first?.pecho) {
        const diff = Number((last.pecho - first.pecho).toFixed(1));
        delta = `${diff > 0 ? '+' : ''}${diff} cm`;
      }
      cells.push({
        label: 'PECHO',
        value: `${last.pecho} cm`,
        delta,
        deltaGood: true
      });
    }

    if (tmbKcal && cells.length < 4) {
      cells.push({
        label: 'TMB ACTUAL',
        value: `${tmbKcal} kcal`
      });
    }

    if (cells.length === 0) {
      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `600 20px ${this.FONT}`;
      ctx.fillText('Sin medidas registradas en los check-ins seleccionados', x + width / 2, y + height / 2 + 12);
      return;
    }

    const colW = (width - 40) / cells.length;
    const startX = x + 20;
    const centerY = y + 132;

    cells.forEach((cell, idx) => {
      const cx = startX + colW * idx + colW / 2;

      // Separador vertical sutil entre columnas
      if (idx > 0) {
        ctx.strokeStyle = '#F5F5F4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX + colW * idx, y + 76);
        ctx.lineTo(startX + colW * idx, y + height - 28);
        ctx.stroke();
      }

      ctx.fillStyle = this.TEXT_MUTED;
      ctx.font = `800 17px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(cell.label, cx, centerY - 34);

      ctx.fillStyle = this.TEXT_PRIMARY;
      ctx.font = `900 36px ${this.FONT}`;
      ctx.fillText(cell.value, cx, centerY + 12);

      if (cell.delta) {
        ctx.fillStyle = cell.deltaGood ? this.EMERALD : this.AWAKIN_SUN;
        ctx.font = `800 20px ${this.FONT}`;
        ctx.fillText(cell.delta, cx, centerY + 48);
      }
    });
  }

  private drawFooter(
    ctx: CanvasRenderingContext2D,
    userAvatar: HTMLImageElement | null,
    userName: string,
    userFullName?: string | null
  ): void {
    const footerCenterY = this.HEIGHT - 78;
    const avatarSize = 68;
    const handleText = `@${userName.replace(/^@/, '')}`;

    ctx.font = `800 26px ${this.FONT}`;
    const textW = ctx.measureText(handleText).width;
    const totalW = avatarSize + 18 + textW;
    const startX = (this.WIDTH - totalW) / 2;

    // Avatar circular con borde Awakin Sun
    const avCenterX = startX + avatarSize / 2;
    const avCenterY = footerCenterY;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCenterX, avCenterY, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = this.AWAKIN_SUN;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(avCenterX, avCenterY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();

    if (userAvatar) {
      this.drawImageCover(ctx, userAvatar, startX, avCenterY - avatarSize / 2, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = '#FED7AA';
      ctx.fillRect(startX, avCenterY - avatarSize / 2, avatarSize, avatarSize);
      ctx.fillStyle = '#C2410C';
      ctx.font = `900 26px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((userFullName || userName).charAt(0).toUpperCase(), avCenterX, avCenterY);
    }
    ctx.restore();

    // Username
    ctx.fillStyle = this.TEXT_PRIMARY;
    ctx.font = `800 26px ${this.FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(handleText, startX + avatarSize + 18, footerCenterY);
  }

  private drawLightCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    this.roundRect(ctx, x, y, w, h, 28);
    ctx.fillStyle = this.CARD_BG;
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.roundRect(ctx, x, y, w, h, 28);
    ctx.strokeStyle = this.BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;

    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  private drawImageContain(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let drawW = w;
    let drawH = h;

    if (imgRatio > boxRatio) {
      drawH = w / imgRatio;
    } else {
      drawW = h * imgRatio;
    }

    const dx = x + (w - drawW) / 2;
    const dy = y + (h - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Versión IG Layout Full-Bleed:
   * - Todas las fotos juntas rellenando el 100% del lienzo 9:16 (sin espacios ni labels Frontal/Lateral/Espalda)
   * - Logos de Awakin + Kin superpuestos en overlay arriba
   * - Fechas de cada log en overlay alineadas a la derecha
   * - Backdrop translúcido abajo con comparación de medidas/logros y avatar/nombre del usuario
   */
  private async renderFullBleedCollage(
    ctx: CanvasRenderingContext2D,
    records: ProgressMetricRecord[],
    awakinLogo: HTMLImageElement | null,
    kinLogo: HTMLImageElement | null,
    userAvatar: HTMLImageElement | null,
    data: ShareChartData
  ): Promise<void> {
    const count = records.length;
    const rowH = this.HEIGHT / count;
    const colW = this.WIDTH / 3;

    // 1. Dibujar todas las fotos edge-to-edge sin ningún espacio ni borde
    for (let i = 0; i < count; i++) {
      const rec = records[i];
      const rowY = i * rowH;
      const urls = [rec.foto_frontal_url, rec.foto_lateral_url, rec.foto_espalda_url];
      const imgs = await Promise.all(urls.map(u => (u ? this.safeLoadImage(u) : Promise.resolve(null))));

      for (let col = 0; col < 3; col++) {
        const cx = col * colW;
        const img = imgs[col];

        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, rowY, Math.ceil(colW) + 1, Math.ceil(rowH) + 1);
        ctx.clip();

        if (img) {
          this.drawImageCover(ctx, img, cx, rowY, colW, rowH);
        } else {
          ctx.fillStyle = '#1C1917';
          ctx.fillRect(cx, rowY, colW, rowH);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.font = `600 18px ${this.FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Sin foto', cx + colW / 2, rowY + rowH / 2);
        }
        ctx.restore();
      }
    }

    // 2. Scrim degradado superior para legibilidad del header overlay
    const topScrim = ctx.createLinearGradient(0, 0, 0, 250);
    topScrim.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    topScrim.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
    topScrim.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, this.WIDTH, 250);

    // 3. Scrim degradado inferior para legibilidad del backdrop y footer
    const bottomScrim = ctx.createLinearGradient(0, this.HEIGHT - 560, 0, this.HEIGHT);
    bottomScrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomScrim.addColorStop(0.45, 'rgba(0, 0, 0, 0.42)');
    bottomScrim.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
    ctx.fillStyle = bottomScrim;
    ctx.fillRect(0, this.HEIGHT - 560, this.WIDTH, 560);

    // 4. Overlay Logos Awakin + Kin arriba a la izquierda (PNG sin fondo y sin recortes)
    const startY = 52;
    const logoSize = 76;
    const logoX = 48;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    if (awakinLogo) {
      this.drawImageContain(ctx, awakinLogo, logoX, startY, logoSize, logoSize);
    } else {
      ctx.fillStyle = this.AWAKIN_SUN;
      ctx.font = `900 32px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', logoX + logoSize / 2, startY + logoSize / 2);
    }
    ctx.restore();

    if (kinLogo) {
      const badgeSize = 48;
      const badgeX = logoX + logoSize - badgeSize / 2 + 2;
      const badgeY = startY + logoSize - badgeSize / 2 + 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10;
      this.drawImageContain(ctx, kinLogo, badgeX, badgeY, badgeSize, badgeSize);
      ctx.restore();
    }

    const textX = logoX + logoSize + (kinLogo ? 32 : 20);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.AWAKIN_SUN;
    ctx.font = `900 17px ${this.FONT}`;
    const brandTag = kinLogo && data.kinName ? `AWAKIN  ×  ${data.kinName.toUpperCase()}` : 'AWAKIN';
    ctx.fillText(brandTag, textX, startY + 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 34px ${this.FONT}`;
    ctx.fillText('MI PROGRESO', textX, startY + 66);
    ctx.restore();

    // 5. Fechas overlay sobre cada fila de fotos alineadas a la derecha
    for (let i = 0; i < count; i++) {
      const rec = records[i];
      const rowY = i * rowH;
      const dateText = this.formatDateSpanish(rec.timestamp).toUpperCase();
      let rowLabel = dateText;
      if (count === 2) {
        rowLabel = i === 0 ? `ANTES • ${dateText}` : `AHORA • ${dateText}`;
      } else if (count > 2) {
        if (i === 0) rowLabel = `INICIO • ${dateText}`;
        else if (i === count - 1) rowLabel = `ACTUAL • ${dateText}`;
      }

      const isLatest = i === count - 1;
      ctx.save();
      ctx.font = `800 18px ${this.FONT}`;
      const labelW = ctx.measureText(rowLabel).width;
      const pillW = labelW + 32;
      const pillH = 38;
      const pillX = this.WIDTH - 36 - pillW;
      const pillY = rowY + (i === 0 ? 64 : 24);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 12;
      this.roundRect(ctx, pillX, pillY, pillW, pillH, 19);
      ctx.fillStyle = 'rgba(28, 25, 23, 0.62)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isLatest ? 'rgba(254, 151, 10, 0.85)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isLatest ? '#FDBA74' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rowLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);
      ctx.restore();
    }

    // 6. Backdrop translúcido posicionable con Logros y Comparación de Medidas
    if (!data.omitMetricsBackdrop) {
      const cardW = this.WIDTH - 88;
      const cardH = 228;
      const xRatio = data.metricsBackdropXRatio ?? 0.5;
      const yRatio = data.metricsBackdropYRatio ?? (this.HEIGHT - 122 - cardH - 18) / this.HEIGHT;

      const rawCardX = xRatio * this.WIDTH - cardW / 2;
      const rawCardY = yRatio * this.HEIGHT;
      const cardX = Math.max(20, Math.min(this.WIDTH - cardW - 20, rawCardX));
      const cardY = Math.max(150, Math.min(this.HEIGHT - cardH - 120, rawCardY));

      // Efecto backdrop-blur-xs totalmente transparente (sin relleno negro ni de color)
      const blurPad = 12;
      const sx = Math.max(0, cardX - blurPad);
      const sy = Math.max(0, cardY - blurPad);
      const sw = Math.min(this.WIDTH - sx, cardW + blurPad * 2);
      const sh = Math.min(this.HEIGHT - sy, cardH + blurPad * 2);

      const snap = document.createElement('canvas');
      snap.width = sw;
      snap.height = sh;
      const snapCtx = snap.getContext('2d');
      if (snapCtx) {
        snapCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.save();
        this.roundRect(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.clip();
        ctx.filter = 'blur(4px)';
        ctx.drawImage(snap, 0, 0, sw, sh, sx, sy, sw, sh);
        ctx.filter = 'none';
        ctx.restore();
      }

      ctx.save();
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 28);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      const isComparison = records.length >= 2;
      const first = records[0];
      const last = records[records.length - 1];

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = this.AWAKIN_SUN;
      ctx.font = `900 20px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(isComparison ? 'LOGROS  •  INICIO VS ACTUAL' : 'MIS MEDIDAS', cardX + cardW / 2, cardY + 42);
      ctx.restore();

      interface OverlayCell {
        label: string;
        value: string;
        delta?: string;
        deltaGood?: boolean;
      }

      const cells: OverlayCell[] = [];

      if (last?.peso) {
        const lastW = this.convertWeight(last.peso, last.unidad_peso, data.weightUnit);
        let delta: string | undefined;
        let deltaGood = true;
        if (isComparison && first?.peso) {
          const firstW = this.convertWeight(first.peso, first.unidad_peso, data.weightUnit);
          const diff = Number((lastW - firstW).toFixed(1));
          delta = `${diff > 0 ? '+' : ''}${diff} ${data.weightUnit}`;
          deltaGood = diff <= 0;
        }
        cells.push({ label: 'PESO', value: `${lastW.toFixed(1)} ${data.weightUnit}`, delta, deltaGood });
      }

      if (last?.cintura) {
        let delta: string | undefined;
        let deltaGood = true;
        if (isComparison && first?.cintura) {
          const diff = Number((last.cintura - first.cintura).toFixed(1));
          delta = `${diff > 0 ? '+' : ''}${diff} cm`;
          deltaGood = diff <= 0;
        }
        cells.push({ label: 'CINTURA', value: `${last.cintura} cm`, delta, deltaGood });
      }

      if (last?.cadera) {
        let delta: string | undefined;
        if (isComparison && first?.cadera) {
          const diff = Number((last.cadera - first.cadera).toFixed(1));
          delta = `${diff > 0 ? '+' : ''}${diff} cm`;
        }
        cells.push({ label: 'CADERA', value: `${last.cadera} cm`, delta, deltaGood: true });
      }

      if (last?.pecho) {
        let delta: string | undefined;
        if (isComparison && first?.pecho) {
          const diff = Number((last.pecho - first.pecho).toFixed(1));
          delta = `${diff > 0 ? '+' : ''}${diff} cm`;
        }
        cells.push({ label: 'PECHO', value: `${last.pecho} cm`, delta, deltaGood: true });
      }

      if (data.tmbKcal && cells.length < 4) {
        cells.push({ label: 'TMB ACTUAL', value: `${data.tmbKcal} kcal` });
      }

      if (cells.length > 0) {
        const colWidth = (cardW - 32) / cells.length;
        const startX = cardX + 16;
        const centerY = cardY + 124;

        cells.forEach((cell, idx) => {
          const cx = startX + colWidth * idx + colWidth / 2;
          if (idx > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(startX + colWidth * idx, cardY + 70);
            ctx.lineTo(startX + colWidth * idx, cardY + cardH - 24);
            ctx.stroke();
          }

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 8;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.font = `800 16px ${this.FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(cell.label, cx, centerY - 30);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `900 34px ${this.FONT}`;
          ctx.fillText(cell.value, cx, centerY + 12);

          if (cell.delta) {
            ctx.fillStyle = cell.deltaGood ? '#34D399' : '#FBBF24';
            ctx.font = `800 19px ${this.FONT}`;
            ctx.fillText(cell.delta, cx, centerY + 46);
          }
          ctx.restore();
        });
      }
    }

    // 7. Footer Avatar + Nombre en Overlay blanco
    const footerCenterY = this.HEIGHT - 68;
    const avatarSize = 62;
    const handleText = `@${data.userName.replace(/^@/, '')}`;

    ctx.font = `800 25px ${this.FONT}`;
    const textW = ctx.measureText(handleText).width;
    const totalW = avatarSize + 16 + textW;
    const fStartX = (this.WIDTH - totalW) / 2;
    const avCenterX = fStartX + avatarSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCenterX, footerCenterY, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = this.AWAKIN_SUN;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(avCenterX, footerCenterY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();

    if (userAvatar) {
      this.drawImageCover(ctx, userAvatar, fStartX, footerCenterY - avatarSize / 2, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = this.AWAKIN_SUN;
      ctx.fillRect(fStartX, footerCenterY - avatarSize / 2, avatarSize, avatarSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 24px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((data.userFullName || data.userName).charAt(0).toUpperCase(), avCenterX, footerCenterY);
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 25px ${this.FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(handleText, fStartX + avatarSize + 16, footerCenterY);
    ctx.restore();
  }

  private async safeLoadImage(url: string): Promise<HTMLImageElement | null> {
    if (!url) return null;
    try {
      // Cargar vía fetch CORS -> Blob -> ObjectURL para evitar tainted canvas
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = await this.loadImgElement(objectUrl, false);
          return img;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch {
      // Fallback directo si es asset local o CORS estándar
    }

    try {
      return await this.loadImgElement(url, !url.startsWith('/'));
    } catch {
      return null;
    }
  }

  private loadImgElement(src: string, useCrossOrigin: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (useCrossOrigin) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private convertWeight(val: number, fromUnit: string | undefined, toUnit: 'kg' | 'lb'): number {
    const f = (fromUnit || 'lb').toLowerCase();
    if (f === toUnit) return val;
    return toUnit === 'kg' ? val * 0.453592 : val * 2.20462;
  }

  private formatDateSpanish(timestamp: string): string {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return timestamp;
    }
  }

  private formatShortDate(timestamp: string): string {
    try {
      const d = new Date(timestamp);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return timestamp;
    }
  }
}
