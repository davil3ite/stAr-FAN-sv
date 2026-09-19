// hub.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom'
import { getArticles, timeAgo, getEditions } from "../articles.js";
import "./css/hub.css";

const INSTAGRAM_URL = "https://www.instagram.com/folha.alfa_news/";
const CONTACT_EMAIL = "folhaalfanews@gmail.com";

/* ── Helpers de co-autoria ── */
function formatAuthorsText(author, coauthors) {
  // Autoria anônima
  if (author === "anonymous") return "Autoria Anônima";

  const all = [author, ...(coauthors || [])];
  if (all.length === 1) return all[0].name;
  if (all.length === 2) return `${all[0].name} & ${all[1].name}`;
  const last = all[all.length - 1];
  const rest = all.slice(0, -1).map(a => a.name).join(", ");
  return `${rest} & ${last.name}`;
}

function AuthorAvatars({ author, coauthors }) {
  // Autoria anônima: exibe avatar padrão preto
  if (author === "anonymous") {
    return (
      <div className="card-avatars">
        <div className="card-avatar-anonymous" />
      </div>
    );
  }

  const all = [author, ...(coauthors || [])];
  return (
    <div className="card-avatars">
      {all.map((a, i) => (
        a.avatar
          ? <img
              key={a.username || i}
              src={a.avatar}
              className="card-avatar"
              alt={a.name}
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: all.length - i }}
            />
          : <div
              key={a.username || i}
              className="card-avatar-placeholder"
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: all.length - i }}
            >
              {a.name[0].toUpperCase()}
            </div>
      ))}
    </div>
  );
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [editions, setEditions] = useState([]);

  useEffect(() => {
    Promise.all([getArticles(), getEditions()]).then(([arts, eds]) => {
      setArticles(arts);
      setEditions(eds);
    });
  }, []);

  function groupByEdition(articles, editions) {
    const edMap = {};
    editions.forEach(e => { edMap[e.id] = e; });
    const groups = {};
    articles.forEach(a => {
      const key = a.edition_id || "__none__";
      if (!groups[key]) {
        groups[key] = { edition: a.edition_id ? edMap[a.edition_id] : null, articles: [] };
      }
      groups[key].articles.push(a);
    });
    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.edition) return 1;
      if (!b.edition) return -1;
      return b.edition.number - a.edition.number;
    });
    return sorted;
  }

  const grouped = groupByEdition(articles, editions);
  const hasMultipleEditions = grouped.filter(g => g.edition !== null).length > 1 ||
    (grouped.length === 1 && grouped[0].edition !== null);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <button className={`menu-btn ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">
            <span/><span/><span/>
          </button>
        </div>
        <div className="header-center">
          <button className="btn-logo" disabled="true">
            <img src="/logofanSESI.png" style={{ height: "65px", width: "auto" }} />
          </button>
        </div>
        <div className="header-right">
          <button className="btn-write" onClick={() => navigate('/write')}>Escrever</button>
        </div>
      </header>

      <div className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button className="sidebar-home" onClick={() => navigate('/')}>Início</button>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-social">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="sidebar-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <span className="sidebar-dot">•</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="sidebar-email">{CONTACT_EMAIL}</a>
          </div>
          <div className="sidebar-logsign">
            <button className="sb-signup" onClick={() => navigate('/write')}>Escrever</button>
          </div>
        </div>
      </aside>

      <main className="page-content">
        {articles.length === 0 ? <p className="page-hint"></p> : (
          <div className="articles-grid">
            {grouped.map((group, gi) => (
              <div key={gi} className="edition-group">
                {hasMultipleEditions && group.edition && (
                  <div className="edition-separator">
                    <span className="edition-separator-label">Edição {group.edition.number}</span>
                    <span className="edition-separator-line" />
                  </div>
                )}

                {group.articles.map((a) => (
                  <div className="article-card" key={a.id} onClick={() => navigate(`/article/${a.id}`)}>
                    {a.cover_image && <div className="card-cover" style={{ backgroundImage: `url(${a.cover_image})` }} />}
                    <div className="card-body">
                      <span className="card-type">
                        {a.type}{a.theme ? ` • ${a.theme}` : ""}
                      </span>
                      <h2 className="card-headline">{a.headline}</h2>
                      <p className="card-excerpt">{a.body.replace(/<[^>]+>/g, '').slice(0, 120)}...</p>
                      <div className="card-meta">
                        <AuthorAvatars author={a.author} coauthors={a.coauthors} />
                        <span>{formatAuthorsText(a.author, a.coauthors)}</span>
                        <span>{timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="footer-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span>Siga-nos no Instagram</span>
        </a>
        <span className="footer-dot">•</span>
        <span className="footer-text">{CONTACT_EMAIL}</span>
      </footer>
    </div>
  );
}

export default Layout;