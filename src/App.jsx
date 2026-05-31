import { Header } from "./components/Header.jsx";
import { ChapterRail } from "./components/ChapterRail.jsx";
import { Narrator } from "./components/Narrator.jsx";
import { Stage } from "./components/Stage.jsx";
import { Transport } from "./components/Transport.jsx";
import { Landing } from "./components/Landing.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { PatchesModal } from "./components/PatchesModal.jsx";
import { useSynthStore } from "./store/useSynthStore.js";
import { useAudioEngineBridge } from "./hooks/useAudioEngine.js";

export function App() {
  useAudioEngineBridge();
  const journeyId     = useSynthStore((s) => s.journeyId);
  const mobileView    = useSynthStore((s) => s.ui.mobileView);
  const setMobileView = useSynthStore((s) => s.setMobileView);
  const showSidebar   = !!journeyId;

  // Mobile-only tabs (CSS hides .mobile-tabs above the breakpoint). The
  // `mobile-view-*` class on .wrap drives which pane is visible on mobile.
  const wrapClass = [
    "wrap",
    showSidebar ? "" : "no-sidebar",
    `mobile-view-${mobileView}`,
  ].filter(Boolean).join(" ");

  return (
    <>
      <div className={wrapClass}>
        <Header />
        {showSidebar && (
          <nav className="mobile-tabs" aria-label="View">
            <button
              className={"mobile-tab" + (mobileView === "instructions" ? " on" : "")}
              onClick={() => setMobileView("instructions")}
            >Instructions</button>
            <button
              className={"mobile-tab" + (mobileView === "synth" ? " on" : "")}
              onClick={() => setMobileView("synth")}
            >Synth</button>
          </nav>
        )}
        {showSidebar && (
          <aside className="sidebar">
            <ChapterRail />
            <Narrator />
          </aside>
        )}
        <main className="main-area">
          <Stage />
        </main>
        <Transport />
      </div>
      <SettingsModal />
      <PatchesModal />
      <Landing />
    </>
  );
}
