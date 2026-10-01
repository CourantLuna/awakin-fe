export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1', // <-- Tu servidor local en FastAPI
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
