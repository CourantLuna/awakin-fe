import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, catchError, map, switchMap, timeout } from 'rxjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabase.service';
import { environment } from '../../../environments/environment';
import {
  MenuPlan,
  WeeklyTemplate,
  DayAssignment,
  DishItem,
  DishIngredient,
  LooseIngredientItem,
  CatalogIngredient,
  FoodPhotoEstimationResult,
  FormattedRecordIngredient,
} from '../../features/intake/models/intake.models';
import { applyOptimizationToMenu } from '../helpers/nutrition-optimizer';
import { compressImage } from '../helpers/image-compressor.helper';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function determineCoverIcon(name: string, tags: string[] = []): string {
  const text = (name + ' ' + tags.join(' ')).toLowerCase();
  if (text.includes('pollo') || text.includes('pavo')) return '🍗';
  if (text.includes('carne') || text.includes('res') || text.includes('steak')) return '🥩';
  if (text.includes('atun') || text.includes('pescado') || text.includes('salmon')) return '🐟';
  if (text.includes('avena') || text.includes('bowl')) return '🥣';
  if (text.includes('ensalada') || text.includes('salad') || text.includes('verde')) return '🥗';
  if (text.includes('huevo') || text.includes('omelet')) return '🍳';
  if (text.includes('taco')) return '🌮';
  if (text.includes('pasta')) return '🍝';
  if (text.includes('aguacate')) return '🥑';
  return '🍽️';
}

@Injectable({ providedIn: 'root' })
export class IntakeService {
  private http = inject(HttpClient);
  private supabase: SupabaseClient = supabaseClient;
  private readonly baseUrl = `${environment.apiUrl}/intake`;

  public availableMenus = signal<MenuPlan[]>([]);
  public availableIngredients = signal<CatalogIngredient[]>([]);
  public weeklyPlans = signal<WeeklyTemplate[]>([]);
  public isLoading = signal<boolean>(false);
  public currentAthleteId = signal<string | null>(null);

  constructor() {
    this.hydrateFromCache();
  }

