export const environment = {
  production: true,
  apiUrl: 'https://awakin-backend.vercel.app/api/v1', // <-- Tu backend en Vercel
  SUPABASE_URL: 'https://cgdfraunsnwihuajkiuq.supabase.co',
  SUPABASE_KEY: 'sb_publishable_kxYmYZsTOiJNpeTgpD65gA_3DIijba0',
  modules: {
    home: true,
    intake: true,
    workout: false,
    kin: false,
    avatar: true,
  },
};
