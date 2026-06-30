import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Opens the device camera and scans barcodes/QR codes live. Calls
// onScan(text) on the first successful decode, then stops.
//
// We acquire the MediaStream ourselves (rather than letting zxing call
// getUserMedia) so that:
//   1. the live preview is guaranteed to render, and
//   2. cleanup can always stop the camera — even React 18 StrictMode's
//      mount→unmount→mount cycle, which otherwise leaks a held camera and
//      leaves the preview black.
export default function BarcodeScanner({ onScan, onCancel }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    let stream = null;
    let controls = null;

    const stopStream = () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera API not available in this browser.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        // If the component already unmounted while we were awaiting, bail out
        // and release the camera we just grabbed.
        if (cancelled) return stopStream();

        controls = await reader.decodeFromStream(stream, videoRef.current, (result, _err, ctrl) => {
          if (cancelled || !result) return; // decode errors fire constantly while searching
          ctrl.stop();
          onScan(result.getText());
        });
        if (cancelled) {
          controls.stop();
          return stopStream();
        }
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setError(err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : `Could not start scanner: ${err.message}`);
      }
    }

    start();
    return () => {
      cancelled = true;
      controls?.stop();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="camera">
      {error ? (
        <div className="form-error">{error}</div>
      ) : (
        <>
          <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
          <p className="muted small">
            {starting ? 'Starting camera…' : 'Point the camera at a barcode or QR code…'}
          </p>
        </>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
