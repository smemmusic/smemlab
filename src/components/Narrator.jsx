import { useNarratorStep } from "../hooks/useNarratorStep.js";

export function Narrator() {
  const { step, text } = useNarratorStep();
  return (
    <div className="narrator">
      <div className="step">{step}</div>
      <p dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}
