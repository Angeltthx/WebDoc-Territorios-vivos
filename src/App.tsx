import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BASE } from './application/base';
import { countPage } from './application/visits';
import { Webdoc } from './ui/screens/Webdoc';

// Mapa 3D de prueba, mientras llega el modelo del diseñador. Va en una dirección difícil de adivinar (y sin indexar)
// hasta que el cliente lo apruebe: /mapa y cualquier otra cae en el recorrido.
const MapScreen = lazy(() => import('./ui/screens/MapScreen'));
const MAP_PATH = '/costa-k7q4x';
// La tienda y «Cuéntanos tu historia» se abren desde la costa; también tienen su propia dirección.
const Shop = lazy(() => import('./ui/screens/Shop'));
const StoryForm = lazy(() => import('./ui/screens/StoryForm'));
const OrderPage = lazy(() => import('./ui/screens/OrderPage'));
// El panel del equipo (con su clave; no se indexa).
const Admin = lazy(() => import('./ui/screens/Admin'));
// La guía pedagógica (a esta dirección lleva su QR).
const Guide = lazy(() => import('./ui/screens/Guide'));
// El proyecto y Visita Nuquí (el Canva del cliente, 27/10/2026).
const Chapter = lazy(() => import('./ui/screens/Chapter'));
const sheet = (el: ReactNode) => <Suspense fallback={null}><div className="sheet-page">{el}</div></Suspense>;

/** Cuenta cada dirección a la que se llega (el recorrido cuenta sus páginas por su lado: ver journey.ts). */
function VisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Las vueltas de un pedido cuentan juntas, sin el código.
    countPage(pathname.startsWith('/tienda/pedido/') ? '/tienda/pedido' : pathname, { at: pathname });
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <BrowserRouter basename={BASE || undefined}>
      <VisitTracker />
      <Routes>
        <Route path="/" element={<Webdoc />} />
        <Route path={MAP_PATH} element={<Suspense fallback={<p className="map-loading">Cargando el mapa…</p>}><MapScreen /></Suspense>} />
        <Route path="/tienda" element={sheet(<Shop />)} />
        {/* A donde vuelve la persona después de pagar en Wompi. */}
        <Route path="/tienda/pedido/:ref" element={sheet(<OrderPage />)} />
        <Route path="/cuenta-tu-historia" element={sheet(<StoryForm />)} />
        <Route path="/el-proyecto/:tab?" element={<Suspense fallback={null}><Chapter path="/el-proyecto" /></Suspense>} />
        <Route path="/visita-nuqui/:tab?" element={<Suspense fallback={null}><Chapter path="/visita-nuqui" /></Suspense>} />
        <Route path="/guia" element={<Suspense fallback={null}><Guide /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        <Route path="/:page" element={<Webdoc />} />
        <Route path="*" element={<Webdoc />} />
      </Routes>
    </BrowserRouter>
  );
}
