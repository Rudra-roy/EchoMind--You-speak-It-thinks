import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';

export default function HistoryScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const conversationHistory = [
    {
      id: '1',
      title: 'Planning my day',
      timestamp: '2 hours ago',
      preview: 'Help me organize my schedule for tomorrow...',
    },
    {
      id: '2',
      title: 'Creative writing ideas',
      timestamp: '1 day ago',
      preview: 'I need some inspiration for my short story...',
    },
    {
      id: '3',
      title: 'Learning JavaScript',
      timestamp: '3 days ago',
      preview: 'Explain closures in JavaScript...',
    },
  ];

  const handleConversationPress = (conversationId: string) => {
    Alert.alert('History', `Opening conversation ${conversationId}. This feature will be implemented soon.`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setSidebarOpen(true)}
        >
          <Ionicons name="menu" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>History</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Your conversations
          </Text>
        </View>
        
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {conversationHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="time-outline" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No conversations yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Start chatting to see your history here
            </Text>
          </View>
        ) : (
          <View style={styles.conversationList}>
            {conversationHistory.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={[styles.conversationItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => handleConversationPress(conversation.id)}
              >
                <View style={styles.conversationContent}>
                  <Text style={[styles.conversationTitle, { color: theme.text }]}>
                    {conversation.title}
                  </Text>
                  <Text style={[styles.conversationPreview, { color: theme.textSecondary }]}>
                    {conversation.preview}
                  </Text>
                  <Text style={[styles.conversationTime, { color: theme.textSecondary }]}>
                    {conversation.timestamp}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentTab="history"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  searchButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  conversationList: {
    paddingVertical: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  conversationTime: {
    fontSize: 12,
  },
});
