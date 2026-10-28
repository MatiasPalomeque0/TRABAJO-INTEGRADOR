import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme-context';
export function Loading({ label = 'Cargando…' }: { label?: string }) { const { colors } = useTheme(); return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.muted }}>{label}</Text></View>; }
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) { const { colors } = useTheme(); return <View style={[styles.box, { backgroundColor: `${colors.danger}18`, borderColor: colors.danger }]}><Text style={{ color: colors.danger, fontWeight: '700' }}>{message}</Text>{onRetry ? <Text onPress={onRetry} style={[styles.retry, { color: colors.primary }]}>Reintentar</Text> : null}</View>; }
export function EmptyState({ title, description }: { title: string; description: string }) { const { colors } = useTheme(); return <View style={styles.center}><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={{ color: colors.muted, textAlign: 'center' }}>{description}</Text></View>; }
const styles = StyleSheet.create({ center: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }, box: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 }, retry: { fontWeight: '700' }, title: { fontSize: 20, fontWeight: '800' } });

