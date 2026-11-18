import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { supabaseClient } from './supabase.service';
import { WorkoutLog, WorkoutPlan, WorkoutRoutine } from '../../features/workout/models/workout.models';

export interface AwakinWidgetExerciseItem {
  order: number;
  name: string;
  sets: number;
}

export interface AwakinWidgetMuscleHighlight {
  region:
    | 'chest'
    | 'shoulders'
    | 'lats'
    | 'upper_back'
    | 'biceps'
    | 'triceps'
    | 'forearms'
    | 'abs'
    | 'quads'
    | 'hamstrings'
    | 'glutes'
    | 'calves';
  colorHex: string;
}

export interface AwakinTodayWorkoutWidgetPayload {
  updatedAt: string;
  dateYMD: string;
  dayOfWeek: number;
  hasWorkoutToday: boolean;
  isCompletedToday: boolean;
  completedDurationMin: number | null;
  completedVolume: number | null;
  completedVolumeUnit: string | null;
  routineId: string | null;
  badgeText: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  estimatedMinutes: number;
  exerciseCount: number;
  totalSets: number;
  exercises: AwakinWidgetExerciseItem[];
  remainingExercisesCount: number;
  muscles: string[];
  muscleHighlights: AwakinWidgetMuscleHighlight[];
  startDeepLink: string;
  detailDeepLink: string;
}

const STORAGE_KEY = 'awakin_ios_widget_today_workout';
export const AWAKIN_APP_GROUP_ID = 'group.com.awakin.app';

@Injectable({ providedIn: 'root' })
export class IosWidgetSyncService {
  /**
   * Sincroniza los datos del entrenamiento de hoy con:
   * 1. localStorage (para la PWA y el generador de Widget iOS sin App Store)
   * 2. El plugin nativo de Capacitor (AwakinWidgetBridge) si corre en contenedor nativo
   */
  async syncTodayWorkout(params: {
    plan: WorkoutPlan | null;
    availableRoutines: WorkoutRoutine[];
    workoutLogs: WorkoutLog[];
    translateMuscleName: (raw: string | null | undefined) => string;
  }): Promise<AwakinTodayWorkoutWidgetPayload> {
    const now = new Date();
    const dateYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const jsDay = now.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // Buscar si hoy ya hay un entrenamiento registrado
    const todayLog =
      params.workoutLogs.find((log) => {
        const d = new Date(log.workout_date);
        const logYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return logYmd === dateYMD;
      }) || null;

    // Buscar la rutina asignada al día de hoy en el plan semanal activo
    let todayRoutine: WorkoutRoutine | null = null;
    if (params.plan?.plan_routines) {
      const link = params.plan.plan_routines.find((pr) => pr.day_of_week === dayOfWeek);
      if (link) {
        todayRoutine =
          link.routine ||
          params.availableRoutines.find((r) => r.id === link.routine_id) ||
          null;
      }
    }

    const payload = this.buildPayload({
      dateYMD,
      dayOfWeek,
      routine: todayRoutine,
      todayLog,
      translateMuscleName: params.translateMuscleName
    });

    // 1. Guardar en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar si storage está restringido
    }

