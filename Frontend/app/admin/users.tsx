import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorMessage, EmptyState, Loading } from '../../src/components/Feedback';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { miscApi, type EmployeeInvitation } from '../../src/services/misc';
import { useTheme } from '../../src/theme/theme-context';
import type { Role, User } from '../../src/types/api';

type EmployeeRole = Extract<Role, 'recepcionista' | 'tecnico'>;

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<User[]>();
  const [error, setError] = useState<string>();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<EmployeeRole>('recepcionista');
  const [inviteToken, setInviteToken] = useState<string>();
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    try { setError(undefined); setUsers((await miscApi.users()).items); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleStatus = async (user: User) => {
    try { await miscApi.updateStatus(user.id, !user.isActive); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el estado.'); }
  };

  const changeRole = (user: User) => Alert.alert('Cambiar rol', `Elegí el rol autorizado para ${user.firstName}.`, [
    { text: 'Cliente', onPress: () => { void applyRole(user, ['cliente']); } },
    { text: 'Recepcionista', onPress: () => { void applyRole(user, ['recepcionista']); } },
    { text: 'Técnico', onPress: () => { void applyRole(user, ['tecnico']); } },
    { text: 'Administrador', onPress: () => { void applyRole(user, ['admin']); } },
    { text: 'Cancelar', style: 'cancel' }
  ]);

  const applyRole = async (user: User, roles: Role[]) => {
    try { await miscApi.updateRoles(user.id, roles); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el rol.'); }
  };

  const createInvitation = async () => {
    if (!inviteEmail.trim()) { setError('Ingresá un correo para crear la invitación.'); return; }
    try {
      setInviteBusy(true); setError(undefined); setInviteToken(undefined);
      const invitation: EmployeeInvitation = await miscApi.createInvitation(inviteEmail.trim(), inviteRole);
      setInviteToken(invitation.token);
      setInviteEmail('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la invitación.'); }
    finally { setInviteBusy(false); }
  };

  if (!users && !error) return <Loading />;
  return <Screen>
    <Text style={[styles.title, { color: colors.text }]}>Administración de usuarios</Text>
    <Card>
      <Text style={[styles.section, { color: colors.text }]}>Invitar empleado</Text>
      <Text style={{ color: colors.muted }}>La invitación autoriza únicamente recepción o técnico y se utiliza una sola vez.</Text>
      <Input label="Correo del empleado" value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" placeholder="empleado@ejemplo.com" />
      <View style={styles.roleRow}>
        <Button title="Recepción" variant={inviteRole === 'recepcionista' ? 'primary' : 'secondary'} onPress={() => setInviteRole('recepcionista')} />
        <Button title="Técnico" variant={inviteRole === 'tecnico' ? 'primary' : 'secondary'} onPress={() => setInviteRole('tecnico')} />
      </View>
      <Button title="Crear invitación" loading={inviteBusy} onPress={createInvitation} />
      {inviteToken ? <Text selectable style={[styles.token, { color: colors.warning }]}>Token de un solo uso (entregar por un canal seguro): {inviteToken}</Text> : null}
    </Card>
    {error ? <ErrorMessage message={error} onRetry={load} /> : null}
    {users?.length === 0 ? <EmptyState title="Sin usuarios" description="No hay registros para mostrar." /> : users?.map((user) => <Card key={user.id}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.text }]}>{user.firstName} {user.lastName}</Text><Text style={{ color: colors.muted }}>{user.email}</Text><Text style={{ color: colors.primary }}>{user.roles.join(' · ')}</Text></View><View style={styles.actions}><Pressable onPress={() => changeRole(user)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Cambiar rol</Text></Pressable><Pressable onPress={() => { void toggleStatus(user); }}><Text style={{ color: user.isActive ? colors.success : colors.danger, fontWeight: '800' }}>{user.isActive ? 'Activo' : 'Deshabilitado'}</Text></Pressable></View></View></Card>)}
  </Screen>;
}

const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '900' }, section: { fontSize: 18, fontWeight: '800' }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' }, roleRow: { flexDirection: 'row', gap: 10 }, name: { fontSize: 17, fontWeight: '800' }, actions: { gap: 12, alignItems: 'flex-end' }, token: { fontWeight: '700', lineHeight: 21 } });
