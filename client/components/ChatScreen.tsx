import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import Sidebar from '@/components/Sidebar';
import chatService, { ChatSession, Message } from '@/services/chatService';

export default function ChatScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { selectedSessionId, shouldLoadSpecificSession, setShouldLoadSpecificSession } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize chat session
  useEffect(() => {
    initializeChat();
  }, [user]);

  // Handle specific session loading from history
  useEffect(() => {
    if (shouldLoadSpecificSession && selectedSessionId) {
      loadSpecificSession(selectedSessionId);
      setShouldLoadSpecificSession(false);
    }
  }, [shouldLoadSpecificSession, selectedSessionId]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      // Get existing sessions
      const sessions = await chatService.getSessions();
      
      if (sessions.length > 0) {
        // Load the most recent session
        const latestSession = sessions[0];
        const sessionData = await chatService.getSession(latestSession._id);
        setCurrentSession(sessionData.session);
        setMessages(sessionData.messages);
      } else {
        // Create a new session
        const newSession = await chatService.createSession();
        setCurrentSession(newSession);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const sessionData = await chatService.getSession(sessionId);
      setCurrentSession(sessionData.session);
      setMessages(sessionData.messages);
    } catch (error) {
      console.error('Error loading specific session:', error);
      Alert.alert('Error', 'Failed to load conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      setLoading(true);
      const newSession = await chatService.createSession();
      setCurrentSession(newSession);
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
      Alert.alert('Error', 'Failed to create new chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !currentSession) return;

    const messageText = text.trim();
    setInputText('');
    setIsTyping(true);

    try {
      const response = await chatService.sendMessage(currentSession._id, messageText);
      
      // Add both user message and AI response to the messages array
      setMessages(prev => [...prev, response.userMessage, response.aiResponse]);
      
      // Update session title if it's the first message
      if (messages.length === 0) {
        // Refresh session data to get updated title
        const sessionData = await chatService.getSession(currentSession._id);
        setCurrentSession(sessionData.session);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      // TODO: Stop recording and process voice
      Alert.alert('Voice Recording', 'Recording stopped. Voice processing will be implemented here.');
    } else {
      setIsRecording(true);
      // TODO: Start recording
      Alert.alert('Voice Recording', 'Recording started. Tap again to stop.');
    }
  };

  const renderMessage = (message: Message) => (
    <View key={message._id} style={[
      styles.messageContainer,
      message.isUserMessage ? styles.userMessage : styles.aiMessage
    ]}>
      {!message.isUserMessage && (
        <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" size={16} color="white" />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        message.isUserMessage 
          ? { backgroundColor: theme.primary }
          : { backgroundColor: theme.surface, borderColor: theme.border }
      ]}>
        <Text style={[
          styles.messageText,
          { color: message.isUserMessage ? 'white' : theme.text }
        ]}>
          {message.content}
        </Text>
        <Text style={[
          styles.messageTime,
          { color: message.isUserMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary }
        ]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  const renderTypingIndicator = () => (
    <View style={[styles.messageContainer, styles.aiMessage]}>
      <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}>
        <Ionicons name="sparkles" size={16} color="white" />
      </View>
      <View style={[styles.messageBubble, styles.typingBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.typingIndicator}>
          <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
          <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
          <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
        </View>
      </View>
    </View>
  );

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
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {currentSession?.title || 'EchoMind'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {loading ? 'Loading...' : 'AI Assistant'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={createNewChat}
        >
          <Ionicons name="add" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="chatbubble-outline" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                What can I help with?
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Start a conversation or use voice input
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="refresh" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Loading...
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Setting up your chat session
              </Text>
            </View>
          ) : (
            <>
              {messages.map(renderMessage)}
              {isTyping && renderTypingIndicator()}
            </>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.card, 
                borderColor: theme.border,
                color: theme.text,
                maxHeight: 100,
              }]}
              placeholder="Ask anything..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onSubmitEditing={() => sendMessage(inputText)}
            />
            
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  { backgroundColor: isRecording ? theme.error : theme.primary }
                ]}
                onPress={handleVoiceRecord}
              >
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={24} 
                  color="white" 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentTab="chat"
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
  optionsButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
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
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  typingBubble: {
    paddingVertical: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    fontSize: 16,
    minHeight: 48,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  voiceButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