    // 2. Enviar al contenedor nativo iOS (Capacitor Plugin AwakinWidgetBridge) si existe
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.AwakinWidgetBridge?.syncTodayWorkout) {
        await cap.Plugins.AwakinWidgetBridge.syncTodayWorkout({
          appGroup: AWAKIN_APP_GROUP_ID,
          payloadJson: JSON.stringify(payload),
          bannerUrl: payload.bannerUrl || ''
        });
      }
    } catch (err) {
      console.warn('[IosWidgetSync] No se pudo sincronizar con el bridge nativo de iOS:', err);
    }

    return payload;
  }

  getLastSyncedPayload(): AwakinTodayWorkoutWidgetPayload | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AwakinTodayWorkoutWidgetPayload) : null;
    } catch {
      return null;
    }
  }

  /**
   * Construye el mapa semanal (días 1..7) con el payload pre-calculado de cada día
   * para que el Widget de Scriptable en iOS cambie automáticamente de rutina cada día
   * de la semana incluso sin conexión a internet.
   */
  buildWeeklyPayloadsMap(params: {
    plan: WorkoutPlan | null;
    availableRoutines: WorkoutRoutine[];
    workoutLogs: WorkoutLog[];
    translateMuscleName: (raw: string | null | undefined) => string;
  }): Record<number, AwakinTodayWorkoutWidgetPayload> {
    const now = new Date();
    const dateYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const jsDay = now.getDay();
    const todayDow = jsDay === 0 ? 7 : jsDay;

    const todayLog =
      params.workoutLogs.find((log) => {
        const d = new Date(log.workout_date);
        const logYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return logYmd === dateYMD;
      }) || null;

    const weeklyMap: Record<number, AwakinTodayWorkoutWidgetPayload> = {};
    for (let day = 1; day <= 7; day++) {
      let routineForDay: WorkoutRoutine | null = null;
      if (params.plan?.plan_routines) {
        const link = params.plan.plan_routines.find((pr) => pr.day_of_week === day);
        if (link) {
          routineForDay =
            link.routine ||
            params.availableRoutines.find((r) => r.id === link.routine_id) ||
            null;
        }
      }
      weeklyMap[day] = this.buildPayload({
        dateYMD,
        dayOfWeek: day,
        routine: routineForDay,
        todayLog: day === todayDow ? todayLog : null,
        translateMuscleName: params.translateMuscleName
      });
    }
    return weeklyMap;
  }

  /**
   * OPCIÓN 1 (PWA + Scriptable en iOS sin App Store ni Mac):
   * Genera el script completo de iOS Scriptable (.js) que dibuja en la pantalla de inicio
   * del iPhone exactamente el mismo card de entrenamiento de hoy y abre la PWA directo
   * en /workout?action=start-today (para el botón INICIAR SESIÓN) o /workout?action=detail-today.
   */
  async generateScriptableWidgetScript(params: {
    athleteId: string;
    pwaBaseUrl?: string;
    plan: WorkoutPlan | null;
    availableRoutines: WorkoutRoutine[];
    workoutLogs: WorkoutLog[];
    translateMuscleName: (raw: string | null | undefined) => string;
  }): Promise<string> {
    const baseUrl = (
      params.pwaBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://awakin.app')
    ).replace(/\/+$/, '');

    const weeklyMap = this.buildWeeklyPayloadsMap({
      plan: params.plan,
      availableRoutines: params.availableRoutines,
      workoutLogs: params.workoutLogs,
      translateMuscleName: params.translateMuscleName
    });

    let accessToken = '';
    try {
      const { data } = await supabaseClient.auth.getSession();
      accessToken = data?.session?.access_token || '';
    } catch {
      accessToken = '';
    }

    const configObj = {
      pwaBaseUrl: baseUrl,
      athleteId: params.athleteId,
      supabaseUrl: environment.SUPABASE_URL,
      supabaseKey: environment.SUPABASE_KEY,
      accessToken,
      weeklySchedule: weeklyMap
    };

    return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: bolt;

/**
 * ============================================================================
 * AWAKIN — WIDGET DE ENTRENAMIENTO DEL DÍA PARA IPHONE (iOS Scriptable)
 * ============================================================================
 * - Toca "▶ INICIAR SESIÓN" para abrir AWAKIN e iniciar la sesión activa de hoy.
 * - Toca el resto del card para abrir el modal con el detalle de la rutina.
 */

const AWAKIN_CONFIG = ${JSON.stringify(configObj, null, 2)};

async function main() {
  const payload = await resolveTodayWorkoutPayload();
  const widget = await createAwakinWorkoutWidget(payload);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    // Si el usuario abre el script dentro de la app Scriptable, muestra vista previa y opción de iniciar
    await widget.presentLarge();
    const alert = new Alert();
    alert.title = payload.name;
    alert.message = "¿Qué deseas hacer en AWAKIN?";
    alert.addAction("▶ Iniciar Sesión de Hoy");
    alert.addAction("Ver Detalle de la Rutina");
    alert.addCancelAction("Cerrar");
    const idx = await alert.presentSheet();
    if (idx === 0) {
      Safari.open(payload.pwaStartUrl);
    } else if (idx === 1) {
      Safari.open(payload.pwaDetailUrl);
    }
  }
  Script.complete();
}

