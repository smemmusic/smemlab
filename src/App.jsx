import { Header } from "./components/Header.jsx";
import { ChapterRail } from "./components/ChapterRail.jsx";
import { Narrator } from "./components/Narrator.jsx";
import { Stage } from "./components/Stage.jsx";
import { Transport } from "./components/Transport.jsx";
import { Landing } from "./components/Landing.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { useAudioEngineBridge } from "./hooks/useAudioEngine.js";

export function App() {
  useAudioEngineBridge();
  return (
    <>
      <div className="wrap">
        <Header />
        <aside className="sidebar">
          <ChapterRail />
          <Narrator />
        </aside>
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
