/**
 * Utilidad de compresión y redimensionamiento de imágenes en el cliente (Browser / PWA).
 *
 * Utiliza la API nativa de HTML5 Canvas para optimizar imágenes directamente en el dispositivo móvil
 * o de escritorio antes de subirlas por la red.
 *
 * Beneficios para PWA Móvil:
 * - Reduce fotos tomadas con cámara (4MB - 12MB) a ~80KB - 160KB (ahorro de ~97% en datos).
 * - No requiere dependencias pesadas de terceros.
 * - Respeta las proporciones originales (aspect ratio).
 * - Fallback seguro: si el navegador no soporta Canvas o el archivo no es imagen, retorna el original.
 */
export async function compressImage(
  file: File | Blob,
  maxDimension: number = 1200,
  quality: number = 0.8
): Promise<Blob> {
  // Si no es un Blob/File válido, devolver tal cual
  if (!file) {
    return file;
  }

  // Si no es imagen, o es SVG / GIF animado, no recomprimir
  const fileType = file.type || '';
  if (fileType && !fileType.startsWith('image/')) {
    return file;
  }
  if (fileType === 'image/svg+xml' || fileType === 'image/gif') {
    return file;
  }

  // Si el archivo ya pesa menos de 120 KB, no gastar procesamiento innecesario
  if (file.size && file.size < 120 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(file);
        }

        // Redimensionar proporcionalmente respetando maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        // Suavizado de bordes de alta calidad para móvil
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0 && blob.size < file.size) {
              resolve(blob);
            } else {
              // Si el blob resultante fuera mayor o vacío, usar el original
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

