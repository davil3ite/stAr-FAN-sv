// write.jsx

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createArticle } from "../articles.js";
import { uploadImage, checkImage } from "../storage.js";
import "./css/write.css";

const TYPES = ["Notícia", "Reportagem", "Artigo de opinião", "Crônica", "Resenha Crítica"];
const THEMES = ["Esportes", "Cultura", "SESI", "Brasil", "Mundo", "Ciência", "Tecnologia", "Saúde", "Arte", "Culinária"];
const THEMES_VISIBLE = 6;

// Máximo de autores por matéria, contando o primeiro. Mude aqui para outro limite.
const MAX_AUTHORS = 6;

// Nome da edição mostrado na tela de escrever. É só visual: não é salvo no banco.
const EDITION_LABEL = "SESIVERSO";

// Recuo da primeira linha de cada parágrafo. O mesmo valor está no write.css,
// na regra .editor-body, para a tela de escrever ficar igual à matéria publicada.
const PARAGRAPH_INDENT = "3em";

// Textos que aparecem no "i" ao lado de cada título. Troque aqui.
const INFO_TEXTS = {
  headline: "A manchete é um dos primeiros elementos que o leitor observa em uma publicação e tem a função de apresentar o assunto principal de forma rápida e atrativa. Uma boa manchete deve ser clara, objetiva e interessante, despertando a curiosidade do leitor sem exagerar ou apresentar informações que não estejam no conteúdo. Ela também facilita a identificação do tema da notícia, principalmente quando a publicação apresenta vários assuntos. Além de chamar a atenção, a manchete precisa representar corretamente o conteúdo da matéria. Um título muito vago pode não deixar claro sobre o que a notícia trata, enquanto um título exagerado ou enganoso pode fazer o leitor criar uma expectativa que o texto não corresponde. Por isso, é importante escolher palavras adequadas e buscar um equilíbrio entre informação, objetividade e atratividade.",
  cover: "A imagem é um elemento que ajuda a chamar a atenção e a complementar as informações apresentadas no texto. Quando está relacionada diretamente ao assunto, ela facilita a compreensão da notícia e ajuda o leitor a visualizar melhor aquilo que está sendo apresentado. Por exemplo, em uma reportagem sobre uma competição escolar, uma fotografia dos participantes ou do evento pode contribuir muito mais para a compreensão do conteúdo do que uma imagem genérica. Além de ser relacionada ao assunto, a imagem deve possuir boa qualidade e ser utilizada de maneira adequada. É importante verificar sua origem e evitar fotografias falsas, manipuladas ou retiradas de contextos diferentes. Uma legenda também pode ser utilizada para explicar quem ou o que aparece na imagem. Dessa forma, a fotografia deixa de ser apenas uma decoração e passa a funcionar como parte da informação apresentada pela publicação.",
  sources: "As fontes são fundamentais para garantir que as informações apresentadas tenham credibilidade. Na produção de uma notícia, não é suficiente encontrar uma informação na internet e simplesmente utilizá-la. É necessário verificar sua origem, observar se a fonte é confiável e, quando possível, comparar os dados com outras fontes. Órgãos oficiais, universidades, instituições de pesquisa e veículos jornalísticos reconhecidos são exemplos de fontes que podem ajudar na busca por informações verificáveis. Também é importante informar as fontes utilizadas na própria publicação. Isso permite que o leitor saiba de onde vieram os dados e possa conferir as informações por conta própria. Além de aumentar a transparência, indicar as fontes demonstra responsabilidade de quem produziu o conteúdo e ajuda a diferenciar uma informação pesquisada e comprovada de uma afirmação sem evidências. Em uma época em que notícias falsas podem se espalhar rapidamente, apresentar a origem das informações é uma parte importante de uma publicação responsável.",
};

