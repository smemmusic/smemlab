export function HCable() {
  return (
    <div className="cable h">
      <svg viewBox="0 0 46 402" preserveAspectRatio="none">
        <path d="M0 201 C 18 201,26 201,46 201" fill="none" stroke="var(--audio)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <path className="flow" d="M0 201 C 18 201,26 201,46 201" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="2" cy="201" r="3.5" fill="var(--audio)" />
        <circle cx="44" cy="201" r="3.5" fill="var(--audio)" />
      </svg>
    </div>
  );
}
