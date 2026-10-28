import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { Button } from './Button';
import { ErrorMessage } from './Feedback';
import { Screen } from './Screen';
import { navigationDiagnostic, safeErrorDetails } from '../utils/navigation-diagnostics';
import { Text } from 'react-native';
import { useTheme } from '../theme/theme-context';

export function RouteErrorBoundary({ route, error, retry }: ErrorBoundaryProps & { route: string }) {
  const { colors } = useTheme();
  navigationDiagnostic('render-error', { route, ...safeErrorDetails(error) });
  return <Screen><Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>No se pudo abrir esta pantalla</Text><ErrorMessage message="Se detectó un error de navegación. Revisá Metro para ver el detalle técnico." /><Button title="Reintentar" onPress={() => { void retry(); }} /><Button title="Volver" variant="ghost" onPress={() => { navigationDiagnostic('navigate', { from: route, to: 'back', reason: 'error-boundary' }); router.back(); }} /></Screen>;
}
