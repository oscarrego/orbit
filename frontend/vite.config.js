import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientEnv = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith('VITE_') || key.startsWith('REACT_APP_'))
  );

  return {
    plugins: [react()],
    define: {
      'process.env': JSON.stringify(clientEnv),
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
