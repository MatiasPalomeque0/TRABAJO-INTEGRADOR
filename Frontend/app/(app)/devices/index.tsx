import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState, ErrorMessage, Loading } from '../../../src/components/Feedback';
import { Screen } from '../../../src/components/Screen';
import { deviceApi } from '../../../src/services/devices';
import { useTheme } from '../../../src/theme/theme-context';
import { useAuth } from '../../../src/context/auth-context';
import { canManageDevices, isAdmin } from '../../../src/utils/permissions';
import type { Device } from '../../../src/types/api';
import { appRoutes } from '../../../src/navigation/routes';

export default function DevicesScreen() {
  const { colors } = useTheme(); const { user } = useAuth(); const [items, setItems] = useState<Device[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>();
  const load = useCallback(async () => { try { setError(undefined); setItems(await deviceApi.list()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar tus equipos.'); } finally { setLoading(false); } }, []);
  useEffect(() => { if (canManageDevices(user) && !isAdmin(user)) void load(); }, [load, user]);
  if (isAdmin(user)) return <Redirect href={appRoutes.customers} />;
  if (!canManageDevices(user)) return <Redirect href="/denied" />;
  if (loading) return <Loading />;
  return <Screen><View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>Mis equipos</Text><Text style={{ color: colors.muted }}>Equipos asociados a tu cuenta de cliente.</Text></View><Button title="＋ Nuevo" onPress={() => router.push('/(app)/devices/new')} /></View>{error ? <ErrorMessage message={error} onRetry={load} /> : items.length === 0 ? <EmptyState title="No hay equipos" description="Agregá una computadora o notebook para solicitar una reparación." /> : items.map((device) => <Pressable key={device.id} onPress={() => router.push(`/(app)/devices/${device.id}`)}><Card><Text style={[styles.name, { color: colors.text }]}>{device.brand} {device.model}</Text><Text style={{ color: colors.muted }}>{device.deviceType} · serie: {device.serialNumber ?? 'no informada'}</Text><Text style={{ color: colors.muted }}>{device.description || 'Sin descripción adicional.'}</Text></Card></Pressable>)}</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { fontSize: 28, fontWeight: '900' }, name: { fontSize: 18, fontWeight: '800' } });
