import { createRoot } from 'react-dom/client';
import App from './App';
import '../styles/globals.css';
import { applyCachedTheme } from '../utils/themes';

// Paint the last-used theme before React mounts, so dark mode never flashes white.
applyCachedTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);
