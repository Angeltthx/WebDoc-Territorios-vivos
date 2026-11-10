import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pathFor } from '../../application/journey';
import { stations } from '../../content/journey';
import { pageIndex, type Tabs } from '../../content/pages';
import { menu, social, type MenuItem, type SocialNetwork } from '../../content/site';
import type { Transition } from '../../domain/types';
import { mediaUrl } from './Media';

/** Navegación del recorrido disponible para cualquier componente. Fuera del recorrido, `inJourney` es falso. */
export const JourneyNav = createContext<{ scrollToPage: (id: string) => void; scrollToIndex: (i: number) => void; inJourney: boolean }>({
  scrollToPage: () => {},
  scrollToIndex: () => {},
  inJourney: false,
});
export const useJourneyNav = () => useContext(JourneyNav);

/** Dirección de una página del recorrido, para llegar a ella desde fuera. */
export const pagePath = (id: string) => pathFor(pageIndex(id));

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

/** Sin `label` la barra no lleva rótulo (la bienvenida, 09/11/2026). */
export function TopBar({ label, right, plain }: { label?: ReactNode; right?: ReactNode; plain?: boolean }) {
  return (
    <div className="topbar">
      {!label ? <span /> : plain ? <span className="chip chip--plain">{label}</span> : <Chip>{label}</Chip>}
      <div className="topbar__right">{right}</div>
    </div>
  );
}

/** Siempre «Ver mapa interactivo» (09/11/2026; en las estaciones decía «Mapa · guía» y abría la guía de estaciones). */
export function GuideButton({ onOpen, children = 'Ver mapa interactivo' }: { onOpen: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="ghost-link" onClick={onOpen}>
      <span aria-hidden="true">◇</span> {children}
    </button>
  );
}

export function ChachitaTag({ plain }: { plain?: boolean }) {
  if (plain) return <span className="ghost-link">Chachita</span>;
  return (
    <span className="pill">
      <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
        <path d="M1 2c2 3 4 3 6 0s4-3 6 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Chachita
    </span>
  );
}

/**
 * Una fila de pestañas que no cabe (en celular, la estación 4 tiene seis): la activa se trae a la vista y la fila dice
 * hacia qué lado hay más (`data-more`, que pone una sombra en ese borde).
 */
export function useTabsInView(nav: RefObject<HTMLElement | null>, active: string) {
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const mark = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      el.dataset.more = left && right ? 'both' : left ? 'left' : right ? 'right' : '';
    };
    const on = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (on && el.scrollWidth > el.clientWidth) {
      const a = el.getBoundingClientRect(), b = on.getBoundingClientRect();
      el.scrollLeft += b.left + b.width / 2 - (a.left + a.width / 2);
    }
    mark();
    el.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('resize', mark);
    return () => {
      el.removeEventListener('scroll', mark);
      window.removeEventListener('resize', mark);
    };
  }, [nav, active]);
}

/** Pestañas de la estación. Cada una desplaza el recorrido hasta su página. */
export function PageTabs({ tabs }: { tabs: Tabs }) {
  const { scrollToPage } = useJourneyNav();
  const nav = useRef<HTMLElement>(null);
  useTabsInView(nav, tabs.active);
  return (
    <nav className="tabs" aria-label="Secciones de la estación" ref={nav}>
      {tabs.items.map((t) => {
        const active = t.label === tabs.active;
        const cls = `tab${active ? ' is-active' : ''}${t.warm ? ' tab--warm' : ''}`;
        return t.to ? (
          <button key={t.label} type="button" className={cls} aria-current={active ? 'page' : undefined} onClick={() => scrollToPage(t.to!)}>
            {t.label}
          </button>
        ) : (
          <span key={t.label} className={`${cls} tab--off`}>{t.label}</span>
        );
      })}
    </nav>
  );
}

