import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { ChoiceSelector } from '../../../src/components/ChoiceSelector';
import { EmptyState, ErrorMessage, Loading } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { PresentialEstimateCard } from '../../../src/components/PresentialEstimateCard';
import { RepairOpenOnly } from '../../../src/components/RepairOpenOnly';
import { repairApi } from '../../../src/services/repairs';
import { miscApi } from '../../../src/services/misc';
import { useAuth } from '../../../src/context/auth-context';
import { isAdmin, isClient, isReceptionist, isTechnician } from '../../../src/utils/permissions';
import { allowedRepairStatuses, isRepairClosed, normalizeRepairStatus, repairStatusLabel } from '../../../src/utils/repair-status';
import { canAssignRepair, canEditTechnicalRepair } from '../../../src/utils/repair-actions';
import { canCreateEstimate, canRegisterEstimateDecision, isPresentialDecisionRole } from '../../../src/utils/estimate-visibility';
import { useTheme } from '../../../src/theme/theme-context';
import type { Repair, User } from '../../../src/types/api';
import { appRoutes } from '../../../src/navigation/routes';
import { navigationDiagnostic } from '../../../src/utils/navigation-diagnostics';

export default function RepairDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [repair, setRepair] = useState<Repair>();
  const [error, setError] = useState<string>();
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [technicianError, setTechnicianError] = useState<string>();
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [assignmentError, setAssignmentError] = useState<string>();
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [estimateNotes, setEstimateNotes] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [partsCost, setPartsCost] = useState('0');
  const [workDescription, setWorkDescription] = useState('');
  const [decisionObservation, setDecisionObservation] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadVersionRef = useRef(0);

  const load = useCallback(async () => {
    const requestVersion = ++loadVersionRef.current;
    try {
      setError(undefined);
      const nextRepair = await repairApi.get(Number(id));
      if (requestVersion === loadVersionRef.current) setRepair(nextRepair);
    } catch (e) {
      if (requestVersion === loadVersionRef.current) setError(e instanceof Error ? e.message : 'No se pudo cargar la reparación.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const admin = isAdmin(user);
  const technician = isTechnician(user);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    setLoadingTechnicians(true);
    setTechnicianError(undefined);
    void miscApi.technicians()
      .then((items) => { if (active) setTechnicians(items); })
      .catch((e) => { if (active) setTechnicianError(e instanceof Error ? e.message : 'No se pudieron cargar los técnicos.'); })
      .finally(() => { if (active) setLoadingTechnicians(false); });
    return () => { active = false; };
  }, [admin]);

  useEffect(() => {
    setSelectedTechnicianId(repair?.technicianId ? String(repair.technicianId) : '');
  }, [repair?.id, repair?.technicianId]);

  if (!repair && !error) return <Loading />;
  if (error || !repair) return <Screen><ErrorMessage message={error ?? 'Reparación no encontrada'} onRetry={load} /></Screen>;

  const currentStatus = normalizeRepairStatus(repair.status);
  const assignedTechnician = technician && repair.technicianId === user?.id;
  const isClosed = isRepairClosed(currentStatus);
  navigationDiagnostic('repair-detail-state', { repairId: Number(id), status: repair.status, normalizedStatus: currentStatus, isClosed, roles: user?.roles ?? [] });
  const canEditTechnicalData = canEditTechnicalRepair(user, currentStatus, assignedTechnician);
  const canAssignTechnician = canAssignRepair(user, currentStatus);
  const activeEstimates = [...(repair.estimates ?? [])].filter((estimate) => estimate.status !== 'reemplazado').sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id);
  const pendingEstimates = repair.estimates?.filter((estimate) => estimate.status === 'pendiente_aprobacion') ?? [];
  const currentPendingEstimate = pendingEstimates[0];
  const currentEstimate = activeEstimates[0];
  const hasDuplicatePendingEstimates = pendingEstimates.length > 1;
  const hasApprovedEstimate = currentEstimate?.status === 'aprobado';
  const nextStatuses = allowedRepairStatuses(currentStatus as Repair['status'], user, { hasApprovedEstimate, hasPendingEstimate: pendingEstimates.length > 0, hasAssignedTechnician: Boolean(repair.technicianId), hasWorkLogs: (repair.workLogs?.length ?? 0) > 0 });
  const canViewEstimate = admin || isReceptionist(user) || technician || isClient(user);
  const canDecideEstimate = !isClosed && canRegisterEstimateDecision(user, currentEstimate, pendingEstimates.length);

  const submit = async (action: () => Promise<unknown>, message: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { setError(undefined); await action(); await load(); }
    catch (e) {
      setError(e instanceof Error ? e.message : message);
      const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status?: unknown }).status) : undefined;
      if (status === 409) await load();
    }
    finally { busyRef.current = false; setBusy(false); }
  };

  const assign = () => {
    if (!selectedTechnicianId) { setAssignmentError('Seleccioná un técnico activo.'); return; }
    setAssignmentError(undefined);
    void submit(() => repairApi.assign(repair.id, Number(selectedTechnicianId), currentStatus as Repair['status'], repair.technicianId), 'No se pudo asignar el técnico.');
  };

  const saveDiagnosis = () => void submit(async () => {
    await repairApi.diagnosis(repair.id, { description: diagnosis, recommendation: recommendation || null });
    setDiagnosis('');
    setRecommendation('');
  }, 'No se pudo guardar el diagnóstico.');

  const saveEstimate = () => void submit(
    () => repairApi.createEstimate(repair.id, { notes: estimateNotes || null, laborCost: Number(laborCost), partsCost: Number(partsCost), items: [] }),
    'No se pudo crear el presupuesto.'
  );

  const saveWorkLog = () => void submit(async () => {
    await repairApi.addWorkLog(repair.id, workDescription);
    setWorkDescription('');
  }, 'No se pudo registrar el trabajo realizado.');

  const decideEstimate = (estimateId: number, decision: 'aprobado' | 'rechazado') => void submit(async () => {
    if (admin || isReceptionist(user)) await repairApi.presentialDecision(repair.id, estimateId, decision, decisionObservation || null);
    else await repairApi.updateEstimateStatus(repair.id, estimateId, decision, decisionObservation || null);
    setDecisionObservation('');
  }, decision === 'aprobado' ? 'No se pudo registrar la aceptación presencial.' : 'No se pudo registrar el rechazo presencial.');

  return <Screen>
    <View style={styles.heading}><Text style={[styles.title, { color: colors.text }]}>{repair.deviceName}</Text><StatusBadge value={currentStatus} /></View>
    <Text style={{ color: colors.text }}>{repair.problemDescription}</Text>
    <Text style={{ color: colors.muted }}>Estado actual: {repairStatusLabel(currentStatus)}</Text>
    <Text style={{ color: colors.muted }}>Cliente: {repair.customerName ?? repair.clientName}</Text>

    {isClosed ? <Card>
      <Text style={[styles.section, { color: colors.text }]}>Orden entregada y cerrada</Text>
      <Text style={{ color: colors.muted }}>La entrega ya fue registrada. Las modificaciones técnicas ordinarias están bloqueadas; el diagnóstico, los presupuestos, los trabajos, las fotografías y la constancia histórica continúan disponibles para consulta.</Text>
    </Card> : null}

    <Card>
      <Text style={[styles.section, { color: colors.text }]}>Técnico asignado</Text>
      <Text style={{ color: colors.muted }}>{repair.technicianName ?? 'Todavía no asignado'}</Text>
      {canAssignTechnician ? <RepairOpenOnly status={currentStatus}><>
        {loadingTechnicians ? <Loading /> : null}
        {technicianError ? <ErrorMessage message={technicianError} /> : null}
        {!loadingTechnicians && !technicianError && technicians.length === 0 ? <Text style={{ color: colors.muted }}>No hay técnicos activos disponibles.</Text> : null}
        {technicians.length ? <ChoiceSelector label="Seleccionar técnico activo" value={selectedTechnicianId} onChange={setSelectedTechnicianId} error={assignmentError} options={technicians.map((item) => ({ value: String(item.id), label: `${item.firstName} ${item.lastName}`, description: item.email }))} /> : null}
        <Button title={repair.technicianId ? 'Reasignar técnico' : 'Asignar técnico'} loading={busy} disabled={!technicians.length} onPress={assign} />
      </></RepairOpenOnly> : null}
    </Card>

    {nextStatuses.length ? <RepairOpenOnly status={currentStatus}><Card>
      <Text style={[styles.section, { color: colors.text }]}>Actualizar estado</Text>
      <Text style={{ color: colors.muted }}>Solo se muestran transiciones permitidas para tu rol.</Text>
      <View style={styles.statuses}>{nextStatuses.map((status) => <Button key={status} title={repairStatusLabel(status)} variant="secondary" loading={busy} onPress={() => void submit(() => repairApi.updateStatus(repair.id, status, currentStatus as Repair['status']), 'No se pudo actualizar el estado.')} />)}</View>
    </Card></RepairOpenOnly> : null}

    {canEditTechnicalData ? <RepairOpenOnly status={currentStatus}><Card>
      <Text style={[styles.section, { color: colors.text }]}>Registrar diagnóstico</Text>
      <Input label="Descripción" multiline value={diagnosis} onChangeText={setDiagnosis} />
      <Input label="Recomendación (opcional)" multiline value={recommendation} onChangeText={setRecommendation} />
      <Button title="Guardar diagnóstico" loading={busy} onPress={saveDiagnosis} />
    </Card></RepairOpenOnly> : null}

    {canEditTechnicalData && currentStatus === 'en_reparacion' ? <RepairOpenOnly status={currentStatus}><Card>
      <Text style={[styles.section, { color: colors.text }]}>Trabajo realizado</Text>
      <Input label="Detalle del trabajo" multiline value={workDescription} onChangeText={setWorkDescription} placeholder="Describí las tareas realizadas y las pruebas efectuadas." />
      <Button title="Registrar trabajo" loading={busy} disabled={workDescription.trim().length < 10} onPress={saveWorkLog} />
    </Card></RepairOpenOnly> : null}

    {canViewEstimate && currentEstimate ? <PresentialEstimateCard
      estimate={currentEstimate}
      customerName={repair.customerName ?? repair.clientName ?? 'Cliente no informado'}
      decisions={repair.estimateDecisions ?? []}
      canDecide={canDecideEstimate}
      isPresential={isPresentialDecisionRole(user)}
      hasDuplicatePendingEstimates={hasDuplicatePendingEstimates}
      observation={decisionObservation}
      busy={busy}
      onObservationChange={setDecisionObservation}
      onDecision={(decision) => decideEstimate(currentEstimate.id, decision)}
    /> : null}

    {canEditTechnicalData ? <RepairOpenOnly status={currentStatus}><Card>
      <Text style={[styles.section, { color: colors.text }]}>Preparar presupuesto</Text>
      {!canCreateEstimate(pendingEstimates.length) ? <>
        <Text style={{ color: colors.text }}>Ya existe un presupuesto pendiente de aprobación (ID {currentPendingEstimate?.id}) por ${currentPendingEstimate?.total.toFixed(2)}.</Text>
        <Text style={{ color: colors.muted }}>No se puede crear otro presupuesto hasta resolver el vigente. El historial permanece visible más abajo.</Text>
        {hasDuplicatePendingEstimates ? <Text style={{ color: colors.danger }}>Hay {pendingEstimates.length} presupuestos pendientes para esta reparación. Requiere revisión administrativa antes de decidir cuál es el vigente.</Text> : null}
      </> : <>
        <Input label="Mano de obra" keyboardType="decimal-pad" value={laborCost} onChangeText={setLaborCost} />
        <Input label="Repuestos" keyboardType="decimal-pad" value={partsCost} onChangeText={setPartsCost} />
        <Input label="Notas" multiline value={estimateNotes} onChangeText={setEstimateNotes} />
        <Button title="Enviar a aprobación" loading={busy} onPress={saveEstimate} />
      </>}
    </Card></RepairOpenOnly> : null}

    <Card><Text style={[styles.section, { color: colors.text }]}>Diagnósticos</Text>{repair.diagnoses?.length ? repair.diagnoses.map((item) => <View key={item.id}><Text style={{ color: colors.text, fontWeight: '700' }}>{item.description}</Text><Text style={{ color: colors.muted }}>{item.recommendation || 'Sin recomendación'} · {item.technicianName}</Text></View>) : <EmptyState title="Sin diagnóstico" description="El técnico todavía no registró un diagnóstico." />}</Card>

    <Card><Text style={[styles.section, { color: colors.text }]}>Historial de presupuestos</Text>{repair.estimates?.length ? repair.estimates.map((estimate) => <View key={estimate.id} style={styles.estimate}><View style={styles.row}><StatusBadge value={estimate.status} /><Text style={[styles.total, { color: colors.text }]}>${estimate.total.toFixed(2)}</Text></View>{estimate.id === currentEstimate?.id ? <Text style={{ color: colors.muted }}>Presupuesto vigente.</Text> : <Text style={{ color: colors.muted }}>Registro histórico.</Text>}<Text style={{ color: colors.muted }}>{estimate.notes || 'Sin notas'}</Text></View>) : <EmptyState title="Sin presupuesto" description="El presupuesto aparecerá cuando el técnico lo prepare." />}</Card>

    {repair.workLogs?.length ? <Card><Text style={[styles.section, { color: colors.text }]}>Trabajo documentado</Text>{repair.workLogs.map((item) => <View key={item.id}><Text style={{ color: colors.text, fontWeight: '700' }}>{item.recordedByName}</Text><Text style={{ color: colors.muted }}>{item.description}</Text></View>)}</Card> : null}

    <Card><Text style={[styles.section, { color: colors.text }]}>Historial</Text>{repair.history?.map((event) => <Pressable key={event.id}><Text style={{ color: colors.text, fontWeight: '700' }}>{repairStatusLabel(event.newStatus)}</Text><Text style={{ color: colors.muted }}>{event.changedByName} · {event.observation || 'Sin observación'}</Text></Pressable>)}</Card>
    <Card><Text style={[styles.section, { color: colors.text }]}>Fotografías</Text><Text style={{ color: colors.muted }}>{repair.photos?.length ?? 0} evidencia(s) adjunta(s).</Text></Card>
    {user?.roles.includes('cliente') && currentStatus === 'solicitud_recibida' ? <Button title="Cancelar solicitud" variant="danger" loading={busy} onPress={() => void submit(() => repairApi.updateStatus(repair.id, 'cancelado', currentStatus as Repair['status']), 'No se pudo cancelar.')} /> : null}
    {!isClosed && assignedTechnician ? <Button title="Adjuntar fotografía" variant="secondary" onPress={() => router.push({ pathname: '/native/repair-photo', params: { repairId: String(repair.id) } })} /> : null}
    {(admin || isReceptionist(user)) && repair.status === 'listo_para_retirar' ? <Button title="Registrar entrega presencial" variant="secondary" onPress={() => router.push(appRoutes.repairDelivery(repair.id))} /> : null}
    {repair.delivery ? <Card><Text style={[styles.section, { color: colors.text }]}>Constancia de entrega</Text><Text style={{ color: colors.muted }}>Retiró: {repair.delivery.pickedUpByName}</Text><Text style={{ color: colors.muted }}>Fecha: {repair.delivery.deliveredAt}</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({ heading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, fontSize: 28, fontWeight: '900' }, section: { fontSize: 18, fontWeight: '800' }, statuses: { gap: 8 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, estimate: { gap: 8 }, total: { fontWeight: '900', fontSize: 18 } });
