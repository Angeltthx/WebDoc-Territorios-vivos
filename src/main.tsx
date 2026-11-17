import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/global.css';
import { startAnalytics } from './application/visits';

// Lanzamiento (17/11/2026): el sitio ya no pide clave en ningún dominio. El panel /admin conserva la suya.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));

startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}><App /></Suspense>
  </StrictMode>,
);
