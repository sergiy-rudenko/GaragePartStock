import { useEffect, useRef, useState } from 'react';

// Opens the device camera, shows a live preview, and captures a still frame
// as an image File passed to onCapture(file). Calls onCancel to close.
export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera API not available in this browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setError(err.name === 'NotAllowedError'
          ? 'Camera permission denied.'
          : `Could not start camera: ${err.message}`);
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stop();
      onCapture(file);
    }, 'image/jpeg', 0.9);
  }

  function handleCancel() {
    stop();
    onCancel();
  }

  return (
    <div className="camera">
      {error ? (
        <div className="form-error">{error}</div>
      ) : (
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleCapture} disabled={!!error}>
          📸 Capture
        </button>
      </div>
    </div>
  );
}
