import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { isSupabaseConfigured } from '@/config/env';
import { colors, radius, spacing } from '@/config/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { loading, profile, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && profile) {
    return <Redirect href="/(deliver)" />;
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace('/(deliver)');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Delivery</Text>
        <Text style={styles.subtitle}>Sign in with your admin account.</Text>

        {!isSupabaseConfigured ? (
          <Text style={styles.hint}>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in delivery/.env (copy from
            mobile).
          </Text>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={() => void onSubmit()}
              disabled={submitting || !email.trim() || !password}
              style={({ pressed }) => [
                styles.button,
                (submitting || !email.trim() || !password) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.buttonLabel}>Sign in</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});
