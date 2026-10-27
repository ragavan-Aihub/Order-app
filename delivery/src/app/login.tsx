import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { LoginHeroArt } from '@/components/LoginHeroArt';
import { LoginMapBackground } from '@/components/LoginMapBackground';
import { isSupabaseConfigured } from '@/config/env';
import { colors, radius, shadow, spacing } from '@/config/theme';

function LoginField({
  icon,
  right,
  inputRef,
  onFocus,
  ...inputProps
}: TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
  inputRef?: React.RefObject<ComponentRef<typeof TextInput> | null>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Ionicons name={icon} size={20} color={colors.textMuted} style={styles.fieldIcon} />
      <TextInput
        ref={inputRef}
        placeholderTextColor={colors.textMuted}
        style={styles.fieldInput}
        onFocus={onFocus}
        {...inputProps}
      />
      {right}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { loading, profile, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  function scrollFormIntoView() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 140, animated: true });
    });
  }

  const keyboardOpen = keyboardHeight > 0;
  const canSubmit = Boolean(email.trim() && password) && !submitting;

  return (
    <View style={styles.screen}>
      <LoginMapBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: keyboardOpen ? insets.top + spacing.sm : insets.top + spacing.lg,
              paddingBottom:
                insets.bottom + spacing.lg + (Platform.OS === 'android' ? keyboardHeight : 0),
              justifyContent: keyboardOpen ? 'flex-start' : 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={styles.card}>
            {!keyboardOpen ? <LoginHeroArt /> : null}
            <Text style={[styles.title, keyboardOpen && styles.titleCompact]}>Delivery</Text>
            <Text style={styles.subtitle}>Sign in with your admin account</Text>

            {!isSupabaseConfigured ? (
              <Text style={styles.hint}>
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in delivery/.env (copy from
                mobile).
              </Text>
            ) : (
              <>
                <LoginField
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="Email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <LoginField
                  icon="lock-closed-outline"
                  inputRef={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  placeholder="Password"
                  returnKeyType="go"
                  onFocus={scrollFormIntoView}
                  onSubmitEditing={() => {
                    if (canSubmit) {
                      void onSubmit();
                    }
                  }}
                  right={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  }
                />

                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Forgot password?',
                      'Reset your password from the admin website login page, or ask your shop administrator.',
                    )
                  }
                  style={styles.forgotWrap}
                  accessibilityRole="button"
                >
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  onPress={() => void onSubmit()}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.button,
                    !canSubmit && styles.buttonDisabled,
                    pressed && canSubmit && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <>
                      <Text style={styles.buttonLabel}>Sign in</Text>
                      <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + 4,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(231, 229, 228, 0.9)',
    ...shadow.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 24,
    marginBottom: -4,
  },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: '#FAFAF9',
    paddingHorizontal: spacing.sm,
    minHeight: 50,
  },
  fieldIcon: {
    marginRight: 4,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: spacing.xs,
  },
  forgot: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: 14,
  },
  button: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonLabel: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: '700',
  },
});
