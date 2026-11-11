import { AppDialog } from '@/components/AppDialog';
import { formatPrice } from '@/utils/format';

export function MinOrderDialog({
  visible,
  minAmount,
  onClose,
  onAddItems,
}: {
  visible: boolean;
  minAmount: number;
  onClose: () => void;
  onAddItems: () => void;
}) {
  return (
    <AppDialog
      visible={visible}
      title={`Minimum order is ${formatPrice(minAmount)}`}
      message="Add more items to continue."
      icon="cart"
      onClose={onClose}
      actions={[{ label: 'Add Items', onPress: onAddItems }]}
    />
  );
}
