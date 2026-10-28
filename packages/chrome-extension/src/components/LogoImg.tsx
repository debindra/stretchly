/**
 * Stretchly logo: the figure mark cropped from public/logo.png plus a live-text
 * wordmark, so the name follows the theme's foreground color (legible in dark mode).
 */
export interface LogoImgProps {
  className?: string;
  /** Height of the mark in px; the wordmark scales with it. */
  height?: number;
  /** Hide the wordmark and show only the mark. */
  markOnly?: boolean;
}

// Bounding box of the mark inside logo.png (258×88).
const MARK = { x: 28, y: 13, w: 36, h: 61, imgW: 258, imgH: 88 };

const SRC =
  typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('logo.png') : '/logo.png';

export function LogoImg({ className = '', height = 28, markOnly = false }: LogoImgProps) {
  const s = height / MARK.h;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Stretchly" role="img">
      <span
        aria-hidden
        className="relative block shrink-0 overflow-hidden"
        style={{ width: MARK.w * s, height }}
      >
        <img
          src={SRC}
          alt=""
          className="absolute max-w-none"
          style={{ width: MARK.imgW * s, height: MARK.imgH * s, left: -MARK.x * s, top: -MARK.y * s }}
        />
      </span>
      {!markOnly && (
        <span
          aria-hidden
          className="font-bold tracking-tight text-foreground"
          style={{ fontSize: height * 0.72, lineHeight: 1 }}
        >
          Stretchly
        </span>
      )}
    </span>
  );
}
