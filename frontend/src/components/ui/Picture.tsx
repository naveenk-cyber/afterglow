import type React from 'react';

type PictureProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** JPEG path, e.g. `/assets/hero-charging.jpg`. The WebP sibling is derived. */
  src: string;
  alt: string;
};

/**
 * Serves the WebP sibling of a bundled JPEG with the original as fallback.
 *
 * The assets are local files, so the WebP path is simply the same name with a
 * `.webp` extension — no build step, no image service, no new dependency. The
 * wrapper is `display: contents`, so it never adds a box: absolutely
 * positioned images keep sizing against the card that already contained them.
 */
const Picture: React.FC<PictureProps> = ({ src, alt, ...imgProps }) => {
  const webp = src.replace(/\.jpe?g$/i, '.webp');

  return (
    <picture className="contents">
      {webp !== src && <source srcSet={webp} type="image/webp" />}
      <img src={src} alt={alt} {...imgProps} />
    </picture>
  );
};

export default Picture;
