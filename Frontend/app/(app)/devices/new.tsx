import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ChoiceSelector } from '../../../src/components/ChoiceSelector';
import { ErrorMessage } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { customerApi } from '../../../src/services/customers';
import { deviceApi } from '../../../src/services/devices';
import { useTheme } from '../../../src/theme/theme-context';
import { useAuth } from '../../../src/context/auth-context';
import { canManageCommercialRecords, isClient } from '../../../src/utils/permissions';
import { DEVICE_TYPE_OPTIONS } from '../../../src/constants/techfix';
import type { Customer, DeviceType } from '../../../src/types/api';
import { appRoutes } from '../../../src/navigation/routes';

const schema = z.object({ customerId: z.string().optional(), deviceType: z.enum(['desktop', 'notebook', 'all_in_one', 'impresora', 'otro']), brand: z.string().trim().min(2, 'Ingresá la marca'), model: z.string().trim().min(1, 'Ingresá el modelo'), serialNumber: z.string().trim().optional(), description: z.string().trim().optional() });
type Form = z.infer<typeof schema>;

export default function NewDeviceScreen() {
  const { colors } = useTheme(); const { user } = useAuth(); const internalStaff = canManageCommercialRecords(user); const legacyClient = isClient(user);
  const [customers, setCustomers] = useState<Customer[]>([]); const [customerError, setCustomerError] = useState<string>();
  const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { customerId: '', deviceType: 'notebook', brand: '', model: '', serialNumber: '', description: '' } });
  useEffect(() => { if (!internalStaff) return; void customerApi.list().then((result) => setCustomers(result.items)).catch((e) => setCustomerError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.')); }, [internalStaff]);
  const submit = async (data: Form) => { try { const selectedCustomerId = data.customerId ? Number(data.customerId) : null; if (internalStaff && !selectedCustomerId) { setError('customerId', { message: 'Seleccioná el cliente comercial.' }); return; } const device = await deviceApi.create({ deviceType: data.deviceType as DeviceType, brand: data.brand, model: data.model, serialNumber: data.serialNumber || null, description: data.description || null, customerId: internalStaff ? selectedCustomerId : null }); router.replace(internalStaff ? appRoutes.customerDetail(selectedCustomerId as number) : `/(app)/devices/${device.id}`); } catch (e) { setError('root', { message: e instanceof Error ? e.message : 'No se pudo registrar el equipo.' }); } };
  if (!internalStaff && !legacyClient) return <Redirect href="/denied" />;
  if (internalStaff && customerError && !customers.length) return <Screen><ErrorMessage message={customerError} /></Screen>;
  return <Screen><Text style={[styles.title, { color: colors.text }]}>{internalStaff ? 'Registrar equipo para un cliente' : 'Registrar mi equipo'}</Text><Text style={{ color: colors.muted }}>{internalStaff ? 'Asociá el equipo a un cliente comercial antes de recibirlo.' : 'El equipo quedará asociado a tu cuenta.'}</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}{internalStaff && customers.length === 0 ? <><Text style={{ color: colors.muted }}>Todavía no hay clientes comerciales registrados.</Text><Button title="＋ Registrar cliente" variant="secondary" onPress={() => router.push(appRoutes.newCustomer)} /></> : null}{internalStaff ? <Controller control={control} name="customerId" render={({ field: { onChange, value } }) => <ChoiceSelector label="Cliente comercial" value={value} onChange={onChange} error={errors.customerId?.message} options={customers.map((customer) => ({ value: String(customer.id), label: `${customer.firstName} ${customer.lastName}`, description: customer.documentNumber ?? 'Sin documento' }))} />} /> : null}<Controller control={control} name="deviceType" render={({ field: { onChange, value } }) => <ChoiceSelector label="Tipo de equipo" value={value} onChange={onChange} error={errors.deviceType?.message} options={DEVICE_TYPE_OPTIONS} />} /><Controller control={control} name="brand" render={({ field: { onChange, value } }) => <Input label="Marca" value={value} onChangeText={onChange} error={errors.brand?.message} />} /><Controller control={control} name="model" render={({ field: { onChange, value } }) => <Input label="Modelo" value={value} onChangeText={onChange} error={errors.model?.message} />} /><Controller control={control} name="serialNumber" render={({ field: { onChange, value } }) => <Input label="Número de serie (opcional)" value={value} onChangeText={onChange} error={errors.serialNumber?.message} />} /><Controller control={control} name="description" render={({ field: { onChange, value } }) => <Input label="Descripción del equipo" multiline value={value} onChangeText={onChange} error={errors.description?.message} />} /><Button title="Guardar equipo" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });
