import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ExerciseDetail,
  ExerciseSummary,
  PaginatedExercisesResponse,
  BodyMapTaxonomyResponse,
  EquipmentResponse
} from '../models/exercises.models';

@Injectable({
  providedIn: 'root'
})
export class ExerciseApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = environment.exercisesApiUrl || 'https://exercises.awakin.app/api';
  private readonly cdnUrl = environment.exercisesCdnUrl || 'https://exercises.awakin.app';
  private readonly fallbackApiUrl = 'https://exercises.awakin.app/api';
  private readonly fallbackCdnUrl = 'https://exercises.awakin.app';

  /**
   * Resuelve la URL pública y absoluta de una miniatura o GIF
   * @param relativePath ej: "images/0001-2gPfomN.jpg" o "videos/0001-2gPfomN.gif"
   */
  getMediaUrl(relativePath?: string | null): string {
    if (!relativePath) return '';
    if (relativePath.startsWith('http')) return relativePath;
    let cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const base = this.cdnUrl.endsWith('/') ? this.cdnUrl.slice(0, -1) : this.cdnUrl;

    if (base.endsWith('/public') && cleanPath.startsWith('public/')) {
      cleanPath = cleanPath.slice('public/'.length);
    }
    return `${base}/${cleanPath}`;
  }

  /**
   * Obtiene ejercicios a partir del click en un músculo o articulación del BodyMap
   * @param bodyMapId ID emitido por el BodyMapComponent (ej: 'upper-pectoralis', 'quads', 'knees')
   * @param page Página actual (default: 1)
   * @param limit Cantidad por página (default: 24)
   * @param equipment Filtro opcional por equipamiento
   * @param search Filtro opcional por búsqueda de texto
   * @param primaryOnly Si es true, excluye sinergistas y devuelve solo objetivo primario
   */
  getExercisesByBodyMap(
    bodyMapId: string,
    page: number = 1,
    limit: number = 24,
    equipment?: string | null,
    search?: string | null,
    primaryOnly: boolean = false
  ): Observable<PaginatedExercisesResponse> {
    let params = new HttpParams()
      .set('body_map_id', bodyMapId)
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('lang', 'es'); // Solo instrucciones en español

    if (primaryOnly) {
      params = params.set('primary_only', 'true');
    }

    if (equipment && equipment !== 'all' && equipment !== 'Todos') {
      params = params.set('equipment', equipment);
    }
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PaginatedExercisesResponse>(`${this.apiUrl}/exercises`, { params }).pipe(
      catchError((err) => {
        // Fallback a producción si el entorno local (localhost:3000) no responde
        if (this.apiUrl !== this.fallbackApiUrl) {
          console.warn('Local Exercise API unreachable, falling back to production:', err);
          return this.http.get<PaginatedExercisesResponse>(`${this.fallbackApiUrl}/exercises`, { params });
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Búsqueda general con filtros combinados (nombre, equipo, músculo)
   */
  searchExercises(options: {
    search?: string;
    body_part?: string;
    target?: string;
    equipment?: string;
    body_map_id?: string;
    page?: number;
    limit?: number;
  }): Observable<PaginatedExercisesResponse> {
    let params = new HttpParams().set('lang', 'es');

    if (options.search?.trim()) params = params.set('search', options.search.trim());
    if (options.body_map_id) params = params.set('body_map_id', options.body_map_id);
    if (options.body_part) params = params.set('body_part', options.body_part);
    if (options.target) params = params.set('target', options.target);
    if (options.equipment && options.equipment !== 'all' && options.equipment !== 'Todos') {
      params = params.set('equipment', options.equipment);
    }
    if (options.page) params = params.set('page', options.page.toString());
    if (options.limit) params = params.set('limit', options.limit.toString());

    return this.http.get<PaginatedExercisesResponse>(`${this.apiUrl}/exercises`, { params }).pipe(
      catchError((err) => {
        if (this.apiUrl !== this.fallbackApiUrl) {
          console.warn('Local Exercise API unreachable, falling back to production:', err);
          return this.http.get<PaginatedExercisesResponse>(`${this.fallbackApiUrl}/exercises`, { params });
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Obtiene el detalle completo de un ejercicio (instrucciones paso a paso y multimedia)
   */
  getExerciseDetail(id: string): Observable<{ success: boolean; data: ExerciseDetail }> {
    const params = new HttpParams().set('lang', 'es');
    return this.http.get<{ success: boolean; data: ExerciseDetail }>(
      `${this.apiUrl}/exercises/${id}`,
      { params }
    ).pipe(
      catchError((err) => {
        if (this.apiUrl !== this.fallbackApiUrl) {
          return this.http.get<{ success: boolean; data: ExerciseDetail }>(
            `${this.fallbackApiUrl}/exercises/${id}`,
            { params }
          );
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Obtiene la taxonomía completa del BodyMap con sus 56 regiones y contadores
   */
  getBodyMapTaxonomy(): Observable<BodyMapTaxonomyResponse> {
    return this.http.get<BodyMapTaxonomyResponse>(`${this.apiUrl}/body-map`).pipe(
      catchError((err) => {
        if (this.apiUrl !== this.fallbackApiUrl) {
          return this.http.get<BodyMapTaxonomyResponse>(`${this.fallbackApiUrl}/body-map`);
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Obtiene la lista de equipamientos disponibles y el recuento de ejercicios
   */
  getEquipmentList(): Observable<EquipmentResponse> {
    return this.http.get<EquipmentResponse>(`${this.apiUrl}/equipment`).pipe(
      catchError((err) => {
        if (this.apiUrl !== this.fallbackApiUrl) {
          return this.http.get<EquipmentResponse>(`${this.fallbackApiUrl}/equipment`);
        }
        return throwError(() => err);
      })
    );
  }
}

