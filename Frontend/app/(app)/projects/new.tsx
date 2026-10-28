import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Text, StyleSheet } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ErrorMessage } from '../../../src/components/Feedback';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/theme-context';
import { projectApi } from '../../../src/services/projects';
import { ApiError } from '../../../src/services/api';
const schema = z.object({ name: z.string().trim().min(2, 'Ingresá un nombre'), description: z.string().max(5000).optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá AAAA-MM-DD').optional() });
type Form = z.infer<typeof schema>;
export default function NewProjectScreen() { const { colors } = useTheme(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', dueDate: '' } }); const submit = async (data: Form) => { try { const project = await projectApi.create({ ...data, description: data.description || null, dueDate: data.dueDate || null }); router.replace(`/(app)/projects/${project.id}`); } catch (e) { setError('root', { message: e instanceof ApiError ? e.message : 'No se pudo crear el proyecto.' }); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Nuevo proyecto</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="name" render={({ field: { onChange, value } }) => <Input label="Nombre" value={value} onChangeText={onChange} error={errors.name?.message} />} /><Controller control={control} name="description" render={({ field: { onChange, value } }) => <Input label="Descripción" multiline value={value} onChangeText={onChange} error={errors.description?.message} />} /><Controller control={control} name="dueDate" render={({ field: { onChange, value } }) => <Input label="Fecha estimada (AAAA-MM-DD)" placeholder="2026-12-20" value={value} onChangeText={onChange} error={errors.dueDate?.message} />} /><Button title="Guardar proyecto" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => router.back()} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });

