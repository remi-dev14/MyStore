import { clsx } from 'clsx';

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
      <table className={clsx('w-full text-sm text-slate-700 border-collapse', className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
      {children}
    </thead>
  );
}

export function Th({ children, className, right }) {
  return (
    <th className={clsx('px-4 py-3 font-semibold border-b border-slate-100 whitespace-nowrap', right && 'text-right', className)}>
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-slate-50 bg-white">{children}</tbody>;
}

export function Tr({ children, onClick, className }) {
  return (
    <tr
      className={clsx('transition-colors', onClick && 'cursor-pointer hover:bg-slate-50', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className, right }) {
  return (
    <td className={clsx('px-4 py-3 align-middle', right && 'text-right', className)}>
      {children}
    </td>
  );
}