function applyFormat(tag) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    const commands = { b: "bold", i: "italic", u: "underline" };
    if (commands[tag]) document.execCommand(commands[tag], false, null);
    return;
  }
  const range = sel.getRangeAt(0);
  let node = sel.anchorNode;
  while (node) {
    if (node.nodeName === tag.toUpperCase()) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }
    node = node.parentNode;
  }
  const wrapper = document.createElement(tag);
  try {
    range.surroundContents(wrapper);
  } catch {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/* ── "i" de ajuda ──
   Bolinha ao lado do título. O popup abre no hover (e no foco pelo teclado)
   e é posicionado pelo CSS, logo abaixo da bolinha. */
function InfoTip({ text }) {
  return (
    <span className="info-tip">
      <span className="info-tip-btn" tabIndex={0} role="button" aria-label="Mais informações">i</span>
      <span className="info-tip-popup" role="tooltip">{text}</span>
    </span>
  );
}

/* ── Campos de autoria ──
   Uma linha por autor. O primeiro é o autor principal; os demais são
   co-autores. O "+" fica sempre na última linha e some ao atingir o limite.
   Campos extras deixados em branco são ignorados na hora de publicar. */
function AuthorFields({ authors, onChange, onAdd, onRemove, max }) {
  return (
    <div className="write-field">
      <label>Autoria</label>
      {authors.map((name, i) => {
        const isLast = i === authors.length - 1;
        return (
          <div className="author-row" key={i}>
            <input
              type="text"
              placeholder={i === 0 ? "Seu nome" : "Nome do co-autor"}
              value={name}
              onChange={e => onChange(i, e.target.value)}
            />
            {i > 0 && (
              <button className="remove-source" onClick={() => onRemove(i)} title="Remover autor">✕</button>
            )}
            {isLast && authors.length < max && (
              <button className="add-author" onClick={onAdd} title="Adicionar autor">+</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Write() {
  const navigate = useNavigate();

  const [type, setType] = useState(TYPES[0]);
  const [theme, setTheme] = useState(null);
  const [themeOverflowOpen, setThemeOverflowOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [sources, setSources] = useState([{ label: "", url: "" }]);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [activeFormats, setActiveFormats] = useState({ b: false, i: false, u: false });

  // Capa: o arquivo fica guardado aqui e só sobe pro Storage ao publicar.
  // A prévia usa um endereço temporário do próprio navegador.
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // Autoria: lista de nomes digitados. O primeiro é o autor principal.
  const [authors, setAuthors] = useState([""]);

  const bodyRef = useRef(null);
  const coverInputRef = useRef(null);
  const themeOverflowRef = useRef(null);
  const coverPreviewRef = useRef("");

  useEffect(() => {
    function handleClickOutside(e) {
      if (themeOverflowRef.current && !themeOverflowRef.current.contains(e.target))
        setThemeOverflowOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Libera a prévia da capa ao sair da página
  useEffect(() => () => {
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
  }, []);

  function handleBodyChange() { setBody(bodyRef.current.innerHTML); setError(""); }

  function updateActiveFormats() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (sel.isCollapsed) {
      setActiveFormats({
        b: document.queryCommandState("bold"),
        i: document.queryCommandState("italic"),
        u: document.queryCommandState("underline"),
      });
      return;
    }
    let node = sel.anchorNode;
    const active = { b: false, i: false, u: false };
    while (node && node !== bodyRef.current) {
      const name = node.nodeName?.toLowerCase();
      if (name === "b" || name === "strong") active.b = true;
      if (name === "i" || name === "em") active.i = true;
      if (name === "u") active.u = true;
      node = node.parentNode;
    }
    setActiveFormats(active);
  }

  function handleFormat(e, tag) {
    e.preventDefault();
    bodyRef.current.focus();
    applyFormat(tag);
    setBody(bodyRef.current.innerHTML);
    setTimeout(updateActiveFormats, 0);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    setBody(bodyRef.current.innerHTML);
  }

  function handleCoverChange(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const check = checkImage(file);
    if (!check.ok) { setError(check.error); return; }

    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    const preview = URL.createObjectURL(file);
    coverPreviewRef.current = preview;

    setCoverFile(file);
    setCoverPreview(preview);
    setError("");
  }

  function addSource() { setSources(s => [...s, { label: "", url: "" }]); }
  function removeSource(i) { setSources(s => s.filter((_, idx) => idx !== i)); }
  function updateSource(i, field, value) {
    setSources(s => s.map((src, idx) => idx === i ? { ...src, [field]: value } : src));
    setError("");
  }

  function updateAuthor(i, value) {
    setAuthors(a => a.map((name, idx) => idx === i ? value : name));
    setError("");
  }
  function addAuthor() { setAuthors(a => a.length < MAX_AUTHORS ? [...a, ""] : a); }
  function removeAuthor(i) { setAuthors(a => a.filter((_, idx) => idx !== i)); }

  function handleSelectTheme(t) {
    setTheme(theme === t ? null : t);
    setError("");
  }

  async function handlePublish() {
    // Todos os campos são obrigatórios. Campos de autor deixados em branco
    // são ignorados, desde que sobre pelo menos um nome preenchido.
    const names = authors.map(n => n.trim()).filter(Boolean);
    const filledSources = sources.filter(s => s.url.trim());

    if (names.length === 0) { setError("Coloque o nome de pelo menos um autor."); return; }
    if (!theme) { setError("Escolha um tema."); return; }
    if (!headline.trim()) { setError("A manchete é obrigatória."); return; }
    if (!coverFile) { setError("A imagem de capa é obrigatória."); return; }
    if (!body.trim() || body === "<br>") { setError("O texto é obrigatório."); return; }
    if (filledSources.length === 0) { setError("Coloque o link de pelo menos uma fonte."); return; }

    setPublishing(true);
    setError("");

    // A capa sobe pro Storage e o que vai pro banco é só o link dela.
    const upload = await uploadImage(coverFile, "covers");
    if (!upload.ok) { setPublishing(false); setError(upload.error); return; }

    // O texto vai embrulhado com o alinhamento e o recuo, para a matéria
    // publicada sair igual ao que aparece aqui na hora de escrever.
    const styledBody = `<div style="text-align: justify; text-indent: ${PARAGRAPH_INDENT};">${body}</div>`;

    // Autores salvos só pelo nome: { name }. Sem id, o articles.js
    // exibe o nome direto e usa a inicial como foto.
    const data = {
      type,
      theme,
      headline: headline.trim(),
      body: styledBody,
      coverImage: upload.url,
      images: [],
      sources: filledSources,
      author: { name: names[0] },
      coauthors: names.length > 1 ? names.slice(1).map(name => ({ name })) : null,
      editionId: null,
    };

    const result = await createArticle(data);
    setPublishing(false);
    if (!result) { setError("Não foi possível publicar. Tente de novo."); return; }
    navigate("/");
  }

  const visibleThemes = THEMES.slice(0, THEMES_VISIBLE);
  const overflowThemes = THEMES.slice(THEMES_VISIBLE);
  const isOverflowTheme = theme && overflowThemes.includes(theme);

  return (
    <div>
      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate("/")}>◀</button>
        </div>
        <div className="header-center">
          <button className="btn-logo" onClick={() => navigate("/")}>
            <img src="/logofanSESI.png" style={{ height: "65px", width: "auto" }} />
          </button>
        </div>
        <div className="header-right" />
      </header>

      <main className="write-content">
        <div className="write-card">

          {/* Título + edição fixa */}
          <div className="write-title-row">
            <h1 className="write-title">Nova matéria</h1>
            <span className="edition-pill">{EDITION_LABEL}</span>
          </div>

          {/* Autoria */}
          <AuthorFields
            authors={authors}
            onChange={updateAuthor}
            onAdd={addAuthor}
            onRemove={removeAuthor}
            max={MAX_AUTHORS}
          />

          {/* Tipo */}
          <div className="write-field">
            <label>Tipo</label>
            <div className="type-options">
              {TYPES.map(t => (
                <button key={t} className={`type-btn ${type === t ? "active" : ""}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="write-field">
            <label>Tema</label>
            <div className="type-options" style={{ position: "relative" }}>
              {visibleThemes.map(t => (
                <button
                  key={t}
                  className={`type-btn ${theme === t ? "active" : ""}`}
                  onClick={() => handleSelectTheme(t)}
                >{t}</button>
              ))}

              {overflowThemes.length > 0 && (
                <div className="theme-overflow-wrap" ref={themeOverflowRef}>
                  <button
                    className={`type-btn theme-overflow-trigger ${isOverflowTheme ? "active" : ""}`}
                    onClick={() => setThemeOverflowOpen(v => !v)}
                    title="Mais temas"
                  >
                    {isOverflowTheme ? theme : "···"}
                  </button>
                  {themeOverflowOpen && (
                    <div className="theme-overflow-dropdown">
                      {overflowThemes.map(t => (
                        <button
                          key={t}
                          className={`theme-overflow-item ${theme === t ? "active" : ""}`}
                          onClick={() => { handleSelectTheme(t); setThemeOverflowOpen(false); }}
                        >{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Manchete */}
          <div className="write-field">
            <label>Manchete<InfoTip text={INFO_TEXTS.headline} /></label>
            <input type="text" placeholder="Título da matéria" value={headline} onChange={e => { setHeadline(e.target.value); setError(""); }} />
          </div>

          {/* Imagem de capa */}
          <div className="write-field">
            <label>Imagem de capa<InfoTip text={INFO_TEXTS.cover} /></label>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
            <button className="file-btn" onClick={() => coverInputRef.current.click()}>
              {coverPreview ? "Trocar imagem de capa" : "Escolher imagem de capa"}
            </button>
            {coverPreview && <img src={coverPreview} alt="capa" className="cover-preview" />}
          </div>

          {/* Texto */}
          <div className="write-field">
            <label>Texto</label>
            <div className="editor-toolbar">
              <button className={activeFormats.b ? "active" : ""} onMouseDown={e => handleFormat(e, "b")}><b>B</b></button>
              <button className={activeFormats.i ? "active" : ""} onMouseDown={e => handleFormat(e, "i")}><i>I</i></button>
              <button className={activeFormats.u ? "active" : ""} onMouseDown={e => handleFormat(e, "u")}><u>U</u></button>
            </div>
            <div
              ref={bodyRef}
              className="editor-body"
              contentEditable
              suppressContentEditableWarning
              onInput={handleBodyChange}
              onPaste={handlePaste}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
              data-placeholder="Escreva sua matéria aqui..."
            />
          </div>

          {/* Fontes */}
          <div className="write-field">
            <label>Fontes<InfoTip text={INFO_TEXTS.sources} /></label>
            {sources.map((src, i) => (
              <div className="source-row" key={i}>
                <input type="text" placeholder="Nome da fonte (opcional)" value={src.label} onChange={e => updateSource(i, "label", e.target.value)} />
                <input type="text" placeholder="https://..." value={src.url} onChange={e => updateSource(i, "url", e.target.value)} />
                {sources.length > 1 && <button className="remove-source" onClick={() => removeSource(i)}>✕</button>}
              </div>
            ))}
            <button className="add-source" onClick={addSource}>+ Adicionar fonte</button>
          </div>

          {error && <p className="write-error">{error}</p>}
          <button className="publish-btn" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default Write;