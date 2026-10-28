import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { ErrorMessage, Loading } from '../../../src/components/Feedback';
import { Screen } from '../../../src/components/Screen';
import { deviceApi } from '../../../src/services/devices';
import { useAuth } from '../../../src/context/auth-context';
import { canManageCommercialRecords, canManageDevices } from '../../../src/utils/permissions';
import { useTheme } from '../../../src/theme/theme-context';
import type { Device } from '../../../src/types/api';
import { appRoutes } from '../../../src/navigation/routes';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { colors } = useTheme(); const { user } = useAuth(); const internalStaff = canManageCommercialRecords(user); const legacyAccess = canManageDevices(user); const [device, setDevice] = useState<Device>(); const [error, setError] = useState<string>();
  const load = useCallback(async () => { try { setDevice(await deviceApi.get(Number(id))); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el equipo.'); } }, [id]);
  useEffect(() => { if (internalStaff || legacyAccess) void load(); }, [internalStaff, legacyAccess, load]);
  if (!internalStaff && !legacyAccess) return <Redirect href="/denied" />;
  if (!device && !error) return <Loading />;
  if (error || !device) return <Screen><ErrorMessage message={error ?? 'Equipo no encontrado'} onRetry={load} /></Screen>;
  const remove = () => Alert.alert('Eliminar equipo', 'Solo se puede eliminar si no tiene reparaciones.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await deviceApi.remove(device.id); router.back(); } }]);
  return <Screen><Text style={[styles.title, { color: colors.text }]}>{device.brand} {device.model}</Text><Card><Text style={{ color: colors.text }}>Tipo: {device.deviceType}</Text><Text style={{ color: colors.text }}>Número de serie: {device.serialNumber ?? 'No informado'}</Text>{device.customerName ? <Text style={{ color: colors.text }}>Cliente comercial: {device.customerName}</Text> : null}<Text style={{ color: colors.muted }}>{device.description || 'Sin descripción.'}</Text></Card>{device.customerId ? <Button title="Registrar nueva recepción" onPress={() => router.push({ pathname: appRoutes.newIntake, params: { customerId: String(device.customerId), deviceId: String(device.id) } })} /> : <Button title="Solicitar reparación" onPress={() => router.push({ pathname: '/(app)/repairs/new', params: { deviceId: String(device.id) } })} />}{legacyAccess ? <Button title="Eliminar equipo" variant="danger" onPress={remove} /> : null}</Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });
