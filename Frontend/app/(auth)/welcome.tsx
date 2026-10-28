import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/theme-context';
export default function WelcomeScreen() { const { colors } = useTheme(); return <Screen><View style={styles.hero}><View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={styles.logoText}>TF</Text></View><Text style={[styles.title, { color: colors.text }]}>TechFix</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Seguimiento simple y seguro de tus reparaciones informáticas.</Text></View><View style={styles.actions}><Button title="Iniciar sesión" onPress={() => router.push('/(auth)/login')} /><Button title="Crear una cuenta" variant="secondary" onPress={() => router.push('/(auth)/register')} /></View><Text style={[styles.note, { color: colors.muted }]}>Equipos, diagnósticos y presupuestos en un solo lugar.</Text></Screen>; }
const styles = StyleSheet.create({ hero: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 16 }, logo: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#fff', fontSize: 34, fontWeight: '900' }, title: { fontSize: 36, fontWeight: '900' }, subtitle: { maxWidth: 320, textAlign: 'center', lineHeight: 24, fontSize: 17 }, actions: { gap: 12 }, note: { textAlign: 'center', fontSize: 12, marginTop: 20 } });

