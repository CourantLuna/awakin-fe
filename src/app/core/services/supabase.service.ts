import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Singleton Supabase Client compartido en toda la aplicación.
 * Previene la advertencia "Multiple GoTrueClient instances detected in the same browser context"
 * y evita colisiones en el token de autenticación en LocalStorage.
 */
export const supabaseClient: SupabaseClient = createClient(
  environment.SUPABASE_URL,
  environment.SUPABASE_KEY
);

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public readonly client: SupabaseClient = supabaseClient;
}

