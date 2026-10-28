import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Text, StyleSheet } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/auth-context';
import { useTheme } from '../../src/theme/theme-context';
import { ApiError } from '../../src/services/api';
const schema = z.object({ firstName: z.string().trim().min(2, 'Ingresá tu nombre'), lastName: z.string().trim().min(2, 'Ingresá tu apellido'), email: z.string().email('Ingresá un correo válido'), password: z.string().min(8, 'Usá al menos 8 caracteres').regex(/[A-Z]/, 'Agregá una mayúscula').regex(/[0-9]/, 'Agregá un número'), passwordConfirmation: z.string() }).refine((data) => data.password === data.passwordConfirmation, { path: ['passwordConfirmation'], message: 'Las contraseñas no coinciden' });
type Form = z.infer<typeof schema>;
export default function RegisterScreen() { const { colors } = useTheme(); const { register, isSubmitting } = useAuth(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { firstName: '', lastName: '', email: '', password: '', passwordConfirmation: '' } }); const onSubmit = async (data: Form) => { try { await register(data); router.replace('/(app)'); } catch (error) { setError('root', { message: error instanceof ApiError ? error.message : 'No se pudo crear la cuenta.' }); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Crear cuenta</Text><Text style={{ color: colors.muted }}>Tu cuenta se registrará como Cliente. El administrador podrá asignar funciones de Técnico.</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="firstName" render={({ field: { onChange, value } }) => <Input label="Nombre" autoCapitalize="words" value={value} onChangeText={onChange} error={errors.firstName?.message} />} /><Controller control={control} name="lastName" render={({ field: { onChange, value } }) => <Input label="Apellido" autoCapitalize="words" value={value} onChangeText={onChange} error={errors.lastName?.message} />} /><Controller control={control} name="email" render={({ field: { onChange, value } }) => <Input label="Correo electrónico" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field: { onChange, value } }) => <Input label="Contraseña" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />} /><Controller control={control} name="passwordConfirmation" render={({ field: { onChange, value } }) => <Input label="Repetir contraseña" secureTextEntry value={value} onChangeText={onChange} error={errors.passwordConfirmation?.message} />} /><Button title="Crear cuenta" loading={isSubmitting} onPress={handleSubmit(onSubmit)} /></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900', marginTop: 20 } });

