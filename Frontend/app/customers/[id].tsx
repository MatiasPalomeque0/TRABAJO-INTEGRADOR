import { useCallback, useEffect, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorMessage, EmptyState, Loading } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { customerApi } from '../../src/services/customers';
import { deviceApi } from '../../src/services/devices';
import { useAuth } from '../../src/context/auth-context';
import { canManageCommercialRecords, isAdmin } from '../../src/utils/permissions';
import { useTheme } from '../../src/theme/theme-context';
import type { Customer, Device } from '../../src/types/api';
import { appRoutes } from '../../src/navigation/routes';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { colors } = useTheme(); const { user } = useAuth(); const customerId = Number(id); const [customer, setCustomer] = useState<Customer>(); const [devices, setDevices] = useState<Device[]>([]); const [error, setError] = useState<string>(); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [address, setAddress] = useState(''); const [notes, setNotes] = useState('');
  const load = useCallback(async () => { try { setError(undefined); const [nextCustomer, nextDevices] = await Promise.all([customerApi.get(customerId), deviceApi.list(undefined, customerId)]); setCustomer(nextCustomer); setDevices(nextDevices); setPhone(nextCustomer.phone ?? ''); setEmail(nextCustomer.email ?? ''); setAddress(nextCustomer.address ?? ''); setNotes(nextCustomer.notes ?? ''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el cliente.'); } }, [customerId]);
  useEffect(() => { if (canManageCommercialRecords(user)) void load(); }, [load, user]);
  if (!canManageCommercialRecords(user)) return <Redirect href="/denied" />;
  if (!customer && !error) return <Loading />;
  if (!customer) return <Screen><ErrorMessage message={error ?? 'Cliente no encontrado.'} onRetry={load} /></Screen>;
  const saveContact = async () => { try { setCustomer(await customerApi.update(customerId, { email: email || null, phone: phone || null, address: address || null, notes: notes || null })); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar los datos.'); } };
  const deactivate = () => Alert.alert('Desactivar cliente', 'No se eliminará su historial ni sus equipos.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desactivar', style: 'destructive', onPress: async () => { try { setCustomer(await customerApi.updateStatus(customerId, false)); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo desactivar el cliente.'); } } }]);
  return <Screen><Text style={[styles.title, { color: colors.text }]}>{customer.firstName} {customer.lastName}</Text><Text style={{ color: colors.muted }}>{customer.isActive ? 'Cliente activo' : 'Cliente desactivado'}</Text><Card><Text style={[styles.section, { color: colors.text }]}>Datos de contacto</Text>{isAdmin(user) ? <Text style={{ color: colors.muted }}>Documento: {customer.documentNumber ?? 'No informado'}</Text> : null}<Input label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" /><Input label="Teléfono" value={phone} onChangeText={setPhone} /><Input label="Dirección" value={address} onChangeText={setAddress} /><Input label="Notas" value={notes} onChangeText={setNotes} multiline /><Button title="Guardar contacto" onPress={saveContact} /></Card><View style={styles.row}><Text style={[styles.section, { color: colors.text }]}>Equipos</Text><Button title="＋ Registrar" onPress={() => router.push({ pathname: appRoutes.customerDevice, params: { id: String(customerId) } })} /></View>{devices.length ? devices.map((device) => <Pressable key={device.id} onPress={() => router.push({ pathname: appRoutes.newIntake, params: { customerId: String(customerId), deviceId: String(device.id) } })}><Card><Text style={[styles.device, { color: colors.text }]}>{device.brand} {device.model}</Text><Text style={{ color: colors.muted }}>{device.deviceType} · Nueva recepción</Text></Card></Pressable>) : <EmptyState title="Sin equipos" description="Registrá el equipo antes de crear una orden." />}<Button title="Nueva recepción" variant="secondary" onPress={() => router.push({ pathname: appRoutes.newIntake, params: { customerId: String(customerId) } })} />{isAdmin(user) && customer.isActive ? <Button title="Desactivar cliente" variant="danger" onPress={deactivate} /> : null}</Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, section: { fontSize: 19, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, device: { fontSize: 17, fontWeight: '800' } });
