import { useEffect, useRef, useState } from "react";
import { useSynthStore, serialisePatch, validatePatchObject } from "../store/useSynthStore.js";

// Trigger a JSON file download via a temporary <a> + object URL.
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name) {
  const base = (name || "patch").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "patch") + ".json";
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function PatchesModal() {
  const open    = useSynthStore((s) => s.patchesOpen);
  const setOpen = useSynthStore((s) => s.setPatchesOpen);

  const modules     = useSynthStore((s) => s.modules);
  const connections = useSynthStore((s) => s.connections);
  const savedPatches = useSynthStore((s) => s.savedPatches);
  const savePatch    = useSynthStore((s) => s.savePatch);
  const loadPatch    = useSynthStore((s) => s.loadPatch);
  const deletePatch  = useSynthStore((s) => s.deletePatch);
  const renamePatch  = useSynthStore((s) => s.renamePatch);
  const loadPatchFromObject = useSynthStore((s) => s.loadPatchFromObject);

  const [name, setName]   = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const fileInputRef = useRef(null);

  // Esc closes; reset transient state on each open so the form starts clean.
  useEffect(() => {
    if (!open) return;
    setError("");
    setEditingId(null);
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function handleSaveLocal() {
    const n = name.trim() || `Patch ${savedPatches.length + 1}`;
    savePatch(n);
    setName("");
  }

  function handleExport() {
    const n = name.trim() || "Untitled patch";
    downloadJson(serialisePatch(n, { modules, connections }), safeFilename(n));
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!validatePatchObject(obj)) {
          setError("File does not look like a valid patch.");
          return;
        }
        loadPatchFromObject(obj);
      } catch (err) {
        setError("Could not parse file: " + (err.message || "invalid JSON"));
      } finally {
        // Allow re-uploading the same file by resetting the input.
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsText(file);
  }

  function startRename(p) {
    setEditingId(p.id);
    setEditingName(p.name);
  }
  function commitRename() {
    if (editingId) renamePatch(editingId, editingName.trim() || "Untitled patch");
    setEditingId(null);
    setEditingName("");
  }

  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hide")}
      onClick={() => setOpen(false)}
      {...(open ? {} : { inert: "" })}
    >
      <div className="modal patches-modal" role="dialog" aria-modal="true" aria-label="Patches" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Patches</h2>
          <button className="modal-close btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </header>

        {/* ---- Save ---- */}
        <section className="setting-group">
          <div className="setting-title">Save current patch</div>
          <p className="setting-desc">Store the current modules + connections so you can come back to them later, or download a JSON file you can share.</p>
          <div className="patch-save-row">
            <input
              className="patch-input"
              type="text"
              placeholder="Patch name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveLocal(); }}
            />
            <button className="patch-btn" onClick={handleSaveLocal} title="Save to this browser">Save</button>
            <button className="patch-btn ghost" onClick={handleExport} title="Download a JSON file">Export JSON</button>
          </div>
        </section>

        {/* ---- Load ---- */}
        <section className="setting-group">
          <div className="setting-title">Load a patch</div>
          {error && <p className="patch-error">{error}</p>}
          {savedPatches.length === 0 ? (
            <p className="setting-desc">No saved patches yet.</p>
          ) : (
            <ul className="patch-list">
              {savedPatches.map((p) => (
                <li key={p.id} className="patch-item">
                  {editingId === p.id ? (
                    <input
                      className="patch-input patch-rename"
                      type="text"
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        else if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                      }}
                      onBlur={commitRename}
                    />
                  ) : (
                    <button
                      className="patch-name"
                      title="Rename"
                      onClick={() => startRename(p)}
                    >{p.name}</button>
                  )}
                  <span className="patch-date">{formatDate(p.createdAt)}</span>
                  <div className="patch-actions">
                    <button className="patch-btn small" onClick={() => loadPatch(p.id)}>Load</button>
                    <button
                      className="patch-btn small ghost"
                      onClick={() => downloadJson(serialisePatch(p.name, p.patch), safeFilename(p.name))}
                      title="Download this patch as JSON"
                    >Export</button>
                    <button
                      className="patch-btn small danger"
                      onClick={() => deletePatch(p.id)}
                      title="Delete from library"
                    >✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="patch-upload">
            <label className="patch-btn ghost">
              Upload JSON…
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChosen}
                hidden
              />
            </label>
            <span className="setting-desc patch-upload-hint">Loads the patch immediately (current graph is replaced).</span>
          </div>
        </section>
      </div>
    </div>
  );
}
