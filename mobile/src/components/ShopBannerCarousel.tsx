import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { colors, radius, spacing } from '@/config/theme';

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
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [ready, setReady] = useState<string[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const visible = banners
    .map((banner) => ({ url: banner.url.trim(), focusY: banner.focusY }))
    .filter((banner) => banner.url.length > 0 && !failed.includes(banner.url));
  const shown = visible.filter((banner) => ready.includes(banner.url));
  const pending = visible.filter((banner) => !ready.includes(banner.url));

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
    if (reduceMotion || shown.length < 2 || width <= 0) {
      return;
    }
    const timer = setInterval(() => {
      if (pausedRef.current) {
        return;
      }
      const next = (indexRef.current + 1) % shown.length;
      indexRef.current = next;
      setIndex(next);
      scrollerRef.current?.scrollTo({ x: next * width, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [reduceMotion, shown.length, width]);

  function rememberIndex(offsetX: number) {
    if (width <= 0) {
      return;
    }
    const next = Math.round(offsetX / width);
    const clamped = Math.min(Math.max(next, 0), shown.length - 1);
    indexRef.current = clamped;
    if (clamped !== index) {
      setIndex(clamped);
    }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    rememberIndex(event.nativeEvent.contentOffset.x);
  }

  if (visible.length === 0) {
    return null;
  }

  return (
    <>
      {pending.map((banner) => (
        <Image
          key={`probe-${banner.url}`}
          source={{ uri: banner.url }}
          style={styles.probe}
          onLoad={() => setReady((current) => (current.includes(banner.url) ? current : [...current, banner.url]))}
          onError={() => setFailed((current) => (current.includes(banner.url) ? current : [...current, banner.url]))}
        />
      ))}
      {shown.length === 0 || frameHeight === 0 ? null : (
        <View style={styles.wrap}>
          <View
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              if (nextWidth > 0 && nextWidth !== width) {
                setWidth(nextWidth);
              }
            }}
          >
            {width > 0 ? (
              <ScrollView
                ref={scrollerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                onScrollBeginDrag={() => {
                  pausedRef.current = true;
                }}
                onMomentumScrollEnd={(event) => {
                  rememberIndex(event.nativeEvent.contentOffset.x);
                  pausedRef.current = false;
                }}
                scrollEventThrottle={16}
                decelerationRate="fast"
              >
                {shown.map((banner, slide) => (
                  <View
                    key={`${banner.url}-${slide}`}
                    style={[styles.frame, frameHeight ? { width, height: frameHeight } : [styles.frameRatio, { width }]]}
                  >
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
            ) : null}
          </View>
          {width > 0 && shown.length > 1 ? (
            <View style={styles.dots}>
              {shown.map((banner, dot) => (
                <View key={`${banner.url}-dot-${dot}`} style={[styles.dot, dot === index && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  probe: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
  },
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  frameRatio: {
    aspectRatio: 2 / 1,
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
