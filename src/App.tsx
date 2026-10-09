import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Webdoc } from './ui/screens/Webdoc';

// Mapa 3D de prueba, mientras llega el modelo del diseñador. Va en una dirección difícil de adivinar (y sin indexar)
// hasta que el cliente lo apruebe: /mapa y cualquier otra cae en el recorrido.
const MapScreen = lazy(() => import('./ui/screens/MapScreen'));
const MAP_PATH = '/costa-k7q4x';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Webdoc />} />
        <Route path={MAP_PATH} element={<Suspense fallback={<p className="map-loading">Cargando el mapa…</p>}><MapScreen /></Suspense>} />
        <Route path="/:page" element={<Webdoc />} />
        <Route path="*" element={<Webdoc />} />
      </Routes>
    </BrowserRouter>
  );
}
