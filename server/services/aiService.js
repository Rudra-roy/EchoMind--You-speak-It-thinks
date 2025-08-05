const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AIService {
  constructor() {
    // Ollama default configuration
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'llava:7b';
    this.isOllamaAvailable = false;
    
    // Initialize and check Ollama availability
    this.initializeOllama();
  }

  async initializeOllama() {
    try {
      await this.checkOllamaStatus();
      console.log('✅ Ollama service is available');
      this.isOllamaAvailable = true;
      
      // Check if the model is available
      await this.ensureModelAvailable();
    } catch (error) {
      console.log('⚠️ Ollama service not available:', error.message);
      console.log('📋 To use local AI:');
      console.log('   1. Install Ollama: https://ollama.ai/');
      console.log('   2. Run: ollama pull llava:7b');
      console.log('   3. Start Ollama service');
      this.isOllamaAvailable = false;
    }
  }

  async checkOllamaStatus() {
    const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`, {
      timeout: 5000
    });
    return response.status === 200;
  }

  async ensureModelAvailable() {
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
      const models = response.data.models || [];
      
      const modelExists = models.some(model => 
        model.name.includes('llava') || model.name === this.defaultModel
      );
      
      if (!modelExists) {
        console.log(`⚠️ Model ${this.defaultModel} not found. Available models:`, 
          models.map(m => m.name));
        console.log('📋 Run: ollama pull llava:7b');
        throw new Error(`Model ${this.defaultModel} not available`);
      }
      
      console.log(`✅ Model ${this.defaultModel} is available`);
    } catch (error) {
      throw new Error(`Failed to check model availability: ${error.message}`);
    }
  }

  async generateTextResponse(prompt, context = []) {
    if (!this.isOllamaAvailable) {
      return this.getFallbackResponse('text');
    }

    try {
      const messages = [
        ...context,
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await axios.post(`${this.ollamaBaseUrl}/api/chat`, {
        model: this.defaultModel,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 1000
        }
      }, {
        timeout: 30000 // 30 seconds timeout
      });

      return {
        success: true,
        content: response.data.message.content,
        model: this.defaultModel,
        type: 'text'
      };
    } catch (error) {
      console.error('Error generating text response:', error.message);
      return this.getFallbackResponse('text', error.message);
    }
  }

  async generateImageCaption(imagePath, customPrompt = null) {
    if (!this.isOllamaAvailable) {
      return this.getFallbackResponse('image');
    }

    try {
      // Read and encode image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = customPrompt || 
        "Please describe this image in detail. Focus on the main subjects, objects, activities, and setting.";

      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, {
        model: this.defaultModel,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.5,
          max_tokens: 500
        }
      }, {
        timeout: 45000 // 45 seconds for image processing
      });

      return {
        success: true,
        content: response.data.response,
        model: this.defaultModel,
        type: 'image_caption'
      };
    } catch (error) {
      console.error('Error generating image caption:', error.message);
      return this.getFallbackResponse('image', error.message);
    }
  }

  async answerImageQuestion(imagePath, question, previousContext = []) {
    if (!this.isOllamaAvailable) {
      return this.getFallbackResponse('image_qa');
    }

    try {
      // Read and encode image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const contextPrompt = previousContext.length > 0 
        ? `Previous context: ${previousContext.join(' ')} \n\n`
        : '';

      const prompt = `${contextPrompt}Looking at this image, please answer the following question: ${question}`;

      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, {
        model: this.defaultModel,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.6,
          max_tokens: 800
        }
      }, {
        timeout: 45000
      });

      return {
        success: true,
        content: response.data.response,
        model: this.defaultModel,
        type: 'image_qa'
      };
    } catch (error) {
      console.error('Error answering image question:', error.message);
      return this.getFallbackResponse('image_qa', error.message);
    }
  }

  async streamResponse(prompt, imagePath = null, onChunk = null) {
    if (!this.isOllamaAvailable) {
      return this.getFallbackResponse('stream');
    }

    try {
      const payload = {
        model: this.defaultModel,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.7
        }
      };

      if (imagePath) {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        payload.images = [base64Image];
      }

      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, payload, {
        responseType: 'stream',
        timeout: 60000
      });

      let fullResponse = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                if (onChunk) {
                  onChunk(data.response);
                }
              }
              
              if (data.done) {
                resolve({
                  success: true,
                  content: fullResponse,
                  model: this.defaultModel,
                  type: 'stream'
                });
              }
            }
          } catch (parseError) {
            console.error('Error parsing stream chunk:', parseError);
          }
        });

        response.data.on('error', (error) => {
          reject(error);
        });

        response.data.on('end', () => {
          if (fullResponse) {
            resolve({
              success: true,
              content: fullResponse,
              model: this.defaultModel,
              type: 'stream'
            });
          }
        });
      });
    } catch (error) {
      console.error('Error in stream response:', error.message);
      return this.getFallbackResponse('stream', error.message);
    }
  }

  getFallbackResponse(type, error = null) {
    const fallbackResponses = {
      text: "I'm currently offline. Please ensure Ollama is running with the LLaVA model installed.",
      image: "I'm unable to analyze images right now. Please check that Ollama is running with the LLaVA model.",
      image_qa: "I can't answer questions about images at the moment. Please verify Ollama setup.",
      stream: "Streaming is unavailable. Please check Ollama service status."
    };

    return {
      success: false,
      content: fallbackResponses[type] || "AI service is currently unavailable.",
      error: error,
      model: 'fallback',
      type: type
    };
  }

  async getModelInfo() {
    try {
      if (!this.isOllamaAvailable) {
        return { available: false, models: [] };
      }

      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
      return {
        available: true,
        models: response.data.models || [],
        currentModel: this.defaultModel,
        ollamaUrl: this.ollamaBaseUrl
      };
    } catch (error) {
      return { 
        available: false, 
        error: error.message,
        models: [] 
      };
    }
  }

  // Utility method to check if service is ready
  isReady() {
    return this.isOllamaAvailable;
  }
}

module.exports = new AIService();
