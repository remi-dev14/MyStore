export default function DeclinationSelector({ combinations, selectedCombo, onSelect }) {
  if (!combinations.length) return null;

  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-gray-700 mb-2">Déclinaison</p>
      <div className="flex flex-wrap gap-2">
        {combinations.map((c) => (
          <button
            key={c.id_product_attribute}
            onClick={() => onSelect(c)}
            disabled={c.quantity === 0}
            className={[
              'px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all',
              selectedCombo?.id_product_attribute === c.id_product_attribute
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-700 hover:border-indigo-300',
              c.quantity === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {c.reference}{c.quantity === 0 && ' (épuisé)'}
          </button>
        ))}
      </div>
    </div>
  );
}
