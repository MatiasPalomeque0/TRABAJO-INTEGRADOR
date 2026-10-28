import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ErrorMessage } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { repairApi } from '../../../src/services/repairs';
import { useTheme } from '../../../src/theme/theme-context';
import { useAuth } from '../../../src/context/auth-context';
import { canCreateRepair } from '../../../src/utils/permissions';
const schema = z.object({ deviceId: z.string().min(1).refine((value) => Number(value) > 0, 'Ingresá un ID válido'), problemDescription: z.string().trim().min(10, 'Describí el problema con más detalle').max(4000) });
type Form = z.infer<typeof schema>;
export default function NewRepairScreen() { const { deviceId } = useLocalSearchParams<{ deviceId?: string }>(); const { colors } = useTheme(); const { user } = useAuth(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { deviceId: deviceId ?? '', problemDescription: '' } }); const submit = async (data: Form) => { try { const repair = await repairApi.create({ deviceId: Number(data.deviceId), problemDescription: data.problemDescription }); router.replace(`/(app)/repairs/${repair.id}`); } catch (e) { setError('root', { message: e instanceof Error ? e.message : 'No se pudo crear la solicitud.' }); } }; if (!canCreateRepair(user)) return <Redirect href="/denied" />; return <Screen><Text style={[styles.title, { color: colors.text }]}>Solicitar reparación</Text><Text style={{ color: colors.muted }}>Contanos qué problema presenta el equipo.</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="deviceId" render={({ field: { onChange, value } }) => <Input label="ID del equipo" keyboardType="number-pad" value={value} onChangeText={onChange} error={errors.deviceId?.message} />} /><Controller control={control} name="problemDescription" render={({ field: { onChange, value } }) => <Input label="Descripción del problema" multiline value={value} onChangeText={onChange} error={errors.problemDescription?.message} />} /><Button title="Enviar solicitud" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });

