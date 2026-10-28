import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { StatusBadge } from './StatusBadge';
import { useTheme } from '../theme/theme-context';
import type { Estimate, EstimateDecision } from '../types/api';

type Decision = 'aprobado' | 'rechazado';

export function PresentialEstimateCard({
  estimate,
  customerName,
  decisions,
  canDecide,
  isPresential,
  hasDuplicatePendingEstimates,
  observation,
  busy,
  onObservationChange,
  onDecision
}: {
  estimate: Estimate;
  customerName: string;
  decisions: EstimateDecision[];
  canDecide: boolean;
  isPresential: boolean;
  hasDuplicatePendingEstimates: boolean;
  observation: string;
  busy: boolean;
  onObservationChange: (value: string) => void;
  onDecision: (decision: Decision) => void;
}) {
  const { colors } = useTheme();
  const estimateDecisions = decisions.filter((item) => item.estimateId === estimate.id);
  const confirmDecision = (decision: Decision) => Alert.alert(
    decision === 'aprobado' ? 'Confirmar aprobación' : 'Confirmar rechazo',
    `¿Querés registrar que ${customerName} ${decision === 'aprobado' ? 'acepta' : 'rechaza'} el presupuesto de $${estimate.total.toFixed(2)}?`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', style: decision === 'rechazado' ? 'destructive' : 'default', onPress: () => onDecision(decision) }]
  );

  return <Card>
    <Text style={[styles.title, { color: colors.text }]}>{isPresential ? 'Decisión presencial del presupuesto' : 'Presupuesto vigente'}</Text>
    <View style={styles.row}><StatusBadge value={estimate.status} /><Text style={[styles.total, { color: colors.text }]}>${estimate.total.toFixed(2)}</Text></View>
    <Text style={{ color: colors.muted }}>Cliente: {customerName}</Text>
    <Text style={{ color: colors.muted }}>Mano de obra: ${estimate.laborCost.toFixed(2)}</Text>
    <Text style={{ color: colors.muted }}>Repuestos: ${estimate.partsCost.toFixed(2)}</Text>
    <Text style={{ color: colors.muted }}>{estimate.notes || 'Sin observaciones técnicas.'}</Text>
    {estimate.items?.length ? <View style={styles.items}>{estimate.items.map((item) => <Text key={item.id} style={{ color: colors.muted }}>• {item.description} × {item.quantity} — ${item.subtotal.toFixed(2)}</Text>)}</View> : null}
    {hasDuplicatePendingEstimates ? <Text style={{ color: colors.danger }}>Hay más de un presupuesto pendiente. Se requiere revisión administrativa.</Text> : null}
    {canDecide && !hasDuplicatePendingEstimates ? <>
      {isPresential ? <Input label="Observaciones de la decisión" multiline value={observation} onChangeText={onObservationChange} placeholder="Dejá constancia de lo expresado por el cliente." /> : null}
      <View style={styles.row}><Button title="Aprobar" loading={busy} onPress={() => confirmDecision('aprobado')} /><Button title="Rechazar" variant="danger" loading={busy} onPress={() => confirmDecision('rechazado')} /></View>
    </> : null}
    <Text style={[styles.subtitle, { color: colors.text }]}>Historial de decisiones</Text>
    {estimateDecisions.length ? estimateDecisions.map((decision) => <View key={decision.id}><Text style={{ color: colors.text, fontWeight: '700' }}>{decision.decision === 'aprobado' ? 'Aprobado' : 'Rechazado'} · {decision.decidedByName}</Text><Text style={{ color: colors.muted }}>{decision.decidedAt} · {decision.channel} · {decision.observation || 'Sin observación'}</Text></View>) : <Text style={{ color: colors.muted }}>Todavía no hay una decisión registrada.</Text>}
  </Card>;
}

const styles = StyleSheet.create({ title: { fontSize: 18, fontWeight: '800' }, subtitle: { fontSize: 16, fontWeight: '800', marginTop: 4 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, total: { fontSize: 20, fontWeight: '900' }, items: { gap: 4 } });
