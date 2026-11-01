import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Blue identifies the physio workspace; the client app uses green. */
export const AdminTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#2563eb',
      600: '#1d4ed8',
      700: '#1e40af',
      800: '#1e3a8a',
      900: '#172554',
      950: '#0f1738',
    },
  },
});
