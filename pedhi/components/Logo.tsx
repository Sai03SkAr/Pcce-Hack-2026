export function Logo({ size = 32 }: { size?: number }) {
  // A bahi-khata cover: red cloth, gold binding thread, the first letter of पेढी.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--bahi)" />
      <path d="M2 10.5h28" stroke="var(--gold)" strokeWidth="1.6" />
      <path d="M8 2v28" stroke="#000" strokeOpacity=".14" strokeWidth="2.2" />
      <text x="18.5" y="25" textAnchor="middle" fontSize="15" fontWeight="600" fill="#fff6e6" fontFamily="'Noto Sans Devanagari','Kohinoor Devanagari',sans-serif">पे</text>
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="display text-[22px] font-semibold leading-none">Pedhi</span>
    </span>
  )
}
