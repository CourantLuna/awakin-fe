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
   * 1. localStorage (para inspección local)
   * 2. El plugin nativo de Capacitor (AwakinWidgetBridge) si corre como app nativa iOS
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

    const todayLog =
      params.workoutLogs.find((log) => {
        const d = new Date(log.workout_date);
        const logYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return logYmd === dateYMD;
      }) || null;

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

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar si storage está restringido
    }

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
   * OPCIÓN 1 — 100% DINÁMICO EN TIEMPO REAL CONTRA SUPABASE:
   * El script NO guarda rutinas estáticas. Cada vez que iOS refresca el widget
   * (o cuando el atleta cambia de rutina, edita ejercicios o asigna otro plan en AWAKIN),
   * el widget consulta directamente en vivo las tablas de Supabase:
   * - workout_plan_athletes -> workout_plans -> workout_plan_routines -> workout_routines
   * - workout_routine_exercises -> workout_routine_sets
   * - workout_logs (para saber si ya completó el entreno de hoy)
   */
  async generateScriptableWidgetScript(params: {
    athleteId: string;
    pwaBaseUrl?: string;
    plan?: WorkoutPlan | null;
    availableRoutines?: WorkoutRoutine[];
    workoutLogs?: WorkoutLog[];
    translateMuscleName?: (raw: string | null | undefined) => string;
  }): Promise<string> {
    const baseUrl = (
      params.pwaBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://awakin.app')
    ).replace(/\/+$/, '');

    let accessToken = '';
    let refreshToken = '';
    try {
      const { data } = await supabaseClient.auth.getSession();
      accessToken = data?.session?.access_token || '';
      refreshToken = data?.session?.refresh_token || '';
    } catch {
      accessToken = '';
      refreshToken = '';
    }

    const connectionConfig = {
      pwaBaseUrl: baseUrl,
      athleteId: params.athleteId,
      supabaseUrl: environment.SUPABASE_URL,
      supabaseKey: environment.SUPABASE_KEY,
      initialAccessToken: accessToken,
      initialRefreshToken: refreshToken
    };

    return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: bolt;

/**
 * ============================================================================
 * AWAKIN — WIDGET DINÁMICO EN TIEMPO REAL PARA IPHONE (iOS Scriptable)
 * ============================================================================
 * 100% DINÁMICO: Consulta directamente tu Supabase en vivo cada vez que se
 * actualiza. Si cambias tu rutina del día, editas ejercicios o completas tu
 * entrenamiento en AWAKIN, el widget se actualiza solo sin tocar este script.
 */

const AWAKIN_CONN = ${JSON.stringify(connectionConfig, null, 2)};

const MUSCLE_TRANSLATIONS = {
  "chest": "PECHO", "pectorals": "PECHO", "pectoral": "PECHO", "upper chest": "PECHO SUP.",
  "mid-lower-pectoralis": "PECHO", "upper-pectoralis": "PECHO SUP.",
  "delts": "HOMBROS", "deltoids": "HOMBROS", "shoulders": "HOMBROS",
  "front-shoulders": "HOMBRO ANT.", "anterior-deltoid": "HOMBRO ANT.",
  "lateral-deltoid": "HOMBRO LAT.", "posterior-deltoid": "HOMBRO POST.",
  "back": "ESPALDA", "lats": "DORSALES", "latissimus dorsi": "DORSALES",
  "upper back": "ESPALDA ALTA", "lower back": "ZONA LUMBAR", "traps": "TRAPECIOS",
  "trapezius": "TRAPECIOS", "rhomboids": "ROMBOIDES",
  "biceps": "BÍCEPS", "long-head-bicep": "BÍCEPS", "short-head-bicep": "BÍCEPS",
  "triceps": "TRÍCEPS", "medial-head-triceps": "TRÍCEPS", "long-head-triceps": "TRÍCEPS",
  "lateral-head-triceps": "TRÍCEPS", "forearms": "ANTEBRAZOS", "forearm": "ANTEBRAZOS",
  "quads": "CUÁDRICEPS", "quadriceps": "CUÁDRICEPS", "outer-quadricep": "CUÁDRICEPS",
  "inner-quadricep": "CUÁDRICEPS", "rectus-femoris": "CUÁDRICEPS",
  "hamstrings": "ISQUIOTIBIALES", "medial-hamstrings": "ISQUIOTIBIALES", "lateral-hamstrings": "ISQUIOTIBIALES",
  "glutes": "GLÚTEOS", "gluteus": "GLÚTEOS", "gluteus-maximus": "GLÚTEOS", "gluteus-medius": "GLÚTEOS",
  "calves": "PANTORRILLAS", "gastrocnemius": "PANTORRILLAS", "soleus": "PANTORRILLAS",
  "adductors": "ADUCTORES", "abductors": "ABDUCTORES",
  "abs": "ABDOMEN", "abdominals": "ABDOMEN", "core": "CORE", "obliques": "OBLICUOS"
};

function translateMuscle(raw) {
  if (!raw) return "GENERAL";
  const clean = String(raw).trim().toLowerCase().replace(/_/g, "-");
  if (MUSCLE_TRANSLATIONS[clean]) return MUSCLE_TRANSLATIONS[clean];
  const rawLower = String(raw).trim().toLowerCase();
  if (MUSCLE_TRANSLATIONS[rawLower]) return MUSCLE_TRANSLATIONS[rawLower];
  return String(raw).toUpperCase();
}

function mapMuscleToRegion(raw) {
  const m = String(raw || "").toLowerCase();
  if (m.includes("pec") || m.includes("chest") || m.includes("pecho")) return "chest";
  if (m.includes("delt") || m.includes("shoulder") || m.includes("hombro")) return "shoulders";
  if (m.includes("lat") || m.includes("dorsal")) return "lats";
  if (m.includes("trap") || m.includes("rhomb") || m.includes("back") || m.includes("espalda")) return "upper_back";
  if (m.includes("bicep") || m.includes("bíceps")) return "biceps";
  if (m.includes("tricep") || m.includes("tríceps")) return "triceps";
  if (m.includes("forearm") || m.includes("antebrazo")) return "forearms";
  if (m.includes("ab") || m.includes("core") || m.includes("obliq")) return "abs";
  if (m.includes("quad") || m.includes("cuádriceps") || m.includes("femoris")) return "quads";
  if (m.includes("glute") || m.includes("glúteo")) return "glutes";
  if (m.includes("ham") || m.includes("isquio")) return "hamstrings";
  if (m.includes("calv") || m.includes("gastro") || m.includes("soleus") || m.includes("pantorrilla") || m.includes("gemelo")) return "calves";
  return null;
}

async function getValidAuthToken() {
  const fm = FileManager.local();
  const authPath = fm.joinPath(fm.documentsDirectory(), "awakin_widget_auth.json");
  let token = AWAKIN_CONN.initialAccessToken || AWAKIN_CONN.supabaseKey;
  let refresh = AWAKIN_CONN.initialRefreshToken || "";

  if (fm.fileExists(authPath)) {
    try {
      const saved = JSON.parse(fm.readString(authPath));
      if (saved.accessToken) token = saved.accessToken;
      if (saved.refreshToken) refresh = saved.refreshToken;
    } catch (e) {}
  }

  // Si tenemos refreshToken, intentar renovar sesión silenciosamente si fuera necesario
  if (refresh) {
    try {
      const req = new Request(AWAKIN_CONN.supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
      req.method = "POST";
      req.timeoutInterval = 4;
      req.headers = {
        "apikey": AWAKIN_CONN.supabaseKey,
        "Content-Type": "application/json"
      };
      req.body = JSON.stringify({ refresh_token: refresh });
      const res = await req.loadJSON();
      if (res && res.access_token) {
        token = res.access_token;
        refresh = res.refresh_token || refresh;
        fm.writeString(authPath, JSON.stringify({ accessToken: token, refreshToken: refresh }));
      }
    } catch (e) {}
  }

  return token || AWAKIN_CONN.supabaseKey;
}

async function supabaseGet(endpoint, bearerToken) {
  const req = new Request(AWAKIN_CONN.supabaseUrl + "/rest/v1/" + endpoint);
  req.timeoutInterval = 6;
  req.headers = {
    "apikey": AWAKIN_CONN.supabaseKey,
    "Authorization": "Bearer " + (bearerToken || AWAKIN_CONN.supabaseKey)
  };
  return await req.loadJSON();
}

async function fetchLiveTodayWorkoutFromSupabase() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), "awakin_widget_live_cache.json");

  const now = new Date();
  const ymd = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const jsDay = now.getDay();
  const dow = jsDay === 0 ? 7 : jsDay;

  try {
    const bearer = await getValidAuthToken();
    const athleteId = encodeURIComponent(AWAKIN_CONN.athleteId);

    // 1. Consultar planes activos asignados al atleta en vivo
    const planLinks = await supabaseGet(
      "workout_plan_athletes?select=plan_id&athlete_id=eq." + athleteId + "&is_active=eq.true",
      bearer
    );

    const planIds = Array.isArray(planLinks)
      ? planLinks.map(l => l.plan_id).filter(Boolean)
      : [];

    let liveRoutine = null;

    if (planIds.length > 0) {
      const inList = planIds.map(id => '"' + id + '"').join(",");
      const selectQuery =
        "id,name,workout_plan_routines(" +
          "day_of_week,sort_order,routine_id," +
          "workout_routines(" +
            "id,name,description,banner_url,estimated_minutes,total_sets,focus_muscles," +
            "workout_routine_exercises(" +
              "id,exercise_api_id,exercise_name,target_muscle,secondary_muscles,sort_order," +
              "workout_routine_sets(id,set_number)" +
            ")" +
          ")" +
        ")";

      const plansData = await supabaseGet(
        "workout_plans?select=" + encodeURIComponent(selectQuery) +
        "&id=in.(" + encodeURIComponent(inList) + ")&is_active=eq.true&order=created_at.desc&limit=1",
        bearer
      );

      if (Array.isArray(plansData) && plansData.length > 0) {
        const links = plansData[0].workout_plan_routines || [];
        const todayLink = links.find(l => Number(l.day_of_week) === dow);
        if (todayLink && todayLink.workout_routines) {
          liveRoutine = todayLink.workout_routines;
        }
      }
    }

    // 2. Consultar si ya existe un workout_log registrado hoy
    const startOfDayIso = ymd + "T00:00:00.000Z";
    const logs = await supabaseGet(
      "workout_logs?select=id,duration_minutes,total_volume,volume_unit,workout_date" +
      "&athlete_id=eq." + athleteId +
      "&workout_date=gte." + encodeURIComponent(startOfDayIso) +
      "&limit=1",
      bearer
    );
    const isCompletedToday = Array.isArray(logs) && logs.length > 0;

    // 3. Construir payload dinámico desde la rutina viva
    const payload = buildDynamicPayload(liveRoutine, isCompletedToday);
    fm.writeString(cachePath, JSON.stringify(payload));
    return payload;
  } catch (err) {
    // Si no hay conexión en ese segundo, usar la última respuesta guardada en caché
    if (fm.fileExists(cachePath)) {
      try {
        return JSON.parse(fm.readString(cachePath));
      } catch (e) {}
    }
    return buildDynamicPayload(null, false);
  }
}

