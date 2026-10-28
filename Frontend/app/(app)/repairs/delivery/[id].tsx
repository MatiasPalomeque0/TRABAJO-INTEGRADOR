import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../../../../src/components/Button';
import { Card } from '../../../../src/components/Card';
import { ChoiceSelector } from '../../../../src/components/ChoiceSelector';
import { ErrorMessage, Loading } from '../../../../src/components/Feedback';
import { Input } from '../../../../src/components/Input';
import { Screen } from '../../../../src/components/Screen';
import { useAuth } from '../../../../src/context/auth-context';
import { repairApi } from '../../../../src/services/repairs';
import { appRoutes } from '../../../../src/navigation/routes';
import { canManageCommercialRecords } from '../../../../src/utils/permissions';
import { repairStatusLabel } from '../../../../src/utils/repair-status';
import { useTheme } from '../../../../src/theme/theme-context';
import type { Repair } from '../../../../src/types/api';

type ReturnStatus = 'devuelto' | 'no_corresponde';

export default function RepairDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [repair, setRepair] = useState<Repair>();
  const [pickedUpByName, setPickedUpByName] = useState('');
  const [observations, setObservations] = useState('');
  const [returnStatuses, setReturnStatuses] = useState<Record<number, ReturnStatus>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try { setError(undefined); setRepair(await repairApi.get(Number(id))); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la reparación.'); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const items = useMemo(() => repair?.intake?.items ?? [], [repair?.intake?.items]);
  useEffect(() => {
    setReturnStatuses(Object.fromEntries(items.map((item) => [item.id, 'devuelto' as ReturnStatus])));
  }, [items]);

  const itemPayload = useMemo(() => items.map((item) => ({ id: item.id, returnStatus: returnStatuses[item.id] ?? 'devuelto' })), [items, returnStatuses]);

  if (!canManageCommercialRecords(user)) return <Redirect href="/denied" />;
  if (!repair && !error) return <Loading />;
  if (!repair) return <Screen><ErrorMessage message={error ?? 'Reparación no encontrada.'} onRetry={load} /></Screen>;
  if (repair.delivery) return <Screen><Card><TextBlock color={colors.text} title="Entrega ya registrada" body={`Retiró: ${repair.delivery.pickedUpByName}`} /><TextBlock color={colors.muted} title="Fecha" body={repair.delivery.deliveredAt} /><TextBlock color={colors.muted} title="Estado" body={repairStatusLabel(repair.status)} /></Card><Button title="Volver a la reparación" onPress={() => router.replace(appRoutes.repairDetail(repair.id))} /></Screen>;

  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await repairApi.createDelivery(repair.id, { pickedUpByName, observations: observations || null, items: itemPayload });
      router.replace(appRoutes.repairDetail(repair.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la entrega.'); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return <Screen>
    <TextBlock color={colors.text} title="Registrar entrega presencial" body={`${repair.deviceName} · ${repairStatusLabel(repair.status)}`} />
    <TextBlock color={colors.muted} title="Cliente" body={repair.customerName ?? repair.clientName} />
    {error ? <ErrorMessage message={error} /> : null}
    <Input label="Nombre de quien retira" value={pickedUpByName} onChangeText={setPickedUpByName} placeholder="Nombre y apellido" />
    {items.length ? <Card><TextBlock color={colors.text} title="Accesorios" body="Registrá qué se devuelve junto con el equipo." />{items.map((item) => <ChoiceSelector key={item.id} label={item.description} value={returnStatuses[item.id]} onChange={(value) => setReturnStatuses((current) => ({ ...current, [item.id]: value as ReturnStatus }))} options={[{ value: 'devuelto', label: 'Devuelto' }, { value: 'no_corresponde', label: 'No corresponde' }]} />)}</Card> : <TextBlock color={colors.muted} title="Accesorios" body="No se registraron accesorios en el ingreso." />}
    <Input label="Observaciones (opcional)" multiline value={observations} onChangeText={setObservations} />
    <Button title="Confirmar entrega" loading={busy} disabled={!pickedUpByName.trim() || repair.status !== 'listo_para_retirar'} onPress={submit} />
    <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
  </Screen>;
}

function TextBlock({ color, title, body }: { color: string; title: string; body: string }) {
  return <Card><Text style={{ color, fontWeight: '800' }}>{title}</Text><Text style={{ color }}>{body}</Text></Card>;
}
