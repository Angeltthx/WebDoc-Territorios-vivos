// /el-proyecto y /visita-nuqui: las páginas del Canva del cliente (27/10/2026), fuera del recorrido. Cada pestaña tiene
// su dirección (/el-proyecto/equipo…); se pasa de una a otra sin sumar pasos al «atrás» del navegador, así
// «Volver al recorrido» regresa a la página del recorrido desde donde se llegó.

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { chapterByPath, type ChapterAction, type ChapterBody, type ChapterTab } from '../../content/chapters';
import { Backdrop, Img } from '../components/Media';
import { CreditMark, pagePath, SiteMenu, SocialLinks } from '../components/Chrome';
import { VideoPanel } from '../components/Sections';

export default function ChapterScreen({ path }: { path: string }) {
  const chapter = chapterByPath(path)!;
  const { tab: slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const tab = chapter.tabs.find((t) => t.slug === slug) ?? chapter.tabs[0];

  useEffect(() => {
    document.title = `Territorios Vivos · ${chapter.label} · ${tab.label}`;
    setNotice(false);
  }, [chapter, tab]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(false), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  // Se llegó desde otra página de la web: se vuelve a ella. Si se entró directo, a la bienvenida.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  const act = (a: ChapterAction) => {
    if (a.pending) setNotice(true);
    else if (a.page) navigate(pagePath(a.page));
    else if (a.href) navigate(a.href);
  };

  return (
    <div className={`chapter chapter--${tab.body.kind}`} style={tab.color ? { background: tab.color } : undefined}>
      {tab.background && <Backdrop key={`fondo-${tab.slug}`} photo={tab.background} tint="linear-gradient(180deg, rgba(6,14,11,.55), rgba(6,14,11,.62))" />}
      <div className="topbar">
        <span className="chip">{chapter.label} · {tab.label}</span>
        <div className="topbar__right">
          <button type="button" className="ghost-link" onClick={back}><span aria-hidden="true">◇</span> Volver<span className="chapter__back-more"> al recorrido</span></button>
        </div>
      </div>
      <main key={tab.slug} className="chapter__body reveal">
        <Body body={tab.body} act={act} />
      </main>
      <nav className="chapter__tabs tabs" aria-label={`Secciones de ${chapter.label}`}>
        {chapter.tabs.map((t: ChapterTab, i) => (
          <Link
            key={t.slug}
            replace
            to={i === 0 ? chapter.path : `${chapter.path}/${t.slug}`}
            className={`tab${t === tab ? ' is-active' : ''}`}
            aria-current={t === tab ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {notice && <p className="notice notice--float" role="status">Muy pronto: estamos confirmando este dato con las comunidades.</p>}
      <SiteMenu open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
      <div className="dock"><SocialLinks /></div>
      <CreditMark />
    </div>
  );
}

function Action({ action, act }: { action: ChapterAction; act: (a: ChapterAction) => void }) {
  return (
    <button type="button" className={`chapter-btn${action.primary ? ' chapter-btn--primary' : ''}`} onClick={() => act(action)}>
      {action.label}
    </button>
  );
}

function Body({ body, act }: { body: ChapterBody; act: (a: ChapterAction) => void }) {
  switch (body.kind) {
    case 'story':
      return (
        <div className="chapter-story">
          <div>
            <p className="eyebrow">{body.eyebrow}</p>
            <h1>{body.title}</h1>
            {body.paragraphs.map((t) => <p key={t}>{t}</p>)}
          </div>
          <div>
            <figure className="chapter-photo"><Img photo={body.photo} sizes="(max-width: 900px) 90vw, 40vw" /></figure>
            <p className="eyebrow">{body.aside.eyebrow}</p>
            {body.aside.paragraphs.map((t) => <p key={t}>{t}</p>)}
          </div>
        </div>
      );

    case 'team':
      return (
        <div className="chapter-team">
          <p className="eyebrow">{body.eyebrow}</p>
          <ul className="chapter-team__people">
            {body.people.map((m) => (
              <li key={m.name}><strong>{m.name}</strong><span>{m.role}</span></li>
            ))}
          </ul>
          <p className="eyebrow">{body.thanks.eyebrow}</p>
          <div className="chapter-team__thanks">
            {body.thanks.photos.map((ph) => (
              <figure key={ph.id} className="chapter-photo"><Img photo={ph} sizes="(max-width: 900px) 45vw, 22vw" /></figure>
            ))}
          </div>
        </div>
      );

    case 'video':
      return (
        <div className="trailer chapter-video">
          <div className="trailer__frame"><VideoPanel video={body.video} active /></div>
        </div>
      );

    case 'blog':
      return (
        <div className="chapter-blog">
          <article>
            <p className="eyebrow">{body.eyebrow}</p>
            <h1>{body.title}</h1>
            <p className="chapter-blog__meta">{body.meta}</p>
            <figure className="chapter-photo chapter-photo--wide"><Img photo={body.photo} sizes="(max-width: 900px) 90vw, 55vw" /></figure>
            {body.paragraphs.map((t) => <p key={t}>{t}</p>)}
            <p className="chapter-blog__quote">{body.quote}</p>
            <p className="chapter-soon">La entrada completa, muy pronto.</p>
          </article>
          <aside>
            <p className="eyebrow">Más entradas</p>
            <ul>
              {body.more.map((m) => (
                <li key={m.title}><strong>{m.title}</strong><span>{m.sub}</span><em>Muy pronto</em></li>
              ))}
            </ul>
          </aside>
        </div>
      );

    case 'feature':
      return (
        <div className="chapter-feature">
          <p className="eyebrow">{body.eyebrow}</p>
          <h1>{body.title}</h1>
          <p>{body.text}</p>
          <div className="chapter-actions">{body.actions.map((a) => <Action key={a.label} action={a} act={act} />)}</div>
        </div>
      );

    case 'experiences':
      return (
        <div className="chapter-exp">
          <p className="eyebrow">{body.eyebrow}</p>
          <ul>
            {body.items.map((it) => (
              <li key={it.title}>
                <div><strong>{it.title}</strong><span>{it.sub}</span></div>
                <Action action={it.action} act={act} />
              </li>
            ))}
          </ul>
        </div>
      );

    case 'take':
      return (
        <div className="chapter-take">
          <p className="eyebrow">{body.eyebrow}</p>
          <ul>
            {body.items.map((it) => (
              <li key={it.title}>
                <img src={it.image.src} alt={it.image.alt} loading="lazy" decoding="async" />
                <div>
                  <strong>{it.title}</strong>
                  <p>{it.text}</p>
                  <Action action={it.action} act={act} />
                </div>
              </li>
            ))}
          </ul>
          <p className="chapter-take__note">{body.note}</p>
        </div>
      );
  }
}
