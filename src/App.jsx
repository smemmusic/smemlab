import { Header } from "./components/Header.jsx";
import { ChapterRail } from "./components/ChapterRail.jsx";
import { Narrator } from "./components/Narrator.jsx";
import { Stage } from "./components/Stage.jsx";
import { Transport } from "./components/Transport.jsx";
import { Landing } from "./components/Landing.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { useSynthStore } from "./store/useSynthStore.js";
import { useAudioEngineBridge } from "./hooks/useAudioEngine.js";

export function App() {
  useAudioEngineBridge();
  const freeMode  = useSynthStore((s) => s.ui.freeMode);
  const journeyId = useSynthStore((s) => s.journeyId);
  const showSidebar = !freeMode && !!journeyId;

  return (
    <>
      <div className={"wrap" + (showSidebar ? "" : " no-sidebar")}>
        <Header />
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
      <Landing />
    </>
  );
}
