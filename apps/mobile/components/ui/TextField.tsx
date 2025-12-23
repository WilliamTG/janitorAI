import React, { useState } from 'react';
import { 
  TextInput, 
  View, 
  TextStyle, 
  ViewStyle, 
  StyleProp, 
  useColorScheme,
  TextInputProps as RNTextInputProps
} from 'react-native';
import { Colors, BorderRadius, Spacing, Typography as TypographyStyles } from '@/constants/theme';
import { Label, Caption } from './Typography';

export interface TextFieldProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  error?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * TextField - Input field with label, helper text, error state, and focus styling
 * Native-feeling iOS input with proper states and feedback
 */
export function TextField({ 
  label,
  helperText,
  error,
  multiline = false,
  containerStyle,
  inputStyle,
  ...textInputProps
}: TextFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && (
        <Label style={{ marginBottom: Spacing.xs }}>
          {label}
        </Label>
      )}
      
      <TextInput
        {...textInputProps}
        multiline={multiline}
        onFocus={(e) => {
          setIsFocused(true);
          textInputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          textInputProps.onBlur?.(e);
        }}
        style={[
          TypographyStyles.body,
          {
            borderWidth: 1.5,
            borderColor: error 
              ? colors.error 
              : isFocused 
                ? colors.borderFocus 
                : colors.border,
            borderRadius: BorderRadius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            backgroundColor: colors.surface,
            color: colors.text,
            minHeight: multiline ? 100 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          inputStyle,
        ]}
        placeholderTextColor={colors.textTertiary}
      />

      {(error || helperText) && (
        <Caption 
          color={error ? colors.error : colors.textSecondary}
          style={{ marginTop: Spacing.xs }}
        >
          {error || helperText}
        </Caption>
      )}
    </View>
  );
}
