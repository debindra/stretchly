/**
 * Original Stretchly logo as exact PNG. Use public/logo.png (icon + "Stretchly" wordmark).
 */
export interface LogoImgProps {
  alt?: string;
  className?: string;
  /** Height in px; width auto to preserve aspect ratio. */
  height?: number;
  /** Optional max width. */
  maxWidth?: number;
}

export function LogoImg({
  alt = 'Stretchly',
  className = '',
  height = 40,
  maxWidth,
}: LogoImgProps) {
  const src =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('logo.png')
      : '/logo.png';

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      height={height}
      width="auto"
      style={{
        display: 'block',
        objectFit: 'contain',
        ...(maxWidth != null && { maxWidth: `${maxWidth}px` }),
      }}
    />
  );
}
