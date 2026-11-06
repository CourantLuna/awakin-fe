import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class SupabaseStorageService {
  private supabase: SupabaseClient = supabaseClient;
  private bucketName = 'imagenes-awakin';

  constructor() {}

  /**
   * Sube un archivo al bucket de Supabase y retorna la URL pública
   * @param file Archivo obtenido del input HTML
   * @param folder Carpeta de destino dentro del bucket (ej: 'avatars', 'meals')
   */
  async uploadImage(file: File, folder: string = 'general'): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      // Creamos un nombre único usando el timestamp para evitar colisiones
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // 1. Subir el archivo al bucket
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error al subir a Supabase:', error.message);
        return null;
      }

      // 2. Obtener y retornar la URL pública directa
      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Error inesperado en el servicio de Storage:', err);
      return null;
    }
  }
}