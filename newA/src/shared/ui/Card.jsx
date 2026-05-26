import { clsx } from 'clsx';

export function Card({ children, className, ...props }) {
  return (
    <div className={clsx('bg-white rounded-xl shadow-sm border border-slate-100 p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }) {
  return <h3 className={clsx('text-base font-semibold text-slate-800', className)}>{children}</h3>;
}
