import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SimpleThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  style?: any;
}

const SimpleThemeToggle: React.FC<SimpleThemeToggleProps> = ({ isDark, onToggle, style }) => {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <Ionicons 
          name={isDark ? 'moon' : 'sunny'} 
          size={24} 
          color={isDark ? '#fbbf24' : '#f59e0b'} 
        />
        <Text style={[styles.text, { color: isDark ? '#f1f5f9' : '#1f2937' }]}>
          {isDark ? 'Dark' : 'Light'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  text: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SimpleThemeToggle;
