import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, catchError, map, switchMap } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { MenuPlan, WeeklyTemplate, DayAssignment, DishItem, DishIngredient, LooseIngredientItem } from '../../features/intake/models/intake.models';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function determineCoverIcon(name: string, tags: string[] = []): string {
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
  private supabase: SupabaseClient;
  private readonly baseUrl = `${environment.apiUrl}/intake`;

  public availableMenus = signal<MenuPlan[]>([]);
  public weeklyPlans = signal<WeeklyTemplate[]>([]);
  public isLoading = signal<boolean>(false);
  public currentAthleteId = signal<string | null>(null);

  constructor() {
    this.supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY);
  }

  /**
   * Carga el catálogo de menús de intake_menus (obviando shared_plan_id y athlete_id).
   */
  public loadAvailableMenus(): Observable<MenuPlan[]> {
    return this.http.get<any[]>(`${this.baseUrl}/menus`).pipe(
      map((menus) => this.mapMenusToPlan(menus)),
      catchError((err) => {
        console.warn('Backend unavailable for menus, falling back to Supabase client directly:', err);
        const query = `
          id, name, created_at, cover_image_url, author_id, author_name, is_public, total_calories, total_protein, total_carbs, total_fats, tags, description,
          intake_menu_dishes(dish_id, meal_type, is_optimizer_active, optimizer_targets, intake_dishes(*, intake_dish_ingredients!intake_dish_ingredients_dish_id_fkey(quantity, mode, intake_ingredients(id, name, unit, calories, protein, carbs, fats, source_classification)))),
          intake_menu_ingredients(id, ingredient_id, meal_type, quantity, mode, intake_ingredients(id, name, unit, calories, protein, carbs, fats, source_classification))
        `;
        return from(
          this.supabase
            .from('intake_menus')
            .select(query)
            .order('name')
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              console.error('Error fetching menus from Supabase:', error);
              return [];
            }
            return this.mapMenusToPlan(data || []);
          })
        );
      }),
      map((menus) => {
        this.availableMenus.set(menus);
        return menus;
      })
    );
  }

  /**
   * Carga los planes semanales asignados al atleta logueado.
   */
  public loadWeeklyPlansForAthlete(athleteId: string): Observable<WeeklyTemplate[]> {
    this.isLoading.set(true);
    this.currentAthleteId.set(athleteId);

    return this.http.get<any[]>(`${this.baseUrl}/athletes/${athleteId}/weekly-plans`).pipe(
      map((plans) => this.mapBackendWeeklyPlans(plans)),
      catchError((err) => {
        console.warn('Backend unavailable for weekly plans, falling back to Supabase client directly:', err);
        return from(this.fetchWeeklyPlansFromSupabase(athleteId));
      }),
      map((templates) => {
        this.weeklyPlans.set(templates);
        this.isLoading.set(false);
        return templates;
      })
    );
  }

  /**
   * Crea un nuevo plan semanal para el atleta.
   */
  public createWeeklyPlan(athleteId: string, name: string): Observable<WeeklyTemplate | null> {
    const payload = {
      name,
      assignments: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day_of_week: d, menu_id: null }))
    };

    return this.http.post<any>(`${this.baseUrl}/athletes/${athleteId}/weekly-plans`, payload).pipe(
      map((p) => this.mapSingleBackendWeeklyPlan(p)),
      catchError((err) => {
        console.warn('Backend unavailable for creating weekly plan, falling back to Supabase client directly:', err);
        return from(
          this.supabase
            .from('intake_weekly_plans')
            .insert({ athlete_id: athleteId, name })
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

    const payload = {
      name: plan.name,
      assignments: assignmentsPayload
    };

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

  private mapMenusToPlan(rawMenus: any[]): MenuPlan[] {
    return (rawMenus || []).map((m) => {
      const kcal = Math.round(Number(m.total_calories || 0));
      const p = Math.round(Number(m.total_protein || 0));
      const c = Math.round(Number(m.total_carbs || 0));
      const f = Math.round(Number(m.total_fats || 0));
      const tags = Array.isArray(m.tags) ? m.tags : [];

      const rawDishes = m.dishes || m.intake_menu_dishes || [];
      const dishes: DishItem[] = rawDishes.map((d: any) => {
        const dishObj = d.intake_dishes || d;
        const rawDishIngs = dishObj.ingredients || dishObj.intake_dish_ingredients || [];
        const ingredients: DishIngredient[] = rawDishIngs.map((di: any) => {
          const ing = di.intake_ingredients || di;
          return {
            id: ing.id,
            name: ing.name || 'Ingrediente',
            quantity: Number(di.quantity || ing.quantity || 0),
            mode: di.mode || ing.mode || 'g',
            unit: ing.unit || di.unit || 'g',
            calories: Number(ing.calories || 0),
            protein: Number(ing.protein || 0),
            carbs: Number(ing.carbs || 0),
            fats: Number(ing.fats || 0),
            sourceClassification: ing.source_classification || di.source_classification
          };
        });

        return {
          id: String(d.id || d.dish_id || dishObj.id),
          dishId: String(d.dish_id || dishObj.id),
          name: dishObj.name || 'Platillo',
          mealType: d.meal_type || dishObj.meal_type || 'BREAKFAST',
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
          isOptimizerActive: Boolean(d.is_optimizer_active),
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

      return {
        id: String(m.id),
        name: m.name || 'Menú sin nombre',
        coverIcon: determineCoverIcon(m.name || '', tags),
        coverImageUrl: m.cover_image_url || null,
        tags,
        kcal,
        macros: `${p}P • ${c}C • ${f}G`,
        protein: p,
        carbs: c,
        fats: f,
        authorName: m.author_name || 'Awakin Protocol',
        description: m.description || null,
        dishes,
        looseIngredients
      };
    });
  }

  private mapBackendWeeklyPlans(plans: any[]): WeeklyTemplate[] {
    return (plans || []).map((p) => this.mapSingleBackendWeeklyPlan(p));
  }

  private mapSingleBackendWeeklyPlan(p: any): WeeklyTemplate {
    const rawAssignments = p.assignments || [];
    const assignmentsMap = new Map<number, string | null>();
    for (const a of rawAssignments) {
      assignmentsMap.set(Number(a.day_of_week), a.menu_id || null);
    }

    const assignments: DayAssignment[] = [1, 2, 3, 4, 5, 6, 7].map((dayNum, idx) => ({
      dayName: DAY_NAMES[idx],
      menuId: assignmentsMap.get(dayNum) || null
    }));

    return {
      id: String(p.id),
      name: p.name || 'Mi Plan Semanal',
      isFromCoach: false,
      assignments
    };
  }

  private async fetchWeeklyPlansFromSupabase(athleteId: string): Promise<WeeklyTemplate[]> {
    const { data: plans, error: ep } = await this.supabase
      .from('intake_weekly_plans')
      .select('id, athlete_id, name, created_at')
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

      return {
        id: String(plan.id),
        name: plan.name || 'Mi Plan Semanal',
        isFromCoach: false,
        assignments
      };
    });
  }

  private async saveWeeklyPlanToSupabase(plan: WeeklyTemplate): Promise<void> {
    // 1. Actualizar nombre si no es un plan nuevo
    await this.supabase
      .from('intake_weekly_plans')
      .update({ name: plan.name })
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
}
