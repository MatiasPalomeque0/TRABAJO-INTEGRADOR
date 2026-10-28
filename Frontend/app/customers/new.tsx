import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Redirect, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorMessage } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { customerApi } from '../../src/services/customers';
import { useAuth } from '../../src/context/auth-context';
import { canManageCommercialRecords } from '../../src/utils/permissions';
import { useTheme } from '../../src/theme/theme-context';
import { appRoutes } from '../../src/navigation/routes';
import { RouteErrorBoundary } from '../../src/components/RouteErrorBoundary';
import { navigationDiagnostic, roleDetails } from '../../src/utils/navigation-diagnostics';

const schema = z.object({ firstName: z.string().trim().min(2, 'Ingresá el nombre'), lastName: z.string().trim().min(2, 'Ingresá el apellido'), documentNumber: z.string().trim().optional(), email: z.string().trim().email('Correo inválido').optional().or(z.literal('')), phone: z.string().trim().optional(), address: z.string().trim().optional(), notes: z.string().trim().optional() });
type Form = z.infer<typeof schema>;

export default function NewCustomerScreen() { const { colors } = useTheme(); const { user, isLoading } = useAuth(); const pathname = usePathname(); const { control, handleSubmit, formState: { errors }, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { firstName: '', lastName: '', documentNumber: '', email: '', phone: '', address: '', notes: '' } }); useEffect(() => { navigationDiagnostic('screen-mount', { route: pathname }); return () => navigationDiagnostic('screen-unmount', { route: pathname }); }, [pathname]); useEffect(() => { navigationDiagnostic('screen-auth-state', { route: pathname, ...roleDetails(user), isLoading }); }, [pathname, isLoading, user]); const submit = async (data: Form) => { try { const customer = await customerApi.create({ ...data, documentNumber: data.documentNumber || null, email: data.email || null, phone: data.phone || null, address: data.address || null, notes: data.notes || null }); router.replace(appRoutes.customerDetail(customer.id)); } catch (e) { setError('root', { message: e instanceof Error ? e.message : 'No se pudo registrar el cliente.' }); } }; if (!canManageCommercialRecords(user)) { navigationDiagnostic('redirect', { from: pathname, to: '/denied', reason: 'role-not-authorized', ...roleDetails(user) }); return <Redirect href="/denied" />; } return <Screen><Text style={[styles.title, { color: colors.text }]}>Registrar cliente</Text><Text style={{ color: colors.muted }}>El cliente comercial no necesita una cuenta de usuario.</Text>{errors.root?.message ? <ErrorMessage message={errors.root.message} /> : null}<Controller control={control} name="firstName" render={({ field: { onChange, value } }) => <Input label="Nombre" value={value} onChangeText={onChange} error={errors.firstName?.message} />} /><Controller control={control} name="lastName" render={({ field: { onChange, value } }) => <Input label="Apellido" value={value} onChangeText={onChange} error={errors.lastName?.message} />} /><Controller control={control} name="documentNumber" render={({ field: { onChange, value } }) => <Input label="Documento (opcional)" value={value} onChangeText={onChange} error={errors.documentNumber?.message} />} /><Controller control={control} name="email" render={({ field: { onChange, value } }) => <Input label="Correo (opcional)" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />} /><Controller control={control} name="phone" render={({ field: { onChange, value } }) => <Input label="Teléfono" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />} /><Controller control={control} name="address" render={({ field: { onChange, value } }) => <Input label="Dirección" value={value} onChangeText={onChange} error={errors.address?.message} />} /><Controller control={control} name="notes" render={({ field: { onChange, value } }) => <Input label="Notas" multiline value={value} onChangeText={onChange} error={errors.notes?.message} />} /><Button title="Guardar cliente" onPress={handleSubmit(submit)} /><Button title="Cancelar" variant="ghost" onPress={() => { navigationDiagnostic('navigate', { from: pathname, to: 'back', reason: 'cancel' }); router.back(); }} /></Screen>; }

export function ErrorBoundary(props: ErrorBoundaryProps) { return <RouteErrorBoundary route="/customers/new" {...props} />; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' } });
