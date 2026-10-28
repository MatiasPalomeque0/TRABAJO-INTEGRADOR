import { router } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { useTheme } from '../src/theme/theme-context';
export default function DeniedScreen() { const { colors } = useTheme(); return <Screen><Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>Acceso denegado</Text><Text style={{ color: colors.muted }}>Tu cuenta o rol no tiene permiso para consultar este recurso.</Text><Button title="Volver al inicio" onPress={() => router.replace('/(app)')} /></Screen>; }

