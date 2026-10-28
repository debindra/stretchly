import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '../styles/globals.css';
import { applyCachedTheme } from '../utils/themes';

applyCachedTheme();

createRoot(document.getElementById('root')!).render(<Popup />);
