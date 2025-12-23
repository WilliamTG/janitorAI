import React, { useState } from 'react';
import { Platform, View } from 'react-native';
// eslint-disable-next-line import/no-unresolved
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { TextField } from './TextField';
import { useAppTheme } from './theme';

export type DateFieldProps = {
  value?: string;
  onChange: (dateString: string) => void;
  label?: string;
};

export const DateField = ({ value, onChange, label }: DateFieldProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const theme = useAppTheme();

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    if (selected) {
      const formatted = selected.toISOString().split('T')[0];
      onChange(formatted);
    }
  };

  return (
    <View>
      <TextField
        label={label}
        value={value}
        placeholder="Select a date"
        editable={false}
        rightIcon={<Ionicons name="calendar-outline" size={18} color={theme.colors.muted} />}
        onPressIn={() => setShowPicker(true)}
      />
      {showPicker && (
        <DateTimePicker value={value ? new Date(value) : new Date()} mode="date" display="default" onChange={handleChange} />
      )}
    </View>
  );
};
