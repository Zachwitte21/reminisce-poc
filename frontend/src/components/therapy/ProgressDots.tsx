import { View, StyleSheet } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

interface ProgressDotsProps {
  total: number;
  current: number;
  maxVisible?: number;
}

export function ProgressDots({ total, current, maxVisible = 10 }: ProgressDotsProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  let startIndex = 0;
  let endIndex = total;

  if (total > maxVisible) {
    const halfVisible = Math.floor(maxVisible / 2);
    startIndex = Math.max(0, current - halfVisible);
    endIndex = Math.min(total, startIndex + maxVisible);

    if (endIndex - startIndex < maxVisible) {
      startIndex = Math.max(0, endIndex - maxVisible);
    }
  }

  const visibleIndices = Array.from(
    { length: endIndex - startIndex },
    (_, i) => startIndex + i
  );

  return (
    <View style={styles.container}>
      {startIndex > 0 && <View style={styles.ellipsis} />}
      {visibleIndices.map((index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current && styles.dotActive,
            index < current && styles.dotCompleted,
          ]}
        />
      ))}
      {endIndex < total && <View style={styles.ellipsis} />}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.textInverse + '40',
  },
  dotActive: {
    backgroundColor: theme.textInverse,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCompleted: {
    backgroundColor: theme.textInverse + '80',
  },
  ellipsis: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.textInverse + '60',
    marginHorizontal: spacing.xs,
  },
});