function buildDynamicPayload(rawRoutine, isCompletedToday) {
  const baseUrl = AWAKIN_CONN.pwaBaseUrl;

  if (!rawRoutine) {
    return {
      hasWorkoutToday: false,
      isCompletedToday: isCompletedToday,
      routineId: null,
      badgeText: "DÍA DE DESCANSO",
      name: "RECUPERACIÓN ACTIVA O ENTRENO LIBRE",
      description: "Hoy no tienes rutina asignada en tu plan semanal. Descansa o inicia un entreno libre.",
      bannerUrl: null,
      estimatedMinutes: 45,
      exerciseCount: 0,
      totalSets: 0,
      exercises: [],
      remainingExercisesCount: 0,
      muscles: ["GENERAL"],
      muscleHighlights: [],
      pwaStartUrl: baseUrl + "/workout?action=start-today",
      pwaDetailUrl: baseUrl + "/workout?action=detail-today"
    };
  }

  const rawExercises = Array.isArray(rawRoutine.workout_routine_exercises)
    ? rawRoutine.workout_routine_exercises.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : [];

  let computedTotalSets = 0;
  const regionSets = {};

  for (const ex of rawExercises) {
    const setsCount = Array.isArray(ex.workout_routine_sets) ? ex.workout_routine_sets.length : 3;
    computedTotalSets += setsCount;
    const reg = mapMuscleToRegion(ex.target_muscle);
    if (reg) {
      regionSets[reg] = (regionSets[reg] || 0) + setsCount;
    }
  }

  const totalSets = rawRoutine.total_sets || computedTotalSets || 0;
  const estimatedMinutes = rawRoutine.estimated_minutes || Math.max(25, Math.round(totalSets * 2.5));

  const topExercises = rawExercises.slice(0, 4).map((ex, i) => ({
    order: i + 1,
    name: ex.exercise_name || ("Ejercicio #" + (i + 1)),
    sets: Array.isArray(ex.workout_routine_sets) ? ex.workout_routine_sets.length : 3
  }));

  const focusList = Array.isArray(rawRoutine.focus_muscles) && rawRoutine.focus_muscles.length > 0
    ? rawRoutine.focus_muscles
    : rawExercises.map(e => e.target_muscle).filter(Boolean);

  const muscles = Array.from(new Set(focusList.map(m => translateMuscle(m)))).slice(0, 4);
  const routineQuery = "&routineId=" + encodeURIComponent(rawRoutine.id);

  return {
    hasWorkoutToday: true,
    isCompletedToday: isCompletedToday,
    routineId: rawRoutine.id,
    badgeText: "ASIGNADO HOY",
    name: String(rawRoutine.name || "RUTINA DE HOY").toUpperCase(),
    description: rawRoutine.description || "Entrenamiento enfocado en fuerza e hipertrofia.",
    bannerUrl: rawRoutine.banner_url || null,
    estimatedMinutes: estimatedMinutes,
    exerciseCount: rawExercises.length,
    totalSets: totalSets,
    exercises: topExercises,
    remainingExercisesCount: Math.max(0, rawExercises.length - 4),
    muscles: muscles.length > 0 ? muscles : ["GENERAL"],
    muscleHighlights: [],
    pwaStartUrl: baseUrl + "/workout?action=start-today" + routineQuery,
    pwaDetailUrl: baseUrl + "/workout?action=detail-today" + routineQuery
  };
}

