import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Body, Caption, useAppTheme } from '@/src/ui';

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = { icon: string; label: string; durationMs: number };

const REPORT_STEPS: Step[] = [
  { icon: '🔍', label: 'Analyzing content', durationMs: 2600 },
  { icon: '🧠', label: 'Collecting knowledge', durationMs: 3200 },
  { icon: '✍️', label: 'Drafting your report', durationMs: 99999 },
];

const GOOGLE_DOC_STEPS: Step[] = [
  { icon: '🎬', label: 'Analyzing video', durationMs: 3000 },
  { icon: '🗣️', label: 'Transcribing content', durationMs: 4500 },
  { icon: '🧠', label: 'Collecting knowledge', durationMs: 3000 },
  { icon: '📄', label: 'Generating document', durationMs: 99999 },
];

// ─── Pulsing orb ─────────────────────────────────────────────────────────────

function PulsingOrb() {
  const theme = useAppTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.5, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ alignItems: 'center', marginBottom: 24 }}>
      <Animated.View
        style={[
          {
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: theme.colors.accent + '20',
            alignItems: 'center',
            justifyContent: 'center',
          },
          animStyle,
        ]}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: theme.colors.accent + '35',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Animated dots ────────────────────────────────────────────────────────────

function AnimatedDots() {
  const theme = useAppTheme();
  const [count, setCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setCount(c => (c % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  const dots = '●'.repeat(count) + '○'.repeat(3 - count);

  return (
    <Body style={{ color: theme.colors.accent, letterSpacing: 3, fontSize: 10 }}>
      {dots}
    </Body>
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'pending';

function StepRow({ step, state, index }: { step: Step; state: StepState; index: number }) {
  const theme = useAppTheme();
  const isDone = state === 'done';
  const isActive = state === 'active';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: theme.radii.md,
        backgroundColor: isActive ? theme.colors.accent + '12' : 'transparent',
      }}
    >
      {/* Icon / checkmark */}
      <View style={{ width: 30, alignItems: 'center' }}>
        {isDone ? (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
        ) : (
          <Body style={{ fontSize: 18, lineHeight: 24, opacity: isActive ? 1 : 0.3 }}>
            {step.icon}
          </Body>
        )}
      </View>

      {/* Label */}
      <Body
        style={{
          flex: 1,
          color: isDone ? theme.colors.accent : isActive ? theme.colors.foreground : theme.colors.muted,
          fontWeight: isActive ? '600' : '400',
          opacity: state === 'pending' ? 0.4 : 1,
        }}
      >
        {step.label}
      </Body>

      {/* Right side */}
      {isActive && <AnimatedDots />}
      {isDone && (
        <Caption style={{ color: theme.colors.accent, opacity: 0.65 }}>done</Caption>
      )}
    </Animated.View>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  mode: 'report' | 'googleDoc';
};

export function ReportGeneratingOverlay({ visible, mode }: Props) {
  const theme = useAppTheme();
  const steps = mode === 'googleDoc' ? GOOGLE_DOC_STEPS : REPORT_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    let step = 0;

    const advance = () => {
      if (step >= steps.length - 1) return;
      step += 1;
      setCurrentStep(step);
      timerRef.current = setTimeout(advance, steps[step].durationMs);
    };

    timerRef.current = setTimeout(advance, steps[0].durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, steps]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.52)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Animated.View
          entering={FadeIn.springify()}
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: 28,
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 28,
            elevation: 14,
          }}
        >
          <PulsingOrb />

          <Body style={{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 6 }}>
            {mode === 'googleDoc' ? 'Generating Google Doc' : 'Creating report'}
          </Body>
          <Caption muted style={{ textAlign: 'center', marginBottom: 22 }}>
            The AI is working on it — this may take a moment.
          </Caption>

          <View style={{ gap: 2 }}>
            {steps.map((step, i) => (
              <StepRow
                key={step.label}
                step={step}
                index={i}
                state={i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
