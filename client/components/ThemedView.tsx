import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { theme, isDark } = useTheme();
  
  // Use custom colors if provided, otherwise use theme colors
  let backgroundColor = theme.background;
  if (isDark && darkColor) {
    backgroundColor = darkColor;
  } else if (!isDark && lightColor) {
    backgroundColor = lightColor;
  }

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
