import { useSynthStore } from "../store/useSynthStore.js";
import { CHAPTERS } from "../content/narrator.js";
import { MODULE_META } from "../content/moduleMeta.js";
import { NARRATOR_UI } from "../content/ui.js";

export function Narrator() {
  const chapter     = useSynthStore((s) => s.chapter);
  const blocks      = useSynthStore((s) => s.blocks);
  const nextChapter = useSynthStore((s) => s.nextChapter);

  const safeIdx = Math.min(chapter, CHAPTERS.length - 1);
  const c       = CHAPTERS[safeIdx];
  const pending = c.adds && !blocks[c.adds];
  const atEnd   = safeIdx === CHAPTERS.length - 1;

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
        {pending ? (
          <span className="await">
            {NARRATOR_UI.awaitPrefix} {MODULE_META[c.adds].title} {NARRATOR_UI.awaitSuffix}
          </span>
        ) : !atEnd ? (
          <button className="nextbtn" onClick={nextChapter}>{NARRATOR_UI.next}</button>
        ) : (
          <span className="await">{NARRATOR_UI.done}</span>
        )}
      </div>
    </div>
  );
}
