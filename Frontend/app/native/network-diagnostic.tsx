import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/theme-context';

const HEALTH_URL = 'http://192.168.0.226:4000/health';
const REQUEST_TIMEOUT_MS = 10000;

type DiagnosticResult = {
  success: boolean;
  status?: number;
  errorName?: string;
  errorMessage?: string;
  elapsedMs: number;
};

export default function NetworkDiagnosticScreen() {
  const { colors } = useTheme();
  const [result, setResult] = useState<DiagnosticResult>();
  const [loading, setLoading] = useState(false);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
      setResult({ success: response.ok, status: response.status, elapsedMs: Date.now() - startedAt });
    } catch (error) {
      setResult({
        success: false,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startedAt
      });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text }]}>Diagnóstico de conectividad</Text>
      <Text style={{ color: colors.muted }}>GET /health</Text>
      {result ? (
        <>
          <Text style={{ color: colors.text }}>Solicitud exitosa: {result.success ? 'sí' : 'no'}</Text>
          <Text style={{ color: colors.text }}>Código HTTP: {result.status ?? 'sin respuesta'}</Text>
          {result.errorName ? <Text style={{ color: colors.danger }}>Nombre del error: {result.errorName}</Text> : null}
          {result.errorMessage ? <Text style={{ color: colors.danger }}>Mensaje del error: {result.errorMessage}</Text> : null}
          <Text style={{ color: colors.text }}>Tiempo transcurrido: {result.elapsedMs} ms</Text>
        </>
      ) : null}
      <Button title="Repetir prueba" loading={loading} onPress={runDiagnostic} />
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 24, fontWeight: '900' } });
