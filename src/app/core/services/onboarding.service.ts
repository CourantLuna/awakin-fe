import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DietTypeOption {
  id: string | null;
  slug?: string;
  name: string;
  description?: string;
  protein_pct: number;
  carbs_pct: number;
  fats_pct: number;
  protein_p_kg?: number | null;
  fats_p_kg?: number | null;
}

export interface UsernameCheckResponse {
  available: boolean;
  normalized: string;
  reason?: string | null;
}

export interface OnboardingPrefillResponse {
  athlete?: {
    id?: string;
    email?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    gender?: string;
    birth_date?: string;
    altura_cm?: number;
    nivel_actividad?: string;
    has_completed_onboarding?: boolean;
  };
  onboarding?: any;
}

export interface OnboardingCompletePayload {
  athlete_id: string;
  email?: string;
  username: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  gender: string;
  birth_date: string;
  current_weight: number;
  weight_unit: 'lb' | 'kg';
  altura_cm: number;
  nivel_actividad: string;
  protocol: 'DEFICIT' | 'MAINTENANCE' | 'SURPLUS' | 'RECOMPOSITION';
  target_weight?: number | null;
  pace_percent?: number | null;
  estimated_weeks?: number | null;
  diet_type_id?: string | null;
  goal_kcal: number;
  protein_target_g: number;
  carbs_target_g: number;
  fats_target_g: number;
  meal_types: string[];
  favorite_proteins: string[];
  favorite_carbs: string[];
  favorite_fats: string[];
  favorite_free_meals?: string | null;
  disliked_foods?: string | null;
  medical_conditions: string[];
  medical_conditions_other?: string | null;
  injuries_notes?: string | null;
  allergies_intolerances?: string | null;
  medications_supplements?: string | null;
  stress_level?: number | null;
  sleep_hours?: string | null;
  digestive_symptoms: string[];
  menstrual_cycle_status?: string | null;
  daily_water_intake?: string | null;
  alcohol_frequency?: string | null;
  training_days_per_week?: number | null;
  training_location?: 'GYM' | 'HOME' | 'HYBRID';
  training_duration_minutes?: number | null;
  training_preferred_time?: string | null;
  cintura?: number | null;
  cadera?: number | null;
  pecho?: number | null;
  cuello?: number | null;
  biceps?: number | null;
  muslo?: number | null;
  porcentaje_grasa?: number | null;
  masa_muscular?: number | null;
  foto_frontal_url?: string | null;
  foto_lateral_url?: string | null;
  foto_espalda_url?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding`;

  public checkUsername(username: string, excludeAthleteId?: string): Observable<UsernameCheckResponse> {
    const params: Record<string, string> = { username };
    if (excludeAthleteId) params['exclude_athlete_id'] = excludeAthleteId;
    return this.http.get<UsernameCheckResponse>(`${this.baseUrl}/check-username`, { params });
  }

  public getDietTypes(): Observable<DietTypeOption[]> {
    return this.http.get<DietTypeOption[]>(`${this.baseUrl}/diet-types`);
  }

  public getPrefill(athleteId: string): Observable<OnboardingPrefillResponse> {
    return this.http.get<OnboardingPrefillResponse>(`${this.baseUrl}/profile/${encodeURIComponent(athleteId)}`);
  }

  public completeOnboarding(payload: OnboardingCompletePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/complete`, payload);
  }
}
