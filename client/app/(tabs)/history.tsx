import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import Sidebar from '@/components/Sidebar';
import chatService, { ChatSession } from '@/services/chatService';

export default function HistoryScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { setSelectedSessionId, setShouldLoadSpecificSession } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Load chat sessions on component mount
  useEffect(() => {
    loadChatSessions();
  }, []);

  // Filter sessions based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session =>
        session.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSessions(filtered);
    }
  }, [sessions, searchQuery]);

  const loadChatSessions = async () => {
    try {
      setLoading(true);
      const chatSessions = await chatService.getSessions();
      setSessions(chatSessions);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      Alert.alert('Error', 'Failed to load chat history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadChatSessions();
    setRefreshing(false);
  };

  const handleConversationPress = (session: ChatSession) => {
    // Set the selected session in context and navigate to chat
    setSelectedSessionId(session._id);
    setShouldLoadSpecificSession(true);
    router.push('/' as any);
  };

  const handleDeleteSession = async (session: ChatSession) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${session.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteSession(session._id);
              // Remove from local state
              setSessions(prev => prev.filter(s => s._id !== session._id));
              Alert.alert('Success', 'Conversation deleted successfully.');
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
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
        
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons name="search" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading conversations...
            </Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={searchQuery ? "search" : "time-outline"} size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {searchQuery ? 'No results found' : 'No conversations yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery ? `No conversations match "${searchQuery}"` : 'Start chatting to see your history here'}
            </Text>
          </View>
        ) : (
          <View style={styles.conversationList}>
            {filteredSessions.map((session) => (
              <TouchableOpacity
                key={session._id}
                style={[styles.conversationItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => handleConversationPress(session)}
              >
                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={[styles.conversationTitle, { color: theme.text }]}>
                      {session.title}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteSession(session)}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.conversationPreview, { color: theme.textSecondary }]}>
                    {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.conversationTime, { color: theme.textSecondary }]}>
                    {formatDate(session.lastActivity)}
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
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
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  conversationPreview: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  conversationTime: {
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});
