import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { assetUrl } from '../api.js';

const LightboxContext = createContext(null);

// Hook returning openLightbox(photoUrl) — shows the full-size image in an overlay.
export function useLightbox() {
  return useContext(LightboxContext);
}

export function LightboxProvider({ children }) {
  const [src, setSrc] = useState(null);
  const open = useCallback((s) => { if (s) setSrc(s); }, []);
  const close = useCallback(() => setSrc(null), []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, close]);

  return (
    <LightboxContext.Provider value={open}>
      {children}
      {src && (
        <div className="lightbox-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Image preview">
          <img className="lightbox-img" src={assetUrl(src)} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="lightbox-close" onClick={close} aria-label="Close preview">×</button>
        </div>
      )}
    </LightboxContext.Provider>
  );
}
