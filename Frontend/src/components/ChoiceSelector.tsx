import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme-context';

export type ChoiceOption = { value: string; label: string; description?: string };

export function ChoiceSelector({ label, value, options, onChange, error }: { label: string; value?: string; options: readonly ChoiceOption[]; onChange: (value: string) => void; error?: string }) {
  const { colors } = useTheme();
  return <View style={styles.container}>
    <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    <View style={styles.options}>{options.map((option) => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={[styles.option, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
        <Text style={[styles.optionLabel, { color: selected ? colors.primaryText : colors.text }]}>{option.label}</Text>
        {option.description ? <Text style={{ color: selected ? colors.primaryText : colors.muted }}>{option.description}</Text> : null}
      </Pressable>;
    })}</View>
    <Text style={[styles.error, { color: colors.danger }]}>{error ?? ' '}</Text>
  </View>;
}

const styles = StyleSheet.create({ container: { gap: 6 }, label: { fontWeight: '700', fontSize: 14 }, options: { gap: 8 }, option: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 }, optionLabel: { fontWeight: '700', fontSize: 15 }, error: { minHeight: 16, fontSize: 12 } });
