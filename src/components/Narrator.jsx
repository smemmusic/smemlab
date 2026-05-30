import { useSynthStore } from "../store/useSynthStore.js";
import { CHAPTERS } from "../content/narrator.js";
import { MODULE_META, KIND_LABEL } from "../content/moduleMeta.js";
import { PLACARDS } from "../content/placards.js";
import { NARRATOR_UI } from "../content/ui.js";

export function Narrator() {
  const chapter      = useSynthStore((s) => s.chapter);
  const blocks       = useSynthStore((s) => s.blocks);
  const addBlock     = useSynthStore((s) => s.addBlock);
  const nextChapter  = useSynthStore((s) => s.nextChapter);
  const focusedSlot  = useSynthStore((s) => s.ui.focusedModuleSlot);
  const clearFocus   = useSynthStore((s) => s.clearFocus);

  // When a module is focused (user clicked on its body), the narrator panel
  // shows that module's placard + title in place of the chapter content.
  if (focusedSlot && PLACARDS[focusedSlot]) {
    const meta = MODULE_META[focusedSlot];
    return (
      <div className={"narrator " + (meta?.kind || "audio")}>
        <button className="narrator-back" onClick={clearFocus} title="Back to chapter">← Back</button>
        <div className={"eyebrow " + meta?.kind}>
          <span className="rule" />
          {meta ? KIND_LABEL[meta.kind] : "Module"}
        </div>
        <h2>{meta?.title || focusedSlot}</h2>
        <p dangerouslySetInnerHTML={{ __html: PLACARDS[focusedSlot] }} />
      </div>
    );
  }

  const safeIdx  = Math.min(chapter, CHAPTERS.length - 1);
  const c        = CHAPTERS[safeIdx];
  const atEnd    = safeIdx === CHAPTERS.length - 1;
  const upcoming = !atEnd ? CHAPTERS[safeIdx + 1] : null;

  function handleNext() {
    if (!upcoming) return;
    if (upcoming.adds && !blocks[upcoming.adds]) addBlock(upcoming.adds);
    nextChapter();
  }

  const label = upcoming?.adds
    ? `Add ${MODULE_META[upcoming.adds].title} ▸`
    : NARRATOR_UI.next;

  return (
    <div className={"narrator " + c.kind}>
      <div className={"eyebrow " + c.kind}>
        <span className="rule" />
        {NARRATOR_UI.chapterPrefix} {c.ix} · {c.nm}
      </div>
      <h2>{c.title}</h2>
      <p dangerouslySetInnerHTML={{ __html: c.prose }} />
      <div className="try">{c.tryit}</div>
      <div className="nav-row">
        {!atEnd
          ? <button className="nextbtn" onClick={handleNext}>{label}</button>
          : <span className="await">{NARRATOR_UI.done}</span>}
      </div>
    </div>
  );
}
