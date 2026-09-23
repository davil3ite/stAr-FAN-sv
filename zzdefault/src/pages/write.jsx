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

// Textos que aparecem no "i" ao lado de cada título. Troque aqui.
const INFO_TEXTS = {
  headline: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  cover: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
  sources: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit.",
};

const PARAGRAPH_INDENT = "3em";

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

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

/* ── Recuo de parágrafo (Tab) ──
   Encontra o bloco onde o cursor está dentro do editor e aplica/remove
   text-indent. Se o cursor estiver em texto solto (filho direto do editor),
   envolve a linha num <div> antes de recuar, para não recuar o editor todo. */
function findParagraphBlock(editor, node) {
  // Sobe a partir do nó do cursor até o filho direto do editor
  let current = node;
  while (current && current.parentNode !== editor && current !== editor) {
    current = current.parentNode;
  }
  if (!current || current === editor) return null;
  // Só aceita blocos de elemento (DIV/P), não imagens ou texto solto
  if (current.nodeType !== 1) return null;
  const tag = current.nodeName;
  if (tag !== "DIV" && tag !== "P") return null;
  return current;
}

function toggleParagraphIndent(editor, remove) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  let node = sel.anchorNode;
  if (!node) return;

  let block = findParagraphBlock(editor, node);

  // Texto solto direto no editor: envolve a linha atual num <div>
  if (!block) {
    // formatBlock transforma a linha do cursor num bloco
    document.execCommand("formatBlock", false, "div");
    node = window.getSelection().anchorNode;
    block = findParagraphBlock(editor, node);
  }

  if (!block) return;

  if (remove) {
    block.style.textIndent = "";
    if (!block.getAttribute("style")) block.removeAttribute("style");
  } else {
    block.style.textIndent = PARAGRAPH_INDENT;
  }
}

function IconAlignLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignCenter() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="3" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="3" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="5" y="5.5" width="10" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="5" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
}
function IconAlignJustify() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
      <rect x="1" y="2" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="5.5" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="9" width="14" height="1.5" rx="0.75"/>
      <rect x="1" y="12.5" width="10" height="1.5" rx="0.75"/>
    </svg>
  );
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
  const [activeAlign, setActiveAlign] = useState("Left");

  // Capa: o arquivo fica guardado aqui e só sobe pro Storage ao publicar.
  // A prévia usa um endereço temporário do próprio navegador.
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // Autoria: lista de nomes digitados. O primeiro é o autor principal.
  const [authors, setAuthors] = useState([""]);

  const bodyRef = useRef(null);
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
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

  // Tab = recuo de parágrafo; Shift+Tab = remove o recuo
  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      bodyRef.current.focus();
      toggleParagraphIndent(bodyRef.current, e.shiftKey);
      setBody(bodyRef.current.innerHTML);
    }
  }

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

  function handleAlign(e, dir) {
    e.preventDefault();
    bodyRef.current.focus();
    document.execCommand("justify" + dir, false, null);
    setBody(bodyRef.current.innerHTML);
    setActiveAlign(dir);
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

  async function handleInlineImage(e) {
    const file = e.target.files[0]; if (!file) return;
    const base64 = await fileToBase64(file);
    bodyRef.current.focus();
    document.execCommand("insertImage", false, base64);
    setBody(bodyRef.current.innerHTML);
    e.target.value = "";
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

    // Autores salvos só pelo nome: { name }. Sem id, o articles.js
    // exibe o nome direto e usa a inicial como foto.
    const data = {
      type,
      theme,
      headline: headline.trim(),
      body,
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
              <span className="toolbar-sep" />
              <button onMouseDown={e => handleAlign(e, "Left")} className={activeAlign === "Left" ? "active" : ""} title="Alinhar à esquerda"><IconAlignLeft /></button>
              <button onMouseDown={e => handleAlign(e, "Center")} className={activeAlign === "Center" ? "active" : ""} title="Centralizar"><IconAlignCenter /></button>
              <button onMouseDown={e => handleAlign(e, "Right")} className={activeAlign === "Right" ? "active" : ""} title="Alinhar à direita"><IconAlignRight /></button>
              <button onMouseDown={e => handleAlign(e, "Full")} className={activeAlign === "Full" ? "active" : ""} title="Justificar"><IconAlignJustify /></button>
              <span className="toolbar-sep" />
              <button onMouseDown={e => { e.preventDefault(); inlineInputRef.current.click(); }}>🖼</button>
              <input ref={inlineInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInlineImage} />
            </div>
            <div
              ref={bodyRef}
              className="editor-body"
              contentEditable
              suppressContentEditableWarning
              onInput={handleBodyChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
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