async function resolveTodayWorkoutPayload() {
  const now = new Date();
  const ymd = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const jsDay = now.getDay();
  const dow = jsDay === 0 ? 7 : jsDay;

  // 1. Tomar la rutina del día desde el plan semanal sincronizado
  const basePayload = (AWAKIN_CONFIG.weeklySchedule && AWAKIN_CONFIG.weeklySchedule[dow])
    ? JSON.parse(JSON.stringify(AWAKIN_CONFIG.weeklySchedule[dow]))
    : AWAKIN_CONFIG.weeklySchedule[1];

  const routineQuery = basePayload && basePayload.routineId
    ? "&routineId=" + encodeURIComponent(basePayload.routineId)
    : "";

  basePayload.pwaStartUrl = AWAKIN_CONFIG.pwaBaseUrl + "/workout?action=start-today" + routineQuery;
  basePayload.pwaDetailUrl = AWAKIN_CONFIG.pwaBaseUrl + "/workout?action=detail-today" + routineQuery;

  // 2. Consultar en vivo a Supabase si hoy ya se completó el entrenamiento
  if (AWAKIN_CONFIG.athleteId && AWAKIN_CONFIG.supabaseUrl && AWAKIN_CONFIG.supabaseKey) {
    try {
      const startOfDayIso = ymd + "T00:00:00.000Z";
      const url = AWAKIN_CONFIG.supabaseUrl +
        "/rest/v1/workout_logs?select=id,duration_minutes,total_volume,volume_unit,workout_date" +
        "&athlete_id=eq." + encodeURIComponent(AWAKIN_CONFIG.athleteId) +
        "&workout_date=gte." + encodeURIComponent(startOfDayIso) +
        "&limit=1";
      const req = new Request(url);
      req.timeoutInterval = 5;
      const bearer = AWAKIN_CONFIG.accessToken || AWAKIN_CONFIG.supabaseKey;
      req.headers = {
        "apikey": AWAKIN_CONFIG.supabaseKey,
        "Authorization": "Bearer " + bearer
      };
      const logs = await req.loadJSON();
      if (Array.isArray(logs) && logs.length > 0) {
        basePayload.isCompletedToday = true;
        basePayload.completedDurationMin = logs[0].duration_minutes || null;
      }
    } catch (e) {
      // Fallback silencioso a caché local si no hay red
    }
  }

  return basePayload;
}

async function loadBannerWithDarkOverlay(bannerUrl) {
  const width = 720;
  const height = 760;
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = true;

  // Fondo base oscuro #0C0A09
  ctx.setFillColor(new Color("#0C0A09"));
  ctx.fillRect(new Rect(0, 0, width, height));

  if (bannerUrl) {
    try {
      const req = new Request(bannerUrl);
      req.timeoutInterval = 6;
      const img = await req.loadImage();
      if (img) {
        ctx.drawImageInRect(img, new Rect(0, 0, width, height));
      }
    } catch (e) {
      // Si falla la descarga, usar fondo oscuro Awakin
    }
  }

  // Capa de oscurecimiento para contraste perfecto del texto igual al Hero Card
  ctx.setFillColor(new Color("#0C0A09", bannerUrl ? 0.76 : 0.95));
  ctx.fillRect(new Rect(0, 0, width, height));

  return ctx.getImage();
}

