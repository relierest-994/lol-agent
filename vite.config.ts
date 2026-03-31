import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const viteEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_')));

  return {
    plugins: [react()],
    resolve: {
      alias: [{ find: /^react-native$/, replacement: 'react-native-web' }],
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    define: {
      __VITE_ENV__: JSON.stringify(viteEnv),
    },
  };
});
