const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const speech = require('@google-cloud/speech');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const execAsync = promisify(exec);

// Check if whisper CLI is available
let whisper = null;
(async () => {
  try {
    await execAsync('whisper --help', { timeout: 5000 });
    whisper = true;
    console.log('Whisper CLI available for speech-to-text');
  } catch (error) {
    console.log('Whisper CLI not available:', error.message);
  }
})();

class AIService {
  constructor() {
    // Gemini API configuration
    this.useGemini = process.env.USE_GEMINI === 'true' || true; // Default to Gemini
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.isGeminiAvailable = false;
    this.genAI = null;
    
    // Ollama fallback configuration (keep for backward compatibility)
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.textModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    this.visionModel = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';
    this.isOllamaAvailable = false;
    
    // Speech-to-Text client initialization
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        this.speechClient = new speech.SpeechClient({
          apiKey: apiKey,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'echomind-speech'
        });
        console.log('Speech-to-Text client initialized with API key');
      } catch (error) {
        console.log('Speech-to-Text client initialization failed:', error.message);
        this.speechClient = null;
      }
    } else {
      console.log('No Google API key found for Speech-to-Text');
      this.speechClient = null;
    }
    
    // Initialize AI service
    this.initializeAI();
  }

  async initializeAI() {
    if (this.useGemini) {
      await this.initializeGemini();
    } else {
      await this.initializeOllama();
    }
  }

  async initializeGemini() {
    try {
      // Check if we have an API key
      if (!this.geminiApiKey) {
        throw new Error('No Gemini API key found in environment variables');
      }

      // Initialize the Google AI SDK
      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      
      // Test the connection by getting a model
      const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
      
      // Test with a simple prompt
      const result = await model.generateContent("Hello");
      if (result.response) {
        console.log('Gemini API is working');
        console.log(`Using model: ${this.geminiModel}`);
        this.isGeminiAvailable = true;
      } else {
        throw new Error('No response from Gemini API');
      }
      
    } catch (error) {
      console.log('Gemini API not available:', error.message);
      console.log('To use Gemini API:');
      console.log('   1. Set GEMINI_API_KEY environment variable');
      console.log('   2. Make sure you have a valid Google AI API key');
      console.log('   3. Falling back to Ollama if available...');
      
      // Fallback to Ollama
      this.useGemini = false;
      await this.initializeOllama();
    }
  }

  async initializeOllama() {
    try {
      await this.checkOllamaStatus();
      console.log('Ollama service is available');
      this.isOllamaAvailable = true;
      
      // Check if the model is available
      await this.ensureModelAvailable();
    } catch (error) {
      console.log('Ollama service not available:', error.message);
      console.log('To use local AI:');
      console.log('   1. Install Ollama: https://ollama.ai/');
      console.log('   2. Run: ollama pull llama3.2:3b');
      console.log('   3. Run: ollama pull llama3.2-vision');
      console.log('   4. Start Ollama service');
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
      
      const textModelExists = models.some(model => 
        model.name.includes(this.textModel.split(':')[0]) || model.name === this.textModel
      );
      
      const visionModelExists = models.some(model => 
        model.name.includes(this.visionModel.split(':')[0]) || model.name === this.visionModel
      );
      
      if (!textModelExists) {
        console.log(`Text model ${this.textModel} not found. Available models:`, 
          models.map(m => m.name));
        console.log(`Run: ollama pull ${this.textModel}`);
        throw new Error(`Text model ${this.textModel} not available`);
      }
      
      if (!visionModelExists) {
        console.log(`Vision model ${this.visionModel} not found. Image processing will be limited.`);
        console.log(`For image support, run: ollama pull ${this.visionModel}`);
      }
      
      console.log(`Text model ${this.textModel} is available`);
      if (visionModelExists) {
        console.log(`Vision model ${this.visionModel} is available`);
      }
    } catch (error) {
      throw new Error(`Failed to check model availability: ${error.message}`);
    }
  }

  // Ollama AI Methods
  async generateOllamaTextResponse(prompt, context = []) {
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
        model: this.textModel,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048, // Reduced for memory efficiency
          num_ctx: 8192 // Reduced context window to fit memory
        }
      }, {
        timeout: 60000 // Increased timeout for longer responses
      });

      return {
        success: true,
        content: response.data.message.content,
        model: this.textModel,
        type: 'text'
      };
    } catch (error) {
      console.error('Error generating text response:', error.message);
      return this.getFallbackResponse('text', error.message);
    }
  }

  async generateOllamaImageCaption(imagePath, customPrompt = null) {
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
        model: this.visionModel,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.5,
          num_predict: 1024, // Reduced for memory efficiency
          num_ctx: 4096 // Reduced context for vision model
        }
      }, {
        timeout: 90000 // Increased timeout for image processing
      });

      return {
        success: true,
        content: response.data.response,
        model: this.visionModel,
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
        model: this.visionModel,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.6,
          num_predict: 1536, // Reduced for memory efficiency
          num_ctx: 4096 // Reduced context
        }
      }, {
        timeout: 90000
      });

      return {
        success: true,
        content: response.data.response,
        model: this.visionModel,
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
      const modelToUse = imagePath ? this.visionModel : this.textModel;
      
      const payload = {
        model: modelToUse,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 2048, // Reduced for streaming
          num_ctx: 8192 // Reduced context for memory
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
                  model: modelToUse,
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
              model: modelToUse,
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

  // Gemini AI Methods
  async generateGeminiTextResponse(prompt, context = []) {
    try {
      if (!this.genAI) {
        throw new Error('Gemini API not initialized');
      }

      const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
      
      console.log('Generating response with Gemini API...');
      console.log('� Prompt:', prompt.substring(0, 100) + '...');
      
      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const executionTime = Date.now() - startTime;
      
      const response = result.response;
      const text = response.text();
      
      console.log('Gemini API response generated in', executionTime + 'ms');
      console.log('📤 Response length:', text.length);
      
      return {
        success: true,
        content: text,
        model: this.geminiModel,
        type: 'text'
      };
    } catch (error) {
      console.error('Error in generateGeminiTextResponse:', error.message);
      return this.getFallbackResponse('text', error.message);
    }
  }

  async generateGeminiMultimodalResponse(prompt, imagePath = null, context = []) {
    try {
      if (!imagePath) {
        // If no image, use text generation
        return await this.generateGeminiTextResponse(prompt, context);
      }

      if (!this.genAI) {
        throw new Error('Gemini API not initialized');
      }

      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      console.log('Processing image with Gemini API:', imagePath);
      
      // Read and encode image
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeType(imagePath);
      
      const model = this.genAI.getGenerativeModel({ model: this.geminiModel });
      
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const startTime = Date.now();
      const result = await model.generateContent([prompt, imagePart]);
      const executionTime = Date.now() - startTime;
      
      const response = result.response;
      const text = response.text();
      
      console.log('Gemini multimodal response generated in', executionTime + 'ms');
      
      return {
        success: true,
        content: text,
        model: this.geminiModel,
        type: 'multimodal',
        hasImage: true
      };
      
    } catch (error) {
      console.error('Error generating Gemini multimodal response:', error.message);
      return this.getFallbackResponse(imagePath ? 'image' : 'text', error.message);
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  // Main generation methods (will route to appropriate AI service)
  async generateTextResponse(prompt, context = []) {
    if (this.useGemini && this.isGeminiAvailable) {
      return await this.generateGeminiTextResponse(prompt, context);
    } else if (this.isOllamaAvailable) {
      return await this.generateOllamaTextResponse(prompt, context);
    } else {
      return this.getFallbackResponse('text');
    }
  }

  async generateMultimodalResponse(prompt, imagePath = null, context = []) {
    if (this.useGemini && this.isGeminiAvailable) {
      return await this.generateGeminiMultimodalResponse(prompt, imagePath, context);
    } else if (this.isOllamaAvailable) {
      return await this.generateOllamaMultimodalResponse(prompt, imagePath, context);
    } else {
      return this.getFallbackResponse(imagePath ? 'image' : 'text');
    }
  }

  // Prompt Template Methods
  applyPromptTemplate(userPrompt, templateText) {
    if (!templateText || templateText.trim() === '') {
      return userPrompt;
    }

    // If the template contains placeholders, replace them
    if (templateText.includes('{user_prompt}') || templateText.includes('{prompt}')) {
      return templateText
        .replace('{user_prompt}', userPrompt)
        .replace('{prompt}', userPrompt);
    }

    // Otherwise, append the user prompt to the template
    return `${templateText}\n\nUser Query: ${userPrompt}`;
  }

  async generateTemplatedResponse(prompt, templateText = null, imagePath = null, context = []) {
    try {
      // Apply template if provided
      const finalPrompt = templateText ? this.applyPromptTemplate(prompt, templateText) : prompt;
      
      console.log('Using prompt template:', templateText ? 'Yes' : 'No');
      if (templateText) {
        console.log('Template preview:', templateText.substring(0, 100) + '...');
      }

      // Use the appropriate generation method based on whether we have an image
      if (imagePath) {
        return await this.generateMultimodalResponse(finalPrompt, imagePath, context);
      } else {
        return await this.generateTextResponse(finalPrompt, context);
      }
    } catch (error) {
      console.error('Error in templated response generation:', error.message);
      return this.getFallbackResponse('text', error.message);
    }
  }

  getFallbackResponse(type, error = null) {
    const fallbackResponses = {
      text: "I'm currently offline. Please ensure Ollama is running with Llama 3.2 3B model installed.",
      image: "I'm unable to analyze images right now. Please check that Ollama is running with Llama 3.2 Vision model.",
      image_qa: "I can't answer questions about images at the moment. Please verify Llama 3.2 Vision model is available.",
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
    if (this.isGeminiAvailable) {
      return {
        available: true,
        activeService: 'Gemini',
        model: this.geminiModel,
        command: this.geminiCommand
      };
    } else if (this.isOllamaAvailable) {
      try {
        const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
        return {
          available: true,
          activeService: 'Ollama',
          models: response.data.models || [],
          textModel: this.textModel,
          visionModel: this.visionModel,
          ollamaUrl: this.ollamaBaseUrl
        };
      } catch (error) {
        return { 
          available: false, 
          error: error.message,
          models: [] 
        };
      }
    } else {
      return { 
        available: false, 
        error: 'No AI service available',
        models: [] 
      };
    }
  }

  // Utility method to check if service is ready
  isReady() {
    return this.isGeminiAvailable || this.isOllamaAvailable;
  }

  // Get current AI service info
  getCurrentService() {
    return {
      useGemini: this.useGemini,
      isGeminiAvailable: this.isGeminiAvailable,
      isOllamaAvailable: this.isOllamaAvailable,
      activeService: this.isGeminiAvailable ? 'Gemini' : (this.isOllamaAvailable ? 'Ollama' : 'None'),
      model: this.isGeminiAvailable ? this.geminiModel : (this.isOllamaAvailable ? this.textModel : 'none')
    };
  }

  // Speech-to-Text functionality
  async transcribeAudio(audioFilePath) {
    try {
      console.log('🎤 Starting speech-to-text transcription for:', audioFilePath);
      
      // Check if the audio file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }
      
      // Try Google Cloud Speech-to-Text first
      if (this.speechClient) {
        try {
          const cloudResult = await this.transcribeWithGoogleCloud(audioFilePath);
          if (cloudResult.success) {
            console.log('Google Cloud transcription successful:', cloudResult.transcription);
            return cloudResult;
          }
        } catch (error) {
          console.log('Google Cloud Speech-to-Text failed:', error.message);
        }
      }

      // Try local Whisper as fallback
      if (whisper) {
        try {
          console.log('🔄 Trying local Whisper transcription...');
          const whisperResult = await this.transcribeWithLocalWhisper(audioFilePath);
          if (whisperResult.success) {
            console.log('Local Whisper transcription successful:', whisperResult.transcription);
            return whisperResult;
          }
        } catch (error) {
          console.log('Local Whisper failed:', error.message);
        }
      }

      // If no transcription methods are available, return error
      console.log('No speech-to-text methods available');
      return {
        success: false,
        error: 'Speech-to-text services not available. Please enable Google Cloud Speech API or install Whisper.',
        transcription: null
      };

    } catch (error) {
      console.error('Speech-to-text error:', error);
      return {
        success: false,
        error: error.message,
        transcription: null
      };
    }
  }

  async getAudioInfo(audioFilePath) {
    try {
      // Use ffprobe to get audio information
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${audioFilePath}"`);
      const info = JSON.parse(stdout);
      
      const audioStream = info.streams.find(stream => stream.codec_type === 'audio');
      const duration = parseFloat(info.format.duration) || 0;
      
      console.log(`Audio info: ${Math.round(duration)}s, ${audioStream?.codec_name || 'unknown'} codec`);
      
      return {
        duration: Math.round(duration),
        codec: audioStream?.codec_name || 'unknown',
        bitrate: audioStream?.bit_rate || 'unknown',
        sampleRate: audioStream?.sample_rate || 'unknown'
      };
    } catch (error) {
      console.log('Could not extract audio info:', error.message);
      return {
        duration: 0,
        codec: 'unknown',
        bitrate: 'unknown',
        sampleRate: 'unknown'
      };
    }
  }

  async transcribeWithGoogleCloud(audioFilePath) {
    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Configure the request
    const request = {
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: {
        encoding: 'WEBM_OPUS', // Default for mobile recordings
        sampleRateHertz: 48000, // Common for mobile devices
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long', // Use the latest long-form model
      },
    };

    // Alternative encodings to try if the first one fails
    const alternativeConfigs = [
      { encoding: 'OGG_OPUS', sampleRateHertz: 48000 },
      { encoding: 'WEBM_OPUS', sampleRateHertz: 16000 },
      { encoding: 'MP3', sampleRateHertz: 44100 },
      { encoding: 'LINEAR16', sampleRateHertz: 16000 },
    ];

    let transcription = null;
    let lastError = null;

    // Try the default config first
    try {
      const [response] = await this.speechClient.recognize(request);
      if (response.results && response.results.length > 0) {
        transcription = response.results
          .map(result => result.alternatives[0].transcript)
          .join(' ');
      }
    } catch (error) {
      console.log('Default config failed, trying alternatives...', error.message);
      lastError = error;
    }

    // If default failed, try alternative configurations
    if (!transcription) {
      for (const altConfig of alternativeConfigs) {
        try {
          console.log(`🔄 Trying alternative config: ${altConfig.encoding} @ ${altConfig.sampleRateHertz}Hz`);
          const altRequest = {
            ...request,
            config: {
              ...request.config,
              ...altConfig,
            },
          };
          
          const [response] = await this.speechClient.recognize(altRequest);
          if (response.results && response.results.length > 0) {
            transcription = response.results
              .map(result => result.alternatives[0].transcript)
              .join(' ');
            console.log(`Successful transcription with ${altConfig.encoding}`);
            break;
          }
        } catch (error) {
          console.log(`${altConfig.encoding} failed:`, error.message);
          lastError = error;
        }
      }
    }

    if (!transcription) {
      console.log('All transcription attempts failed');
      throw lastError || new Error('Failed to transcribe audio with all available configurations');
    }

    console.log('Transcription successful:', transcription);
    return {
      success: true,
      transcription: transcription.trim(),
      processingTime: Date.now(),
    };
  }

  async transcribeWithLocalWhisper(audioFilePath) {
    try {
      console.log('🤖 Using local Whisper CLI for transcription...');
      
      // Use the whisper CLI directly
      const outputDir = path.dirname(audioFilePath);
      const command = `whisper "${audioFilePath}" --model base --language en --task transcribe --output_format txt --output_dir "${outputDir}" --verbose False`;
      
      console.log('🔄 Running Whisper command:', command);
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      
      // Whisper creates a .txt file with the same name as the audio file
      const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
      const transcriptPath = path.join(outputDir, `${baseName}.txt`);
      
      if (fs.existsSync(transcriptPath)) {
        const transcription = fs.readFileSync(transcriptPath, 'utf8').trim();
        
        // Clean up the transcript file
        fs.unlinkSync(transcriptPath);
        
        if (transcription && transcription.length > 0) {
          console.log('Local Whisper transcription successful:', transcription);
          return {
            success: true,
            transcription: transcription,
            processingTime: Date.now(),
            method: 'local-whisper-cli'
          };
        } else {
          throw new Error('Empty transcription result');
        }
      } else {
        throw new Error('Whisper output file not found');
      }
      
    } catch (error) {
      console.log('Local Whisper transcription failed:', error.message);
      return {
        success: false,
        error: error.message,
        transcription: null
      };
    }
  }
}

module.exports = new AIService();
