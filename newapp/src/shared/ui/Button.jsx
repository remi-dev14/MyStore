import { clsx } from 'clsx';

const variants = {
  primary:   'bg-indigo-600 hover:bg-indigo-700 text-white',
  danger:    'bg-red-500 hover:bg-red-600 text-white',
  secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  ghost:     'hover:bg-slate-100 text-slate-600',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white',
  info:      'bg-blue-500 hover:bg-blue-600 text-white',
  warning:   'bg-amber-500 hover:bg-amber-600 text-white',
};

const sizes = {
  sm:  'px-3 py-1.5 text-xs',
  md:  'px-4 py-2 text-sm',
  lg:  'px-5 py-2.5 text-base',
};

export function Button({ children, variant = 'primary', size = 'md', className, disabled, ...props }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
