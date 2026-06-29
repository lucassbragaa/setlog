import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, radius } from '../theme';

export function PRBadge({ visible, onDone }: { visible: boolean; onDone?: () => void }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.7);
    opacity.setValue(1);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDone?.());
    }, 3000);
    return () => clearTimeout(timer);
  }, [visible, scale, opacity, onDone]);

  if (!visible) return null;
  return <Animated.View style={[styles.badge, { opacity, transform: [{ scale }] }]}><Text style={styles.text}>PR!</Text></Animated.View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  text: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
