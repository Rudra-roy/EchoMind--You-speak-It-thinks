import { Platform } from 'react-native';

/**
 * Network configuration for different platforms
 * This file centralizes all network-related configuration
 */

export const NETWORK_CONFIG = {
  // Your computer's local IP address - update this when your IP changes
  LOCAL_IP: '192.168.0.111', // Updated to match current IP
  // LOCAL_IP: '10.217.194.62', // Updated to match current IP

  
  // Server port
  SERVER_PORT: 8000,
  
  // Development mode flag
  DEV_MODE: __DEV__,
};

/**
 * Get the appropriate API base URL based on the platform
 * @returns {string} The API base URL
 */
export const getApiBaseUrl = (): string => {
  const { LOCAL_IP, SERVER_PORT } = NETWORK_CONFIG;
  
  if (Platform.OS === 'android') {
    // Android devices need to use the computer's IP address
    return `http://${LOCAL_IP}:${SERVER_PORT}/api`;
  } else if (Platform.OS === 'web') {
    // Web can use localhost
    return `http://localhost:${SERVER_PORT}/api`;
  } else {
    // iOS simulator can use localhost
    return `http://localhost:${SERVER_PORT}/api`;
  }
};

/**
 * Get the WebSocket URL for real-time communication
 * @returns {string} The WebSocket URL
 */
export const getWebSocketUrl = (): string => {
  const { LOCAL_IP, SERVER_PORT } = NETWORK_CONFIG;
  
  if (Platform.OS === 'android') {
    return `ws://${LOCAL_IP}:${SERVER_PORT}`;
  } else {
    return `ws://localhost:${SERVER_PORT}`;
  }
};

export default {
  getApiBaseUrl,
  getWebSocketUrl,
  NETWORK_CONFIG,
};

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  AUTH: `${getApiBaseUrl()}/auth`,
  CHAT: `${getApiBaseUrl()}/chat`,
  PROMPT_TEMPLATES: `${getApiBaseUrl()}/prompt-templates`
};
