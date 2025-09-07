const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE_URL = 'http://localhost:8000';
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpass123',
  name: 'Test User'
};

class AITestSuite {
  constructor() {
    this.token = null;
    this.sessionId = null;
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'INFO',
      success: 'SUCCESS',
      error: 'ERROR',
      warning: 'WARNING'
    };
    console.log(`[${prefix[type]}] [${timestamp}] ${message}`);
  }

  async runTests() {
    await this.log('Starting EchoMind AI Test Suite');
    console.log('=====================================\n');

    try {
      // Test 1: Check server health
      await this.testServerHealth();

      // Test 2: Check AI health
      await this.testAIHealth();

      // Test 3: Authenticate user
      await this.authenticateUser();

      // Test 4: Create chat session
      await this.createChatSession();

      // Test 5: Test text chat
      await this.testTextChat();

      // Test 6: Test AI direct endpoints
      await this.testAIEndpoints();

      await this.log('All tests completed successfully!', 'success');

    } catch (error) {
      await this.log(`Test suite failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async testServerHealth() {
    await this.log('Testing server health...');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/`);
      
      if (response.status === 200 && response.data.message) {
        await this.log('Server is running and healthy', 'success');
        await this.log(`Server message: ${response.data.message}`);
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      throw new Error(`Server is not accessible: ${error.message}`);
    }
  }

  async testAIHealth() {
    await this.log('Testing AI service health...');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/ai/health`);
      
      await this.log(`AI Health Status: ${response.data.status}`);
      
      if (response.data.success) {
        await this.log('AI service is healthy', 'success');
        if (response.data.data?.models?.length > 0) {
          await this.log(`Available models: ${response.data.data.models.map(m => m.name).join(', ')}`);
        }
      } else {
        await this.log('AI service is not available - tests will continue with fallback responses', 'warning');
      }
    } catch (error) {
      await this.log(`AI health check failed: ${error.message}`, 'warning');
      await this.log('This is normal if Ollama is not installed - AI will use fallback responses', 'warning');
    }
  }

  async authenticateUser() {
    await this.log('Authenticating test user...');
    
    try {
      // Try to register user (in case they don't exist)
      try {
        await axios.post(`${API_BASE_URL}/api/auth/register`, TEST_USER);
        await this.log('Test user registered');
      } catch (regError) {
        // User might already exist, that's okay
        await this.log('User may already exist, trying login...');
      }

      // Login
      const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
      });

      if (loginResponse.data.success && loginResponse.data.token) {
        this.token = loginResponse.data.token;
        await this.log('Authentication successful', 'success');
        await this.log(`User: ${loginResponse.data.user.name} (${loginResponse.data.user.email})`);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      throw new Error(`Authentication error: ${error.message}`);
    }
  }

  async createChatSession() {
    await this.log('Creating chat session...');
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/chat/sessions`,
        { title: 'AI Test Session' },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      if (response.data.success && response.data.data._id) {
        this.sessionId = response.data.data._id;
        await this.log('Chat session created successfully', 'success');
        await this.log(`Session ID: ${this.sessionId}`);
      } else {
        throw new Error('Failed to create chat session');
      }
    } catch (error) {
      throw new Error(`Chat session creation failed: ${error.message}`);
    }
  }

  async testTextChat() {
    await this.log('Testing text chat with AI...');
    
    try {
      const testMessage = "Hello AI! Can you tell me a short joke?";
      
      const response = await axios.post(
        `${API_BASE_URL}/api/chat/sessions/${this.sessionId}/messages`,
        {
          content: testMessage,
          messageType: 'text'
        },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      if (response.data.success) {
        await this.log('Text chat successful', 'success');
        await this.log(`User message: ${testMessage}`);
        await this.log(`AI response: ${response.data.data.aiResponse.content}`);
        
        if (response.data.data.aiResponse.metadata?.aiModel) {
          await this.log(`AI Model used: ${response.data.data.aiResponse.metadata.aiModel}`);
        }
      } else {
        throw new Error('Text chat failed');
      }
    } catch (error) {
      throw new Error(`Text chat test failed: ${error.message}`);
    }
  }

  async testAIEndpoints() {
    await this.log('Testing direct AI endpoints...');
    
    try {
      // Test direct text endpoint
      const textResponse = await axios.post(
        `${API_BASE_URL}/api/ai/text`,
        {
          message: "What is the capital of France?",
          sessionId: this.sessionId
        },
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      if (textResponse.data.success) {
        await this.log('Direct text AI endpoint working', 'success');
        await this.log(`Response: ${textResponse.data.data.response}`);
      } else {
        await this.log('Direct text AI endpoint returned fallback response', 'warning');
        await this.log(`Response: ${textResponse.data.data?.response || 'No response'}`);
      }

      // Test AI status endpoint
      const statusResponse = await axios.get(
        `${API_BASE_URL}/api/ai/status`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );

      if (statusResponse.data.success) {
        await this.log('AI status endpoint working', 'success');
        await this.log(`AI Ready: ${statusResponse.data.data.isReady}`);
        await this.log(`Models available: ${statusResponse.data.data.available}`);
      }

    } catch (error) {
      await this.log(`AI endpoints test failed: ${error.message}`, 'warning');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new AITestSuite();
  testSuite.runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = AITestSuite;
