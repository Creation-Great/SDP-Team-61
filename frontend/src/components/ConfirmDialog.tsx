import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary';
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel, variant = 'primary', children,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0, 7, 26, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-card)',
              border: '1px solid rgba(75, 159, 225, 0.15)',
              borderTop: '2px solid',
              borderImage: 'linear-gradient(90deg, var(--tech-blue), var(--uconn-orange)) 1',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              borderRadius: '4px',
            }}
          >
            <h3 style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '12px',
            }}>{title}</h3>
            <p style={{
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '8px',
            }}>{message}</p>
            {children && <div style={{ marginBottom: '16px' }}>{children}</div>}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={onCancel}>{cancelLabel}</button>
              <button className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
