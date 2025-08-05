#!/bin/bash

# EchoMind AI Setup Script
# This script helps set up Ollama with LLaVA for local AI integration

echo "🚀 EchoMind AI Setup Script"
echo "========================================="
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Ollama is running
check_ollama_running() {
    curl -s http://localhost:11434/api/tags >/dev/null 2>&1
}

# Check operating system
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

echo "Detected OS: $OS"
echo ""

# Step 1: Check if Ollama is installed
echo "Step 1: Checking Ollama installation..."
if command_exists ollama; then
    echo "✅ Ollama is already installed"
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
    echo "   Version: $OLLAMA_VERSION"
else
    echo "❌ Ollama is not installed"
    echo ""
    echo "Please install Ollama first:"
    
    if [[ "$OS" == "linux" ]]; then
        echo "   Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    elif [[ "$OS" == "macos" ]]; then
        echo "   macOS: Download from https://ollama.ai/"
        echo "   Or via Homebrew: brew install ollama"
    elif [[ "$OS" == "windows" ]]; then
        echo "   Windows: Download from https://ollama.ai/"
    else
        echo "   Visit: https://ollama.ai/"
    fi
    
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo ""

# Step 2: Check if Ollama service is running
echo "Step 2: Checking Ollama service..."
if check_ollama_running; then
    echo "✅ Ollama service is running"
else
    echo "❌ Ollama service is not running"
    echo ""
    echo "Starting Ollama service..."
    
    # Try to start Ollama
    if [[ "$OS" == "linux" ]] || [[ "$OS" == "macos" ]]; then
        echo "   Starting with: ollama serve"
        echo "   Note: This will run in the background"
        ollama serve &
        OLLAMA_PID=$!
        
        # Wait a moment for service to start
        sleep 5
        
        if check_ollama_running; then
            echo "✅ Ollama service started successfully"
        else
            echo "❌ Failed to start Ollama service"
            echo "   Please start manually: ollama serve"
            exit 1
        fi
    else
        echo "   Please start Ollama manually on Windows"
        echo "   Usually: Start the Ollama application"
        exit 1
    fi
fi

echo ""

# Step 3: Check available models
echo "Step 3: Checking available models..."
MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if echo "$MODELS" | grep -q "llava"; then
    echo "✅ LLaVA model is available"
    echo "   Found models with 'llava':"
    echo "$MODELS" | grep llava | sed 's/^/   - /'
else
    echo "❌ LLaVA model not found"
    echo ""
    echo "Available models:"
    if [ -n "$MODELS" ]; then
        echo "$MODELS" | sed 's/^/   - /'
    else
        echo "   No models installed"
    fi
    echo ""
    echo "Installing LLaVA model (this may take several minutes)..."
    echo "   Running: ollama pull llava:7b"
    
    ollama pull llava:7b
    
    if [ $? -eq 0 ]; then
        echo "✅ LLaVA model installed successfully"
    else
        echo "❌ Failed to install LLaVA model"
        echo "   Please try manually: ollama pull llava:7b"
        exit 1
    fi
fi

echo ""

# Step 4: Test the model
echo "Step 4: Testing LLaVA model..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate -d '{
  "model": "llava:7b",
  "prompt": "Hello, can you see me?",
  "stream": false
}' | grep -o '"response":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_RESPONSE" ] && [ "$TEST_RESPONSE" != "null" ]; then
    echo "✅ LLaVA model is working"
    echo "   Test response: $TEST_RESPONSE"
else
    echo "❌ LLaVA model test failed"
    echo "   Please check the model installation"
fi

echo ""

# Step 5: Provide configuration info
echo "Step 5: Configuration Information"
echo "=================================="
echo ""
echo "Your EchoMind server is configured to use:"
echo "   Ollama URL: http://localhost:11434"
echo "   Model: llava:7b"
echo ""
echo "Environment variables (already set in .env):"
echo "   OLLAMA_BASE_URL=http://localhost:11434"
echo "   OLLAMA_MODEL=llava:7b"
echo ""

# Step 6: Final recommendations
echo "Step 6: Next Steps"
echo "=================="
echo ""
echo "1. Keep Ollama running in the background:"
echo "   Linux/macOS: ollama serve"
echo "   Windows: Keep Ollama app running"
echo ""
echo "2. Start your EchoMind server:"
echo "   cd server && npm start"
echo ""
echo "3. Test AI functionality:"
echo "   - Send a text message in the app"
echo "   - Try image upload and captioning"
echo "   - Use the /api/ai/health endpoint"
echo ""
echo "4. Monitor model performance:"
echo "   - First requests may be slower (model loading)"
echo "   - Subsequent requests should be faster"
echo ""

# Optional: Model recommendations
echo "Optional Model Alternatives:"
echo "============================"
echo ""
echo "For different performance/quality trade-offs:"
echo "   llava:7b     - Good balance (default)"
echo "   llava:13b    - Better quality, more resources"
echo "   llava:34b    - Best quality, high resources"
echo ""
echo "To switch models:"
echo "   1. ollama pull <model-name>"
echo "   2. Update OLLAMA_MODEL in .env file"
echo "   3. Restart server"
echo ""

echo "🎉 Setup complete! Your local AI is ready to use."
echo ""
echo "Need help? Check the README or visit:"
echo "   - Ollama: https://ollama.ai/"
echo "   - LLaVA: https://llava-vl.github.io/"
