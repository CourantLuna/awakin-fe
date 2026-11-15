export interface EquipmentMeta {
  value: string;
  label: string;
  iconSvg: string; // SVG path o elemento visual vectorizado
  count?: number;
}

export const EQUIPMENT_META_MAP: Record<string, { label: string; iconSvg: string }> = {
  'all': {
    label: 'Todos los Equipos',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`
  },
  'body weight': {
    label: 'Peso Corporal (Calistenia)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>`
  },
  'dumbbell': {
    label: 'Mancuernas',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>`
  },
  'barbell': {
    label: 'Barra Olímpica / Estándar',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M6 7v10"/><path d="M4 9v6"/><path d="M18 7v10"/><path d="M20 9v6"/></svg>`
  },
  'cable': {
    label: 'Poleas / Cables',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"/><path d="M12 9v12"/><path d="M8 21h8"/><path d="M5 6h4"/><path d="M15 6h4"/></svg>`
  },
  'leverage machine': {
    label: 'Máquina de Palanca / Gym',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3"/><path d="M15 1v3"/></svg>`
  },
  'band': {
    label: 'Banda Elástica',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5"/></svg>`
  },
  'smith machine': {
    label: 'Máquina Smith',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="M19 3v18"/><path d="M2 11h20"/><circle cx="5" cy="11" r="1.5"/><circle cx="19" cy="11" r="1.5"/></svg>`
  },
  'kettlebell': {
    label: 'Pesa Rusa (Kettlebell)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="7"/><path d="M9 8a3 3 0 0 1 6 0v1H9Z"/></svg>`
  },
  'weighted': {
    label: 'Peso Adicional (Lastre)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4"/><circle cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="2"/></svg>`
  },
  'stability ball': {
    label: 'Pelota Suiza (Fitball)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12a10 10 0 0 0 4 8"/><path d="M12 4a10 10 0 0 0 4 8"/></svg>`
  },
  'ez barbell': {
    label: 'Barra Z (EZ Barbell)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l2-2 3 4 4-4 3 4 2-2h3"/><path d="M4 8v8"/><path d="M20 8v8"/></svg>`
  },
  'assisted': {
    label: 'Máquina Asistida',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v8"/><path d="M8 11h8"/><path d="M5 21h14"/><path d="M10 18h4"/></svg>`
  },
  'sled machine': {
    label: 'Trineo de Empuje (Sled)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18l-3-7H8l-3 7Z"/><path d="M8 11V5"/><path d="M14 11V7"/></svg>`
  },
  'medicine ball': {
    label: 'Balón Medicinal',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18"/><path d="M3 12a9 9 0 0 1 18 0"/><path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/></svg>`
  },
  'rope': {
    label: 'Cuerda de Batalla / Salto',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19c4-6 6-1 10-7s2-7 6-7"/><path d="M4 14c3-4 6 0 10-5s3-5 6-5"/></svg>`
  },
  'roller': {
    label: 'Rodillo de Espuma (Foam Roller)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="3"/><line x1="8" y1="6" x2="8" y2="18"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="16" y1="6" x2="16" y2="18"/></svg>`
  },
  'resistance band': {
    label: 'Banda Circular de Resistencia',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="8" ry="4"/><path d="M4 12v3c0 2.2 3.6 4 8 4s8-1.8 8-4v-3"/></svg>`
  },
  'bosu ball': {
    label: 'Media Esfera Bosu',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M4 17c0-5 3.6-9 8-9s8 4 8 9"/><ellipse cx="12" cy="17" rx="9" ry="2"/></svg>`
  },
  'olympic barbell': {
    label: 'Barra Olímpica de Competición',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M4 9v6"/><path d="M20 9v6"/></svg>`
  },
  'wheel roller': {
    label: 'Rueda Abdominal (Ab Wheel)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M2 12h3"/><path d="M19 12h3"/></svg>`
  },
  'upper body ergometer': {
    label: 'Ergómetro de Brazos',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 7V3"/><path d="M12 17v4"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/></svg>`
  },
  'skierg machine': {
    label: 'Máquina SkiErg',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v18"/><path d="M17 3v18"/><path d="M10 6l-3 4"/><path d="M14 6l3 4"/><path d="M5 21h14"/></svg>`
  },
  'hammer': {
    label: 'Maza / Martillo de Entrenamiento',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.6 3.6a3 3 0 0 0-4.2 0L11 6.1l4.9 4.9 2.5-2.4a3 3 0 0 0 0-4.2l-.8-.8z"/></svg>`
  },
  'stationary bike': {
    label: 'Bicicleta Estática / Spinning',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="17.5" r="3.5"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M17.5 17.5 14 6h-3"/><path d="M6.5 17.5 11 11l4.5 1"/><path d="M10 6h4"/></svg>`
  },
  'tire': {
    label: 'Neumático Gigante (Tire Flip)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="8"/><ellipse cx="12" cy="12" rx="5" ry="4"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/></svg>`
  },
  'trap bar': {
    label: 'Barra Hexagonal (Trap Bar)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3"/><path d="M18 12h3"/><path d="m6 12 3-5h6l3 5-3 5H9z"/><path d="M2 9v6"/><path d="M22 9v6"/></svg>`
  },
  'elliptical machine': {
    label: 'Máquina Elíptica',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="17" rx="8" ry="3"/><circle cx="12" cy="6" r="2"/><path d="M8 17V8"/><path d="M16 17V8"/><path d="M6 17h12"/></svg>`
  },
  'stepmill machine': {
    label: 'Escaladora (Stepmill)',
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4v-4h4v-4h4v-4h4"/><path d="M4 20V4"/><path d="M4 4h4"/></svg>`
  }
};

/**
 * Devuelve metadata para cualquier nombre de equipamiento recibido de la API
 */
export function getEquipmentMeta(name: string, count?: number): EquipmentMeta {
  const normalized = (name || '').toLowerCase().trim();
  const found = EQUIPMENT_META_MAP[normalized];
  if (found) {
    return {
      value: normalized,
      label: found.label,
      iconSvg: found.iconSvg,
      count
    };
  }

  // Fallback para cualquier nuevo equipamiento
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return {
    value: normalized,
    label: capitalized,
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
    count
  };
}

