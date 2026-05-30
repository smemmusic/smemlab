import { Header } from "./components/Header.jsx";
import { Narrator } from "./components/Narrator.jsx";
import { Stage } from "./components/Stage.jsx";
import { Transport } from "./components/Transport.jsx";
import { useAudioEngineBridge } from "./hooks/useAudioEngine.js";

export function App() {
  useAudioEngineBridge();   // wire Zustand → engine once
  return (
    <div className="wrap">
      <Header />
      <Narrator />
      <Stage />
      <Transport />
    </div>
  );
}
