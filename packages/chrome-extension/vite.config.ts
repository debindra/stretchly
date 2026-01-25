import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';

const root = path.resolve(__dirname);

export default defineConfig({
  root,
  plugins: [tailwindcss(), react(), crx({ manifest })],
  resolve: {
    alias: { '@': path.join(root, 'src') },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  build: {
    target: 'esnext',
    outDir: path.join(root, 'dist'),
  },
});
