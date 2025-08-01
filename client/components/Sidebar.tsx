import * as React from 'react';
import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
}

export default function Sidebar({ isOpen, onClose, currentTab }: SidebarProps) {
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(-280)).current; // Start off-screen to the left
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Animate in from left
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out to left
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -280,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const sidebarItems = [
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chatbubble-outline',
      route: '/(tabs)/index',
    },
    {
      id: 'history',
      label: 'History',
      icon: 'time-outline',
      route: '/(tabs)/history',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      route: '/(tabs)/settings',
    },
  ];

  const handleItemPress = (route: string) => {
    router.push(route as any);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth');
    onClose();
  };

  return (
    <Animated.View style={[
      styles.overlay, 
      { 
        backgroundColor: 'rgba(0,0,0,0.5)',
        opacity: opacityAnim,
      }
    ]} pointerEvents={isOpen ? 'auto' : 'none'}>
      <TouchableOpacity 
        style={styles.overlayTouchable} 
        onPress={onClose}
        activeOpacity={1}
      />
      
      <Animated.View style={[
        styles.sidebar, 
        { 
          backgroundColor: theme.surface,
          transform: [{ translateX: slideAnim }],
        }
      ]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerContent}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user?.name || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email || 'user@example.com'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Navigation Items */}
        <ScrollView style={styles.navigation}>
          {sidebarItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                currentTab === item.id && [styles.activeNavItem, { backgroundColor: theme.primary + '20' }]
              ]}
              onPress={() => handleItemPress(item.route)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={24} 
                color={currentTab === item.id ? theme.primary : theme.text} 
              />
              <Text style={[
                styles.navLabel,
                { color: currentTab === item.id ? theme.primary : theme.text }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
            <Text style={[styles.logoutText, { color: theme.error }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    flexDirection: 'row',
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 280,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  navigation: {
    flex: 1,
    padding: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activeNavItem: {
    borderRadius: 12,
  },
  navLabel: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
});
