import React, { useState } from 'react';
import { 
  Pressable, 
  Platform,
  View, 
  ViewStyle, 
  StyleProp, 
  useColorScheme 
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';
import { Label, Body } from './Typography';
import { Row } from './Row';

export interface DateFieldProps {
  label?: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  mode?: 'date' | 'time' | 'datetime';
}

/**
 * DateField - Tap-to-open date picker field with consistent styling
 * iOS-native date picker with proper styling and interaction
 */
export function DateField({ 
  label,
  value,
  onChange,
  placeholder = 'Select date',
  containerStyle,
  mode = 'date',
}: DateFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showPicker, setShowPicker] = useState(false);

  const handlePress = () => {
    Haptics.selectionAsync();
    setShowPicker(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    } else if (event.type === 'dismissed') {
      onChange(undefined);
    }
  };

  const formatDate = (date: Date) => {
    if (mode === 'time') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (mode === 'datetime') {
      return date.toLocaleString([], { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Label style={{ marginBottom: Spacing.xs }}>
          {label}
        </Label>
      )}
      
      <Pressable
        onPress={handlePress}
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          backgroundColor: colors.surface,
          minHeight: 44,
          justifyContent: 'center',
        }}
      >
        <Row gap="sm" justify="space-between">
          <Body color={value ? colors.text : colors.textTertiary}>
            {value ? formatDate(value) : placeholder}
          </Body>
          <Ionicons 
            name="calendar-outline" 
            size={20} 
            color={colors.textTertiary} 
          />
        </Row>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  );
}
