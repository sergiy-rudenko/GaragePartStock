import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

// Hook returning { success, error, info } — each shows a non-blocking toast.
export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { success: '✓', error: '⚠', info: 'ℹ' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type) => {
    const id = (idRef.current += 1);
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
    return id;
  }, [remove]);

  const api = useRef({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            onClick={() => remove(t.id)}
            role="button"
            title="Dismiss"
          >
            <span className="toast-icon" aria-hidden>{ICONS[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