export function Arrow({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = { left: 'M11 3 5 9l6 6', right: 'M7 3l6 6-6 6', up: 'M3 11l6-6 6 6', down: 'M3 7l6 6 6-6' }[dir];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TransitionSymbol({ kind }: { kind: Transition['symbol'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="t-symbol" width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
      {kind === 'wave' && <path {...common} d="M6 16c4-6 10-6 13 0M22 16c3 10 17 10 20 0M45 16c3-6 9-6 13 0" />}
      {kind === 'rain' && (
        <g {...common}>
          <path d="M16 20a16 12 0 0 1 32 0Z" fill="currentColor" stroke="none" />
          <path d="M32 20v12c0 3-5 3-5 0" />
        </g>
      )}
      {kind === 'meet' && <path {...common} d="M18 8v24l14-12Zm28 0v24L32 20Z" />}
      {kind === 'sea' && <path {...common} d="M12 12c4-4 8-4 12 0s8 4 12 0 8-4 12 0M12 20c4-4 8-4 12 0s8 4 12 0 8-4 12 0M12 28c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />}
    </svg>
  );
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

/** La bolita de una parada, con su imagen (09/11/2026: se escogió esta versión frente a la de solo puntos). Si no hay
 * imagen o no carga, queda el punto. */
function Bubble({ image, badge, onClick }: { image?: string; badge?: ReactNode; onClick?: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = image && (image.startsWith('/') ? image : mediaUrl(image, true));
  const photo = !!src && !broken;
  return (
    <span className={`rio__node${photo ? ' has-photo' : ''}`} aria-hidden="true" onClick={onClick}>
      {photo && <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />}
      {badge != null && <b className="rio__badge">{badge}</b>}
    </span>
  );
}

/**
 * El cauce que une las paradas: pasa por el centro de cada bolita y entre una y otra se curva hacia un lado y luego
 * hacia el otro, como un río que serpentea. Sigue un poco más abajo de la última, hacia el mar.
 */
function riverPath(points: { x: number; y: number }[], tail = true) {
  if (!points.length) return '';
  let d = `M ${points[0].x} 0 L ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const h = b.y - a.y;
    const dx = Math.min(18, h * 0.22) * (i % 2 ? 1 : -1);
    d += ` C ${a.x + dx} ${a.y + h * 0.35}, ${b.x + dx} ${b.y - h * 0.35}, ${b.x} ${b.y}`;
  }
  const end = points[points.length - 1];
  if (!tail) return d;
  return `${d} C ${end.x - 12} ${end.y + 30}, ${end.x + 12} ${end.y + 50}, ${end.x} ${end.y + 80}`;
}

const slug = (label: string) => label.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();

/** La estación de una página, por el comienzo de su id (`chori-galeria` → `chori`). */
const stationOf = (page: string) => page.split('-')[0];

/**
 * Menú principal: botón fijo arriba a la derecha y un panel que se despliega desde ese lado, sin tapar toda la página
 * (pedido del cliente, 19/10/2026).
 *
 * Desde el 09/11/2026 es un río que baja (en la prueba con usuarios el menú de dos columnas, con todo a la vista, se
 * veía cargado: no encontraban el viche ni entendían «Tu historia»):
 * - Una sola columna. El río pasa por todas las paradas: la bienvenida, cada estación con su color y, entre ellas, el
 *   nombre del tramo de río (las transiciones); al final, el mapa y, ya en el mar, lo que está fuera del recorrido.
 * - Lo que tiene partes (las estaciones, El proyecto, Visita Nuquí) se despliega al tocarlo, de a uno; la estación que se
 *   está viendo llega abierta. Lo de fuera del recorrido lleva una línea que dice para qué sirve.
 * - El agua corre siempre despacio y, al bajar o subir por el menú, se acelera: el río se mueve con uno. Al abrir, el
 *   agua baja dibujando el cauce, como el mapa de las transiciones.
 */
export function SiteMenu({ open, onOpen, onClose, current }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Id de la página que se está viendo. */
  current?: string;
}) {
  const ref = useDialog(open);
  const { scrollToPage, inJourney } = useJourneyNav();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const journey = menu.filter((item) => item.to);
  const beyond = menu.filter((item) => !item.to);
  const isStation = (item: MenuItem) => !!item.to && !!item.children;
  const here = (item: MenuItem) =>
    item.to
      ? !!current && (item.to === current || (isStation(item) && stationOf(item.to) === stationOf(current)))
      : !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  const go = (item: MenuItem) => {
    onClose();
    if (item.href) navigate(item.href);
    else if (item.to && inJourney) scrollToPage(item.to);
    else if (item.to) navigate(pagePath(item.to));
  };

  // Lo desplegado: uno a la vez. Al abrir el menú, la estación (o la parte) donde se está.
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (open) setExpanded(menu.find((item) => item.children && here(item))?.label ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (label: string) => setExpanded((now) => (now === label ? null : label));

  // El cauce se dibuja por donde quedaron las bolitas y se vuelve a dibujar cuando algo se despliega o cambia de tamaño.
  const rioRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<SVGPathElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const [path, setPath] = useState('');

  /**
   * Al escoger algo, el agua viaja por el río desde donde se está hasta esa parada (09/11/2026, pedido tras ver el menú):
   * un chorro brillante con una gota al frente, que al llegar hace ondas; entonces se cierra el menú y se va allá.
   * Fuera del recorrido y sin estar en ninguna parada, el agua sale desde arriba.
   */
  const stops = [...journey, ...beyond];
  const measureRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const dropRef = useRef<SVGCircleElement>(null);
  const [arriving, setArriving] = useState<string | null>(null);
  const travelling = useRef(false);
  const pick = (item: MenuItem, stop: MenuItem) => {
    if (travelling.current) return;
    const points = pointsRef.current;
    const [measure, trail, drop] = [measureRef.current, trailRef.current, dropRef.current];
    const to = stops.indexOf(stop);
    const from = stops.findIndex(here);
    if (!measure || !trail || !drop || to < 0 || !points[to] || from === to) return go(item);
    travelling.current = true;
    const lengthTo = (i: number) => {
      if (i < 0) return 0;
      measure.setAttribute('d', riverPath(points.slice(0, i + 1), false));
      return measure.getTotalLength();
    };
    const [a, b] = [lengthTo(from), lengthTo(to)];
    const time = Math.min(1200, Math.max(550, Math.abs(b - a) * 0.9));
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / time);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const head = a + (b - a) * e;
      trail.style.strokeDasharray = `${Math.abs(head - a)} 100000`;
      trail.style.strokeDashoffset = `${-Math.min(a, head)}`;
      const p = trail.getPointAtLength(head);
      drop.setAttribute('cx', `${p.x}`);
      drop.setAttribute('cy', `${p.y}`);
      if (t < 1) return void requestAnimationFrame(step);
      setArriving(stop.label);
      setTimeout(() => {
        travelling.current = false;
        go(item);
      }, 380);
    };
    trail.classList.add('is-on');
    drop.classList.add('is-on');
    requestAnimationFrame(step);
  };
  // Al cerrar, el viaje se borra para la próxima vez.
  useEffect(() => {
    if (open) return;
    setArriving(null);
    travelling.current = false;
    trailRef.current?.classList.remove('is-on');
    dropRef.current?.classList.remove('is-on');
  }, [open]);
  useLayoutEffect(() => {
    const rio = rioRef.current;
    if (!open || !rio) return;
    // Por la posición en la página y no la de pantalla: al abrir, las filas entran desplazadas (animación) y el cauce
    // quedaría corrido.
    const draw = () => {
      const points = [...rio.querySelectorAll<HTMLElement>('.rio__node')].map((n) => {
        let [x, y] = [n.offsetWidth / 2, n.offsetHeight / 2];
        for (let el: HTMLElement | null = n; el && el !== rio; el = el.offsetParent as HTMLElement | null) {
          x += el.offsetLeft;
          y += el.offsetTop;
        }
        return { x: Math.round(x), y: Math.round(y) };
      });
      pointsRef.current = points;
      setPath(riverPath(points));
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(rio);
    return () => observer.disconnect();
  }, [open]);

  // La corriente: despacio siempre y más rápido mientras se recorre el menú (en cualquier sentido, el agua baja).
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    let frame = 0;
    let last = panel.scrollTop;
    let before = performance.now();
    let offset = 0;
    const tick = (now: number) => {
      const moved = Math.abs(panel.scrollTop - last);
      last = panel.scrollTop;
      offset -= Math.min(now - before, 100) * 0.02 + Math.min(moved, 80) * 0.9;
      before = now;
      flowRef.current?.style.setProperty('stroke-dashoffset', offset.toFixed(1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, ref]);

  const parts = (item: MenuItem) => {
    // Al desplegar una estación, la primera parte es su Pensamiento (adonde lleva la estación).
    const list = isStation(item) ? [{ label: 'Pensamiento', to: item.to }, ...item.children!] : item.children!;
    const shown = expanded === item.label;
    return (
      <div className="rio__more" id={`rio-${slug(item.label)}`} data-open={shown || undefined} inert={!shown}>
        <ul className="rio__parts">
          {list.map((sub) => (
            <li key={sub.label}>
              <button type="button" className="rio__part" aria-current={sub.to && sub.to === current ? 'page' : undefined} onClick={() => pick(sub, item)}>
                {sub.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  const text = (title: ReactNode, meta?: ReactNode) => (
    <span className="rio__text">
      <span className="rio__name">{title}</span>
      {meta && <span className="rio__meta">{meta}</span>}
    </span>
  );
  // Tocar el nombre (o la bolita) lleva directo; la flecha de al lado despliega las partes (09/11/2026: antes tocar una
  // estación solo la desplegaba y parecía que no hacía nada).
  const row = (item: MenuItem, title: ReactNode, meta?: ReactNode) => (
    <>
      <button type="button" className="rio__row" aria-current={item.to && item.to === current ? 'page' : undefined} onClick={() => pick(item, item)}>
        {text(title, meta)}
      </button>
      {item.children && (
        <button
          type="button"
          className="rio__toggle"
          aria-expanded={expanded === item.label}
          aria-controls={`rio-${slug(item.label)}`}
          aria-label={`${expanded === item.label ? 'Ocultar' : 'Ver'} las partes de ${typeof title === 'string' ? title : item.label}`}
          onClick={() => toggle(item.label)}
        >
          <svg className="rio__chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
  let order = 0;
  const itemProps = (kind: string, item: MenuItem, extra?: Record<string, string | undefined>) => ({
    className: `rio__item rio__item--${kind}${here(item) ? ' is-here' : ''}${expanded === item.label ? ' is-open' : ''}${arriving === item.label ? ' is-arriving' : ''}`,
    style: { ['--i' as string]: order++, ...extra },
  });

  return (
    <>
      <button type="button" className="menu-btn" onClick={onOpen} aria-label="Abrir menú" aria-haspopup="dialog">
        <span /><span /><span />
      </button>
      <dialog
        ref={ref}
        className="menu"
        onClose={onClose}
        onClick={(e) => e.target === ref.current && onClose()}
        aria-label="Menú"
      >
        <div className="menu__panel">
          <div className="menu__head">
            <p className="menu__brand">Territorios <em>Vivos</em></p>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar menú">✕</button>
          </div>
          <div className="rio" ref={rioRef}>
            {path && (
              <svg className="rio__cauce" aria-hidden="true">
                <path className="rio__bed" d={path} />
                <path className="rio__water" d={path} pathLength={1} />
                <path ref={flowRef} className="rio__flow" d={path} />
                <path ref={trailRef} className="rio__trail" d={path} />
                <path ref={measureRef} className="rio__measure" />
                <circle ref={dropRef} className="rio__drop" r={5} />
              </svg>
            )}
            <nav aria-label="El recorrido">
              <ol className="rio__list">
                {journey.map((item, i) => {
                  if (isStation(item)) {
                    const [number, name] = item.label.split(' · ');
                    const station = stations.find((s) => s.id === stationOf(item.to!));
                    return (
                      <li key={item.label} {...itemProps('station', item, { ['--accent']: station?.accent })}>
                        <Bubble image={station?.background.id} badge={station?.number} onClick={() => pick(item, item)} />
                        {row(item, name ?? item.label, `${number}${station ? ` · ${station.place}` : ''}`)}
                        {parts(item)}
                      </li>
                    );
                  }
                  // La bienvenida y el mapa son las puntas del río; lo demás, los tramos entre estaciones.
                  const end = i === 0 || i === journey.length - 1;
                  return (
                    <li key={item.label} {...itemProps(end ? 'stop' : 'reach', item)}>
                      {end ? <Bubble image={item.image} onClick={() => pick(item, item)} /> : <span className="rio__node" aria-hidden="true" />}
                      {row(item, item.label)}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <nav aria-labelledby="menu-mas">
              <h2 id="menu-mas" className="rio__sea" style={{ ['--i' as string]: order++ }}>Más del documental</h2>
              <ul className="rio__list">
                {beyond.map((item) => (
                  <li key={item.label} {...itemProps('group', item)}>
                    <Bubble image={item.image} onClick={() => pick(item, item)} />
                    {row(item, item.label, item.hint)}
                    {item.children && parts(item)}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="menu__foot">
            <SocialLinks className="menu__social" />
            <p className="menu__credit">
              Una producción de <a href="https://www.doinmedia.com" target="_blank" rel="noopener">Doinmedia</a>
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}

const ICONS: Record<SocialNetwork, ReactNode> = {
  youtube: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a8 8 0 0 0 4.6 1.5V6.8a4.7 4.7 0 0 1-4.6-4.8Z" />
    </svg>
  ),
};

/**
 * Dónde va la marca de agua en el celular, mientras se decide (29/10/2026): `arriba` (bajo el sonido y el menú),
 * `menu` (dentro del menú y en la bienvenida) o `lateral` (vertical contra el borde, como estaba). Se elige con
 * `?marca=…` en la dirección y se recuerda en este navegador. En el computador no cambia: abajo a la derecha.
 */
const MARK_PLACES = ['arriba', 'menu', 'lateral'];
function chooseMarkPlace() {
  let place = new URLSearchParams(window.location.search).get('marca');
  try {
    if (place && MARK_PLACES.includes(place)) localStorage.setItem('tv-marca', place);
    else place = localStorage.getItem('tv-marca');
  } catch {
    /* sin almacenamiento: la de siempre */
  }
  document.documentElement.dataset.marca = place && MARK_PLACES.includes(place) ? place : MARK_PLACES[0];
}
chooseMarkPlace();

/** «Una producción de Doinmedia»: marca de agua discreta abajo a la derecha, en todas las páginas (pedido del cliente,
 * 28/10/2026; antes solo estaba en la bienvenida). */
export function CreditMark() {
  return (
    <div className="credit-mark">
      Una producción de <a href="https://www.doinmedia.com" target="_blank" rel="noopener">Doinmedia</a>
    </div>
  );
}

/** Íconos de redes sociales. Sin dirección confirmada, el ícono se muestra sin enlace. */
export function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <ul className={`social ${className}`} aria-label="Redes sociales">
      {social.map((s) => (
        <li key={s.network}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>{ICONS[s.network]}</a>
          ) : (
            <span aria-label={`${s.label} (enlace pendiente)`} title={`${s.label} · enlace pendiente`}>{ICONS[s.network]}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
