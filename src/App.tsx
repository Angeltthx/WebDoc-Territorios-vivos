import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Webdoc } from './ui/screens/Webdoc';

// Mapa 3D de prueba, mientras llega el modelo del diseñador.
const MapScreen = lazy(() => import('./ui/screens/MapScreen'));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Webdoc />} />
        <Route path="/mapa" element={<Suspense fallback={<p className="map-loading">Cargando el mapa…</p>}><MapScreen /></Suspense>} />
        <Route path="/:page" element={<Webdoc />} />
        <Route path="*" element={<Webdoc />} />
      </Routes>
    </BrowserRouter>
  );
}
