import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../../../src/components/Button';
import { ErrorMessage, Loading } from '../../../../src/components/Feedback';
import { Input } from '../../../../src/components/Input';
import { Screen } from '../../../../src/components/Screen';
import { taskApi } from '../../../../src/services/tasks';
import { useTheme } from '../../../../src/theme/theme-context';
const schema = z.object({ title: z.string().trim().min(2), description: z.string().optional(), priority: z.enum(['baja', 'media', 'alta', 'urgente']), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá AAAA-MM-DD').optional() });
type Form = z.infer<typeof schema>;
export default function EditTaskScreen() { const { id } = useLocalSearchParams<{ id: string }>(); const { colors } = useTheme(); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const { control, reset, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) }); useEffect(() => { taskApi.get(Number(id)).then((task) => reset({ title: task.title, description: task.description ?? '', priority: task.priority, dueDate: task.dueDate ?? '' })).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la tarea.')).finally(() => setLoading(false)); }, [id, reset]); if (loading) return <Loading />; if (error) return <Screen><ErrorMessage message={error} /></Screen>; return <Screen><Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>Editar tarea</Text><Controller control={control} name="title" render={({ field: { onChange, value } }) => <Input label="Título" value={value} onChangeText={onChange} error={errors.title?.message} />} /><Controller control={control} name="description" render={({ field: { onChange, value } }) => <Input label="Descripción" multiline value={value} onChangeText={onChange} error={errors.description?.message} />} /><Controller control={control} name="priority" render={({ field: { onChange, value } }) => <Input label="Prioridad" value={value} onChangeText={onChange} error={errors.priority?.message} />} /><Controller control={control} name="dueDate" render={({ field: { onChange, value } }) => <Input label="Fecha (AAAA-MM-DD)" value={value} onChangeText={onChange} error={errors.dueDate?.message} />} /><Button title="Guardar cambios" onPress={handleSubmit(async (data) => { await taskApi.update(Number(id), { ...data, description: data.description || null, dueDate: data.dueDate || null }); router.back(); })} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>; }