function drawMiniBodyMapImage(highlights) {
  const w = 150;
  const h = 135;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;

  const colorMap = {};
  if (Array.isArray(highlights)) {
    for (const item of highlights) {
      colorMap[item.region] = item.colorHex;
    }
  }

  function getColor(region) {
    return colorMap[region] ? new Color(colorMap[region]) : new Color("#57534E", 0.55);
  }

  function fillRoundRect(x, y, rw, rh, radius, color) {
    const path = new Path();
    path.addRoundedRect(new Rect(x, y, rw, rh), radius, radius);
    ctx.addPath(path);
    ctx.setFillColor(color);
    ctx.fillPath();
  }

  const headColor = new Color("#78716C", 0.75);

  // --- SILUETA FRONTAL (Izquierda) ---
  const fx = 14;
  fillRoundRect(fx + 16, 4, 16, 16, 8, headColor); // Cabeza
  fillRoundRect(fx + 3, 23, 10, 8, 4, getColor("shoulders")); // Hombro Izq
  fillRoundRect(fx + 35, 23, 10, 8, 4, getColor("shoulders")); // Hombro Der
  fillRoundRect(fx + 11, 24, 26, 16, 4, getColor("chest")); // Pecho
  fillRoundRect(fx + 13, 42, 22, 22, 4, getColor("abs")); // Abdomen
  fillRoundRect(fx + 2, 33, 8, 26, 4, getColor("biceps")); // Brazo Izq
  fillRoundRect(fx + 38, 33, 8, 26, 4, getColor("biceps")); // Brazo Der
  fillRoundRect(fx + 11, 67, 11, 32, 4, getColor("quads")); // Cuádriceps Izq
  fillRoundRect(fx + 26, 67, 11, 32, 4, getColor("quads")); // Cuádriceps Der
  fillRoundRect(fx + 12, 102, 9, 24, 3, getColor("calves")); // Pantorrilla Izq
  fillRoundRect(fx + 27, 102, 9, 24, 3, getColor("calves")); // Pantorrilla Der

  // --- SILUETA POSTERIOR (Derecha) ---
  const bx = 84;
  fillRoundRect(bx + 16, 4, 16, 16, 8, headColor); // Cabeza
  fillRoundRect(bx + 3, 23, 10, 8, 4, getColor("shoulders")); // Deltoide Post Izq
  fillRoundRect(bx + 35, 23, 10, 8, 4, getColor("shoulders")); // Deltoide Post Der
  fillRoundRect(bx + 11, 24, 26, 20, 4, getColor("upper_back")); // Espalda / Dorsales
  fillRoundRect(bx + 11, 46, 26, 18, 5, getColor("glutes")); // Glúteos
  fillRoundRect(bx + 2, 33, 8, 26, 4, getColor("triceps")); // Tríceps Izq
  fillRoundRect(bx + 38, 33, 8, 26, 4, getColor("triceps")); // Tríceps Der
  fillRoundRect(bx + 11, 67, 11, 32, 4, getColor("hamstrings")); // Isquio Izq
  fillRoundRect(bx + 26, 67, 11, 32, 4, getColor("hamstrings")); // Isquio Der
  fillRoundRect(bx + 12, 102, 9, 24, 3, getColor("calves")); // Gemelo Izq
  fillRoundRect(bx + 27, 102, 9, 24, 3, getColor("calves")); // Gemelo Der

  return ctx.getImage();
}

