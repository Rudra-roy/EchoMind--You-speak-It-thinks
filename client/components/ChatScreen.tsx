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
  Image,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import Sidebar from '@/components/Sidebar';
import PromptTemplateSelector from '@/components/PromptTemplateSelector';
import chatService, { ChatSession, Message } from '@/services/chatService';
import { PromptTemplate } from '@/services/promptTemplateService';
import { getApiBaseUrl } from '@/config/network';

const API_BASE_URL = getApiBaseUrl();

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
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: Audio.Sound }>({});
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize chat session
  useEffect(() => {
    if (user) {
      initializeChat();
    }
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

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      Object.values(playingAudio).forEach(async (sound) => {
        try {
          await sound.unloadAsync();
        } catch (error) {
          console.log('Error unloading audio:', error);
        }
      });
    };
  }, [playingAudio]);

  const sendMessage = async (text: string, imageAsset?: ImagePicker.ImagePickerAsset | null) => {
    if ((!text.trim() && !imageAsset) || !currentSession) return;

    const messageText = text.trim();
    const imageToSend = imageAsset || selectedImage;
    
    setInputText('');
    setSelectedImage(null); // Clear selected image
    setIsTyping(true);

    try {
      let response;
      
      if (imageToSend) {
        // Send message with image
        response = await chatService.sendMessageWithImage(
          currentSession._id, 
          messageText || '', 
          imageToSend,
          selectedTemplate?._id
        );
      } else {
        // Send text-only message
        response = await chatService.sendMessage(
          currentSession._id, 
          messageText,
          selectedTemplate?._id
        );
      }
      
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

  const handleVoiceRecord = async () => {
    try {
      if (isRecording && recording) {
        // Stop recording
        console.log('Stopping recording...');
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        
        const uri = recording.getURI();
        console.log('Recording stopped and stored at', uri);
        
        if (uri) {
          setRecordingUri(uri);
          // Process the recorded audio
          await processVoiceRecording(uri);
        }
        
        setRecording(null);
        setRecordingDuration(0);
      } else {
        // Start recording
        console.log('Starting recording...');
        
        // Request permissions
        const permissionResponse = await Audio.requestPermissionsAsync();
        if (permissionResponse.status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow microphone access to record voice messages.');
          return;
        }
        
        // Configure audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        
        // Start recording
        const { recording: newRecording } = await Audio.Recording.createAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });
        
        setRecording(newRecording);
        setIsRecording(true);
        
        // Start duration counter
        const startTime = Date.now();
        const durationInterval = setInterval(() => {
          if (isRecording) {
            setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
          } else {
            clearInterval(durationInterval);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to record voice:', error);
      Alert.alert('Error', 'Failed to record voice message. Please try again.');
      setIsRecording(false);
      setRecording(null);
    }
  };

  const processVoiceRecording = async (uri: string) => {
    try {
      setIsTyping(true);
      
      // For now, we'll send the voice file to the server and let the user add text
      // Later we can implement speech-to-text processing
      
      if (!currentSession) {
        Alert.alert('Error', 'No active chat session found.');
        return;
      }

      // Create FormData to send voice file
      const formData = new FormData();
      formData.append('voice', {
        uri: uri,
        type: 'audio/m4a',
        name: `voice_${Date.now()}.m4a`,
      } as any);
      
      // Add optional text content
      const voiceMessage = inputText.trim() || '';
      if (voiceMessage) {
        formData.append('message', voiceMessage);
      }
      
      formData.append('messageType', voiceMessage ? 'multimodal' : 'voice');

      try {
        // Send voice message
        const response = await chatService.sendMessageWithVoice(currentSession._id, formData);
        
        if (response.success) {
          // Add both user message and AI response to the messages
          const userMessage = response.data.userMessage;
          const aiResponse = response.data.aiResponse;
          
          setMessages(prev => [...prev, userMessage, aiResponse]);
          setInputText('');
          
          // Scroll to bottom
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          throw new Error(response.message || 'Failed to send voice message');
        }
      } catch (apiError) {
        console.error('API Error:', apiError);
        Alert.alert('Error', 'Failed to send voice message. Please try again.');
      }
    } catch (error) {
      console.error('Error processing voice recording:', error);
      Alert.alert('Error', 'Failed to process voice recording.');
    } finally {
      setIsTyping(false);
      setRecordingUri(null);
    }
  };

  const handleImagePicker = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
        return;
      }

      // Show action sheet for image source selection
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              openCamera();
            } else if (buttonIndex === 2) {
              openImageLibrary();
            }
          }
        );
      } else {
        // For Android, show alert
        Alert.alert(
          'Select Image',
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: openCamera },
            { text: 'Choose from Library', onPress: openImageLibrary },
          ]
        );
      }
    } catch (error) {
      console.error('Error accessing image picker:', error);
      Alert.alert('Error', 'Failed to access image picker.');
    }
  };

  const openCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  const openImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error opening image library:', error);
      Alert.alert('Error', 'Failed to open image library.');
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const speakText = async (text: string) => {
    try {
      // Stop any currently playing speech
      if (isPlayingTTS) {
        Speech.stop();
        setIsPlayingTTS(false);
        return;
      }

      setIsPlayingTTS(true);
      
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setIsPlayingTTS(false);
        },
        onStopped: () => {
          setIsPlayingTTS(false);
        },
        onError: (error) => {
          console.error('TTS Error:', error);
          setIsPlayingTTS(false);
        }
      });
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsPlayingTTS(false);
    }
  };

  const playVoiceMessage = async (message: Message) => {
    try {
      const voiceUrl = `${API_BASE_URL}/api/chat/voice/${message.metadata?.voiceFileName}`;
      
      // If already playing this message, pause it
      if (playingMessageId === message._id && playingAudio[message._id]) {
        await playingAudio[message._id].pauseAsync();
        setPlayingMessageId(null);
        return;
      }
      
      // Stop any currently playing audio
      if (playingMessageId && playingAudio[playingMessageId]) {
        await playingAudio[playingMessageId].stopAsync();
        await playingAudio[playingMessageId].unloadAsync();
        delete playingAudio[playingMessageId];
      }
      
      // Create and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true, isLooping: false }
      );
      
      setPlayingAudio(prev => ({ ...prev, [message._id]: sound }));
      setPlayingMessageId(message._id);
      
      // Set up playback status listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingMessageId(null);
          sound.unloadAsync();
          setPlayingAudio(prev => {
            const updated = { ...prev };
            delete updated[message._id];
            return updated;
          });
        }
      });
      
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Playback Error', 'Failed to play voice message');
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
        {/* Show image if present */}
        {message.metadata?.imagePath && (
          <View style={styles.messageImageContainer}>
            <Image 
              source={{ uri: `${API_BASE_URL}/chat/images/${message.metadata.imageFileName}` }}
              style={styles.messageImage}
              onError={() => console.log('Error loading message image')}
            />
          </View>
        )}
        
        {/* Show voice message if present */}
        {message.metadata?.voiceFileName && (
          <View style={styles.voiceMessageContainer}>
            <TouchableOpacity 
              style={[styles.voicePlayButton, { backgroundColor: theme.primary }]}
              onPress={() => playVoiceMessage(message)}
            >
              <Ionicons 
                name={playingMessageId === message._id ? "pause" : "play"} 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>
            <View style={styles.voiceMessageInfo}>
              <Text style={[styles.voiceMessageText, { color: theme.text }]}>
                {playingMessageId === message._id ? 'Playing...' : 'Voice message'}
              </Text>
              <Text style={[styles.voiceMessageDuration, { color: theme.textSecondary }]}>
                {message.metadata.voiceDuration ? `${message.metadata.voiceDuration}s` : 'Unknown duration'}
              </Text>
            </View>
          </View>
        )}
        
        {/* Show text content */}
        {message.content && (
          <Text style={[
            styles.messageText,
            { color: message.isUserMessage ? 'white' : theme.text }
          ]}>
            {message.content}
          </Text>
        )}
        
        {/* Show message type indicator for multimodal messages */}
        {(message.messageType === 'multimodal' || message.messageType === 'image' || message.messageType === 'multimodal_response') && (
          <View style={styles.messageTypeIndicator}>
            <Ionicons 
              name="image" 
              size={12} 
              color={message.isUserMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary} 
            />
            <Text style={[
              styles.messageTypeText,
              { color: message.isUserMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary }
            ]}>
              {message.messageType === 'multimodal_response' ? 'Vision AI' : 'Image'}
            </Text>
          </View>
        )}
        
        {/* Message controls row */}
        <View style={styles.messageControls}>
          <Text style={[
            styles.messageTime,
            { color: message.isUserMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary }
          ]}>
            {new Date(message.timestamp || message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          
          {/* Speak button for AI messages */}
          {!message.isUserMessage && message.content && (
            <TouchableOpacity
              style={[styles.speakButton, { backgroundColor: isPlayingTTS ? theme.error : 'transparent' }]}
              onPress={() => speakText(message.content)}
            >
              <Ionicons 
                name={isPlayingTTS ? "stop" : "volume-high"} 
                size={16} 
                color={isPlayingTTS ? 'white' : theme.textSecondary} 
              />
            </TouchableOpacity>
          )}
        </View>
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
          {/* Image Preview */}
          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <View style={styles.imagePreview}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={removeSelectedImage}
                >
                  <Ionicons name="close-circle" size={24} color={theme.error} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.imagePreviewText, { color: theme.textSecondary }]}>
                Image selected • Add text or send as is
              </Text>
            </View>
          )}
          
          {/* Selected Template Display */}
          {selectedTemplate && (
            <View style={[styles.selectedTemplateContainer, { 
              backgroundColor: theme.surface,
              borderColor: theme.border 
            }]}>
              <View style={styles.selectedTemplateInfo}>
                <Text style={[styles.selectedTemplateName, { color: theme.primary }]}>
                  {selectedTemplate.name}
                </Text>
                <Text style={[styles.selectedTemplateDescription, { color: theme.textSecondary }]}>
                  {selectedTemplate.description}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTemplate(null)}
                style={styles.clearTemplateButton}
              >
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.card, 
                borderColor: isRecording ? theme.error : theme.border,
                color: theme.text,
                maxHeight: 100,
              }]}
              placeholder={
                isRecording 
                  ? `Recording... ${recordingDuration}s`
                  : selectedImage 
                    ? "Describe or ask about this image..." 
                    : selectedTemplate
                      ? `Ask anything with "${selectedTemplate.name}" style...`
                      : "Ask anything..."
              }
              placeholderTextColor={isRecording ? theme.error : theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onSubmitEditing={() => sendMessage(inputText)}
              editable={!isRecording}
            />
            
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() && !selectedImage}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleImagePicker}
            >
              <Ionicons name="image" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { 
                backgroundColor: selectedTemplate ? theme.success : theme.primary 
              }]}
              onPress={() => {
                if (user) {
                  setShowTemplateSelector(true);
                } else {
                  Alert.alert('Authentication Required', 'Please log in to use prompt templates.');
                }
              }}
            >
              <Ionicons 
                name={selectedTemplate ? "document-text" : "document-text-outline"} 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>
            
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

      {/* Prompt Template Selector Modal */}
      <PromptTemplateSelector
        visible={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={(template) => {
          setSelectedTemplate(template);
          setShowTemplateSelector(false);
        }}
        selectedTemplateId={selectedTemplate?._id}
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
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
  imagePreviewContainer: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 12,
  },
  imagePreview: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  imagePreviewText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  messageImageContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  messageTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  messageTypeText: {
    fontSize: 11,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  messageControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  speakButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  voicePlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  voiceMessageInfo: {
    flex: 1,
  },
  voiceMessageText: {
    fontSize: 14,
    fontWeight: 'medium',
  },
  voiceMessageDuration: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedTemplateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedTemplateInfo: {
    flex: 1,
  },
  selectedTemplateName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedTemplateDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  clearTemplateButton: {
    padding: 4,
    marginLeft: 8,
  },
});
