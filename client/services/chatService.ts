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
  messageType: 'text' | 'voice' | 'system' | 'image' | 'multimodal' | 'multimodal_response';
  metadata: {
    voiceData?: string;
    voiceFileName?: string;
    voiceOriginalName?: string;
    voiceSize?: number;
    voiceMimeType?: string;
    voiceDuration?: number;
    processingTime?: number;
    aiModel?: string;
    imagePath?: string;
    imageFileName?: string;
    imageOriginalName?: string;
    imageSize?: number;
    imageMimeType?: string;
    hasImageInput?: boolean;
    responseType?: string;
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

  async sendMessage(
    sessionId: string, 
    content: string, 
    promptTemplateId?: string,
    messageType: 'text' | 'voice' = 'text'
  ): Promise<{ userMessage: Message; aiResponse: Message }> {
    try {
      const headers = await this.getAuthHeaders();
      const payload: any = { content, messageType };
      if (promptTemplateId) {
        payload.promptTemplateId = promptTemplateId;
      }
      
      const response = await axios.post(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, 
        payload, 
        { headers }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendMessageWithImage(
    sessionId: string, 
    content: string, 
    imageAsset: any,
    promptTemplateId?: string,
    messageType: 'multimodal' | 'image' = 'multimodal'
  ): Promise<{ userMessage: Message; aiResponse: Message }> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('content', content);
      formData.append('messageType', messageType);
      if (promptTemplateId) {
        formData.append('promptTemplateId', promptTemplateId);
      }
      
      // Add image file
      const imageFile = {
        uri: imageAsset.uri,
        type: imageAsset.mimeType || 'image/jpeg',
        name: imageAsset.fileName || `image_${Date.now()}.jpg`,
      } as any;
      
      formData.append('image', imageFile);
      
      // Update headers for multipart form data
      const multipartHeaders = {
        ...headers,
        'Content-Type': 'multipart/form-data',
      };
      
      const response = await axios.post(
        `${API_BASE_URL}/chat/sessions/${sessionId}/messages`, 
        formData,
        { headers: multipartHeaders }
      );
      
      return response.data.data;
    } catch (error) {
      console.error('Error sending message with image:', error);
      throw error;
    }
  }

  async sendMessageWithVoice(sessionId: string, formData: FormData): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      
      // Update headers for multipart form data
      const multipartHeaders = {
        ...headers,
        'Content-Type': 'multipart/form-data',
      };
      
      const response = await axios.post(
        `${API_BASE_URL}/chat/sessions/${sessionId}/messages`, 
        formData,
        { headers: multipartHeaders }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error sending message with voice:', error);
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
