"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { shrinkImage } from "@/components/admin/shrinkImage";
import { LinkPanel } from "./LinkPanel";
import { Glyph, type GlyphName } from "./Glyph";

type Folder = "artikel" | "halaman" | "produk";
type Draft = { md: string; at: number; sub?: number };
type Panel = null | "link" | "image";

const DRAFT_DAYS = 14;
const readDraft = (key: string): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (!d || typeof d.md !== "string" || Date.now() - d.at > DRAFT_DAYS * 864e5) return null;
    return d;
  } catch {
    return null;
  }
};
const writeDraft = (key: string, d: Draft | null) => {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    /* penyimpanan browser tidak tersedia */
  }
};
const jam = (t: number) => new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const altFromName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Editor isi ramah awam (seperti di WordPress): tombol judul, tebal, daftar, tautan, gambar, tabel.
 * Isi tetap disimpan sebagai Markdown di input tersembunyi bernama `name`, jadi tampilan di situs
 * dan data lama tidak berubah. Mode Markdown tetap ada untuk yang terbiasa.
 */
export function RichEditor({
  name,
  defaultValue = "",
  labelledBy,
  placeholder = "Mulai menulis di sini…",
  folder,
  draftKey,
  maxLength = 60000,
  minHeight = 420,
}: {
  name: string;
  defaultValue?: string;
  labelledBy?: string;
  placeholder?: string;
  folder: Folder;
  /** Kunci simpanan draf di browser, mis. "artikel:12" atau "artikel:baru". */
  draftKey: string;
  maxLength?: number;
  minHeight?: number;
}) {
  const storeKey = `ib-draf:${draftKey}`;
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [source, setSource] = useState(defaultValue);
  const [panel, setPanel] = useState<Panel>(null);
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [length, setLength] = useState(defaultValue.length);
  const wrap = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const modeRef = useRef(mode);
  const sourceRef = useRef(source);
  modeRef.current = mode;
  sourceRef.current = source;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);
  // Belum diubah → kirim isi asli apa adanya (tanpa diformat ulang oleh editor).
  const dirty = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: null, target: null } },
      }),
      Image.configure({ allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Markdown,
    ],
    content: defaultValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "prose rte-content",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": "Isi" }),
        spellcheck: "true",
        lang: "id",
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void upload(f));
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        files.forEach((f) => void upload(f, at?.pos));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      dirty.current = true;
      scheduleSync(editor);
    },
  });
  editorRef.current = editor;

  /** Sinkronkan input tersembunyi + draf browser, ditunda sedikit agar ringan saat mengetik. */
  function scheduleSync(ed: Editor | null) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const md = modeRef.current === "markdown" || !ed ? sourceRef.current : ed.getMarkdown();
      if (hidden.current) hidden.current.value = md;
      setLength(md.length);
      if (md !== defaultValue) {
        const at = Date.now();
        writeDraft(storeKey, { md, at });
        setSavedAt(at);
      } else writeDraft(storeKey, null);
    }, 600);
  }

  const current = () => (!dirty.current ? defaultValue : modeRef.current === "markdown" || !editor ? sourceRef.current : editor.getMarkdown());

  // Isi terbaru selalu ikut terkirim, walau penundaan sinkron belum jalan.
  useEffect(() => {
    const form = wrap.current?.closest("form");
    if (!form) return;
    const onData = (e: FormDataEvent) => e.formData.set(name, current());
    // Tandai draf sudah dikirim; bila server menolak dan pengguna lanjut mengetik, draf baru menggantikannya.
    const onSubmit = () => {
      if (timer.current) clearTimeout(timer.current);
      if (!dirty.current) return;
      const now = Date.now();
      writeDraft(storeKey, { md: current(), at: now, sub: now });
    };
    form.addEventListener("formdata", onData);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("formdata", onData);
      form.removeEventListener("submit", onSubmit);
    };
  });

  // Draf yang belum tersimpan dari kunjungan sebelumnya.
  useEffect(() => {
    const d = readDraft(storeKey);
    if (!d) return;
    if (d.md === defaultValue || (d.sub && d.sub >= d.at)) writeDraft(storeKey, null);
    else setDraft(d);
  }, [storeKey, defaultValue]);

  // Bilah alat menempel di bawah kepala panel yang ikut menempel di layar kecil.
  useEffect(() => {
    const side = document.querySelector<HTMLElement>(".admin-side");
    if (!side || !wrap.current) return;
    const el = wrap.current;
    const set = () => el.style.setProperty("--rte-top", getComputedStyle(side).position === "sticky" && side.offsetWidth > window.innerWidth * 0.6 ? `${side.offsetHeight}px` : "0px");
    set();
    const ro = new ResizeObserver(set);
    ro.observe(side);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            p: e.isActive("paragraph"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            href: (e.getAttributes("link").href as string | undefined) ?? "",
            image: e.isActive("image"),
            alt: (e.getAttributes("image").alt as string | undefined) ?? "",
            table: e.isActive("table"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            words: (e.storage.characterCount as { words: () => number }).words(),
            empty: e.isEmpty,
          }
        : null,
  });

  async function upload(file: File, pos?: number) {
    const editor = editorRef.current;
    if (!editor) return;
    setStatus({ tone: "info", text: `Mengunggah ${file.name}…` });
    try {
      const small = await shrinkImage(file);
      const body = new FormData();
      body.set("file", small);
      body.set("folder", folder);
      const res = await fetch("/api/situs/unggah", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Gagal mengunggah gambar.");
      const chain = editor.chain().focus();
      if (pos != null) chain.setTextSelection(pos);
      chain.setImage({ src: data.url, alt: altFromName(file.name) }).run();
      setStatus({ tone: "info", text: "Gambar ditambahkan. Klik gambar untuk mengisi keterangannya." });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Gagal mengunggah gambar." });
    }
  }

  function switchMode(next: "visual" | "markdown") {
    if (next === mode || !editor) return;
    if (next === "markdown") setSource(editor.getMarkdown());
    else editor.commands.setContent(source, { contentType: "markdown", emitUpdate: false });
    setPanel(null);
    setMode(next);
  }

  function restore() {
    if (!draft || !editor) return;
    if (mode === "markdown") setSource(draft.md);
    else editor.commands.setContent(draft.md, { contentType: "markdown", emitUpdate: false });
    dirty.current = true;
    if (hidden.current) hidden.current.value = draft.md;
    setDraft(null);
    setStatus({ tone: "info", text: "Draf dipulihkan. Simpan supaya tidak hilang." });
  }

  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => editor && fn(editor.chain().focus()).run();
  const words = mode === "markdown" ? source.trim().split(/\s+/).filter(Boolean).length : (st?.words ?? 0);
  const minutes = Math.max(1, Math.round(words / 200));
  const visual = mode === "visual";

  const btn = ({ icon, label, on, disabled, onClick, text }: { icon: GlyphName; label: string; on?: boolean; disabled?: boolean; onClick: () => void; text?: string }) => (
    <button key={icon} type="button" className={`rte-btn${on ? " is-on" : ""}${text ? " has-text" : ""}`} aria-pressed={on === undefined ? undefined : on} aria-label={text ? undefined : label} title={label} disabled={disabled || !visual || !editor} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      <Glyph name={icon} />
      {text && <span>{text}</span>}
    </button>
  );

  return (
    <div ref={wrap} className={`rte${visual ? "" : " is-source"}`}>
      <input ref={hidden} type="hidden" name={name} defaultValue={defaultValue} />

      {draft && (
        <div className="rte-draft" role="status">
          <Glyph name="history" />
          <span>Ada perubahan yang belum disimpan dari {jam(draft.at)}.</span>
          <button type="button" className="btn btn-blue btn-sm" onClick={restore}>Pulihkan</button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              writeDraft(storeKey, null);
              setDraft(null);
            }}
          >
            Buang
          </button>
        </div>
      )}

      <div className="rte-bar" role="toolbar" aria-label="Format isi">
        <div className="rte-group rte-blocks" role="group" aria-label="Jenis teks">
          <button type="button" className={`rte-block${st?.p ? " is-on" : ""}`} aria-pressed={!!st?.p} disabled={!visual} onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.setParagraph())}>Paragraf</button>
          <button type="button" className={`rte-block${st?.h2 ? " is-on" : ""}`} aria-pressed={!!st?.h2} disabled={!visual} onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.toggleHeading({ level: 2 }))}>Judul</button>
          <button type="button" className={`rte-block${st?.h3 ? " is-on" : ""}`} aria-pressed={!!st?.h3} disabled={!visual} onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}>Subjudul</button>
        </div>
        <div className="rte-group" role="group" aria-label="Gaya huruf">
          {btn({ icon: "bold", label: "Tebal (Ctrl+B)", on: !!st?.bold, onClick: () => run((c) => c.toggleBold()) })}
          {btn({ icon: "italic", label: "Miring (Ctrl+I)", on: !!st?.italic, onClick: () => run((c) => c.toggleItalic()) })}
          {btn({ icon: "strike", label: "Coret", on: !!st?.strike, onClick: () => run((c) => c.toggleStrike()) })}
        </div>
        <div className="rte-group" role="group" aria-label="Daftar">
          {btn({ icon: "ul", label: "Daftar berpoin", on: !!st?.ul, onClick: () => run((c) => c.toggleBulletList()) })}
          {btn({ icon: "ol", label: "Daftar bernomor", on: !!st?.ol, onClick: () => run((c) => c.toggleOrderedList()) })}
          {btn({ icon: "quote", label: "Kutipan", on: !!st?.quote, onClick: () => run((c) => c.toggleBlockquote()) })}
        </div>
        <div className="rte-group" role="group" aria-label="Sisipkan">
          {btn({ icon: "link", label: "Tautan (Ctrl+K)", text: "Tautan", on: panel === "link" || !!st?.link, onClick: () => setPanel((p) => (p === "link" ? null : "link")) })}
          {btn({ icon: "image", label: "Gambar", text: "Gambar", on: panel === "image", onClick: () => setPanel((p) => (p === "image" ? null : "image")) })}
          {btn({ icon: "table", label: "Tabel", text: "Tabel", on: !!st?.table, onClick: () => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })), disabled: !!st?.table })}
          {btn({ icon: "hr", label: "Garis pemisah", onClick: () => run((c) => c.setHorizontalRule()) })}
        </div>
        <div className="rte-group" role="group" aria-label="Riwayat">
          {btn({ icon: "undo", label: "Urungkan (Ctrl+Z)", disabled: !st?.canUndo, onClick: () => run((c) => c.undo()) })}
          {btn({ icon: "redo", label: "Ulangi (Ctrl+Y)", disabled: !st?.canRedo, onClick: () => run((c) => c.redo()) })}
        </div>
        <div className="rte-mode" role="group" aria-label="Tampilan editor">
          <button type="button" aria-pressed={visual} className={visual ? "is-on" : ""} onClick={() => switchMode("visual")}>Visual</button>
          <button type="button" aria-pressed={!visual} className={!visual ? "is-on" : ""} onClick={() => switchMode("markdown")}>Markdown</button>
        </div>
      </div>

      {visual && panel === "link" && editor && (
        <LinkPanel
          editor={editor}
          currentHref={st?.href ?? ""}
          onClose={() => {
            setPanel(null);
            editor.commands.focus();
          }}
        />
      )}

      {visual && panel === "image" && editor && (
        <div className="rte-panel" role="group" aria-label="Sisipkan gambar">
          <p>Pilih foto dari komputer atau HP. Foto otomatis dikecilkan. Bisa juga tempel (Ctrl+V) atau seret gambar langsung ke dalam isi.</p>
          <div className="rte-panel-row">
            <button type="button" className="btn btn-blue btn-sm" onClick={() => fileInput.current?.click()}>
              <Glyph name="upload" /> Pilih gambar…
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>Tutup</button>
          </div>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                setPanel(null);
                void upload(f);
              }
            }}
          />
        </div>
      )}

      {visual && st?.image && (
        <div className="rte-context" role="group" aria-label="Gambar terpilih">
          <Glyph name="image" />
          <label htmlFor={`${name}-alt`}>Keterangan gambar</label>
          <input
            id={`${name}-alt`}
            value={st.alt}
            placeholder="mis. Paving hexagon abu terpasang di halaman parkir"
            onChange={(e) => editor?.chain().updateAttributes("image", { alt: e.target.value }).run()}
            onKeyDown={(e) => {
              // Enter di sini jangan mengirim form artikel.
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus();
              }
            }}
          />
          <button type="button" className="rte-ctx-btn danger" onClick={() => run((c) => c.deleteSelection())}>Hapus gambar</button>
          <span className="rte-hint">Keterangan dibaca Google &amp; pembaca layar.</span>
        </div>
      )}

      {visual && st?.table && (
        <div className="rte-context" role="group" aria-label="Tabel">
          <Glyph name="table" />
          <span className="rte-ctx-title">Tabel</span>
          <button type="button" className="rte-ctx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.addRowAfter())}>+ Baris</button>
          <button type="button" className="rte-ctx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.addColumnAfter())}>+ Kolom</button>
          <button type="button" className="rte-ctx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.deleteRow())}>− Baris</button>
          <button type="button" className="rte-ctx-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.deleteColumn())}>− Kolom</button>
          <button type="button" className="rte-ctx-btn danger" onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.deleteTable())}>Hapus tabel</button>
        </div>
      )}

      {visual && st?.link && panel !== "link" && !st.image && (
        <div className="rte-context" role="group" aria-label="Tautan terpilih">
          <Glyph name="link" />
          <a href={st.href} target="_blank" rel="noreferrer" className="rte-ctx-href">{st.href}</a>
          <button type="button" className="rte-ctx-btn" onClick={() => setPanel("link")}>Ubah</button>
          <button type="button" className="rte-ctx-btn" onClick={() => run((c) => c.extendMarkRange("link").unsetLink())}>Lepas tautan</button>
        </div>
      )}

      <div className="rte-body" style={{ minHeight }}>
        {visual ? (
          editor ? (
            <EditorContent
              editor={editor}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                  e.preventDefault();
                  setPanel("link");
                }
              }}
            />
          ) : (
            <div className="rte-loading" aria-hidden="true">Memuat editor…</div>
          )
        ) : (
          <textarea
            className="rte-source"
            aria-label="Isi dalam format Markdown"
            value={source}
            spellCheck
            style={{ minHeight }}
            onChange={(e) => {
              setSource(e.target.value);
              sourceRef.current = e.target.value;
              dirty.current = true;
              scheduleSync(null);
            }}
          />
        )}
      </div>

      <div className="rte-foot">
        <span>
          {words.toLocaleString("id-ID")} kata · ± {minutes} menit baca
        </span>
        {length > maxLength && <span className="rte-over">Terlalu panjang: {length.toLocaleString("id-ID")} dari maks {maxLength.toLocaleString("id-ID")} karakter</span>}
        {status ? (
          <span className={status.tone === "error" ? "rte-err" : ""} role={status.tone === "error" ? "alert" : "status"}>{status.text}</span>
        ) : savedAt ? (
          <span className="muted">Draf tersimpan di perangkat ini {jam(savedAt)}</span>
        ) : (
          <span className="muted">{visual ? "Ketik ## lalu spasi untuk judul, - untuk daftar." : "Mode Markdown: ## judul, **tebal**, - daftar, [teks](alamat)."}</span>
        )}
      </div>
    </div>
  );
}


