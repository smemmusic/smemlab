import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "../content/journeys/index.js";
import { CHAPTER_RAIL } from "../content/ui.js";

export function ChapterRail() {
  const chapter   = useSynthStore((s) => s.chapter);
  const journeyId = useSynthStore((s) => s.journeyId);
  const goChapter = useSynthStore((s) => s.goChapter);

  if (!journeyId) return null;
  const chapters = journeyById(journeyId)?.chapters ?? [];
  if (!chapters.length) return null;

  return (
    <aside className="rail">
      <p className="rail-title">{CHAPTER_RAIL.title}</p>
      <nav className="bus">
        {chapters.map((c, i) => {
          const state = i < chapter ? "done" : i === chapter ? "active" : "locked";
          return (
            <button
              key={c.id}
              className={`chap ${c.kind} ${state}`}
              onClick={() => { if (i <= chapter) goChapter(i); }}
            >
              <span className="tap" />
              <span className="ix">{c.ix}</span>
              <span className="nm">{c.nm}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
