import { useEffect, useState } from 'react';

// Renders an <img> that gracefully swaps to `fallback` if the source is missing
// or fails to load (e.g. an uploaded file that was deleted on the server).
export default function SafeImage({ src, alt = '', className, fallback = null, onClick }) {
  const [failed, setFailed] = useState(false);

  // Reset when the source changes so a new image gets a fresh chance to load.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}
