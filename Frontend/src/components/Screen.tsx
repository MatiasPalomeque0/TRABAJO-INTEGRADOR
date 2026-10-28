import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { useTheme } from '../theme/theme-context';

export function Screen({ children, scroll = true, padded = true, refreshControl }: PropsWithChildren<{ scroll?: boolean; padded?: boolean; refreshControl?: ReactElement<RefreshControlProps> }>) {
  const { colors } = useTheme();
  const content = scroll ? <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.content, padded && styles.padded]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} scrollsChildToFocus>{children}</ScrollView> : <View style={[styles.content, padded && styles.padded]}>{children}</View>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{content}</KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, keyboard: { flex: 1 }, content: { flexGrow: 1 }, padded: { padding: 20, paddingBottom: 36, gap: 16 } });

