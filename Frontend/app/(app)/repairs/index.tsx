import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState, ErrorMessage, Loading } from '../../../src/components/Feedback';
import { Screen } from '../../../src/components/Screen';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { repairApi } from '../../../src/services/repairs';
import { useAuth } from '../../../src/context/auth-context';
import { useTheme } from '../../../src/theme/theme-context';
import { canCreateRepair, canManageCommercialRecords, isAdmin, isReceptionist, isTechnician } from '../../../src/utils/permissions';
import { createSingleFlight } from '../../../src/utils/single-flight';
import type { Repair } from '../../../src/types/api';

export default function RepairsScreen() {
  const { colors } = useTheme(); const { user } = useAuth(); const [items, setItems] = useState<Repair[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string>(); const internalStaff = canManageCommercialRecords(user);
  const hasLoadedRef = useRef(false); const mountedRef = useRef(true); const requestRef = useRef(createSingleFlight<void>());
  const load = useCallback(async () => {
    const firstLoad = !hasLoadedRef.current;
    if (firstLoad) setLoading(true); else setRefreshing(true);
    return requestRef.current.run(async () => {
      try {
        const nextItems = await repairApi.list();
        if (!mountedRef.current) return;
        setItems(nextItems);
        setError(undefined);
        hasLoadedRef.current = true;
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : 'No se pudieron cargar las órdenes.');
      } finally {
        if (mountedRef.current) { setLoading(false); setRefreshing(false); }
      }
    });
  }, []);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = () => { void load(); };
  if (loading && items.length === 0 && !error) return <Loading />;
  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}><View style={styles.header}><View><Text style={[styles.title, { color: colors.text }]}>{internalStaff ? 'Órdenes de servicio' : 'Reparaciones'}</Text><Text style={{ color: colors.muted }}>{isReceptionist(user) ? 'Consultá las órdenes necesarias para la recepción.' : isAdmin(user) ? 'Supervisá las órdenes del servicio técnico.' : isTechnician(user) ? 'Reparaciones asignadas a vos.' : 'Seguimiento de tus solicitudes.'}</Text></View>{canCreateRepair(user) ? <Button title="＋ Nueva" onPress={() => router.push('/(app)/repairs/new')} /> : null}</View>{error ? <ErrorMessage message={error} onRetry={refresh} /> : null}{items.length === 0 && !error ? <EmptyState title="Sin órdenes" description={isTechnician(user) ? 'No tenés reparaciones asignadas.' : internalStaff ? 'Todavía no hay órdenes registradas.' : 'Cuando solicites un servicio aparecerá acá.'} /> : null}{items.map((repair) => <Pressable key={repair.id} onPress={() => router.push(`/(app)/repairs/${repair.id}`)}><Card><View style={styles.row}><Text style={[styles.name, { color: colors.text }]}>{repair.deviceName}</Text><StatusBadge value={repair.status} /></View><Text style={{ color: colors.muted }} numberOfLines={2}>{repair.problemDescription}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{repair.customerName ?? repair.clientName} · Actualizada: {repair.updatedAt}</Text></Card></Pressable>)}</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { flex: 1, fontSize: 28, fontWeight: '900' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, name: { flex: 1, fontSize: 18, fontWeight: '800' } });
