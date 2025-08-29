import { API_ENDPOINTS } from '../config/network';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PromptTemplate {
  _id: string;
  name: string;
  description: string;
  template: string;
  category: 'educational' | 'technical' | 'creative' | 'professional' | 'casual' | 'accessibility' | 'custom';
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
  isSystemTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateResponse {
  success: boolean;
  data: {
    templates: PromptTemplate[];
    categorized: {
      system: PromptTemplate[];
      custom: PromptTemplate[];
      byCategory: {
        [key: string]: PromptTemplate[];
      };
    };
    total: number;
  };
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  template: string;
  category: PromptTemplate['category'];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

class PromptTemplateService {
  private baseUrl = API_ENDPOINTS.PROMPT_TEMPLATES;

  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Get all prompt templates
  async getTemplates(): Promise<PromptTemplateResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      throw error;
    }
  }

  // Get a specific template
  async getTemplate(id: string): Promise<{ success: boolean; data: PromptTemplate }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching prompt template:', error);
      throw error;
    }
  }

  // Create a new template
  async createTemplate(templateData: CreateTemplateRequest): Promise<{ success: boolean; data: PromptTemplate }> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating prompt template:', error);
      throw error;
    }
  }

  // Update a template
  async updateTemplate(id: string, templateData: UpdateTemplateRequest): Promise<{ success: boolean; data: PromptTemplate }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating prompt template:', error);
      throw error;
    }
  }

  // Delete a template
  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting prompt template:', error);
      throw error;
    }
  }

  // Use a template (increment usage count)
  async useTemplate(id: string): Promise<{ success: boolean; data: { templateId: string; usageCount: number; template: string } }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/use`, {
        method: 'POST',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error using prompt template:', error);
      throw error;
    }
  }

  // Duplicate a template
  async duplicateTemplate(id: string): Promise<{ success: boolean; data: PromptTemplate }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/duplicate`, {
        method: 'POST',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error duplicating prompt template:', error);
      throw error;
    }
  }

  // Get templates by category
  getTemplatesByCategory(templates: PromptTemplate[], category: string): PromptTemplate[] {
    return templates.filter(template => template.category === category);
  }

  // Get most used templates
  getMostUsedTemplates(templates: PromptTemplate[], limit: number = 5): PromptTemplate[] {
    return templates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  // Search templates
  searchTemplates(templates: PromptTemplate[], searchTerm: string): PromptTemplate[] {
    const term = searchTerm.toLowerCase();
    return templates.filter(template =>
      template.name.toLowerCase().includes(term) ||
      template.description.toLowerCase().includes(term) ||
      template.template.toLowerCase().includes(term)
    );
  }
}

export default new PromptTemplateService();
