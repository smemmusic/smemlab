import { useSynthStore } from "../store/useSynthStore.js";
import { CHAPTERS } from "../content/narrator.js";
import { MODULE_META } from "../content/moduleMeta.js";
import { NARRATOR_UI } from "../content/ui.js";

export function Narrator() {
  const chapter     = useSynthStore((s) => s.chapter);
  const blocks      = useSynthStore((s) => s.blocks);
  const addBlock    = useSynthStore((s) => s.addBlock);
  const nextChapter = useSynthStore((s) => s.nextChapter);

  const safeIdx = Math.min(chapter, CHAPTERS.length - 1);
  const c       = CHAPTERS[safeIdx];
  const atEnd   = safeIdx === CHAPTERS.length - 1;
  const upcoming = !atEnd ? CHAPTERS[safeIdx + 1] : null;

  // The "Next" button now drives module additions: clicking it patches the
  // upcoming chapter's block onto the rack and advances the narrative in one
  // step, so the user follows the story to build the synth (no separate Add bay).
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