async function main() {
  const payload = await fetchLiveTodayWorkoutFromSupabase();
  const widget = await createAwakinWorkoutWidget(payload);
  // Indicar a iOS que refresque el widget frecuentemente para reflejar cambios de rutina
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentLarge();
    const alert = new Alert();
    alert.title = payload.name;
    alert.message = "¿Qué deseas abrir en AWAKIN?";
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

async function loadBannerWithDarkOverlay(bannerUrl) {
  const width = 720;
  const height = 760;
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = true;

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
    } catch (e) {}
  }

  ctx.setFillColor(new Color("#0C0A09", bannerUrl ? 0.76 : 0.95));
  ctx.fillRect(new Rect(0, 0, width, height));

  return ctx.getImage();
}

async function createAwakinWorkoutWidget(p) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0C0A09");
  widget.backgroundImage = await loadBannerWithDarkOverlay(p.bannerUrl);
  widget.setPadding(15, 16, 15, 16);
  widget.url = p.pwaDetailUrl;

  const isMedium = config.widgetFamily === "medium";

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

  widget.addSpacer(8);

  const titleTxt = widget.addText((p.name || "ENTRENAMIENTO DE HOY").toUpperCase());
  titleTxt.font = Font.blackSystemFont(isMedium ? 14 : 17);
  titleTxt.textColor = Color.white();
  titleTxt.lineLimit = isMedium ? 2 : 3;

  if (!isMedium && p.description) {
    widget.addSpacer(4);
    const descTxt = widget.addText(p.description);
    descTxt.font = Font.mediumSystemFont(10.5);
    descTxt.textColor = new Color("#A8A29E");
    descTxt.lineLimit = 2;
  }

  if (!isMedium && p.hasWorkoutToday) {
    widget.addSpacer(8);

    // Músculos a trabajar (Pills limpias sin silueta deformada)
    const pillsRow = widget.addStack();
    pillsRow.layoutHorizontally();
    pillsRow.spacing = 5;

    const musclesList = Array.isArray(p.muscles) ? p.muscles.slice(0, 4) : ["GENERAL"];
    for (const mName of musclesList) {
      const pill = pillsRow.addStack();
      pill.backgroundColor = new Color("#FFFFFF", 0.12);
      pill.borderColor = new Color("#FFFFFF", 0.22);
      pill.borderWidth = 1;
      pill.cornerRadius = 8;
      pill.setPadding(3, 8, 3, 8);
      const pillTxt = pill.addText(mName);
      pillTxt.font = Font.boldSystemFont(8);
      pillTxt.textColor = new Color("#E7E5E4");
      pillTxt.lineLimit = 1;
    }

    widget.addSpacer(10);

    const exHeader = widget.addText("EJERCICIOS DE LA RUTINA (" + p.exerciseCount + ")");
    exHeader.font = Font.blackSystemFont(8.5);
    exHeader.textColor = new Color("#FBBF24");
    widget.addSpacer(5);

    const exercises = Array.isArray(p.exercises) ? p.exercises.slice(0, 4) : [];
    for (const ex of exercises) {
      const exRow = widget.addStack();
      exRow.layoutHorizontally();
      exRow.centerAlignContent();

      const numTxt = exRow.addText(ex.order + ". ");
      numTxt.font = Font.blackSystemFont(11);
      numTxt.textColor = new Color("#FE970A");

      const nameTxt = exRow.addText(ex.name + " ");
      nameTxt.font = Font.semiboldSystemFont(11);
      nameTxt.textColor = new Color("#F5F5F4");
      nameTxt.lineLimit = 1;

      const setsTxt = exRow.addText("(" + ex.sets + "s)");
      setsTxt.font = Font.mediumSystemFont(10);
      setsTxt.textColor = new Color("#A8A29E");

      widget.addSpacer(3.5);
    }

    if (p.remainingExercisesCount > 0) {
      const moreTxt = widget.addText("+" + p.remainingExercisesCount + " ejercicios más");
      moreTxt.font = Font.boldSystemFont(10);
      moreTxt.textColor = new Color("#FBBF24", 0.9);
    }
  }

  widget.addSpacer();

  const ctaBtn = widget.addStack();
  ctaBtn.layoutHorizontally();
  ctaBtn.centerAlignContent();
  ctaBtn.backgroundColor = p.isCompletedToday ? new Color("#059669") : new Color("#FE970A");
  ctaBtn.cornerRadius = 14;
  ctaBtn.setPadding(11, 14, 11, 14);
  ctaBtn.url = p.pwaStartUrl;

  ctaBtn.addSpacer();
  const ctaTxt = ctaBtn.addText(p.isCompletedToday ? "✔ COMPLETADO HOY" : "▶ INICIAR SESIÓN");
  ctaTxt.font = Font.blackSystemFont(12.5);
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
