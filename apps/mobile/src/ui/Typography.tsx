import React, { PropsWithChildren } from 'react';
import { Text, TextProps } from 'react-native';

import { useAppTheme } from './theme';

type TypographyProps = PropsWithChildren<
  TextProps & {
    muted?: boolean;
  }
>;

export const Title = ({ children, style, muted, ...props }: TypographyProps) => {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? theme.colors.muted : theme.colors.foreground,
          fontSize: theme.typography.title.fontSize,
          fontWeight: theme.typography.title.fontWeight,
          letterSpacing: theme.typography.title.letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const Body = ({ children, style, muted, ...props }: TypographyProps) => {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? theme.colors.muted : theme.colors.foreground,
          fontSize: theme.typography.body.fontSize,
          fontWeight: theme.typography.body.fontWeight,
          letterSpacing: theme.typography.body.letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

export const Caption = ({ children, style, muted, ...props }: TypographyProps) => {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? theme.colors.muted : theme.colors.foreground,
          fontSize: theme.typography.caption.fontSize,
          fontWeight: theme.typography.caption.fontWeight,
          letterSpacing: theme.typography.caption.letterSpacing,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};
