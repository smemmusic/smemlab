import { Header } from "./components/Header.jsx";
import { ChapterRail } from "./components/ChapterRail.jsx";
import { Narrator } from "./components/Narrator.jsx";
import { Minimap } from "./components/Minimap.jsx";
import { Stage } from "./components/Stage.jsx";
import { Transport } from "./components/Transport.jsx";
import { Landing } from "./components/Landing.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { useAudioEngineBridge } from "./hooks/useAudioEngine.js";

export function App() {
  useAudioEngineBridge();   // wire Zustand → engine once
  return (
    <>
      <div className="wrap">
        <Header />
        <div className="layout">
          <ChapterRail />
          <div>
            <Narrator />
            <Minimap />
            <Stage />
          </div>
        </div>
      </div>
      <Transport />
      <SettingsModal />
      <Landing />
    </>
  );
}
