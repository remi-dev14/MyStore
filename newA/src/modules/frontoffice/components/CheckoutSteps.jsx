import { Check } from 'lucide-react';

export default function CheckoutSteps() {
  return (
    <div className="flex items-center gap-2 mb-8 text-xs font-medium">
      <div className="flex items-center gap-1.5 text-emerald-600">
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-3 h-3" />
        </div>
        Panier
      </div>
      <div className="flex-1 h-px bg-indigo-200" />
      <div className="flex items-center gap-1.5 text-indigo-600 font-semibold">
        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</div>
        Confirmation
      </div>
      <div className="flex-1 h-px bg-gray-200" />
      <div className="flex items-center gap-1.5 text-gray-400">
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">3</div>
        Terminé
      </div>
    </div>
  );
}
