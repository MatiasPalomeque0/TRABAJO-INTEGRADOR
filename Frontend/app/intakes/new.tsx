import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router, useLocalSearchParams, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { ChoiceSelector } from '../../src/components/ChoiceSelector';
import { ErrorMessage, Loading } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { customerApi } from '../../src/services/customers';
import { deviceApi } from '../../src/services/devices';
import { intakeApi } from '../../src/services/intakes';
import { useAuth } from '../../src/context/auth-context';
import { canManageCommercialRecords } from '../../src/utils/permissions';
import { useTheme } from '../../src/theme/theme-context';
import type { Customer, Device } from '../../src/types/api';
import { appRoutes } from '../../src/navigation/routes';
import { RouteErrorBoundary } from '../../src/components/RouteErrorBoundary';
import { navigationDiagnostic, roleDetails } from '../../src/utils/navigation-diagnostics';

const schema = z.object({ customerId: z.string().min(1, 'Seleccioná el cliente'), deviceId: z.string().min(1, 'Seleccioná el equipo'), problemDescription: z.string().trim().min(10, 'Describí el problema con más detalle'), equipmentCondition: z.string().trim().optional(), observations: z.string().trim().optional(), accessories: z.string().trim().optional() });
type Form = z.infer<typeof schema>;

export default function NewIntakeScreen() {
  const params = useLocalSearchParams<{ customerId?: string; deviceId?: string }>(); const { colors } = useTheme(); const { user, isLoading } = useAuth(); const pathname = usePathname();
  const [customers, setCustomers] = useState<Customer[]>([]); const [devices, setDevices] = useState<Device[]>([]); const [loadingOptions, setLoadingOptions] = useState(true); const [optionsError, setOptionsError] = useState<string>(); const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId ?? '');
  const { control, handleSubmit, formState: { errors }, setError, setValue } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { customerId: params.customerId ?? '', deviceId: params.deviceId ?? '', problemDescription: '', equipmentCondition: '', observations: '', accessories: '' } });
  useEffect(() => { navigationDiagnostic('screen-mount', { route: pathname }); return () => navigationDiagnostic('screen-unmount', { route: pathname }); }, [pathname]);
  useEffect(() => { navigationDiagnostic('screen-auth-state', { route: pathname, ...roleDetails(user), isLoading }); }, [pathname, isLoading, user]);
  useEffect(() => { void customerApi.list().then((result) => setCustomers(result.items)).catch((e) => setOptionsError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.')).finally(() => setLoadingOptions(false)); }, []);
  useEffect(() => { if (!selectedCustomerId) { setDevices([]); return; } void deviceApi.list(undefined, Number(selectedCustomerId)).then(setDevices).catch((e) => setOptionsError(e instanceof Error ? e.message : 'No se pudieron cargar los equipos del cliente.')); }, [selectedCustomerId]);
  const submit = async (data: Form) => { try { const items = (data.accessories ?? '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [description, conditionAtIntake] = line.split('|').map((part) => part.trim()); return { description, conditionAtIntake: conditionAtIntake || null }; }); const result = await intakeApi.create({ customerId: Number(data.customerId), deviceId: Number(data.deviceId), problemDescription: data.problemDescription, equipmentCondition: data.equipmentCondition || null, observations: data.observations || null, items }); router.replace(appRoutes.intakeDetail(result.repair.id)); } catch (e) { setError('root', { message: e instanceof Error ? e.message : 'No se pudo registrar el ingreso.' }); } };
  if (!canManageCommercialRecords(user)) { navigationDiagnostic('redirect', { from: pathname, to: '/denied', reason: 'role-not-authorized', ...roleDetails(user) }); return <Redirect href="/denied" />; }
  if (loadingOptions) return <Loading />;
  return <Screen><Text style={[styles.title, { color: colors.text }]}>Nueva recepción presencial</Text><Text style={{ color: colors.muted }}>Seleccioná el cliente y su equipo. El empleado autenticado queda registrado como responsable.</Text>{optionsError ? <ErrorMessage message={optionsError} /> : null}{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="customerId" render={({ field: { onChange, value } }) => <ChoiceSelector label="Cliente comercial" value={value} onChange={(next) => { onChange(next); setSelectedCustomerId(next); setValue('deviceId', ''); }} error={errors.customerId?.message} options={customers.filter((customer) => customer.isActive).map((customer) => ({ value: String(customer.id), label: `${customer.firstName} ${customer.lastName}`, description: customer.documentNumber ?? 'Sin documento' }))} />} /><Controller control={control} name="deviceId" render={({ field: { onChange, value } }) => <ChoiceSelector label="Equipo recibido" value={value} onChange={onChange} error={errors.deviceId?.message} options={devices.map((device) => ({ value: String(device.id), label: `${device.brand} ${device.model}`, description: `${device.deviceType}${device.serialNumber ? ` · Serie ${device.serialNumber}` : ''}` }))} />} /><Controller control={control} name="problemDescription" render={({ field: { onChange, value } }) => <Input label="Motivo del ingreso" multiline value={value} onChangeText={onChange} error={errors.problemDescription?.message} />} /><Controller control={control} name="equipmentCondition" render={({ field: { onChange, value } }) => <Input label="Estado físico del equipo" multiline value={value} onChangeText={onChange} error={errors.equipmentCondition?.message} />} /><Controller control={control} name="accessories" render={({ field: { onChange, value } }) => <Input label="Accesorios (una línea por elemento; opcionalmente descripción | condición)" multiline value={value} onChangeText={onChange} error={errors.accessories?.message} />} /><Controller control={control} name="observations" render={({ field: { onChange, value } }) => <Input label="Observaciones" multiline value={value} onChangeText={onChange} error={errors.observations?.message} />} /><Button title="Registrar orden" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => { navigationDiagnostic('navigate', { from: pathname, to: 'back', reason: 'cancel' }); router.back(); }} /></Screen>;
}

export function ErrorBoundary(props: ErrorBoundaryProps) { return <RouteErrorBoundary route="/intakes/new" {...props} />; }

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });
