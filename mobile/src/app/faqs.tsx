import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CUSTOMER_FAQS } from '@/content/customer-faqs';
import { colors, radius, spacing } from '@/config/theme';

export default function FaqsScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Answers to common questions about orders, payment, and sign-in.</Text>
      {CUSTOMER_FAQS.map((item, index) => {
        const open = openIndex === index;
        return (
          <View key={item.question} style={styles.card}>
            <Pressable
              onPress={() => setOpenIndex(open ? null : index)}
              style={styles.questionRow}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.question}>{item.question}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {open ? <Text style={styles.answer}>{item.answer}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  question: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.text,
  },
  answer: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
