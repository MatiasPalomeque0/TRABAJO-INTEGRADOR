import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/theme-context';
export function Input({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  return <View style={styles.container}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><TextInput {...props} placeholderTextColor={colors.muted} style={[styles.input, props.multiline ? styles.multiline : undefined, { color: colors.text, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface }, props.style]} accessibilityLabel={label} autoCapitalize={props.autoCapitalize ?? 'none'} /><Text style={[styles.error, { color: colors.danger }]}>{error ?? ' '}</Text></View>;
}
const styles = StyleSheet.create({ container: { gap: 6 }, label: { fontWeight: '700', fontSize: 14 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlignVertical: 'center' }, multiline: { minHeight: 112, textAlignVertical: 'top' }, error: { minHeight: 16, fontSize: 12 } });

