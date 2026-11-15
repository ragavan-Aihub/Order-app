import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/config/theme';
import { getBusiness, peekCachedBusiness } from '@/services/business';
import { fetchInboxItem, markInboxRead, type InboxItem } from '@/services/inbox';

function fullWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function NotificationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [item, setItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopIcon, setShopIcon] = useState(
    () => peekCachedBusiness()?.app_icon_url?.trim() || peekCachedBusiness()?.logo_url?.trim() || '',
  );

  const load = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const shop = await getBusiness();
    setShopIcon(shop?.app_icon_url?.trim() || shop?.logo_url?.trim() || '');
    const next = await fetchInboxItem(id);
    setItem(next);
    if (next && !next.read_at) {
      await markInboxRead(next.id);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const orderId = typeof item?.data.order_id === 'string' ? item.data.order_id : null;

  function goBackToList() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/notifications');
  }

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.md }]}>
      <Stack.Screen
        options={{
          title: 'Notification Center',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={goBackToList}
              hitSlop={8}
              style={styles.headerBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !item ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Message not found</Text>
          <Text style={styles.empty}>It may have been removed. Go back to Notification Center.</Text>
          <Pressable onPress={goBackToList} style={styles.backLink} accessibilityRole="button">
            <Text style={styles.backLinkLabel}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {shopIcon ? (
            <Image source={{ uri: shopIcon }} style={styles.shopIcon} contentFit="cover" />
          ) : (
            <View style={styles.iconFallback}>
              <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
            </View>
          )}
          <Text style={styles.when}>{fullWhen(item.created_at)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.copy}>{item.body}</Text>
          {orderId ? (
            <PrimaryButton
              label="View order"
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: orderId } })}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBack: {
    width: 44,
    height: 44,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  backLink: {
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  backLinkLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  shopIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.canvasTint,
  },
  iconFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  when: {
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  copy: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
  },
});
