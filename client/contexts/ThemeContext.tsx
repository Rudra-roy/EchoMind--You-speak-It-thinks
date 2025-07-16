import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  shadow: string;
  error: string;
  success: string;
}

const lightTheme: ThemeColors = {
  background: '#ffffff',
  surface: '#f8fafc',
  primary: '#2563eb',
  secondary: '#64748b',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  card: '#ffffff',
  shadow: '#000000',
  error: '#ef4444',
  success: '#10b981',
};

const darkTheme: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  primary: '#3b82f6',
  secondary: '#64748b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: '#334155',
  card: '#1e293b',
  shadow: '#000000',
  error: '#f87171',
  success: '#34d399',
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  
  const isDark = themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  // Load saved theme mode from storage
  useEffect(() => {
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const savedThemeMode = await AsyncStorage.getItem('themeMode');
      if (savedThemeMode && ['light', 'dark'].includes(savedThemeMode)) {
        setThemeModeState(savedThemeMode as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme mode:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const toggleTheme = () => {
    if (themeMode === 'light') {
      setThemeMode('dark');
    } else {
      setThemeMode('light');
    }
  };

  const value = {
    theme,
    themeMode,
    isDark,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
