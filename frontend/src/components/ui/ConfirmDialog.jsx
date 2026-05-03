import { AnimatePresence, motion } from 'framer-motion';

/**
 * Animated confirmation dialog with overlay.
 * Supports primary and danger variants.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'primary',
  children,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{
            background: 'rgba(0, 14, 47, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-2">
              {message}
            </p>
            {children && <div className="mb-4">{children}</div>}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                    : 'bg-[#000E2F] text-white hover:bg-[#061a3d] shadow-sm'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
