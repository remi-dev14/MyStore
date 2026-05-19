import { daysDiffIso } from '../../utils/dateUtils.js';

export default function Badge({ availableDate }) {
  if (!availableDate || availableDate === '0000-00-00') return null;
  const diff = daysDiffIso(availableDate);
  if (diff === null || diff < 0) return null; // future date → no badge
  if (diff <= 1) return <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white uppercase tracking-wider shadow-sm">HOT</span>;
  if (diff <= 7) return <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider shadow-sm">NEW</span>;
  return null;
}
