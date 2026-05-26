import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';
import Badge from '../../../shared/components/Badge.jsx';

export default function ProductImages({ imageUrl, name, availableDate }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative">
      <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-16 h-16 text-gray-200" />
          </div>
        )}
      </div>
      {availableDate && (
        <div className="absolute top-4 left-4">
          <Badge availableDate={availableDate} />
        </div>
      )}
    </motion.div>
  );
}
