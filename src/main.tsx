import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fonts are bundled with the site (no requests to Google's servers).
import '@fontsource/lilita-one/latin-400.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
