import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ChoiceSelector } from '../../../src/components/ChoiceSelector';
import { ErrorMessage } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { deviceApi } from '../../../src/services/devices';
import { useAuth } from '../../../src/context/auth-context';
import { canManageCommercialRecords } from '../../../src/utils/permissions';
import { useTheme } from '../../../src/theme/theme-context';
import { DEVICE_TYPE_OPTIONS } from '../../../src/constants/techfix';
import { appRoutes } from '../../../src/navigation/routes';

const schema = z.object({ deviceType: z.enum(['desktop', 'notebook', 'all_in_one', 'impresora', 'otro']), brand: z.string().trim().min(2, 'Ingresá la marca'), model: z.string().trim().min(1, 'Ingresá el modelo'), serialNumber: z.string().trim().optional(), description: z.string().trim().optional() });
type Form = z.infer<typeof schema>;

export default function CustomerDeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { colors } = useTheme(); const { user } = useAuth();
  const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { deviceType: 'notebook', brand: '', model: '', serialNumber: '', description: '' } });
  const submit = async (data: Form) => { try { await deviceApi.create({ ...data, customerId: Number(id), serialNumber: data.serialNumber || null, description: data.description || null }); router.replace(appRoutes.customerDetail(id)); } catch (e) { setError('root', { message: e instanceof Error ? e.message : 'No se pudo registrar el equipo.' }); } };
  if (!canManageCommercialRecords(user)) return <Redirect href="/denied" />;
  return <Screen><Text style={[styles.title, { color: colors.text }]}>Registrar equipo del cliente</Text><Text style={{ color: colors.muted }}>Cliente comercial asociado: #{id}</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="deviceType" render={({ field: { onChange, value } }) => <ChoiceSelector label="Tipo de equipo" value={value} onChange={onChange} error={errors.deviceType?.message} options={DEVICE_TYPE_OPTIONS} />} /><Controller control={control} name="brand" render={({ field: { onChange, value } }) => <Input label="Marca" value={value} onChangeText={onChange} error={errors.brand?.message} />} /><Controller control={control} name="model" render={({ field: { onChange, value } }) => <Input label="Modelo" value={value} onChangeText={onChange} error={errors.model?.message} />} /><Controller control={control} name="serialNumber" render={({ field: { onChange, value } }) => <Input label="Número de serie (opcional)" value={value} onChangeText={onChange} error={errors.serialNumber?.message} />} /><Controller control={control} name="description" render={({ field: { onChange, value } }) => <Input label="Descripción del equipo" multiline value={value} onChangeText={onChange} error={errors.description?.message} />} /><Button title="Guardar equipo" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });
