import AsyncStorage from '@react-native-async-storage/async-storage';

export async function debugAuthState() {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userData = await AsyncStorage.getItem('userData');
    
    console.log('=== AUTH DEBUG ===');
    console.log('Token:', token);
    console.log('User Data:', userData);
    console.log('=================');
    
    return {
      token,
      userData: userData ? JSON.parse(userData) : null
    };
  } catch (error) {
    console.error('Error debugging auth state:', error);
    return null;
  }
}

export async function clearAuthState() {
  try {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    console.log('Auth state cleared');
  } catch (error) {
    console.error('Error clearing auth state:', error);
  }
}

export async function testServerConnection() {
  try {
    const { getApiBaseUrl } = require('@/config/network');
    const API_BASE_URL = getApiBaseUrl();
    
    console.log('Testing connection to:', API_BASE_URL);
    
    const response = await fetch(`${API_BASE_URL}/auth/test-connection`);
    console.log('Server response status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('Server response:', data);
    }
  } catch (error) {
    console.error('Server connection test failed:', error);
  }
}
