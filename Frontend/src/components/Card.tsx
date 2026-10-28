import { StyleSheet, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { useTheme } from '../theme/theme-context';
export function Card({ children }: PropsWithChildren) { const { colors } = useTheme(); return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>; }
const styles = StyleSheet.create({ card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 } });