  /**
   * Hidrata catálogo de menús y planes semanales instantáneamente (0ms) desde LocalStorage
   */
  private hydrateFromCache(): void {
    try {
      const cachedMenus = localStorage.getItem('awakin_cached_menus');
      if (cachedMenus) {
        const parsed = JSON.parse(cachedMenus);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.availableMenus.set(parsed);
        }
      }
      const cachedIngredients = localStorage.getItem('awakin_cached_ingredients');
      if (cachedIngredients) {
        const parsedIngredients = JSON.parse(cachedIngredients);
        if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
          this.availableIngredients.set(parsedIngredients);
        }
      }
      const athId = localStorage.getItem('awakin_active_athlete_id');
      if (athId) {
        const cachedPlans = localStorage.getItem('awakin_cached_weekly_plans_' + athId);
        if (cachedPlans) {
          const parsed = JSON.parse(cachedPlans);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.weeklyPlans.set(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Error hidratando caché de intake:', e);
    }
  }

  /**
   * Carga el catálogo de menús de intake_menus (obviando shared_plan_id y athlete_id).
   */
  public loadAvailableMenus(athleteId?: string | null): Observable<MenuPlan[]> {
    const athId = athleteId || this.currentAthleteId();
    const url = athId ? `${this.baseUrl}/menus?athlete_id=${athId}` : `${this.baseUrl}/menus`;

    return this.http.get<any[]>(url).pipe(
      timeout(3500),
      map((menus) => this.mapMenusToPlan(menus, athId)),
      catchError((err) => {
        console.warn('Backend unavailable for menus, falling back to Supabase client directly:', err);
        const queryWithAthlete = `
          id, name, created_at, cover_image_url, author_id, author_name, is_public, total_calories, total_protein, total_carbs, total_fats, tags, description, created_by, athlete_id,
          intake_menu_dishes_new(
            id, dish_id, meal_type,
            intake_menu_dish_optimizers(id, is_optimizer_active, optimizer_targets, athlete_id),
            intake_dishes(*, intake_dish_ingredients!intake_dish_ingredients_dish_id_fkey(*, intake_ingredients(*)))
          ),
          intake_menu_ingredients(id, ingredient_id, meal_type, quantity, mode, intake_ingredients(*))
        `;
        const queryFallback = `
          id, name, created_at, cover_image_url, author_id, author_name, is_public, total_calories, total_protein, total_carbs, total_fats, tags, description, created_by, athlete_id,
          intake_menu_dishes_new(
            id, dish_id, meal_type,
            intake_menu_dish_optimizers(id, is_optimizer_active, optimizer_targets),
            intake_dishes(*, intake_dish_ingredients!intake_dish_ingredients_dish_id_fkey(*, intake_ingredients(*)))
          ),
          intake_menu_ingredients(id, ingredient_id, meal_type, quantity, mode, intake_ingredients(*))
        `;
        return from(
          this.supabase
            .from('intake_menus')
            .select(queryWithAthlete)
            .order('name')
        ).pipe(
          switchMap(({ data, error }) => {
            if (error) {
              return from(
                this.supabase
                  .from('intake_menus')
                  .select(queryFallback)
                  .order('name')
              ).pipe(
                map(({ data: fallbackData }) => fallbackData || [])
              );
            }
            return of(data || []);
          }),
          map((data) => this.mapMenusToPlan(data || [], athId))
        );
      }),
      map((menus) => {
        this.availableMenus.set(menus);
        try {
          localStorage.setItem('awakin_cached_menus', JSON.stringify(menus));
        } catch {}
        return menus;
      })
    );
  }

  /**
   * Duplica un menú existente (ej. creado por coach) para permitir su personalización por parte del atleta.
   */
  public duplicateMenu(menu: MenuPlan, newName?: string): Observable<MenuPlan | null> {
    const athleteId = this.currentAthleteId();
    const copyName = newName || `${menu.name} (Copia)`;

    return this.http
      .post<any>(`${this.baseUrl}/menus/${menu.id}/duplicate?athlete_id=${athleteId}`, {})
      .pipe(
        map((res) => {
          const mapped = this.mapMenusToPlan([res], athleteId)[0];
          return mapped;
        }),
        catchError((err) => {
          console.warn('Backend unavailable for duplicating menu, falling back to Supabase directly:', err);
          return from(this.duplicateMenuViaSupabase(menu, copyName, athleteId));
        }),
        map((newMenu) => {
          if (newMenu) {
            this.availableMenus.update((menus) => [...menus, newMenu]);
          }
          return newMenu;
        })
      );
  }

  private async duplicateMenuViaSupabase(
    menu: MenuPlan,
    copyName: string,
    athleteId: string | null
  ): Promise<MenuPlan | null> {
    try {
      const { data: newMenu, error: menuErr } = await this.supabase
        .from('intake_menus')
        .insert({
          name: copyName,
          created_by: athleteId,
          athlete_id: athleteId,
          author_name: 'Atleta',
          cover_image_url: menu.coverImageUrl,
          total_calories: menu.kcal,
          total_protein: menu.protein,
          total_carbs: menu.carbs,
          total_fats: menu.fats,
          tags: menu.tags || [],
          description: menu.description || null
        })
        .select()
        .single();

      if (menuErr || !newMenu) {
        console.error('Error duplicating menu in Supabase:', menuErr);
        return null;
      }

      if (menu.dishes && menu.dishes.length > 0) {
        const dishRows = menu.dishes.map((d) => ({
          menu_id: newMenu.id,
          dish_id: d.dishId || d.id,
          meal_type: d.mealType
        }));
        const { data: insertedDishes, error: dishesErr } = await this.supabase
          .from('intake_menu_dishes_new')
          .insert(dishRows)
          .select('id, dish_id, meal_type');

        if (!dishesErr && insertedDishes && insertedDishes.length > 0) {
          const optimizerRows: any[] = [];
          menu.dishes.forEach((d, idx) => {
            if (idx < insertedDishes.length && (d.isOptimizerActive || d.optimizerTargets)) {
              optimizerRows.push({
                intake_menu_dish_id: insertedDishes[idx].id,
                is_optimizer_active: d.isOptimizerActive || false,
                optimizer_targets: d.optimizerTargets || null,
                athlete_id: athleteId || null
              });
            }
          });
          if (optimizerRows.length > 0) {
            const { error: insErr } = await this.supabase.from('intake_menu_dish_optimizers').insert(optimizerRows);
            if (insErr && insErr.message && insErr.message.includes('athlete_id')) {
              const cleaned = optimizerRows.map(({ athlete_id, ...rest }) => rest);
              await this.supabase.from('intake_menu_dish_optimizers').insert(cleaned);
            }
          }
        }
      }

      if (menu.looseIngredients && menu.looseIngredients.length > 0) {
        const looseRows = menu.looseIngredients.map((li) => ({
          menu_id: newMenu.id,
          ingredient_id: li.ingredientId || li.id,
          meal_type: li.mealType,
          quantity: li.quantity,
          mode: li.mode
        }));
        await this.supabase.from('intake_menu_ingredients').insert(looseRows);
      }

      return {
        ...menu,
        id: newMenu.id,
        name: newMenu.name,
        createdBy: athleteId ?? undefined,
        athleteId: athleteId ?? undefined,
        dishes: [...(menu.dishes || [])],
        looseIngredients: [...(menu.looseIngredients || [])]
      };
    } catch (e) {
      console.error('Failed to duplicate menu via Supabase:', e);
      return null;
    }
  }

  /**
   * Carga los planes semanales asignados al atleta logueado.
   */
  public loadWeeklyPlansForAthlete(athleteId: string): Observable<WeeklyTemplate[]> {
    this.isLoading.set(true);
    this.currentAthleteId.set(athleteId);

    try {
      const cached = localStorage.getItem('awakin_cached_weekly_plans_' + athleteId);
      if (cached && this.weeklyPlans().length === 0) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.weeklyPlans.set(parsed);
        }
      }
    } catch {}

