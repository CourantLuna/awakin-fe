import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ACTIVITY_LEVELS, AthleteService } from '../../core/services/athlete.service';
import { ThemeService } from '../../core/services/theme.service';
import { DietTypeOption, OnboardingService } from '../../core/services/onboarding.service';

export interface TimelineWeekPoint {
  week: number;
  label: string;
  weight: number;
  deltaWeight: number;
  estBodyFatDeltaPct: number;
  estMuscleNote: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent implements OnInit {
  public authService = inject(AuthService);
  public athleteService = inject(AthleteService);
  public themeService = inject(ThemeService);
  private onboardingService = inject(OnboardingService);

  public readonly totalSteps = 9;
  public currentStep = signal<number>(1);
  public isSubmitting = signal<boolean>(false);
  public submitError = signal<string | null>(null);
  public stepError = signal<string | null>(null);

  // Catálogos
  public readonly activityLevels = ACTIVITY_LEVELS;
  public dietTypes = signal<DietTypeOption[]>([]);

  public readonly protocolOptions = [
    {
      key: 'DEFICIT' as const,
      title: 'Déficit Calórico',
      subtitle: 'Perder grasa preservando masa muscular',
      icon: 'pi-arrow-down-right',
      badge: 'Quema de grasa',
    },
    {
      key: 'RECOMPOSITION' as const,
      title: 'Recomposición',
      subtitle: 'Reducir grasa y ganar músculo gradualmente',
      icon: 'pi-sync',
      badge: 'Equilibrio',
    },
    {
      key: 'MAINTENANCE' as const,
      title: 'Mantenimiento',
      subtitle: 'Sostener peso actual, energía y rendimiento',
      icon: 'pi-arrows-h',
      badge: 'Estabilidad',
    },
    {
      key: 'SURPLUS' as const,
      title: 'Superávit Calórico',
      subtitle: 'Ganar masa muscular y fuerza progresiva',
      icon: 'pi-arrow-up-right',
      badge: 'Volumen',
    },
  ];

  public readonly mealTypeOptions = [
    { key: 'DESAYUNO', label: 'Desayuno', icon: '☀️' },
    { key: 'MERIENDA_AM', label: 'Merienda AM', icon: '🍎' },
    { key: 'ALMUERZO', label: 'Almuerzo', icon: '🍽️' },
    { key: 'MERIENDA_PM', label: 'Merienda PM', icon: '🥜' },
    { key: 'CENA', label: 'Cena', icon: '🌙' },
  ];

  public readonly proteinOptions = [
    'Pechuga de pollo',
    'Huevos enteros / claras',
    'Carne de res magra',
    'Salmón',
    'Atún',
    'Pescado blanco / Tilapia',
    'Camarones / Mariscos',
    'Pavo',
    'Lomo de cerdo',
    'Yogurt griego',
    'Queso cottage / Ricotta',
    'Proteína Whey / Vegetal',
    'Tofu / Tempeh',
    'Lentejas / Garbanzos',
  ];

  public readonly carbOptions = [
    'Arroz blanco / integral',
    'Avena',
    'Papa / Patata',
    'Batata / Camote',
    'Plátano maduro / verde',
    'Yuca',
    'Pasta / Fideos',
    'Pan integral / masa madre',
    'Tortillas de maíz / trigo',
    'Quinoa',
    'Frutas (banano, fresas, manzana)',
    'Habichuelas / Frijoles',
    'Maíz / Elote',
    'Cuscús / Granola',
  ];

  public readonly fatOptions = [
    'Aguacate',
    'Aceite de oliva extra virgen',
    'Mantequilla de maní',
    'Almendras',
    'Nueces / Marañón',
    'Semillas de chía / linaza',
    'Aceitunas',
    'Yema de huevo',
    'Quesos curados / mozzarella',
    'Chocolate negro (+70%)',
    'Aceite de coco',
    'Pescados grasos',
  ];

  public readonly medicalConditionOptions = [
    'Ninguna',
    'Hipertensión arterial',
    'Diabetes / Resistencia a la insulina',
    'Hipotiroidismo / Hipertiroidismo',
    'Colesterol / Triglicéridos altos',
    'Asma / Problemas respiratorios',
    'Gastritis / Reflujo',
    'Ansiedad / Depresión',
    'Otro',
  ];

  public readonly digestiveSymptomOptions = [
    'Ninguno (buena digestión)',
    'Inflamación / Distensión abdominal',
    'Gases frecuentes',
    'Acidez / Reflujo',
    'Estreñimiento',
    'Diarrea frecuente',
    'Pesadez después de comer',
  ];

  public readonly menstrualCycleOptions = [
    'Regular',
    'Irregular',
    'Diagnóstico de SOP o Endometriosis',
    'Menopausia',
    'Uso anticonceptivos hormonales',
  ];

  public readonly waterIntakeOptions = [
    'Menos de 1 litro al día',
    '1 a 1.5 litros al día',
    '2 a 2.5 litros al día',
    '3 litros o más al día',
  ];

  public readonly alcoholOptions = [
    'No consumo alcohol',
    'Ocasionalmente (eventos especiales)',
    'Fines de semana (1–2 veces/sem)',
    'Frecuentemente (3+ veces/sem)',
  ];

  public readonly sleepOptions = ['Menos de 5h', '5 a 6h', '7 a 8h', 'Más de 8h'];
  public readonly trainingTimeOptions = ['Mañana (5am–11am)', 'Mediodía (11am–2pm)', 'Tarde (2pm–6pm)', 'Noche (6pm–10pm)'];
  public readonly trainingDurationOptions = [30, 45, 60, 75, 90];

  // === PASO 1: IDENTIDAD ===
  public username = signal<string>('');
  public usernameStatus = signal<'idle' | 'checking' | 'available' | 'taken'>('idle');
  public usernameMessage = signal<string | null>(null);
  private usernameCheckTimer: any = null;

  public firstName = signal<string>('');
  public lastName = signal<string>('');
  public phone = signal<string>('');
  public gender = signal<'FEMALE' | 'MALE' | 'UNSPECIFIED'>('FEMALE');
  public birthDate = signal<string>('');

  // === PASO 2: BIOMETRÍA ===
  public currentWeight = signal<number | null>(null);
  public weightUnit = signal<'lb' | 'kg'>('lb');
  public alturaCm = signal<number | null>(null);
  public nivelActividad = signal<string>('MODERATELY_ACTIVE');

  // === PASO 3-4: OBJETIVO, RITMO, DIETA Y MODO DE CÁLCULO DE MACROS ===
  public protocol = signal<'DEFICIT' | 'MAINTENANCE' | 'SURPLUS' | 'RECOMPOSITION'>('DEFICIT');
  public targetWeight = signal<number | null>(null);
  public pacePercent = signal<number>(18); // % déficit o superávit
  public macroCalcMode = signal<'percentage' | 'g_per_kg'>('percentage');
  public selectedDietType = signal<DietTypeOption | null>(null);

  // === PASO 4: PREFERENCIAS NUTRICIONALES ===
  public mealTypes = signal<string[]>(['DESAYUNO', 'ALMUERZO', 'MERIENDA_PM', 'CENA']);
  public favoriteProteins = signal<string[]>([]);
  public favoriteCarbs = signal<string[]>([]);
  public favoriteFats = signal<string[]>([]);
  public favoriteFreeMeals = signal<string>('');
  public dislikedFoods = signal<string>('');

  // === PASO 5: SALUD CLÍNICA, HÁBITOS Y ENTRENO ===
  public medicalConditions = signal<string[]>(['Ninguna']);
  public medicalConditionsOther = signal<string>('');
  public injuriesNotes = signal<string>('');
  public allergiesIntolerances = signal<string>('');
  public medicationsSupplements = signal<string>('');
  public stressLevel = signal<number>(5);
  public sleepHours = signal<string>('7 a 8h');
  public digestiveSymptoms = signal<string[]>(['Ninguno (buena digestión)']);
  public menstrualCycleStatus = signal<string>('');
  public dailyWaterIntake = signal<string>('2 a 2.5 litros al día');
  public alcoholFrequency = signal<string>('Ocasionalmente (eventos especiales)');
  public trainingDaysPerWeek = signal<number>(4);
  public trainingLocation = signal<'GYM' | 'HOME' | 'HYBRID'>('GYM');
  public trainingDurationMinutes = signal<number>(60);
  public trainingPreferredTime = signal<string>('Mañana (5am–11am)');

  // === PASO 6: MEDIDAS Y FOTOS OPCIONALES ===
  public cintura = signal<number | null>(null);
  public cadera = signal<number | null>(null);
  public pecho = signal<number | null>(null);
  public cuello = signal<number | null>(null);
  public biceps = signal<number | null>(null);
  public muslo = signal<number | null>(null);
  public porcentajeGrasa = signal<number | null>(null);
  public masaMuscular = signal<number | null>(null);
  public fotoFrontalUrl = signal<string | null>(null);
  public fotoLateralUrl = signal<string | null>(null);
  public fotoEspaldaUrl = signal<string | null>(null);
  public uploadingPhotoSlot = signal<'frontal' | 'lateral' | 'espalda' | null>(null);

  // === COMPUTED: EDAD, PESO KG, TMB, TDEE ===
  public computedAge = computed<number | null>(() => {
    const raw = this.birthDate();
    if (!raw) return null;
    const birth = new Date(raw + 'T00:00:00');
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age > 10 && age < 110 ? age : null;
  });

  public currentWeightKg = computed<number | null>(() => {
    const w = this.currentWeight();
    if (!w || w <= 0) return null;
    return this.weightUnit() === 'kg' ? w : w * 0.45359237;
  });

  public computedTmb = computed<number | null>(() => {
    const kg = this.currentWeightKg();
    const cm = this.alturaCm();
    const age = this.computedAge();
    if (!kg || !cm || cm < 100 || !age) return null;
    let offset = -78;
    if (this.gender() === 'MALE') offset = 5;
    else if (this.gender() === 'FEMALE') offset = -161;
    return Math.round(10 * kg + 6.25 * cm - 5 * age + offset);
  });

  public computedTdee = computed<number | null>(() => {
    const tmb = this.computedTmb();
    if (!tmb) return null;
    const opt = this.activityLevels.find((a) => a.key === this.nivelActividad()) || this.activityLevels[2];
    return Math.round(tmb * opt.factor);
  });

  public paceRange = computed<{ min: number; max: number; step: number }>(() => {
    const p = this.protocol();
    if (p === 'DEFICIT') return { min: 10, max: 30, step: 1 };
    if (p === 'SURPLUS') return { min: 5, max: 20, step: 1 };
    if (p === 'RECOMPOSITION') return { min: 5, max: 12, step: 1 };
    return { min: 0, max: 0, step: 1 };
  });

  public paceMeta = computed<{ label: string; colorClass: string; pros: string; cons: string }>(() => {
    const p = this.protocol();
    const pct = this.pacePercent();
    if (p === 'DEFICIT') {
      if (pct <= 13) {
        return {
          label: 'Muy Lento / Ultra Sostenible',
          colorClass: 'bg-sky-100/20 text-sky-800',
          pros: 'Casi cero hambre, máxima energía para entrenar y preservar músculo.',
          cons: 'Resultados más graduales en la báscula.',
        };
      }
      if (pct <= 21) {
        return {
          label: 'Recomendado (Óptimo)',
          colorClass: 'bg-emerald-100/20 text-emerald-800',
          pros: 'Balance ideal entre pérdida constante de grasa y retención muscular.',
          cons: 'Requiere constancia diaria con proteínas y pasos.',
        };
      }
      if (pct <= 26) {
        return {
          label: 'Agresivo / Rápido',
          colorClass: 'bg-amber-100/20 text-amber-800',
          pros: 'Bajada más rápida en pocas semanas.',
          cons: 'Mayor sensación de hambre y fatiga; menor margen de error.',
        };
      }
      return {
        label: 'Extremo (Precaución)',
        colorClass: 'bg-red-100/20 text-red-800',
        pros: 'Máxima reducción calórica a corto plazo.',
        cons: 'Alto riesgo de pérdida muscular, fatiga hormonal y efecto rebote.',
      };
    }
    if (p === 'SURPLUS') {
      if (pct <= 8) {
        return {
          label: 'Limpio / Muy Controlado',
          colorClass: 'bg-sky-100/20 text-sky-800',
          pros: 'Mínima ganancia de grasa corporal mientras subes marcas.',
          cons: 'Aumento de peso muy pausado.',
        };
      }
      if (pct <= 14) {
        return {
          label: 'Recomendado (Lean Bulk)',
          colorClass: 'bg-emerald-100/20 text-emerald-800',
          pros: 'Ritmo óptimo de hipertrofia con grasa controlada.',
          cons: 'Requiere sobrecarga progresiva constante.',
        };
      }
      return {
        label: 'Agresivo / Volumen Rápido',
        colorClass: 'bg-amber-100/20 text-amber-800',
        pros: 'Máxima recuperación y subida rápida de fuerza.',
        cons: 'Mayor proporción de grasa ganada junto al músculo.',
      };
    }
    if (p === 'RECOMPOSITION') {
      return {
        label: 'Recomposición Recomendada',
        colorClass: 'bg-emerald-100/20 text-emerald-800',
        pros: 'Déficit ligero que permite quemar grasa y ganar tono muscular a la vez.',
        cons: 'El peso en báscula cambia poco; el progreso se ve en medidas y fotos.',
      };
    }
    return {
      label: 'Mantenimiento Estable',
      colorClass: 'bg-stone-200/20 text-stone-800',
      pros: 'Calorías en equilibrio para consolidar hábitos y rendimiento.',
      cons: 'Sin cambio significativo de peso corporal.',
    };
  });

  public goalKcal = computed<number>(() => {
    const tdee = this.computedTdee() || 2000;
    const p = this.protocol();
    const pct = this.pacePercent() / 100;
    if (p === 'DEFICIT') return Math.max(1200, Math.round(tdee * (1 - pct)));
    if (p === 'SURPLUS') return Math.round(tdee * (1 + pct));
    if (p === 'RECOMPOSITION') return Math.max(1300, Math.round(tdee * (1 - pct)));
    return tdee;
  });

  public dailyMacros = computed<{
    proteinG: number;
    carbsG: number;
    fatsG: number;
    pPct: number;
    cPct: number;
    fPct: number;
    pPerKg: number;
    fPerKg: number;
  }>(() => {
    const kcal = this.goalKcal();
    const diet = this.selectedDietType();
    const weightKg = this.currentWeightKg() || 65;

    if (this.macroCalcMode() === 'g_per_kg') {
      const pPerKg = Number(diet?.protein_p_kg ?? 1.9);
      const fPerKg = Number(diet?.fats_p_kg ?? 0.85);
      const proteinG = Math.max(40, Math.round(weightKg * pPerKg));
      const fatsG = Math.max(25, Math.round(weightKg * fPerKg));
      const remainingKcal = Math.max(0, kcal - (proteinG * 4 + fatsG * 9));
      const carbsG = Math.round(remainingKcal / 4);

      const totalKcal = Math.max(1, proteinG * 4 + carbsG * 4 + fatsG * 9);
      const pPct = Math.round(((proteinG * 4) / totalKcal) * 100);
      const fPct = Math.round(((fatsG * 9) / totalKcal) * 100);
      const cPct = Math.max(0, 100 - pPct - fPct);

      return { proteinG, carbsG, fatsG, pPct, cPct, fPct, pPerKg, fPerKg };
    }

    const pPct = diet?.protein_pct ?? 30;
    const cPct = diet?.carbs_pct ?? 40;
    const fPct = diet?.fats_pct ?? 30;
    const proteinG = Math.round((kcal * (pPct / 100)) / 4);
    const carbsG = Math.round((kcal * (cPct / 100)) / 4);
    const fatsG = Math.round((kcal * (fPct / 100)) / 9);

    return {
      proteinG,
      carbsG,
      fatsG,
      pPct,
      cPct,
      fPct,
      pPerKg: +(proteinG / weightKg).toFixed(2),
      fPerKg: +(fatsG / weightKg).toFixed(2),
    };
  });

  public weeklyWeightChangeKg = computed<number>(() => {
    const tdee = this.computedTdee() || 2000;
    const dailyDeltaKcal = this.goalKcal() - tdee;
    // 7700 kcal ≈ 1 kg de tejido corporal
    return (dailyDeltaKcal * 7) / 7700;
  });

  public estimatedWeeksToGoal = computed<number | null>(() => {
    const cur = this.currentWeight();
    const tgt = this.targetWeight();
    if (!cur || !tgt || cur <= 0 || tgt <= 0) return null;
    const curKg = this.weightUnit() === 'kg' ? cur : cur * 0.45359237;
    const tgtKg = this.weightUnit() === 'kg' ? tgt : tgt * 0.45359237;
    const diffKg = tgtKg - curKg;
    const weeklyKg = this.weeklyWeightChangeKg();
    if (Math.abs(diffKg) < 0.2 || Math.abs(weeklyKg) < 0.02) return null;
    // Verificar coherencia de dirección
    if ((diffKg < 0 && weeklyKg >= 0) || (diffKg > 0 && weeklyKg <= 0)) return null;
    return Math.max(1, Math.min(104, Math.ceil(Math.abs(diffKg / weeklyKg))));
  });

  public estimatedGoalDateLabel = computed<string | null>(() => {
    const weeks = this.estimatedWeeksToGoal();
    if (!weeks) return null;
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  });

  public projectionTimeline = computed<TimelineWeekPoint[]>(() => {
    const cur = this.currentWeight();
    if (!cur || cur <= 0) return [];
    const weeksCount = Math.min(12, Math.max(8, this.estimatedWeeksToGoal() || 8));
    const unitFactor = this.weightUnit() === 'kg' ? 1 : 2.20462262;
    const weeklyUnitDelta = this.weeklyWeightChangeKg() * unitFactor;
    const proto = this.protocol();

    const points: TimelineWeekPoint[] = [];
    for (let w = 0; w <= weeksCount; w++) {
      const projected = +(cur + weeklyUnitDelta * w).toFixed(1);
      const delta = +(weeklyUnitDelta * w).toFixed(1);
      let fatPctDelta = 0;
      let muscleNote = 'Estable';
      if (proto === 'DEFICIT') {
        fatPctDelta = +(-0.45 * w).toFixed(1);
        muscleNote = this.pacePercent() <= 22 ? 'Músculo preservado' : 'Vigilar proteína';
      } else if (proto === 'SURPLUS') {
        fatPctDelta = +(0.15 * w).toFixed(1);
        muscleNote = `+${(0.18 * w).toFixed(1)} ${this.weightUnit()} magro est.`;
      } else if (proto === 'RECOMPOSITION') {
        fatPctDelta = +(-0.28 * w).toFixed(1);
        muscleNote = `+${(0.12 * w).toFixed(1)} ${this.weightUnit()} magro est.`;
      }
      points.push({
        week: w,
        label: w === 0 ? 'Inicio' : `Sem ${w}`,
        weight: projected,
        deltaWeight: delta,
        estBodyFatDeltaPct: fatPctDelta,
        estMuscleNote: muscleNote,
      });
    }
    return points;
  });

  // Gráfico SVG de tendencia: Eje X (Semanas) vs Eje Y (Peso proyectado)
  public projectionChart = computed(() => {
    const pts = this.projectionTimeline();
    if (pts.length < 2) return null;

    const width = 340;
    const height = 175;
    const padL = 42;
    const padR = 16;
    const padT = 18;
    const padB = 28;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const weights = pts.map((p) => p.weight);
    const rawMin = Math.min(...weights);
    const rawMax = Math.max(...weights);
    const spread = Math.max(2, rawMax - rawMin);
    const minY = +(rawMin - spread * 0.2).toFixed(1);
    const maxY = +(rawMax + spread * 0.2).toFixed(1);
    const rangeY = Math.max(0.5, maxY - minY);

    const coords = pts.map((p, idx) => {
      const x = padL + (plotW * idx) / (pts.length - 1);
      const y = padT + plotH * (1 - (p.weight - minY) / rangeY);
      return {
        ...p,
        x: +x.toFixed(1),
        y: +y.toFixed(1),
      };
    });

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${(padT + plotH).toFixed(1)} L ${coords[0].x} ${(padT + plotH).toFixed(1)} Z`;

    const yTicks = [0, 0.5, 1].map((t) => {
      const val = +(maxY - rangeY * t).toFixed(1);
      const y = +(padT + plotH * t).toFixed(1);
      return { val, y };
    });

    return {
      width,
      height,
      padL,
      padR,
      padT,
      padB,
      plotH,
      coords,
      linePath,
      areaPath,
      yTicks,
      start: coords[0],
      end: coords[coords.length - 1],
    };
  });

  public progressPercent = computed<number>(() => Math.round((this.currentStep() / this.totalSteps) * 100));

  public activeActivityLabel = computed<string>(() => {
    return this.activityLevels.find((a) => a.key === this.nivelActividad())?.label || this.nivelActividad();
  });

  ngOnInit(): void {
    // 1. Cargar catálogo de dietas desde Supabase
    this.onboardingService.getDietTypes().subscribe({
      next: (list) => {
        this.dietTypes.set(list || []);
        if (list && list.length > 0 && !this.selectedDietType()) {
          this.selectedDietType.set(list[0]);
        }
      },
      error: () => { },
    });

    // 2. Prellenar con datos existentes del atleta / sesión de Google
    const sess = this.authService.currentSession();
    const athId = sess?.avatar?.id || this.athleteService.currentAthlete()?.id;
    if (sess?.avatar?.fullName && !this.firstName()) {
      const parts = sess.avatar.fullName.trim().split(' ');
      this.firstName.set(parts[0] || '');
      this.lastName.set(parts.slice(1).join(' ') || '');
    }

    if (athId) {
      this.onboardingService.getPrefill(athId).subscribe({
        next: (res) => {
          const a = res?.athlete;
          if (a) {
            if (a.username) {
              this.username.set(a.username);
              this.triggerUsernameCheck(a.username);
            }
            if (a.first_name) this.firstName.set(a.first_name);
            if (a.last_name) this.lastName.set(a.last_name);
            if (a.phone) this.phone.set(a.phone);
            const rawG = (a.gender || '').toUpperCase();
            if (rawG === 'MALE' || rawG === 'FEMALE' || rawG === 'UNSPECIFIED') {
              this.gender.set(rawG);
            }
            if (a.birth_date) this.birthDate.set(a.birth_date.slice(0, 10));
            if (a.altura_cm) this.alturaCm.set(Number(a.altura_cm));
            if (a.nivel_actividad) this.nivelActividad.set(a.nivel_actividad);
          }
        },
        error: () => { },
      });
    }
  }

  public onUsernameInput(val: string): void {
    const clean = (val || '').toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
    this.username.set(clean);
    this.triggerUsernameCheck(clean);
  }

  private triggerUsernameCheck(clean: string): void {
    if (this.usernameCheckTimer) clearTimeout(this.usernameCheckTimer);
    if (!clean || clean.length < 3) {
      this.usernameStatus.set('taken');
      this.usernameMessage.set('Mínimo 3 caracteres (letras, números, . o _).');
      return;
    }
    this.usernameStatus.set('checking');
    this.usernameMessage.set(null);

    const athId = this.authService.currentSession()?.avatar?.id || this.athleteService.currentAthlete()?.id;
    this.usernameCheckTimer = setTimeout(() => {
      this.onboardingService.checkUsername(clean, athId).subscribe({
        next: (res) => {
          if (res.available) {
            this.usernameStatus.set('available');
            this.usernameMessage.set(`@${res.normalized} está disponible`);
          } else {
            this.usernameStatus.set('taken');
            this.usernameMessage.set(res.reason || 'Este usuario no está disponible.');
          }
        },
        error: () => {
          this.usernameStatus.set('idle');
        },
      });
    }, 350);
  }

  public selectProtocol(proto: 'DEFICIT' | 'MAINTENANCE' | 'SURPLUS' | 'RECOMPOSITION'): void {
    this.protocol.set(proto);
    if (proto === 'DEFICIT') this.pacePercent.set(18);
    else if (proto === 'SURPLUS') this.pacePercent.set(10);
    else if (proto === 'RECOMPOSITION') this.pacePercent.set(8);
    else this.pacePercent.set(0);
  }

  public toggleArrayItem(sig: { (): string[]; set: (v: string[]) => void }, item: string, maxItems?: number, exclusiveNone?: string): void {
    const current = [...sig()];
    const idx = current.indexOf(item);
    if (idx >= 0) {
      current.splice(idx, 1);
      sig.set(current);
      return;
    }
    if (exclusiveNone && item === exclusiveNone) {
      sig.set([exclusiveNone]);
      return;
    }
    const filtered = exclusiveNone ? current.filter((x) => x !== exclusiveNone) : current;
    if (maxItems && filtered.length >= maxItems) return;
    sig.set([...filtered, item]);
  }

  public onProgressPhotoSelected(slot: 'frontal' | 'lateral' | 'espalda', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.uploadingPhotoSlot.set(slot);
    this.athleteService.uploadMedia(file, 'progress_photos', `onboarding_${slot}_${Date.now()}.jpg`).subscribe({
      next: (res) => {
        if (slot === 'frontal') this.fotoFrontalUrl.set(res.public_url);
        else if (slot === 'lateral') this.fotoLateralUrl.set(res.public_url);
        else this.fotoEspaldaUrl.set(res.public_url);
        this.uploadingPhotoSlot.set(null);
        input.value = '';
      },
      error: () => {
        this.uploadingPhotoSlot.set(null);
        input.value = '';
      },
    });
  }

  public nextStep(): void {
    this.stepError.set(null);
    const step = this.currentStep();

    if (step === 1) {
      if (!this.username().trim() || this.usernameStatus() === 'taken') {
        this.stepError.set(this.usernameMessage() || 'Elige un nombre de usuario disponible.');
        return;
      }
      if (!this.firstName().trim() || !this.lastName().trim()) {
        this.stepError.set('Completa tu nombre y apellidos.');
        return;
      }
      if (!this.birthDate() || !this.computedAge()) {
        this.stepError.set('Selecciona tu fecha de nacimiento válida.');
        return;
      }
    } else if (step === 2) {
      if (!this.currentWeight() || (this.currentWeight() || 0) <= 0) {
        this.stepError.set('Ingresa tu peso actual.');
        return;
      }
      if (!this.alturaCm() || (this.alturaCm() || 0) < 100 || (this.alturaCm() || 0) > 250) {
        this.stepError.set('Ingresa tu altura en centímetros (ej. 168).');
        return;
      }
    } else if (step === 7) {
      if (this.mealTypes().length === 0) {
        this.stepError.set('Selecciona al menos un tipo de comida al día.');
        return;
      }
    }

    if (step < this.totalSteps) {
      this.currentStep.set(step + 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  public prevStep(): void {
    this.stepError.set(null);
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  public finishOnboarding(skipBodyMeasurements: boolean = false): void {
    if (this.isSubmitting()) return;
    const sess = this.authService.currentSession();
    const athleteId = sess?.avatar?.id || this.athleteService.currentAthlete()?.id;
    if (!athleteId) {
      this.submitError.set('No se pudo identificar tu sesión. Vuelve a iniciar sesión.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    const macros = this.dailyMacros();

    this.onboardingService
      .completeOnboarding({
        athlete_id: athleteId,
        email: sess?.avatar?.email || this.athleteService.currentAthlete()?.email || undefined,
        username: this.username().trim(),
        first_name: this.firstName().trim(),
        last_name: this.lastName().trim(),
        phone: this.phone().trim() || null,
        gender: this.gender(),
        birth_date: this.birthDate(),
        current_weight: Number(this.currentWeight()),
        weight_unit: this.weightUnit(),
        altura_cm: Number(this.alturaCm()),
        nivel_actividad: this.nivelActividad(),
        protocol: this.protocol(),
        target_weight: this.targetWeight() ? Number(this.targetWeight()) : null,
        pace_percent: this.pacePercent(),
        estimated_weeks: this.estimatedWeeksToGoal(),
        diet_type_id: this.selectedDietType()?.id || null,
        goal_kcal: this.goalKcal(),
        protein_target_g: macros.proteinG,
        carbs_target_g: macros.carbsG,
        fats_target_g: macros.fatsG,
        meal_types: this.mealTypes(),
        favorite_proteins: this.favoriteProteins(),
        favorite_carbs: this.favoriteCarbs(),
        favorite_fats: this.favoriteFats(),
        favorite_free_meals: this.favoriteFreeMeals().trim() || null,
        disliked_foods: this.dislikedFoods().trim() || null,
        medical_conditions: this.medicalConditions(),
        medical_conditions_other: this.medicalConditionsOther().trim() || null,
        injuries_notes: this.injuriesNotes().trim() || null,
        allergies_intolerances: this.allergiesIntolerances().trim() || null,
        medications_supplements: this.medicationsSupplements().trim() || null,
        stress_level: this.stressLevel(),
        sleep_hours: this.sleepHours(),
        digestive_symptoms: this.digestiveSymptoms(),
        menstrual_cycle_status: this.gender() === 'FEMALE' ? this.menstrualCycleStatus() || null : null,
        daily_water_intake: this.dailyWaterIntake(),
        alcohol_frequency: this.alcoholFrequency(),
        training_days_per_week: this.trainingDaysPerWeek(),
        training_location: this.trainingLocation(),
        training_duration_minutes: this.trainingDurationMinutes(),
        training_preferred_time: this.trainingPreferredTime(),
        cintura: skipBodyMeasurements ? null : this.cintura(),
        cadera: skipBodyMeasurements ? null : this.cadera(),
        pecho: skipBodyMeasurements ? null : this.pecho(),
        cuello: skipBodyMeasurements ? null : this.cuello(),
        biceps: skipBodyMeasurements ? null : this.biceps(),
        muslo: skipBodyMeasurements ? null : this.muslo(),
        porcentaje_grasa: skipBodyMeasurements ? null : this.porcentajeGrasa(),
        masa_muscular: skipBodyMeasurements ? null : this.masaMuscular(),
        foto_frontal_url: skipBodyMeasurements ? null : this.fotoFrontalUrl(),
        foto_lateral_url: skipBodyMeasurements ? null : this.fotoLateralUrl(),
        foto_espalda_url: skipBodyMeasurements ? null : this.fotoEspaldaUrl(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.authService.markOnboardingCompleted();
        },
        error: (err) => {
          this.submitError.set(err?.error?.detail || 'Ocurrió un error guardando tu onboarding. Intenta nuevamente.');
          this.isSubmitting.set(false);
        },
      });
  }
}
