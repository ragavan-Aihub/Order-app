import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/config/theme';
import type { Business } from '@/types/business';

const CLOSED_FALLBACK = 'The shop is closed and is not taking orders right now.';

export function shopClosedMessage(shop: Business | null | undefined) {
  if (!shop?.shop_closed) {
    return null;
  }
  return shop.shop_closed_message?.trim() || CLOSED_FALLBACK;
}

export function ShopHomeNotice({ shop }: { shop: Business | null }) {
  const closed = shopClosedMessage(shop);
  if (!closed) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.closed}>
        <Text style={styles.closedTitle}>Shop closed</Text>
        <Text style={styles.closedBody}>{closed}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  closed: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  closedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991B1B',
  },
  closedBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7F1D1D',
  },
});