async function createAwakinWorkoutWidget(p) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0C0A09");
  widget.backgroundImage = await loadBannerWithDarkOverlay(p.bannerUrl);
  widget.setPadding(14, 15, 14, 15);
  widget.url = p.pwaDetailUrl;

  const isMedium = config.widgetFamily === "medium";

  // 1. FILA SUPERIOR: Badge Naranja + Duración / Ejercicios / Series + Botón ↗
  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const badge = topRow.addStack();
  badge.backgroundColor = new Color("#FE970A");
  badge.cornerRadius = 6;
  badge.setPadding(3, 7, 3, 7);
  const badgeTxt = badge.addText(p.badgeText || "ASIGNADO HOY");
  badgeTxt.font = Font.blackSystemFont(8.5);
  badgeTxt.textColor = Color.white();

  topRow.addSpacer(6);

  if (p.hasWorkoutToday) {
    const metaTxt = topRow.addText("⏱ ~" + p.estimatedMinutes + " MIN • " + p.exerciseCount + " EJ. • " + p.totalSets + " SERIES");
    metaTxt.font = Font.boldSystemFont(9);
    metaTxt.textColor = new Color("#D6D3D1");
    metaTxt.lineLimit = 1;
  }

  topRow.addSpacer();

  const arrowCircle = topRow.addStack();
  arrowCircle.size = new Size(22, 22);
  arrowCircle.cornerRadius = 11;
  arrowCircle.backgroundColor = new Color("#FFFFFF", 0.14);
  arrowCircle.centerAlignContent();
  const arrowTxt = arrowCircle.addText("↗");
  arrowTxt.font = Font.boldSystemFont(11);
  arrowTxt.textColor = Color.white();

  widget.addSpacer(7);

  // 2. TÍTULO DE LA RUTINA
  const titleTxt = widget.addText((p.name || "ENTRENAMIENTO DE HOY").toUpperCase());
  titleTxt.font = Font.blackSystemFont(isMedium ? 14 : 16);
  titleTxt.textColor = Color.white();
  titleTxt.lineLimit = isMedium ? 2 : 3;

  // 3. DESCRIPCIÓN
  if (!isMedium && p.description) {
    widget.addSpacer(3);
    const descTxt = widget.addText(p.description);
    descTxt.font = Font.mediumSystemFont(10.5);
    descTxt.textColor = new Color("#A8A29E");
    descTxt.lineLimit = 2;
  }

  if (!isMedium && p.hasWorkoutToday) {
    widget.addSpacer(8);

    // 4. LISTA DE EJERCICIOS DE LA RUTINA
    const exHeader = widget.addText("EJERCICIOS DE LA RUTINA (" + p.exerciseCount + ")");
    exHeader.font = Font.blackSystemFont(8.5);
    exHeader.textColor = new Color("#FBBF24");
    widget.addSpacer(4);

    const exercises = Array.isArray(p.exercises) ? p.exercises.slice(0, 3) : [];
    for (const ex of exercises) {
      const exRow = widget.addStack();
      exRow.layoutHorizontally();
      exRow.centerAlignContent();

      const numTxt = exRow.addText(ex.order + ". ");
      numTxt.font = Font.blackSystemFont(10.5);
      numTxt.textColor = new Color("#FE970A");

      const nameTxt = exRow.addText(ex.name + " ");
      nameTxt.font = Font.semiboldSystemFont(10.5);
      nameTxt.textColor = new Color("#F5F5F4");
      nameTxt.lineLimit = 1;

      const setsTxt = exRow.addText("(" + ex.sets + "s)");
      setsTxt.font = Font.mediumSystemFont(9.5);
      setsTxt.textColor = new Color("#A8A29E");

      widget.addSpacer(2.5);
    }

    if (p.remainingExercisesCount > 0) {
      const moreTxt = widget.addText("+" + p.remainingExercisesCount + " ejercicios más");
      moreTxt.font = Font.boldSystemFont(9.5);
      moreTxt.textColor = new Color("#FBBF24", 0.9);
    }

    widget.addSpacer(8);

    // 5. CAJA DE MÚSCULOS A TRABAJAR + MINI BODY MAP
    const muscleBox = widget.addStack();
    muscleBox.layoutHorizontally();
    muscleBox.centerAlignContent();
    muscleBox.backgroundColor = new Color("#000000", 0.5);
    muscleBox.borderColor = new Color("#FFFFFF", 0.12);
    muscleBox.borderWidth = 1;
    muscleBox.cornerRadius = 14;
    muscleBox.setPadding(7, 9, 7, 9);

    const bodyMapImg = drawMiniBodyMapImage(p.muscleHighlights || []);
    const mapImgWidget = muscleBox.addImage(bodyMapImg);
    mapImgWidget.imageSize = new Size(64, 58);
    mapImgWidget.resizable = true;

    muscleBox.addSpacer(10);

    const muscleRight = muscleBox.addStack();
    muscleRight.layoutVertically();

    const mTitle = muscleRight.addText("MÚSCULOS A TRABAJAR");
    mTitle.font = Font.blackSystemFont(8);
    mTitle.textColor = new Color("#FBBF24");

    muscleRight.addSpacer(5);

    const pillsRow = muscleRight.addStack();
    pillsRow.layoutHorizontally();
    pillsRow.spacing = 4;

    const musclesList = Array.isArray(p.muscles) ? p.muscles.slice(0, 3) : ["GENERAL"];
    for (const mName of musclesList) {
      const pill = pillsRow.addStack();
      pill.backgroundColor = new Color("#FFFFFF", 0.15);
      pill.cornerRadius = 5;
      pill.setPadding(3, 6, 3, 6);
      const pillTxt = pill.addText(mName);
      pillTxt.font = Font.boldSystemFont(7.5);
      pillTxt.textColor = Color.white();
      pillTxt.lineLimit = 1;
    }

    muscleBox.addSpacer();
  }

  widget.addSpacer();

  // 6. BOTÓN INFERIOR: INICIAR SESIÓN (Abre directo la sesión activa en AWAKIN)
  const ctaBtn = widget.addStack();
  ctaBtn.layoutHorizontally();
  ctaBtn.centerAlignContent();
  ctaBtn.backgroundColor = p.isCompletedToday ? new Color("#059669") : new Color("#FE970A");
  ctaBtn.cornerRadius = 13;
  ctaBtn.setPadding(10, 12, 10, 12);
  ctaBtn.url = p.pwaStartUrl;

  ctaBtn.addSpacer();
  const ctaTxt = ctaBtn.addText(p.isCompletedToday ? "✔ COMPLETADO HOY" : "▶ INICIAR SESIÓN");
  ctaTxt.font = Font.blackSystemFont(12);
  ctaTxt.textColor = Color.white();
  ctaBtn.addSpacer();

  return widget;
}

