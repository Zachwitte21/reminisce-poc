import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { useTheme } from '../../hooks/useTheme';

const { height } = Dimensions.get('window');

interface CaptionOverlayProps {
  caption?: string;
}

export function CaptionOverlay({ caption }: CaptionOverlayProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!caption) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      >
        <Text style={styles.caption} numberOfLines={3}>
          {caption}
        </Text>
      </LinearGradient>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.2,
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  caption: {
    fontSize: 24,
    fontWeight: '500',
    color: theme.textInverse,
    textAlign: 'center',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
