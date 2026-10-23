import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/global.css';
import { startAnalytics } from './application/visits';
import { Gate, isUnlocked } from './ui/screens/Gate';

// Antes del lanzamiento el recorrido pide clave; su código no se descarga hasta que se escribe.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));

function Root() {
  const [open, setOpen] = useState(isUnlocked);
  if (!open) return <Gate onUnlock={() => setOpen(true)} />;
  return <Suspense fallback={null}><App /></Suspense>;
}

startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
