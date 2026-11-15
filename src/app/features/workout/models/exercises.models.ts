export interface ExerciseSummary {
  id: string;                      // ej: "0001"
  name: string;                    // ej: "3/4 sit-up"
  category: string;                // ej: "waist"
  body_part: string;               // ej: "waist"
  target: string;                  // ej: "abs"
  muscle_group: string;            // ej: "hip flexors"
  secondary_muscles: string[];     // ej: ["hip flexors", "lower back"]
  equipment: string;               // ej: "body weight"
  image: string;                   // ej: "images/0001-2gPfomN.jpg"
  gif_url: string;                 // ej: "videos/0001-2gPfomN.gif"
  attribution: string;
  created_at: string;
  involvement?: 'primary' | 'secondary' | 'synergist'; // Nivel anatómico respecto al filtro
  instruction?: string;            // Presente si se pide ?lang=es
}

export interface ExerciseDetail extends ExerciseSummary {
  instruction_steps?: string[];    // Pasos individuales en español
  instructions?: Record<string, string>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedExercisesResponse {
  success: boolean;
  pagination: PaginationMeta;
  filters: {
    body_map_id?: string | null;
    body_map_name?: string | null;
    search?: string | null;
    body_part?: string | null;
    target?: string | null;
    equipment?: string | null;
    muscle_group?: string | null;
  };
  data: ExerciseSummary[];
}

export interface BodyMapRegionDetail {
  id: string;                      // ej: "upper-pectoralis"
  name_es: string;                 // ej: "Pectoral superior"
  zone: string;                    // ej: "Cabeza clavicular del pectoral mayor"
  type: 'advanced' | 'standard' | 'joint';
  view: 'anterior' | 'posterior' | 'both';
  exercise_count: number;
  sample_image?: string;
}

export interface BodyMapTaxonomyResponse {
  success: boolean;
  total_regions: number;
  counts: {
    advanced: number;
    standard: number;
    joints: number;
  };
  categories: {
    advanced: BodyMapRegionDetail[];
    standard: BodyMapRegionDetail[];
    joints: BodyMapRegionDetail[];
  };
  data: BodyMapRegionDetail[];
}

export interface EquipmentItem {
  name: string;
  count: number;
}

export interface EquipmentResponse {
  success: boolean;
  total: number;
  data: EquipmentItem[];
}


