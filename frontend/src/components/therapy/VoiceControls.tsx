import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { VoiceSessionState } from '../../types/api';

interface VoiceControlsProps {
  sessionId: string;
  patientId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onPhotoChange?: (photoId: string) => void;
  style?: ViewStyle;
}

interface VoiceIndicatorProps {
  state: VoiceSessionState;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

function getStateColor(state: VoiceSessionState, colors: ReturnType<typeof useTheme>): string {
  switch (state) {
    case 'listening':
      return colors.success;
    case 'speaking':
    case 'processing':
      return colors.primary;
    case 'error':
      return colors.danger;
    case 'connecting':
      return colors.warning;
    case 'connected':
      return colors.primaryLight;
    default:
      return colors.textLight;
  }
}

function getStatusText(state: VoiceSessionState): string {
  switch (state) {
    case 'disconnected':
      return 'Tap to start voice';
    case 'connecting':
      return 'Connecting...';
    case 'connected':
      return 'Tap to speak';
    case 'listening':
      return 'Listening...';
    case 'processing':
      return 'Processing...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return 'Error - tap to retry';
    default:
      return '';
  }
}

function getStateIcon(state: VoiceSessionState): keyof typeof Ionicons.glyphMap {
  switch (state) {
    case 'listening':
      return 'mic';
    case 'speaking':
      return 'volume-high';
    case 'processing':
      return 'hourglass';
    case 'error':
      return 'alert-circle';
    case 'connecting':
      return 'sync';
    case 'connected':
      return 'mic-outline';
    default:
      return 'mic-off';
  }
}

export function VoiceControls({
  sessionId,
  patientId,
  enabled,
  onToggle,
  onPhotoChange,
  style,
  currentPhotoId,
  autoConnect = false,
}: VoiceControlsProps & { currentPhotoId?: string, autoConnect?: boolean }): React.ReactElement {
  const colors = useTheme();
  const {
    state,
    isConnected,
    isListening,
    error,
    connect,
    disconnect,
    toggleListening,
    sendPhotoChange
  } = useVoiceSession({ sessionId, patientId });

  useEffect(() => {
    let mounted = true;
    if (autoConnect && state === 'disconnected' && mounted) {
      connect();
      onToggle(true);
    }
    return () => { mounted = false; };
  }, [autoConnect]);

  useEffect(() => {
    if (isConnected && currentPhotoId) {
      sendPhotoChange(currentPhotoId);
    }
  }, [currentPhotoId, isConnected, sendPhotoChange]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  useEffect(() => {
    if (state === 'connecting') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state, rotateAnim]);

  const handlePress = async () => {
    if (state === 'disconnected' || state === 'error') {
      onToggle(true);
      await connect();
    } else if (isConnected) {
      await toggleListening();
    }
  };

  const handleLongPress = async () => {
    if (isConnected) {
      await disconnect();
      onToggle(false);
    }
  };

  const stateColor = getStateColor(state, colors);
  const statusText = error || getStatusText(state);
  const icon = getStateIcon(state);

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.buttonOuter,
          {
            backgroundColor: `${stateColor}20`,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: stateColor,
              shadowColor: stateColor,
            },
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={1000}
          activeOpacity={0.8}
          accessibilityLabel={statusText}
          accessibilityRole="button"
          accessibilityState={{
            selected: isListening,
            disabled: state === 'connecting',
          }}
        >
          <Animated.View
            style={
              state === 'connecting'
                ? { transform: [{ rotate: rotateInterpolation }] }
                : undefined
            }
          >
            <Ionicons name={icon} size={32} color={colors.textInverse} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <Text
        style={[
          styles.statusText,
          {
            color: state === 'error' ? colors.danger : colors.textSecondary,
          },
        ]}
      >
        {statusText}
      </Text>

      {isConnected && (
        <Text style={[styles.hintText, { color: colors.textLight }]}>
          Hold to disconnect
        </Text>
      )}
    </View>
  );
}

export function VoiceIndicator({
  state,
  size = 'small',
  style,
}: VoiceIndicatorProps): React.ReactElement {
  const colors = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isActive = state === 'listening' || state === 'speaking';
  const stateColor = getStateColor(state, colors);
  const dotSize = size === 'small' ? 8 : 12;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  if (state === 'disconnected') {
    return <View style={style} />;
  }

  return (
    <View style={[styles.indicatorContainer, style]}>
      <Animated.View
        style={[
          styles.indicatorDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: stateColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {state === 'speaking' && (
        <WaveBars color={stateColor} size={size} />
      )}
    </View>
  );
}

function WaveBars({
  color,
  size,
}: {
  color: string;
  size: 'small' | 'medium';
}): React.ReactElement {
  const bar1Anim = useRef(new Animated.Value(0.3)).current;
  const bar2Anim = useRef(new Animated.Value(0.5)).current;
  const bar3Anim = useRef(new Animated.Value(0.3)).current;

  const barWidth = size === 'small' ? 2 : 3;
  const barHeight = size === 'small' ? 12 : 16;

  useEffect(() => {
    const animateBar = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animateBar(bar1Anim, 0),
      animateBar(bar2Anim, 100),
      animateBar(bar3Anim, 200),
    ]);

    animation.start();

    return () => animation.stop();
  }, [bar1Anim, bar2Anim, bar3Anim]);

  return (
    <View style={styles.waveBarsContainer}>
      {[bar1Anim, bar2Anim, bar3Anim].map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  buttonOuter: {
    borderRadius: 50,
    padding: 8,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  hintText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorDot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  waveBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  waveBar: {
    borderRadius: 1,
  },
});
