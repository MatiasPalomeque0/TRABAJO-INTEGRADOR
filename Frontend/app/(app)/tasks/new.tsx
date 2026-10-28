import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ErrorMessage } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/theme-context';
import { taskApi } from '../../../src/services/tasks';
import { ApiError } from '../../../src/services/api';
const schema = z.object({ projectId: z.string().min(1, 'Elegí un proyecto').refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, 'El proyecto debe ser numérico'), title: z.string().trim().min(2, 'Ingresá un título'), description: z.string().optional(), priority: z.enum(['baja', 'media', 'alta', 'urgente']), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá AAAA-MM-DD').optional() });
type Form = z.infer<typeof schema>;
export default function NewTaskScreen() { const { projectId } = useLocalSearchParams<{ projectId?: string }>(); const { colors } = useTheme(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { projectId: projectId ?? '', title: '', description: '', priority: 'media', dueDate: '' } }); const submit = async (data: Form) => { try { const task = await taskApi.create({ ...data, projectId: Number(data.projectId), description: data.description || null, dueDate: data.dueDate || null }); router.replace(`/(app)/tasks/${task.id}`); } catch (e) { setError('root', { message: e instanceof ApiError ? e.message : 'No se pudo crear la tarea.' }); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Nueva tarea</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="projectId" render={({ field: { onChange, value } }) => <Input label="ID de proyecto" keyboardType="number-pad" value={value} onChangeText={onChange} error={errors.projectId?.message} />} /><Controller control={control} name="title" render={({ field: { onChange, value } }) => <Input label="Título" value={value} onChangeText={onChange} error={errors.title?.message} />} /><Controller control={control} name="description" render={({ field: { onChange, value } }) => <Input label="Descripción" multiline value={value} onChangeText={onChange} error={errors.description?.message} />} /><Controller control={control} name="priority" render={({ field: { onChange, value } }) => <Input label="Prioridad (baja/media/alta/urgente)" value={value} onChangeText={onChange} error={errors.priority?.message} />} /><Controller control={control} name="dueDate" render={({ field: { onChange, value } }) => <Input label="Fecha límite (AAAA-MM-DD)" value={value} onChangeText={onChange} error={errors.dueDate?.message} />} /><Button title="Guardar tarea" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });

