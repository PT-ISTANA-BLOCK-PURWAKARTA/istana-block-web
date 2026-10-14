import type { CSSProperties } from "react";

/** Segi enam kecil dekoratif bersudut membulat. */
export function Hex({ size, color, style, className }: { size: number; color: string; style?: CSSProperties; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={Math.round((size * 112) / 100)} viewBox="0 0 100 112" style={style} className={className}>
      <polygon points="50,4 96,30 96,82 50,108 4,82 4,30" fill={color} stroke={color} strokeWidth="8" strokeLinejoin="round" />
    </svg>
  );
}
