import React from 'react';
import { Text, TextStyle, StyleProp, useColorScheme } from 'react-native';
import { Colors, Typography as TypographyStyles } from '@/constants/theme';

export interface TypographyProps {
  children: React.ReactNode;
  variant?: keyof typeof TypographyStyles;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Base Typography component that applies theme-consistent text styling
 */
function Typography({ 
  children, 
  variant = 'body', 
  color,
  align = 'auto',
  numberOfLines,
  style 
}: TypographyProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <Text
      style={[
        TypographyStyles[variant],
        {
          color: color ?? colors.text,
          textAlign: align,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

// Convenience components for common text styles

export function Title({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="title1" style={style} {...props}>{children}</Typography>;
}

export function Title2({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="title2" style={style} {...props}>{children}</Typography>;
}

export function Title3({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="title3" style={style} {...props}>{children}</Typography>;
}

export function Headline({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="headline" style={style} {...props}>{children}</Typography>;
}

export function Body({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="body" style={style} {...props}>{children}</Typography>;
}

export function BodyEmphasized({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="bodyEmphasized" style={style} {...props}>{children}</Typography>;
}

export function Subheadline({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="subheadline" style={style} {...props}>{children}</Typography>;
}

export function Footnote({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="footnote" style={style} {...props}>{children}</Typography>;
}

export function Caption({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="caption1" style={style} {...props}>{children}</Typography>;
}

export function Label({ children, style, ...props }: Omit<TypographyProps, 'variant'>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <Typography 
      variant="subheadlineEmphasized" 
      color={colors.textSecondary}
      style={style} 
      {...props}
    >
      {children}
    </Typography>
  );
}

export { Typography };
