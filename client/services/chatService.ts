import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/config/network';

const API_BASE_URL = getApiBaseUrl();

export interface ChatSession {
  _id: string;
  user: string;
  title: string;
  isActive: boolean;
  lastActivity: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  session: string;
  user: string;
  content: string;
  isUserMessage: boolean;
  messageType: 'text' | 'voice' | 'system';
  metadata: {
    voiceData?: string;
    processingTime?: number;
    aiModel?: string;
  };
  timestamp: string;
  isEdited: boolean;
  editHistory: Array<{
    content: string;
    editedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

class ChatService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getSessions(): Promise<ChatSession[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/chat/sessions`, { headers });
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      throw error;
    }
  }

  async createSession(title?: string): Promise<ChatSession> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/chat/sessions`, 
        { title }, 
        { headers }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<{ session: ChatSession; messages: Message[] }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/chat/sessions/${sessionId}`, { headers });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching chat session:', error);
      throw error;
    }
  }

  async sendMessage(sessionId: string, content: string, messageType: 'text' | 'voice' = 'text'): Promise<{ userMessage: Message; aiResponse: Message }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, 
        { content, messageType }, 
        { headers }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      await axios.delete(`${API_BASE_URL}/chat/sessions/${sessionId}`, { headers });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }

  async getLatestMessages(limit: number = 20): Promise<Message[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/chat/messages/latest?limit=${limit}`, { headers });
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching latest messages:', error);
      throw error;
    }
  }
}

export default new ChatService();
