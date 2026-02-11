// awakin-preset.ts
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura';

export const AwakinPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{orange.50}',
      100: '{orange.100}',
      200: '{orange.200}',
      300: '{orange.300}',
      400: '{orange.400}',
      500: '{orange.500}', // Color principal de la marca
      600: '{orange.600}',
      700: '{orange.700}',
      800: '{orange.800}',
      900: '{orange.900}',
      950: '{orange.950}'
    },
    // Añadimos un color secundario para tu marca
    secondary: {
        50: '{emerald.50}',
        100: '{emerald.100}',
        200: '{emerald.200}',
        300: '{emerald.300}',
        400: '{emerald.400}',
        500: '{emerald.500}',
        600: '{emerald.600}',
        700: '{emerald.700}',
        800: '{emerald.800}',
        900: '{emerald.900}',
        950: '{emerald.950}'
    },
    // Añadimos enfoque en la superficie para que se sienta "Limpio/SaaS"
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '{slate.50}',
          100: '{slate.100}',
          200: '{slate.200}',
          300: '{slate.300}',
          400: '{slate.400}',
          500: '{slate.500}',
          600: '{slate.600}',
          700: '{slate.700}',
          800: '{slate.800}',
          900: '{slate.900}',
          950: '{slate.950}'
        }
      }
    }
  },
  components: {
    // Estilo específico para los componentes de datos (Tablas de precios/supermercados)
    datatable: {
      header: {
        background: '{surface.50}',
        color: '{surface.700}'
      }
    },
    
  }
});