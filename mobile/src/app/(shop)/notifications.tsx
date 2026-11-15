import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { colors, radius, spacing } from '@/config/theme';
import { useTopInset } from '@/utils/safe-area';
import { getBusiness, peekCachedBusiness } from '@/services/business';
import {
  fetchInbox,
  markAllInboxRead,
  markInboxRead,
  type InboxCategory,
  type InboxItem,
} from '@/services/inbox';
import { getSignedInUser } from '@/services/supabase';

const FILTERS: { id: 'all' | InboxCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'orders', label: 'Orders', icon: 'cube-outline' },
  { id: 'offers', label: 'Offers', icon: 'pricetag-outline' },
  { id: 'updates', label: 'Updates', icon: 'megaphone-outline' },
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = startOfToday();
  if (date.getTime() >= today) {
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function iconFor(category: InboxCategory): keyof typeof Ionicons.glyphMap {
  if (category === 'orders') {
    return 'cube-outline';
  }
  if (category === 'offers') {
    return 'pricetag-outline';
  }
  return 'megaphone-outline';
}

function isActionableUnread(item: InboxItem) {
  return !item.read_at && item.category !== 'orders';
}

function toneFor(category: InboxCategory) {
  if (category === 'orders') {
    return { wrap: styles.iconOrders, color: colors.primaryDark };
  }
  if (category === 'offers') {
    return { wrap: styles.iconOffers, color: colors.warning };
  }
  return { wrap: styles.iconUpdates, color: colors.info };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [filter, setFilter] = useState<'all' | InboxCategory>('all');
  const [shopIcon, setShopIcon] = useState(
    () => peekCachedBusiness()?.app_icon_url?.trim() || peekCachedBusiness()?.logo_url?.trim() || '',
  );

  const load = useCallback(async () => {
    const user = await getSignedInUser();
    setSignedIn(Boolean(user));
    const shop = await getBusiness();
    setShopIcon(shop?.app_icon_url?.trim() || shop?.logo_url?.trim() || '');
    if (!user) {
      setItems([]);
      return;
    }
    setItems(await fetchInbox());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.category === filter)),
    [filter, items],
  );
  const todayStamp = startOfToday();
  const today = visible.filter((item) => new Date(item.created_at).getTime() >= todayStamp);
  const earlier = visible.filter((item) => new Date(item.created_at).getTime() < todayStamp);
  const unread = items.some(isActionableUnread);

  async function openItem(item: InboxItem) {
    router.push({ pathname: '/notification/[id]', params: { id: item.id } });
  }

  async function markItemRead(item: InboxItem) {
    if (item.read_at) {
      return;
    }
    await markInboxRead(item.id);
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, read_at: row.read_at ?? new Date().toISOString() } : row)),
    );
  }

  function markAllRead() {
    void markAllInboxRead();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    );
  }

  if (signedIn === false) {
    return (
      <EmptyState
        title="Sign in to see alerts"
        message="Order updates and shop messages show up here after you sign in."
        actionLabel="Sign in"
        onAction={() => router.push({ pathname: '/login', params: { next: 'notifications' } })}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          Notification Center
        </Text>
      </View>
      {items.length > 0 ? (
        <Pressable
          onPress={unread ? markAllRead : undefined}
          disabled={!unread}
          style={[styles.markAllBar, !unread && styles.markAllBarOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !unread }}
        >
          <Text style={[styles.markAll, !unread && styles.markAllOff]}>
            {unread ? 'Clear all unread' : 'All caught up'}
          </Text>
        </Pressable>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((chip) => {
          const on = filter === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setFilter(chip.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
            >
              <Ionicons name={chip.icon} size={16} color={on ? colors.primaryText : colors.primaryDark} />
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {visible.length === 0 ? (
          <Text style={styles.empty}>No notifications yet.</Text>
        ) : (
          <>
            {today.length > 0 ? <Text style={styles.group}>Today</Text> : null}
            {today.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                shopIcon={shopIcon}
                onPress={() => void openItem(item)}
                onMarkRead={() => void markItemRead(item)}
              />
            ))}
            {earlier.length > 0 ? <Text style={[styles.group, styles.groupLater]}>Earlier</Text> : null}
            {earlier.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                shopIcon={shopIcon}
                onPress={() => void openItem(item)}
                onMarkRead={() => void markItemRead(item)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InboxRow({
  item,
  shopIcon,
  onPress,
  onMarkRead,
}: {
  item: InboxItem;
  shopIcon: string;
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const tone = toneFor(item.category);
  const unread = isActionableUnread(item);
  return (
    <View style={[styles.card, unread && styles.cardUnread]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {shopIcon ? (
          <Image source={{ uri: shopIcon }} style={styles.shopIcon} contentFit="cover" />
        ) : (
          <View style={[styles.iconWrap, tone.wrap]}>
            <Ionicons name={iconFor(item.category)} size={18} color={tone.color} />
          </View>
        )}
        <View style={styles.copy}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.when}>{timeLabel(item.created_at)}</Text>
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </Pressable>
      {unread ? (
        <Pressable onPress={onMarkRead} style={styles.markOneBtn} accessibilityRole="button">
          <Text style={styles.unreadLabel}>Unread</Text>
        </Pressable>
      ) : item.category === 'orders' ? null : (
        <Text style={styles.readLabel}>Read</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  markAllBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllBarOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  markAll: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  markAllOff: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  markOneBtn: {
    alignSelf: 'flex-start',
    marginLeft: 52,
    marginTop: 2,
    minHeight: 36,
    justifyContent: 'center',
  },
  unreadLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  readLabel: {
    marginLeft: 52,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chips: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  chipLabelOn: {
    color: colors.primaryText,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  group: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  groupLater: {
    marginTop: spacing.sm,
  },
  empty: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
  },
  card: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardUnread: {
    backgroundColor: colors.canvasTint,
    borderColor: colors.primarySoft,
  },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.canvasTint,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrders: {
    backgroundColor: colors.primarySoft,
  },
  iconOffers: {
    backgroundColor: '#FFEDD5',
  },
  iconUpdates: {
    backgroundColor: '#DBEAFE',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  when: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
});
