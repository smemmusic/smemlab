import { useSynthStore } from "../store/useSynthStore.js";
import { CHAPTERS } from "../content/narrator.js";
import { NARRATOR_UI } from "../content/ui.js";
import { byType, byBlocksFlag, isCanonicalPresent } from "../modules/_registry.js";

const KIND_LABEL = {
  audio:   "Audio · Module",
  control: "Control · Module",
};

export function Narrator() {
  const chapter      = useSynthStore((s) => s.chapter);
  const modules      = useSynthStore((s) => s.modules);
  const addCanonical = useSynthStore((s) => s.addCanonicalModule);
  const nextChapter  = useSynthStore((s) => s.nextChapter);
  const focusedType  = useSynthStore((s) => s.ui.focusedModuleSlot);
  const clearFocus   = useSynthStore((s) => s.clearFocus);

  // Clicked-module view: replaces chapter content with the module's placard.
  const focused = focusedType ? byType(focusedType) : null;
  if (focused) {
    const kind = focused.Cls.KIND;
    return (
      <div className={"narrator " + kind}>
        <button className="narrator-back" onClick={clearFocus} title="Back to chapter">← Back</button>
        <div className={"eyebrow " + kind}>
          <span className="rule" />
          {KIND_LABEL[kind]}
        </div>
        <h2>{focused.meta.title}</h2>
        <p dangerouslySetInnerHTML={{ __html: focused.placard }} />
      </div>
    );
  }

  const safeIdx  = Math.min(chapter, CHAPTERS.length - 1);
  const c        = CHAPTERS[safeIdx];
  const atEnd    = safeIdx === CHAPTERS.length - 1;
  const upcoming = !atEnd ? CHAPTERS[safeIdx + 1] : null;

  function handleNext() {
    if (!upcoming) return;
    if (upcoming.adds) {
      const manifest = byBlocksFlag(upcoming.adds);
      if (manifest && !isCanonicalPresent(manifest.canonical.id, modules)) {
        addCanonical(manifest.canonical.id);
      }
    }
    nextChapter();
  }

  const upcomingManifest = upcoming?.adds ? byBlocksFlag(upcoming.adds) : null;
  const label = upcomingManifest
    ? `Add ${upcomingManifest.meta.title} ▸`
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
