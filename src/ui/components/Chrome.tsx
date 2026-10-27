import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { pathFor } from '../../application/journey';
import { stations } from '../../content/journey';
import { pageIndex, type Tabs } from '../../content/pages';
import { menu, social, type MenuItem, type SocialNetwork } from '../../content/site';
import type { Transition } from '../../domain/types';
import { Illustration } from './Media';

/** Navegación del recorrido disponible para cualquier componente. Fuera del recorrido, `inJourney` es falso. */
export const JourneyNav = createContext<{ scrollToPage: (id: string) => void; scrollToIndex: (i: number) => void; inJourney: boolean }>({
  scrollToPage: () => {},
  scrollToIndex: () => {},
  inJourney: false,
});
export const useJourneyNav = () => useContext(JourneyNav);

/** Primera página de cada estación. */
export const STATION_PAGE: Record<string, string> = {
  chori: 'chori-pensamiento',
  atrato: 'atrato-pensamiento',
  nuqui: 'nuqui-pensamiento',
  pangui: 'pangui-pensamiento',
};

/** Dirección de una página del recorrido, para llegar a ella desde fuera. */
export const pagePath = (id: string) => pathFor(pageIndex(id));

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function TopBar({ label, right, plain }: { label: ReactNode; right?: ReactNode; plain?: boolean }) {
  return (
    <div className="topbar">
      {plain ? <span className="chip chip--plain">{label}</span> : <Chip>{label}</Chip>}
      <div className="topbar__right">{right}</div>
    </div>
  );
}

export function GuideButton({ onOpen, children = 'Mapa · guía' }: { onOpen: () => void; children?: ReactNode }) {
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

/** Guía de estaciones (reemplaza al mapa 3D durante esta entrega). */
export function StationGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialog(open);
  const { scrollToPage } = useJourneyNav();
  return (
    <dialog ref={ref} className="guide" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="guide-title">
      <div className="guide__inner">
        <div className="guide__head">
          <div>
            <p className="eyebrow">Guía del recorrido</p>
            <h2 id="guide-title">Del río al mar</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar guía">✕</button>
        </div>
        <ol className="guide__list">
          {stations.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="guide__item"
                onClick={() => { onClose(); scrollToPage(STATION_PAGE[s.id]); }}
                style={{ ['--accent' as string]: s.accent }}
              >
                <Illustration id={s.illustration} className="guide__art" />
                <span className="guide__num">Estación {s.number}</span>
                <strong>{s.name}</strong>
                <span className="guide__place">{s.place}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}

/** La estación de una página, por el comienzo de su id (`chori-galeria` → `chori`). */
const stationOf = (page: string) => page.split('-')[0];

/**
 * Menú principal: botón fijo arriba a la derecha y un panel que se despliega desde ese lado, sin tapar toda la página
 * (pedido del cliente, 19/10/2026). Tiene todas las paradas del recorrido, en orden, como un río con un punto en cada
 * una; las estaciones se abren para mostrar sus secciones. La página que se está viendo queda marcada y su estación,
 * abierta. Fuera del recorrido (la tienda, «Tu historia») lleva a la dirección de cada página.
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const here = (item: MenuItem) => !!item.to && !!current && (item.to === current || (!!item.children && stationOf(item.to) === stationOf(current)));
  // Al abrir, la estación donde se está queda desplegada.
  useEffect(() => {
    if (open) setExpanded(menu.find((item) => item.children && here(item))?.label ?? null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (item: MenuItem) => {
    onClose();
    if (item.href) navigate(item.href);
    else if (item.to && inJourney) scrollToPage(item.to);
    else if (item.to) navigate(pagePath(item.to));
  };
  return (
    <>
      <button type="button" className="menu-btn" onClick={onOpen} aria-label="Abrir menú" aria-haspopup="dialog">
        <span /><span /><span />
      </button>
      <dialog ref={ref} className="menu" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Menú">
        <nav className="menu__panel">
          <div className="menu__head">
            <p className="menu__brand">Territorios <em>Vivos</em></p>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar menú">✕</button>
          </div>
          <ol className="menu__list">
            {menu.map((item) => {
              const isOpen = expanded === item.label;
              const subId = `menu-${(item.to ?? item.href ?? '').replace(/\W+/g, '-')}`;
              return (
                <li key={item.label} className={`menu__item${item.children ? ' menu__item--station' : ''}${here(item) ? ' is-here' : ''}`}>
                  <div className="menu__row">
                    <button type="button" className="menu__link" aria-current={item.to === current ? 'page' : undefined} onClick={() => go(item)}>
                      {item.label}
                    </button>
                    {item.children && (
                      <button
                        type="button"
                        className="menu__toggle"
                        aria-expanded={isOpen}
                        aria-controls={subId}
                        aria-label={`${isOpen ? 'Ocultar' : 'Ver'} secciones de ${item.label}`}
                        onClick={() => setExpanded(isOpen ? null : item.label)}
                      >
                        <Arrow dir="down" />
                      </button>
                    )}
                  </div>
                  {item.children && (
                    <ul id={subId} className={`menu__sub${isOpen ? ' is-open' : ''}`} inert={!isOpen ? true : undefined}>
                      {item.children.map((sub) => (
                        <li key={sub.label}>
                          <button type="button" className="menu__link" aria-current={sub.to === current ? 'page' : undefined} onClick={() => go(sub)}>
                            {sub.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          <SocialLinks className="menu__social" />
        </nav>
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
