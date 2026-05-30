export function HCable() {
  return (
    <div className="cable-h">
      <svg viewBox="0 0 42 420" preserveAspectRatio="none">
        <path d="M0 210 C 16 210,24 210,42 210" fill="none" stroke="var(--audio)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <path className="flow" d="M0 210 C 16 210,24 210,42 210" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="210" r="3.5" fill="var(--audio)" />
        <circle cx="40" cy="210" r="3.5" fill="var(--audio)" />
      </svg>
    </div>
  );
}
