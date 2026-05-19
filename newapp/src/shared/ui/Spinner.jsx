import { clsx } from 'clsx';

export function Spinner({ className }) {
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  );
}
