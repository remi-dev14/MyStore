import { Badge } from '../../../shared/ui/Badge.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { Tr, Td } from '../../../shared/ui/Table.jsx';
import { isoToFr } from '../../../utils/dateUtils.js';
import { Package, Truck, XCircle } from 'lucide-react';

const STATE_LABEL = {
  2:  'Paiement accepté',
  3:  'En préparation',
  4:  'Expédié',
  5:  'Livré',
  6:  'Annulé',
  8:  'Erreur de paiement',
  11: 'Paiement effectué',
};

const STATE_VARIANT = {
  2:  'info',
  3:  'warning',
  4:  'success',
  5:  'success',
  6:  'danger',
  8:  'danger',
  11: 'info',
};

function stateLabel(id)   { return STATE_LABEL[Number(id)]   ?? `État ${id}`; }
function stateVariant(id) { return STATE_VARIANT[Number(id)] ?? 'default'; }

export default function OrderRow({ order: o, customerMap, updating, onStateChange }) {
  const state      = String(o.current_state);
  const isUpdating = updating === o.id;
  const isFinal    = state === '4' || state === '5' || state === '6';
  const canPrepare = state === '2' || state === '11';
  const canDeliver = state === '2' || state === '11' || state === '3';
  const canCancel  = !isFinal;

  return (
    <Tr>
      <Td className="font-medium text-slate-500">{o.reference ?? `#${o.id}`}</Td>
      <Td className="font-medium">{customerMap[o.id_customer] || `Client #${o.id_customer}`}</Td>
      <Td className="text-slate-500">{isoToFr(o.date_add)}</Td>
      <Td right className="font-semibold">{parseFloat(o.total_paid ?? 0).toFixed(2)} €</Td>
      <Td>
        <Badge variant={stateVariant(o.current_state)}>{stateLabel(o.current_state)}</Badge>
      </Td>
      <Td>
        <div className="flex items-center gap-2 flex-wrap">
          {canPrepare && (
            <Button size="sm" variant="info" disabled={isUpdating} onClick={() => onStateChange(o.id, '3')} title="Passer en préparation">
              <Package size={13} /> Préparer
            </Button>
          )}
          {canDeliver && (
            <Button size="sm" variant="success" disabled={isUpdating} onClick={() => onStateChange(o.id, '5')} title="Marquer comme livré (décrémente le stock)">
              <Truck size={13} /> Livrer
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => onStateChange(o.id, '6')} title="Annuler la commande">
              <XCircle size={13} /> Annuler
            </Button>
          )}
          {isUpdating && <span className="text-xs text-slate-400 italic">mise à jour…</span>}
          {isFinal && !isUpdating && <span className="text-xs text-slate-300 italic">—</span>}
        </div>
      </Td>
    </Tr>
  );
}
