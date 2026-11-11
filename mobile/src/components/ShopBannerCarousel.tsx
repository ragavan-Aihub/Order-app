import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

const BANNER_RATIO = 16 / 7;

export function ShopBannerCarousel({
  banners,
  frameHeight,
}: {
  banners: { url: string; focusY: number }[];
  frameHeight?: number;
}) {
  const scrollerRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const autoplayRef = useRef(false);
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.max(1, Math.round(windowWidth - spacing.md * 2));
  const pageHeight = frameHeight && frameHeight > 0 ? frameHeight : Math.round(pageWidth / BANNER_RATIO);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const shown = banners
    .map((banner) => ({ url: banner.url.trim(), focusY: banner.focusY }))
    .filter((banner) => banner.url.length > 0 && !failed.includes(banner.url));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (indexRef.current >= shown.length) {
      indexRef.current = 0;
      setIndex(0);
    }
  }, [shown.length]);

  useEffect(() => {
    if (reduceMotion || shown.length < 2) {
      return;
    }
    const timer = setInterval(() => {
      if (pausedRef.current) {
        return;
      }
      const next = (indexRef.current + 1) % shown.length;
      indexRef.current = next;
      setIndex(next);
      autoplayRef.current = true;
      const wrapToStart = next === 0;
      scrollerRef.current?.scrollTo({
        x: next * pageWidth,
        animated: !wrapToStart,
      });
      setTimeout(() => {
        autoplayRef.current = false;
      }, wrapToStart ? 50 : 450);
    }, 4000);
    return () => clearInterval(timer);
  }, [pageWidth, reduceMotion, shown.length]);

  function rememberIndex(offsetX: number) {
    if (autoplayRef.current || pageWidth <= 0) {
      return;
    }
    const next = Math.round(offsetX / pageWidth);
    const clamped = Math.min(Math.max(next, 0), Math.max(shown.length - 1, 0));
    indexRef.current = clamped;
    setIndex((current) => (current === clamped ? current : clamped));
  }

  if (shown.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollerRef}
        horizontal
        pagingEnabled={Platform.OS === 'ios'}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          rememberIndex(event.nativeEvent.contentOffset.x);
        }}
        onScrollBeginDrag={() => {
          pausedRef.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          rememberIndex(event.nativeEvent.contentOffset.x);
          pausedRef.current = false;
          autoplayRef.current = false;
        }}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {shown.map((banner, slide) => (
          <View key={`${banner.url}-${slide}`} style={[styles.frame, { width: pageWidth, height: pageHeight }]}>
            <Image
              source={{ uri: banner.url }}
              style={styles.image}
              contentFit="cover"
              contentPosition={{ top: `${banner.focusY}%`, left: '50%' }}
              accessibilityLabel="Shop poster"
              onError={() =>
                setFailed((current) => (current.includes(banner.url) ? current : [...current, banner.url]))
              }
            />
          </View>
        ))}
      </ScrollView>
      {shown.length > 1 ? (
        <View style={styles.dots}>
          {shown.map((banner, dot) => (
            <View key={`${banner.url}-dot-${dot}`} style={[styles.dot, dot === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotOn: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
