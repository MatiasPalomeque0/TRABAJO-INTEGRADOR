import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { EmptyState, ErrorMessage, Loading } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { customerApi } from '../../src/services/customers';
import { useAuth } from '../../src/context/auth-context';
import { canManageCommercialRecords } from '../../src/utils/permissions';
import { useTheme } from '../../src/theme/theme-context';
import type { Customer } from '../../src/types/api';
import { appRoutes } from '../../src/navigation/routes';

export default function CustomersScreen() {
  const { colors } = useTheme(); const { user } = useAuth(); const [items, setItems] = useState<Customer[]>([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>();
  const load = useCallback(async () => { try { setError(undefined); setLoading(true); setItems((await customerApi.list(search.trim())).items); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.'); } finally { setLoading(false); } }, [search]);
  useEffect(() => { if (canManageCommercialRecords(user)) void load(); }, [load, user]);
  if (!canManageCommercialRecords(user)) return <Redirect href="/denied" />;
  if (loading && !items.length) return <Loading />;
  return <Screen><View style={styles.header}><Text style={[styles.title, { color: colors.text }]}>Clientes comerciales</Text><Button title="＋ Nuevo" onPress={() => router.push(appRoutes.newCustomer)} /></View><Input label="Buscar" value={search} onChangeText={setSearch} placeholder="Nombre, documento, correo o teléfono" /><Button title="Actualizar" variant="secondary" onPress={load} />{error ? <ErrorMessage message={error} onRetry={load} /> : items.length === 0 ? <EmptyState title="Sin clientes" description="Registrá al cliente que dejó su equipo en el local." /> : items.map((customer) => <Pressable key={customer.id} onPress={() => router.push(appRoutes.customerDetail(customer.id))}><Card><Text style={[styles.name, { color: colors.text }]}>{customer.firstName} {customer.lastName}</Text><Text style={{ color: colors.muted }}>{customer.documentNumber ?? 'Sin documento'} · {customer.phone ?? 'Sin teléfono'}</Text><Text style={{ color: customer.isActive ? colors.success : colors.danger }}>{customer.isActive ? 'Activo' : 'Desactivado'}</Text></Card></Pressable>)}</Screen>;
}

const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, title: { flex: 1, fontSize: 27, fontWeight: '900' }, name: { fontSize: 18, fontWeight: '800' } });