    return this.http.get<any[]>(`${this.baseUrl}/athletes/${athleteId}/weekly-plans`).pipe(
      timeout(3500),
      map((plans) => this.mapBackendWeeklyPlans(plans)),
      catchError((err) => {
        console.warn('Backend unavailable for weekly plans, falling back to Supabase client directly:', err);
        return from(this.fetchWeeklyPlansFromSupabase(athleteId));
      }),
      map((templates) => {
        this.weeklyPlans.set(templates);
        try {
          localStorage.setItem('awakin_cached_weekly_plans_' + athleteId, JSON.stringify(templates));
        } catch {}
        this.isLoading.set(false);
        return templates;
      })
    );
  }

  /**
   * Crea un nuevo plan semanal para el atleta.
   */
  public createWeeklyPlan(
    athleteId: string,
    name: string,
    startDate?: string,
    endDate?: string,
    isActive: boolean = true
  ): Observable<WeeklyTemplate | null> {
    const payload: any = {
      name,
      created_by: athleteId,
      is_active: isActive,
      assignments: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day_of_week: d, menu_id: null }))
    };
    if (startDate) payload.start_date = startDate;
    if (endDate) payload.end_date = endDate;

    return this.http.post<any>(`${this.baseUrl}/athletes/${athleteId}/weekly-plans`, payload).pipe(
      map((p) => this.mapSingleBackendWeeklyPlan(p)),
      catchError((err) => {
        console.warn('Backend unavailable for creating weekly plan, falling back to Supabase client directly:', err);
        const insertRow: any = { athlete_id: athleteId, name, created_by: athleteId, is_active: isActive };
        if (startDate) insertRow.start_date = startDate;
        if (endDate) insertRow.end_date = endDate;

        return from(
          this.supabase
            .from('intake_weekly_plans')
            .insert(insertRow)
            .select()
            .single()
        ).pipe(
          map(({ data, error }) => {
            if (error || !data) {
              console.error('Error creating weekly plan via Supabase:', error);
              return null;
            }
            const template: WeeklyTemplate = {
              id: data.id,
              name: data.name,
              isFromCoach: false,
              createdBy: athleteId,
              startDate: data.start_date || undefined,
              endDate: data.end_date || undefined,
              isActive: data.is_active !== undefined ? Boolean(data.is_active) : true,
              assignments: DAY_NAMES.map((dayName) => ({ dayName, menuId: null }))
            };
            return template;
          })
        );
      }),
      map((newTemplate) => {
        if (newTemplate) {
          this.weeklyPlans.update((plans) => [...plans, newTemplate]);
        }
        return newTemplate;
      })
    );
  }

  /**
   * Actualiza el plan semanal (nombre y/o asignaciones de días).
   */
  public saveWeeklyPlan(plan: WeeklyTemplate): Observable<boolean> {
    const assignmentsPayload = plan.assignments.map((a, index) => ({
      day_of_week: index + 1,
      menu_id: a.menuId
    }));

    const payload: any = {
      name: plan.name,
      assignments: assignmentsPayload
    };
    if (plan.startDate) payload.start_date = plan.startDate;
    if (plan.endDate) payload.end_date = plan.endDate;
    if (plan.isActive !== undefined) payload.is_active = plan.isActive;

    return this.http.put(`${this.baseUrl}/weekly-plans/${plan.id}`, payload).pipe(
      map(() => true),
      catchError((err) => {
        console.warn('Backend unavailable for saving plan, falling back to Supabase directly:', err);
        return from(this.saveWeeklyPlanToSupabase(plan)).pipe(map(() => true));
      })
    );
  }

  /**
   * Elimina un plan semanal.
   */
  public deleteWeeklyPlan(planId: string): Observable<boolean> {
    return this.http.delete(`${this.baseUrl}/weekly-plans/${planId}`).pipe(
      map(() => true),
      catchError((err) => {
        console.warn('Backend unavailable for deleting plan, falling back to Supabase directly:', err);
        return from(
          this.supabase
            .from('intake_weekly_plans')
            .delete()
            .eq('id', planId)
        ).pipe(map(({ error }) => !error));
      }),
      map((success) => {
        if (success) {
          this.weeklyPlans.update((plans) => plans.filter((p) => p.id !== planId));
        }
        return success;
      })
    );
  }

  // --- Métodos Privados de Mapeo y Supabase Directo ---

  private mapMenusToPlan(rawMenus: any[], targetAthleteId?: string | null): MenuPlan[] {
    return (rawMenus || []).map((m) => {
      const kcal = Math.round(Number(m.total_calories || 0));
      const p = Math.round(Number(m.total_protein || 0));
      const c = Math.round(Number(m.total_carbs || 0));
      const f = Math.round(Number(m.total_fats || 0));
      const tags = Array.isArray(m.tags) ? m.tags : [];

      const rawDishes = m.dishes || m.intake_menu_dishes_new || [];
      const dishes: DishItem[] = rawDishes.map((d: any) => {
        const dishObj = d.intake_dishes || d;
        const rawDishIngs = dishObj.ingredients || dishObj.intake_dish_ingredients || [];
        const ingredients: DishIngredient[] = rawDishIngs.map((di: any) => {
          const ing = di.intake_ingredients || di.ingredient || di;
          return {
            id: di.id || ing.id,
            ingredient_id: di.ingredient_id || ing.id,
            sub_dish_id: di.sub_dish_id || null,
            name: ing.name || 'Ingrediente',
            quantity: Number(di.quantity || ing.quantity || 0),
            mode: di.mode || ing.mode || 'g',
            unit: ing.unit || di.unit || 'g',
            calories: Number(ing.calories || 0),
            protein: Number(ing.protein || 0),
            carbs: Number(ing.carbs || 0),
            fats: Number(ing.fats || 0),
            fiber: Number(ing.fiber || 0),
            micros: ing.micros || {},
            photo_urls: ing.photo_urls || [],
            serving_size: Number(ing.serving_size || di.serving_size || 100),
            unit_weight_grams: ing.unit_weight_grams ? Number(ing.unit_weight_grams) : undefined,
            sourceClassification: ing.source_classification || di.source_classification || 'CARBOHIDRATO',
            rawIngredientObj: {
              id: ing.id,
              name: ing.name,
              unit: ing.unit || 'g',
              calories: Number(ing.calories || 0),
              protein: Number(ing.protein || 0),
              carbs: Number(ing.carbs || 0),
              fats: Number(ing.fats || 0),
              fiber: Number(ing.fiber || 0),
              micros: ing.micros || {},
              photo_urls: ing.photo_urls || [],
              author_id: ing.author_id || null,
              author_name: ing.author_name || 'Awakin Protocol',
              created_at: ing.created_at || null,
              serving_size: Number(ing.serving_size || 100),
              unit_weight_grams: Number(ing.unit_weight_grams || ing.serving_size || 100),
              source_classification: ing.source_classification || 'CARBOHIDRATO'
            }
          };
        });

        // Extraer optimizador desde intake_menu_dish_optimizers o propiedades directas
        const optRaw = d.intake_menu_dish_optimizers;
        let opt: any = {};
        if (Array.isArray(optRaw) && optRaw.length > 0) {
          const effectiveAthleteId = targetAthleteId || this.currentAthleteId();
          const athleteMatch = effectiveAthleteId
            ? optRaw.find((o: any) => o.athlete_id && String(o.athlete_id) === String(effectiveAthleteId))
            : null;
          const defaultMatch = optRaw.find((o: any) => !o.athlete_id);
          opt = athleteMatch || defaultMatch || optRaw[0];
        } else if (optRaw && typeof optRaw === 'object') {
          opt = optRaw;
        }

        const isOptimizerActive = Boolean(
          opt.is_optimizer_active ?? d.is_optimizer_active ?? dishObj.is_optimizer_active ?? d.isOptimizerActive
        );
        const optimizerTargets = opt.optimizer_targets ?? d.optimizer_targets ?? dishObj.optimizer_targets ?? d.optimizerTargets ?? null;
        const optimizerAthleteId = opt.athlete_id ? String(opt.athlete_id) : null;

        return {
          id: String(d.id || d.dish_id || dishObj.id),
          dishId: String(d.dish_id || dishObj.id),
          name: dishObj.name || 'Platillo',
          mealType: d.meal_type || dishObj.meal_type || 'BREAKFAST',
          meal_types: Array.isArray(dishObj.meal_types) ? dishObj.meal_types : (Array.isArray(dishObj.type) ? dishObj.type : []),
          type: Array.isArray(dishObj.type) ? dishObj.type : (Array.isArray(dishObj.meal_types) ? dishObj.meal_types : []),
          prepTimeMinutes: Number(dishObj.prep_time_minutes || 15),
          coverImageUrl: dishObj.cover_image_url || null,
          authorName: dishObj.author_name || 'Awakin Protocol',
          portions: Number(dishObj.portions || 1),
          totalCalories: Math.round(Number(dishObj.total_calories || 0)),
          totalProtein: Math.round(Number(dishObj.total_protein || 0)),
          totalCarbs: Math.round(Number(dishObj.total_carbs || 0)),
          totalFats: Math.round(Number(dishObj.total_fats || 0)),
          totalFiber: Number(dishObj.total_fiber || 0),
          totalWeightGrams: Number(dishObj.total_weight_grams || 0),
          satietyIndex: Number(dishObj.satiety_index || 0),
          tags: Array.isArray(dishObj.tags) ? dishObj.tags : [],
          instructions: Array.isArray(dishObj.instructions) ? dishObj.instructions : [],
          utensils: Array.isArray(dishObj.utensils) ? dishObj.utensils : [],
          isOptimizerActive,
          optimizerTargets,
          optimizerAthleteId,
          ingredients
        };
      });

      const rawLoose = m.loose_ingredients || m.looseIngredients || m.intake_menu_ingredients || [];
      const looseIngredients: LooseIngredientItem[] = rawLoose.map((li: any) => {
        const ing = li.intake_ingredients || li;
        return {
          id: String(li.id || ing.id),
          ingredientId: String(li.ingredient_id || ing.id),
          name: ing.name || 'Ingrediente',
          mealType: li.meal_type || 'SNACK_PM',
          quantity: Number(li.quantity || 100),
          mode: li.mode || ing.unit || 'g',
          unit: ing.unit || 'g',
          calories: Math.round(Number(ing.calories || 0)),
          protein: Math.round(Number(ing.protein || 0)),
          carbs: Math.round(Number(ing.carbs || 0)),
          fats: Math.round(Number(ing.fats || 0)),
          sourceClassification: ing.source_classification
        };
      });

      let finalKcal = kcal;
      let finalP = p;
      let finalC = c;
      let finalF = f;

      if (dishes.length > 0 || looseIngredients.length > 0) {
        let sumKcal = 0;
        let sumP = 0;
        let sumC = 0;
        let sumF = 0;
        for (const d of dishes) {
          sumKcal += Number(d.totalCalories) || 0;
          sumP += Number(d.totalProtein) || 0;
          sumC += Number(d.totalCarbs) || 0;
          sumF += Number(d.totalFats) || 0;
        }
        for (const li of looseIngredients) {
          const factor = (Number(li.quantity) || 100) / 100;
          sumKcal += (Number(li.calories) || 0) * factor;
          sumP += (Number(li.protein) || 0) * factor;
          sumC += (Number(li.carbs) || 0) * factor;
          sumF += (Number(li.fats) || 0) * factor;
        }
        finalKcal = Math.round(sumKcal);
        finalP = Math.round(sumP);
        finalC = Math.round(sumC);
        finalF = Math.round(sumF);
      } else if (finalKcal === 0 && (finalP > 0 || finalC > 0 || finalF > 0)) {
        finalKcal = (finalP * 4) + (finalC * 4) + (finalF * 9);
      }

      const initialMenu: MenuPlan = {
        id: String(m.id),
        name: m.name || 'Menú sin nombre',
        coverIcon: determineCoverIcon(m.name || '', tags),
        coverImageUrl: m.cover_image_url || null,
        tags,
        kcal: finalKcal,
        macros: `${finalP}P • ${finalC}C • ${finalF}G`,
        protein: finalP,
        carbs: finalC,
        fats: finalF,
        authorName: m.author_name || 'Awakin Protocol',
        description: m.description || null,
        createdBy: m.created_by || m.createdBy || null,
        athleteId: m.athlete_id || m.athleteId || null,
        dishes,
        looseIngredients
      };

      return applyOptimizationToMenu(initialMenu);
    });
  }

  private mapBackendWeeklyPlans(plans: any[]): WeeklyTemplate[] {
    return (plans || []).map((p) => this.mapSingleBackendWeeklyPlan(p));
  }

  private mapSingleBackendWeeklyPlan(p: any): WeeklyTemplate {
    const rawAssignments = p.assignments || [];
    const assignmentsMap = new Map<number, string | null>();
    const menusMap = new Map<number, any>();
    for (const a of rawAssignments) {
      assignmentsMap.set(Number(a.day_of_week), a.menu_id || null);
      if (a.menu) {
        menusMap.set(Number(a.day_of_week), a.menu);
      }
    }

    const assignments: DayAssignment[] = [1, 2, 3, 4, 5, 6, 7].map((dayNum, idx) => {
      const rawMenu = menusMap.get(dayNum);
      const mappedMenu = rawMenu ? this.mapMenusToPlan([rawMenu], this.currentAthleteId())[0] : null;
      return {
        dayName: DAY_NAMES[idx],
        menuId: assignmentsMap.get(dayNum) || null,
        menu: mappedMenu
      };
    });

    const embeddedMenus: MenuPlan[] = [];
    assignments.forEach((asg) => {
      if (asg.menu) embeddedMenus.push(asg.menu);
    });
    if (embeddedMenus.length > 0) {
      this.availableMenus.update((curr) => {
        const existingIds = new Set(curr.map((m) => m.id));
        const newOnes = embeddedMenus.filter((m) => !existingIds.has(m.id));
        return newOnes.length > 0 ? [...curr, ...newOnes] : curr;
      });
    }

    const athleteId = this.currentAthleteId();
    const isFromCoach = p.is_from_coach !== undefined
      ? Boolean(p.is_from_coach)
      : Boolean(!p.created_by || p.created_by !== athleteId);

    return {
      id: String(p.id),
      name: p.name || 'Mi Plan Semanal',
      isFromCoach,
      createdBy: p.created_by || null,
      startDate: p.start_date || p.startDate || undefined,
      endDate: p.end_date || p.endDate || undefined,
      isActive: p.is_active !== undefined ? Boolean(p.is_active) : (p.isActive !== undefined ? Boolean(p.isActive) : true),
      assignments
    };
  }

  private async fetchWeeklyPlansFromSupabase(athleteId: string): Promise<WeeklyTemplate[]> {
    const { data: plans, error: ep } = await this.supabase
      .from('intake_weekly_plans')
      .select('id, athlete_id, name, created_at, created_by, start_date, end_date, is_active')
      .eq('athlete_id', athleteId)
      .order('created_at');

    if (ep || !plans || plans.length === 0) {
      return [];
    }

    const planIds = plans.map((p) => p.id);
    const { data: planMenus, error: epm } = await this.supabase
      .from('intake_plan_menus')
      .select('plan_id, menu_id, day_of_week')
      .in('plan_id', planIds)
      .order('day_of_week');

    const pmList = planMenus || [];

    return plans.map((plan) => {
      const dayMap = new Map<number, string | null>();
      for (const pm of pmList) {
        if (pm.plan_id === plan.id) {
          dayMap.set(Number(pm.day_of_week), pm.menu_id || null);
        }
      }

      const assignments: DayAssignment[] = [1, 2, 3, 4, 5, 6, 7].map((dayNum, idx) => ({
        dayName: DAY_NAMES[idx],
        menuId: dayMap.get(dayNum) || null
      }));

      const isFromCoach = Boolean(!plan.created_by || plan.created_by !== athleteId);

      return {
        id: String(plan.id),
        name: plan.name || 'Mi Plan Semanal',
        isFromCoach,
        createdBy: plan.created_by || null,
        startDate: plan.start_date || undefined,
        endDate: plan.end_date || undefined,
        isActive: plan.is_active !== undefined ? Boolean(plan.is_active) : true,
        assignments
      };
    });
  }

  private async saveWeeklyPlanToSupabase(plan: WeeklyTemplate): Promise<void> {
    // 1. Actualizar campos maestros si no es un plan nuevo
    const updateObj: any = { name: plan.name };
    if (plan.startDate) updateObj.start_date = plan.startDate;
    if (plan.endDate) updateObj.end_date = plan.endDate;
    if (plan.isActive !== undefined) updateObj.is_active = plan.isActive;

    await this.supabase
      .from('intake_weekly_plans')
      .update(updateObj)
      .eq('id', plan.id);

    // 2. Limpiar y re-insertar asignaciones
    await this.supabase
      .from('intake_plan_menus')
      .delete()
      .eq('plan_id', plan.id);

    const rows = plan.assignments
      .map((a, idx) => ({
        plan_id: plan.id,
        day_of_week: idx + 1,
        menu_id: a.menuId
      }))
      .filter((r) => !!r.menu_id);

    if (rows.length > 0) {
      await this.supabase
        .from('intake_plan_menus')
        .insert(rows);
    }
  }

  // ==========================================
  // REGISTROS NUTRICIONALES DE PRUEBAS
  // ==========================================

  public loadFoodRecords(email: string, dateStr?: string): Observable<any[]> {
    const params: any = { email };
    if (dateStr) params.date = dateStr;
    return this.http.get<any[]>(`${this.baseUrl}/records`, { params }).pipe(
      catchError(async () => {
        let q = this.supabase
          .from('registros_nutricionales_pruebas')
          .select('*')
          .eq('email', email);
        if (dateStr) {
          q = q.ilike('id_original', `${dateStr}%`);
        }
        const { data } = await q.order('timestamp', { ascending: false });
        return data || [];
      })
    );
  }

  public createFoodRecord(record: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/records`, record).pipe(
      catchError(async () => {
        const { data, error } = await this.supabase
          .from('registros_nutricionales_pruebas')
          .insert(record)
          .select()
          .single();
        if (error) throw error;
        return data;
      })
    );
  }

  public updateFoodRecordStatus(idOriginal: string, isActive: boolean): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/records/${idOriginal}/status`, { is_active: isActive }).pipe(
      catchError(async () => {
        const { data, error } = await this.supabase
          .from('registros_nutricionales_pruebas')
          .update({ is_active: isActive })
          .eq('id_original', idOriginal)
          .select()
          .single();
        if (error) throw error;
        return data;
      })
    );
  }

  public async uploadFoodReportImage(file: File, athleteId?: string): Promise<string> {
    // Compresión y redimensionamiento en el cliente para ahorro de datos y subida ultrarrápida
    const compressedBlob = await compressImage(file, 1200, 0.82);
    const filename = `food_${athleteId || 'ath'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    
    let backendDetail: string | null = null;
    // 1. Intentar subir mediante endpoint de backend
    try {
      const formData = new FormData();
      formData.append('file', compressedBlob, filename);
      const res: any = await this.http.post(
        `${environment.apiUrl}/athletes/upload-media?bucket=Intake_Food_Report`,
        formData
      ).toPromise();
      if (res && res.public_url) {
        return res.public_url;
      }
    } catch (e: any) {
      console.warn('Backend upload failed, attempting direct Supabase upload:', e);
      backendDetail = e?.error?.detail || e?.message || null;
    }

    // 2. Fallback a Supabase Storage directo con caché de 1 año (31536000s)
    const { error } = await this.supabase.storage
      .from('Intake_Food_Report')
      .upload(filename, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000'
      });

    if (error) {
      console.error('Error uploading image to Intake_Food_Report bucket:', error);
      const msg = backendDetail || error.message || 'El bucket Intake_Food_Report no fue encontrado en Supabase.';
      throw new Error(msg);
    }

    const { data: publicData } = this.supabase.storage
      .from('Intake_Food_Report')
      .getPublicUrl(filename);

    return publicData.publicUrl;
  }

  /**
   * Guarda o actualiza los targets del optimizador para un plato de menú,
   * asignados opcionalmente a un atleta específico (o globales/default si athleteId es null).
   */
  public saveDishOptimizerTargets(
    menuDishId: string,
    isOptimizerActive: boolean,
    targets: any,
    athleteId?: string | null
  ): Observable<any> {
    const payload = {
      is_optimizer_active: isOptimizerActive,
      optimizer_targets: targets,
      athlete_id: athleteId || null
    };

    return this.http.put(`${this.baseUrl}/menu-dishes/${menuDishId}/optimizer`, payload).pipe(
      catchError(async () => {
        try {
          let q = this.supabase
            .from('intake_menu_dish_optimizers')
            .select('id')
            .eq('intake_menu_dish_id', menuDishId);
          if (athleteId) {
            q = q.eq('athlete_id', athleteId);
          } else {
            q = q.is('athlete_id', null);
          }
          const { data: existing } = await q;
          const row: any = {
            intake_menu_dish_id: menuDishId,
            is_optimizer_active: isOptimizerActive,
            optimizer_targets: targets
          };
          if (athleteId) row.athlete_id = athleteId;

          if (existing && existing.length > 0) {
            const { data } = await this.supabase
              .from('intake_menu_dish_optimizers')
              .update(row)
              .eq('id', existing[0].id)
              .select()
              .single();
            return data;
          } else {
            const { data } = await this.supabase
              .from('intake_menu_dish_optimizers')
              .insert(row)
              .select()
              .single();
            return data;
          }
        } catch (e) {
          console.error('Error guardando targets optimizador en Supabase:', e);
          throw e;
        }
      })
    );
  }

  /**
   * Carga el catálogo completo de ingredientes de `intake_ingredients` para
   * la selección manual (Vía B) y anclaje nutricional.
   */
  public loadCatalogIngredients(): Observable<CatalogIngredient[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.baseUrl}/ingredients`).pipe(
      timeout(3500),
      map((rows) => this.mapCatalogIngredients(rows)),
      catchError((err) => {
        console.warn('Backend unavailable for ingredients, falling back to Supabase client directly:', err);
        return from(
          this.supabase
            .from('intake_ingredients')
            .select('*')
            .order('name')
        ).pipe(
          map(({ data, error }) => {
            if (error || !data || data.length === 0) {
              return this.extractIngredientsFromMenus();
            }
            return this.mapCatalogIngredients(data as Record<string, unknown>[]);
          }),
          catchError(() => of(this.extractIngredientsFromMenus()))
        );
      }),
      map((ingredients) => {
        const resolved = ingredients.length > 0 ? ingredients : this.extractIngredientsFromMenus();
        if (resolved.length > 0) {
          this.availableIngredients.set(resolved);
          try {
            localStorage.setItem('awakin_cached_ingredients', JSON.stringify(resolved));
          } catch {}
        }
        return resolved;
      })
    );
  }

  /**
   * Envía la fotografía de la comida al endpoint de visión IA para estimar
   * ingredientes, cantidades, macros y kcal.
   */
  public analyzeFoodPhoto(source: {
    file?: File | null;
    imageUrl?: string | null;
    mealType?: string;
    notes?: string;
  }): Observable<FoodPhotoEstimationResult> {
    const buildRequest$: Observable<FormData> = source.file
      ? from(compressImage(source.file, 1024, 0.8)).pipe(
          map((blob) => {
            const formData = new FormData();
            formData.append('file', blob, source.file?.name || 'meal.jpg');
            if (source.mealType) formData.append('meal_type', source.mealType);
            if (source.notes?.trim()) formData.append('notes', source.notes.trim());
            return formData;
          })
        )
      : of(null).pipe(
          map(() => {
            const formData = new FormData();
            if (source.imageUrl) formData.append('image_url', source.imageUrl);
            if (source.mealType) formData.append('meal_type', source.mealType);
            if (source.notes?.trim()) formData.append('notes', source.notes.trim());
            return formData;
          })
        );

    return buildRequest$.pipe(
      switchMap((formData) =>
        this.http.post<Record<string, unknown>>(`${this.baseUrl}/analyze-food-photo`, formData).pipe(
          timeout(25000)
        )
      ),
      map((res) => {
        if (res['success'] === false) {
          throw new Error(String(res['message'] || 'No se pudo estimar la comida desde la fotografía.'));
        }
        const rawIngredients = Array.isArray(res['ingredients']) ? res['ingredients'] : [];
        const mappedIngredients: FormattedRecordIngredient[] = rawIngredients.map((item) => {
          const row = item as Record<string, unknown>;
          const modo = row['modo'] === 'portions' ? 'portions' : 'g';
          return {
            ingredient_id: row['ingredient_id'] ? String(row['ingredient_id']) : null,
            nombre: String(row['nombre'] || 'Ingrediente'),
            cantidad_display: String(row['cantidad_display'] || `${Math.round(Number(row['cantidad_g'] || 0))} g`),
            cantidad_original: Number(row['cantidad_original'] || 0),
            unidad_original: String(row['unidad_original'] || 'g'),
            modo,
            cantidad_g: Number(row['cantidad_g'] || 0),
            kcals: Math.round(Number(row['kcals'] || 0)),
            proteinas_g: Math.round(Number(row['proteinas_g'] || 0) * 10) / 10,
            carbohidratos_g: Math.round(Number(row['carbohidratos_g'] || 0) * 10) / 10,
            grasas_g: Math.round(Number(row['grasas_g'] || 0) * 10) / 10,
          };
        });

        return {
          dishName: String(res['dish_name'] || 'Plato estimado'),
          kcal: Math.round(Number(res['kcal'] || 0)),
          protein: Math.round(Number(res['protein'] || 0) * 10) / 10,
          carbs: Math.round(Number(res['carbs'] || 0) * 10) / 10,
          fat: Math.round(Number(res['fat'] || 0) * 10) / 10,
          ingredients: mappedIngredients,
          provider: res['provider'] ? String(res['provider']) : null,
        };
      })
    );
  }

  private mapCatalogIngredients(rows: Record<string, unknown>[]): CatalogIngredient[] {
    return (rows || [])
      .filter((r) => r && r['id'] && r['name'])
      .map((r) => ({
        id: String(r['id']),
        name: String(r['name']),
        unit: String(r['unit'] || 'g'),
        serving_size: Number(r['serving_size'] || 100),
        calories: Number(r['calories'] || 0),
        protein: Number(r['protein'] || 0),
        carbs: Number(r['carbs'] || 0),
        fats: Number(r['fats'] || 0),
        fiber: r['fiber'] !== undefined && r['fiber'] !== null ? Number(r['fiber']) : undefined,
        unit_weight_grams:
          r['unit_weight_grams'] !== undefined && r['unit_weight_grams'] !== null
            ? Number(r['unit_weight_grams'])
            : undefined,
        source_classification: r['source_classification'] ? String(r['source_classification']) : undefined,
        photo_urls: Array.isArray(r['photo_urls']) ? (r['photo_urls'] as string[]) : [],
      }));
  }

  private extractIngredientsFromMenus(): CatalogIngredient[] {
    const byId = new Map<string, CatalogIngredient>();
    for (const menu of this.availableMenus()) {
      for (const dish of menu.dishes || []) {
        for (const di of dish.ingredients || []) {
          const id = String(di.ingredient_id || di.id || di.name);
          if (!id || byId.has(id)) continue;
          const raw = di.rawIngredientObj || {};
          byId.set(id, {
            id,
            name: di.name || raw.name || 'Ingrediente',
            unit: di.unit || raw.unit || 'g',
            serving_size: Number(di.serving_size ?? raw.serving_size ?? 100),
            calories: Number(di.calories ?? raw.calories ?? 0),
            protein: Number(di.protein ?? raw.protein ?? 0),
            carbs: Number(di.carbs ?? raw.carbs ?? 0),
            fats: Number(di.fats ?? raw.fats ?? 0),
            unit_weight_grams: di.unit_weight_grams ?? raw.unit_weight_grams,
            source_classification: di.sourceClassification ?? raw.source_classification,
            photo_urls: di.photo_urls ?? raw.photo_urls ?? [],
          });
        }
      }
      for (const li of menu.looseIngredients || []) {
        const id = String(li.ingredientId || li.id || li.name);
        if (!id || byId.has(id)) continue;
        byId.set(id, {
          id,
          name: li.name,
          unit: li.unit || 'g',
          serving_size: 100,
          calories: Number(li.calories || 0),
          protein: Number(li.protein || 0),
          carbs: Number(li.carbs || 0),
          fats: Number(li.fats || 0),
          source_classification: li.sourceClassification,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}
