/**
 * LeafCorner — decorative hand-drawn-style leaf sprig used in the API usage
 * page corners. Purely decorative; `aria-hidden` and pointer-events disabled.
 */

const LEAF_PLACEMENTS = [
  { x: 18, y: 22, rotate: -35, scale: 1.15 },
  { x: 54, y: 10, rotate: 15, scale: 0.95 },
  { x: 40, y: 58, rotate: -70, scale: 1.0 },
  { x: 78, y: 44, rotate: 35, scale: 0.8 },
  { x: 92, y: 84, rotate: -15, scale: 0.7 },
  { x: 20, y: 92, rotate: -95, scale: 0.75 },
];

export default function LeafCorner({ className }) {
  return (
    <svg
      className={className}
      width="220"
      height="220"
      viewBox="0 0 140 140"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <path id="lynky-leaf" d="M0,0 C-9,-14 -9,-30 0,-42 C9,-30 9,-14 0,0 Z" />
      </defs>

      <path
        d="M4,4 C34,10 58,34 52,74 C48,102 26,120 8,132"
        stroke="var(--color-clean)"
        strokeWidth="1.5"
        opacity="0.25"
      />

      {LEAF_PLACEMENTS.map((leaf, i) => (
        <use
          key={i}
          href="#lynky-leaf"
          x={leaf.x}
          y={leaf.y}
          transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y}) scale(${leaf.scale})`}
          fill="var(--color-clean)"
          opacity="0.18"
        />
      ))}
    </svg>
  );
}