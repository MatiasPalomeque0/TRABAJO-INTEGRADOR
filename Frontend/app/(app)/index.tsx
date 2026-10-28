import { useCallback, useEffect, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/auth-context';
import { useTheme } from '../../src/theme/theme-context';
import { miscApi } from '../../src/services/misc';
import type { Stats } from '../../src/types/api';
import { canCreateRepair, canManageCommercialRecords, canManageDevices, isAdmin, isReceptionist } from '../../src/utils/permissions';
import { appRoutes } from '../../src/navigation/routes';
import { navigationDiagnostic } from '../../src/utils/navigation-diagnostics';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const internalStaff = canManageCommercialRecords(user);
  const receptionist = isReceptionist(user);
  const load = useCallback(async () => {
    try { setError(undefined); setStats(await miscApi.stats()); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen de TechFix.'); }
  }, []);

  useEffect(() => { if (!receptionist) void load(); else setStats({ repairs: 0, completedRepairs: 0, pendingEstimates: 0, readyForPickup: 0, devices: 0 }); }, [load, receptionist]);
  if (!stats && !error) return <Loading />;

  return <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
    <Text style={[styles.brand, { color: colors.primary }]}>TechFix</Text>
    <Text style={[styles.greeting, { color: colors.text }]}>Hola, {user?.firstName ?? 'equipo'} 👋</Text>
    <Text style={{ color: colors.muted }}>{internalStaff ? 'Panel operativo del servicio técnico presencial.' : 'Este es el estado actual del servicio técnico.'}</Text>
    {error ? <ErrorMessage message={error} onRetry={load} /> : null}
    {!receptionist ? <View style={styles.grid}><Stat label="Órdenes" value={stats?.repairs ?? 0} color={colors.primary} /><Stat label="Finalizadas" value={stats?.completedRepairs ?? 0} color={colors.success} /><Stat label="Presupuestos" value={stats?.pendingEstimates ?? 0} color={colors.warning} /><Stat label="Listas para retirar" value={stats?.readyForPickup ?? 0} color={'#6941C6'} /></View> : null}
    {internalStaff ? <Card><Text style={[styles.sectionTitle, { color: colors.text }]}>Recepción presencial</Text><Text style={{ color: colors.muted }}>Gestioná clientes comerciales, equipos y órdenes desde el local.</Text><QuickLink title="Consultar clientes" onPress={() => navigate(pathname, appRoutes.customers)} /><QuickLink title="＋ Registrar cliente" onPress={() => navigate(pathname, appRoutes.newCustomer)} /><QuickLink title="＋ Nueva recepción" onPress={() => navigate(pathname, appRoutes.newIntake)} /><QuickLink title="Consultar órdenes" onPress={() => navigate(pathname, appRoutes.repairs)} /></Card> : <Card><Text style={[styles.sectionTitle, { color: colors.text }]}>Accesos rápidos</Text>{canManageDevices(user) ? <QuickLink title="＋ Registrar mi equipo" onPress={() => router.push('/(app)/devices/new')} /> : null}{canCreateRepair(user) ? <QuickLink title="＋ Solicitar reparación" onPress={() => router.push('/(app)/repairs/new')} /> : null}<QuickLink title="⌁ Consultar por QR" onPress={() => router.push('/native/qr-scanner')} /></Card>}
    {isAdmin(user) ? <Card><Text style={[styles.sectionTitle, { color: colors.text }]}>Administración</Text><QuickLink title="Gestionar usuarios y roles" onPress={() => router.push('/admin/users')} /></Card> : null}
    {receptionist ? <Card><Text style={[styles.sectionTitle, { color: colors.text }]}>Acceso restringido</Text><Text style={{ color: colors.muted }}>No podés asignar técnicos, registrar diagnósticos, modificar presupuestos ni administrar roles.</Text></Card> : null}
  </Screen>;
}

function QuickLink({ title, onPress }: { title: string; onPress: () => void }) { const { colors } = useTheme(); return <Pressable accessibilityRole="button" onPress={onPress}><Text style={[styles.link, { color: colors.primary }]}>{title}</Text></Pressable>; }
function navigate(from: string, to: string) { navigationDiagnostic('navigate', { from, to, reason: 'dashboard-link' }); router.push(to); }
function Stat({ label, value, color }: { label: string; value: number; color: string }) { return <Card><Text style={{ color, fontSize: 28, fontWeight: '900' }}>{value}</Text><Text style={{ color: '#627D98', fontSize: 12 }}>{label}</Text></Card>; }
const styles = StyleSheet.create({ brand: { fontSize: 16, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 }, greeting: { fontSize: 28, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, sectionTitle: { fontWeight: '800', fontSize: 17 }, link: { fontWeight: '700', paddingVertical: 8 } });
