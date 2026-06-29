export function GitPilotIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id="gpi-bg" cx="44%" cy="36%" r="65%">
          <stop offset="0%" stopColor="#16223a"/>
          <stop offset="100%" stopColor="#080d16"/>
        </radialGradient>
        <linearGradient id="gpi-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.8"/>
          <stop offset="50%"  stopColor="#a78bfa" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="72" fill="url(#gpi-bg)"/>
      <circle cx="80" cy="80" r="72" fill="none" stroke="url(#gpi-rim)" strokeWidth="1.5"/>
      <line x1="68" y1="14"  x2="68" y2="50"  stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="68" y1="62"  x2="68" y2="100" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="68" y1="113" x2="68" y2="146" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <line x1="96" y1="70"  x2="96" y2="92"  stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
      <path d="M 68 50 C 82 50 82 70 96 70" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.72"/>
      <path d="M 96 92 C 82 92 82 113 68 113" stroke="#a78bfa" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.72"/>
      <circle cx="68" cy="30"  r="5.5" fill="#38bdf8"/><circle cx="68" cy="30"  r="3.2" fill="#080d16"/><circle cx="68" cy="30"  r="3.2" fill="#38bdf8" opacity="0.55"/>
      <circle cx="68" cy="56"  r="5.5" fill="#38bdf8"/><circle cx="68" cy="56"  r="3.2" fill="#080d16"/><circle cx="68" cy="56"  r="3.2" fill="#38bdf8" opacity="0.55"/>
      <circle cx="96" cy="81"  r="7"   fill="#a78bfa" opacity="0.15"/>
      <circle cx="96" cy="81"  r="6"   fill="#a78bfa"/><circle cx="96" cy="81"  r="3.8" fill="#080d16"/><circle cx="96" cy="81"  r="3.8" fill="#a78bfa" opacity="0.55"/>
      <circle cx="96" cy="81"  r="9.5" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.85"/>
      <circle cx="68" cy="106" r="5.5" fill="#38bdf8"/><circle cx="68" cy="106" r="3.2" fill="#080d16"/><circle cx="68" cy="106" r="3.2" fill="#38bdf8" opacity="0.55"/>
      <circle cx="68" cy="106" r="8.5" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.4"/>
      <circle cx="68" cy="130" r="5.5" fill="#38bdf8"/><circle cx="68" cy="130" r="3.2" fill="#080d16"/><circle cx="68" cy="130" r="3.2" fill="#38bdf8" opacity="0.55"/>
      <circle cx="116" cy="118" r="5" fill="#34d399" opacity="0.9"/>
    </svg>
  );
}
