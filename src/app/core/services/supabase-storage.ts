import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseStorageService {
  private supabase: SupabaseClient;
  
  // Reemplaza esto con tus credenciales reales o léelas de tus environments de Angular
  private supabaseUrl = 'https://TU_PROJECT_ID.supabase.co';
  private supabaseAnonKey = 'TU_ANON_PUBLIC_KEY';
  private bucketName = 'imagenes-awakin'; // El nombre que le pusiste a tu Bucket público

  constructor() {
    this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
  }

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