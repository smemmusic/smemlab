import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "../content/journeys/index.js";
import { NARRATOR_UI } from "../content/ui.js";
import { byType } from "../modules/_registry.js";

const KIND_LABEL = {
  audio:   "Audio · Module",
  control: "Control · Module",
};

export function Narrator() {
  const chapter      = useSynthStore((s) => s.chapter);
  const journeyId    = useSynthStore((s) => s.journeyId);
  const applyChapterDelta = useSynthStore((s) => s.applyChapterDelta);
  const nextChapter  = useSynthStore((s) => s.nextChapter);
  const goChapter    = useSynthStore((s) => s.goChapter);
  const focusedType  = useSynthStore((s) => s.ui.focusedModuleSlot);
  const clearFocus   = useSynthStore((s) => s.clearFocus);
  const setMobileView = useSynthStore((s) => s.setMobileView);

  if (!journeyId) return null;
  const journey  = journeyById(journeyId);
  const chapters = journey?.chapters ?? [];
  if (!chapters.length) return null;

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

  const safeIdx  = Math.min(chapter, chapters.length - 1);
  const c        = chapters[safeIdx];
  const atEnd    = safeIdx === chapters.length - 1;
  const upcoming = !atEnd ? chapters[safeIdx + 1] : null;

  function handleNext() {
    if (!upcoming) return;
    if (upcoming.adds) {
      applyChapterDelta(upcoming.adds);
      // On mobile, jump to the synth view so the visitor sees the new module.
      setMobileView("synth");
    }
    nextChapter();
  }

  // Label: explicit `addLabel` on the chapter wins, otherwise fall back to
  // a generic "Next chapter" — the delta itself decides what's added.
  const label = upcoming?.addLabel || NARRATOR_UI.next;

  function handlePrev() {
    if (safeIdx > 0) goChapter(safeIdx - 1);
  }

  return (
    <div className={"narrator " + c.kind}>
      <div className="narrator-body">
        <div className={"eyebrow " + c.kind}>
          <span className="rule" />
          {NARRATOR_UI.chapterPrefix} {c.ix} · {c.nm}
        </div>
        <h2>{c.title}</h2>
        <p dangerouslySetInnerHTML={{ __html: c.prose }} />
        {/* tryit accepts either a string (single instruction) or an
            array (multiple atomic steps). Multiple steps render as a
            numbered list under a single TRY badge — keeps the badge
            from repeating and signals "do these in order". */}
        {(() => {
          const steps = Array.isArray(c.tryit) ? c.tryit : [c.tryit];
          return (
            <div className={"try" + (steps.length > 1 ? " try-list" : "")}>
              {steps.length === 1 ? (
                <span dangerouslySetInnerHTML={{ __html: steps[0] }} />
              ) : (
                <ol>
                  {steps.map((step, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
                  ))}
                </ol>
              )}
            </div>
          );
        })()}
      </div>
      <div className="nav-row">
        <button
          className="prevbtn"
          onClick={handlePrev}
          disabled={safeIdx === 0}
          title="Previous chapter"
        >
          ◂ Prev
        </button>
        {!atEnd
          ? <button className="nextbtn" onClick={handleNext}>{label}</button>
          : <span className="await">{NARRATOR_UI.done}</span>}
      </div>
    </div>
  );
}
