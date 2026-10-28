import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '../theme/theme-context';
type ButtonProps = Omit<PressableProps, 'onPress'> & { title: string; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; onPress?: () => unknown };

export function Button({ title, loading, variant = 'primary', onPress, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surface : 'transparent';
  const textColor = variant === 'secondary' ? colors.primary : variant === 'ghost' ? colors.primary : colors.primaryText;
  return <Pressable accessibilityRole="button" {...props} onPress={() => { void onPress?.(); }} disabled={props.disabled || loading} style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: colors.primary, opacity: pressed || props.disabled ? 0.72 : 1 }, variant === 'ghost' && styles.ghost]}>{loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}</Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, ghost: { borderColor: 'transparent' }, text: { fontSize: 16, fontWeight: '700' } });

