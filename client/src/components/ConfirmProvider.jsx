import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal.jsx';

const ConfirmContext = createContext(null);

// Hook returning confirm(opts) -> Promise<boolean>. Replaces window.confirm with
// a styled, accessible dialog. opts: { title, message, confirmLabel, cancelLabel, danger }.
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({
      title: 'Are you sure?',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      danger: false,
      ...opts,
    });
  }), []);

  const close = (result) => {
    setState(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)}>
          <p className="confirm-message">{state.message}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
              {state.cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => close(true)}
              autoFocus
            >
              {state.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
