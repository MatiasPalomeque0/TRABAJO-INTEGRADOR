import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Text, StyleSheet, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/context/auth-context';
import { useTheme } from '../../src/theme/theme-context';
import { ApiError } from '../../src/services/api';
const schema = z.object({ email: z.string().email('Ingresá un correo válido'), password: z.string().min(1, 'Ingresá tu contraseña') });
type Form = z.infer<typeof schema>;
export default function LoginScreen() { const { colors } = useTheme(); const { login, isSubmitting } = useAuth(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } }); const onSubmit = async (data: Form) => { try { await login(data.email, data.password); router.replace('/(app)'); } catch (error) { setError('root', { message: error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.' }); } }; return <Screen><Text style={[styles.title, { color: colors.text }]}>Bienvenido de nuevo</Text><Text style={{ color: colors.muted }}>Ingresá para continuar con tus proyectos.</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => <Input label="Correo electrónico" placeholder="nombre@correo.com" keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => <Input label="Contraseña" placeholder="••••••••" secureTextEntry value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} />} /><Button title="Ingresar" loading={isSubmitting} onPress={handleSubmit(onSubmit)} /><Button title="Diagnóstico de conectividad" variant="secondary" onPress={() => router.push('/native/network-diagnostic')} /><View style={styles.footer}><Text style={{ color: colors.muted }}>¿No tenés cuenta? </Text><Link href="/(auth)/register" style={{ color: colors.primary, fontWeight: '800' }}>Registrate</Link></View><Text onPress={() => router.push('/(auth)/social')} style={[styles.social, { color: colors.primary }]}>Usar una red social</Text></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900', marginTop: 28 }, footer: { flexDirection: 'row', justifyContent: 'center' }, social: { textAlign: 'center', fontWeight: '800', padding: 12 } });