await main();
`;
  }

  private buildPayload(opts: {
    dateYMD: string;
    dayOfWeek: number;
    routine: WorkoutRoutine | null;
    todayLog: WorkoutLog | null;
    translateMuscleName: (raw: string | null | undefined) => string;
  }): AwakinTodayWorkoutWidgetPayload {
    const { dateYMD, dayOfWeek, routine, todayLog, translateMuscleName } = opts;

    if (!routine) {
      return {
        updatedAt: new Date().toISOString(),
        dateYMD,
        dayOfWeek,
        hasWorkoutToday: false,
        isCompletedToday: !!todayLog,
        completedDurationMin: todayLog?.duration_minutes ?? null,
        completedVolume: todayLog?.total_volume ?? null,
        completedVolumeUnit: todayLog?.volume_unit ?? null,
        routineId: null,
        badgeText: 'DÍA DE DESCANSO',
        name: 'RECUPERACIÓN ACTIVA O ENTRENO LIBRE',
        description: 'Hoy no tienes rutina programada en tu plan semanal. Descansa o inicia una sesión libre.',
        bannerUrl: null,
        estimatedMinutes: 45,
        exerciseCount: 0,
        totalSets: 0,
        exercises: [],
        remainingExercisesCount: 0,
        muscles: ['GENERAL'],
        muscleHighlights: [],
        startDeepLink: 'awakin://workout?action=start-today',
        detailDeepLink: 'awakin://workout?action=detail-today'
      };
    }

    const exercisesList = routine.exercises || [];
    const totalSets =
      routine.total_sets ||
      exercisesList.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);

    const topExercises: AwakinWidgetExerciseItem[] = exercisesList.slice(0, 3).map((ex, idx) => ({
      order: idx + 1,
      name: ex.exercise_name || `Ejercicio #${ex.exercise_api_id || idx + 1}`,
      sets: ex.sets?.length || 3
    }));

    const remainingExercisesCount = Math.max(0, exercisesList.length - 3);

    const rawMuscles: string[] =
      routine.focus_muscles && routine.focus_muscles.length > 0
        ? routine.focus_muscles
        : exercisesList
            .map((e) => e.target_muscle || e.apiDetail?.target || '')
            .filter((m) => !!m);

    const uniqueTranslatedMuscles = Array.from(
      new Set(rawMuscles.map((m) => translateMuscleName(m).toUpperCase()))
    ).slice(0, 3);

    const muscleHighlights = this.computeMuscleHighlights(routine);

    return {
      updatedAt: new Date().toISOString(),
      dateYMD,
      dayOfWeek,
      hasWorkoutToday: true,
      isCompletedToday: !!todayLog,
      completedDurationMin: todayLog?.duration_minutes ?? null,
      completedVolume: todayLog?.total_volume ?? null,
      completedVolumeUnit: todayLog?.volume_unit ?? null,
      routineId: routine.id,
      badgeText: 'ASIGNADO HOY',
      name: routine.name.toUpperCase(),
      description: routine.description || 'Entrenamiento enfocado en fuerza e hipertrofia.',
      bannerUrl: routine.banner_url || null,
      estimatedMinutes: routine.estimated_minutes || 45,
      exerciseCount: exercisesList.length,
      totalSets,
      exercises: topExercises,
      remainingExercisesCount,
      muscles: uniqueTranslatedMuscles.length > 0 ? uniqueTranslatedMuscles : ['GENERAL'],
      muscleHighlights,
      startDeepLink: `awakin://workout?action=start-today&routineId=${encodeURIComponent(routine.id)}`,
      detailDeepLink: `awakin://workout?action=detail-today&routineId=${encodeURIComponent(routine.id)}`
    };
  }

  private computeMuscleHighlights(routine: WorkoutRoutine): AwakinWidgetMuscleHighlight[] {
    const regionSets = new Map<AwakinWidgetMuscleHighlight['region'], number>();

    const addRegionSets = (raw: string, sets: number) => {
      const m = raw.toLowerCase();
      let region: AwakinWidgetMuscleHighlight['region'] | null = null;
      if (m.includes('pec') || m.includes('chest') || m.includes('pecho')) region = 'chest';
      else if (m.includes('delt') || m.includes('shoulder') || m.includes('hombro')) region = 'shoulders';
      else if (m.includes('lat') || m.includes('dorsal')) region = 'lats';
      else if (m.includes('trap') || m.includes('rhomb') || m.includes('upper back') || m.includes('espalda')) region = 'upper_back';
      else if (m.includes('bicep') || m.includes('bíceps')) region = 'biceps';
      else if (m.includes('tricep') || m.includes('tríceps')) region = 'triceps';
      else if (m.includes('forearm') || m.includes('antebrazo') || m.includes('wrist')) region = 'forearms';
      else if (m.includes('ab') || m.includes('core') || m.includes('obliq')) region = 'abs';
      else if (m.includes('quad') || m.includes('cuádriceps') || m.includes('femoris')) region = 'quads';
      else if (m.includes('glute') || m.includes('glúteo')) region = 'glutes';
      else if (m.includes('ham') || m.includes('isquio')) region = 'hamstrings';
      else if (m.includes('calv') || m.includes('gastro') || m.includes('soleus') || m.includes('pantorrilla') || m.includes('gemelo')) region = 'calves';

      if (region) {
        regionSets.set(region, (regionSets.get(region) || 0) + sets);
      }
    };

    if (routine.exercises && routine.exercises.length > 0) {
      for (const ex of routine.exercises) {
        const sets = ex.sets?.length || 3;
        const target = ex.target_muscle || ex.apiDetail?.target || '';
        if (target) addRegionSets(target, sets);
      }
    }

    if (regionSets.size === 0 && routine.focus_muscles) {
      for (const f of routine.focus_muscles) {
        addRegionSets(f, 4);
      }
    }

    const maxSets = Math.max(...Array.from(regionSets.values()), 1);
    const result: AwakinWidgetMuscleHighlight[] = [];

    for (const [region, sets] of regionSets.entries()) {
      const ratio = sets / maxSets;
      const colorHex = ratio >= 0.75 ? '#EA580C' : ratio >= 0.4 ? '#FE970A' : '#FBBF24';
      result.push({ region, colorHex });
    }

    return result;
  }
}
