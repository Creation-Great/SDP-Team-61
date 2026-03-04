import { Loader2 } from 'lucide-react';

/**
 * Reusable Button component with multiple variants.
 *
 * Variants: primary | secondary | danger | ghost | ai | success
 * Sizes: sm | default | lg
 */
export default function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  disabled = false,
  loading = false,
  size = 'default',
  type = 'button',
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const variants = {
    primary:
      'bg-[#000E2F] text-white hover:bg-[#061a3d] shadow-sm focus:ring-[#000E2F]',
    secondary:
      'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-slate-200',
    danger:
      'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ai:
      'bg-gradient-to-r from-teal-500 to-emerald-600 text-white hover:from-teal-600 hover:to-emerald-700 shadow-md border-0',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-500',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.default} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        Icon && <Icon className="w-4 h-4 mr-2" />
      )}
      {children}
    </button>
  );
}
