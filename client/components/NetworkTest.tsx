import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NETWORK_CONFIG } from '@/config/network';

const NetworkTest: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const testNetworkConnection = async () => {
    setTesting(true);
    const testResults: string[] = [];
    
    try {
      const { LOCAL_IP, SERVER_PORT } = NETWORK_CONFIG;
      const testUrl = `http://${LOCAL_IP}:${SERVER_PORT}`;
      
      testResults.push(`Testing connection to: ${testUrl}`);
      
      // Test 1: Basic server connectivity
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        testResults.push('✅ Server is reachable');
        const data = await response.json();
        testResults.push(`✅ Server response: ${data.message}`);
      } else {
        testResults.push(`❌ Server responded with status: ${response.status}`);
      }
      
      // Test 2: Auth endpoint
      const authResponse = await fetch(`${testUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpass',
        }),
      });
      
      if (authResponse.status === 400 || authResponse.status === 401) {
        testResults.push('✅ Auth endpoint is working (expected auth error)');
      } else {
        testResults.push(`❓ Auth endpoint status: ${authResponse.status}`);
      }
      
    } catch (error: any) {
      testResults.push(`❌ Network error: ${error.message}`);
      testResults.push(`❌ Error type: ${error.name}`);
      
      if (error.message.includes('Network request failed')) {
        testResults.push('📝 Possible causes:');
        testResults.push('  • Device not on same network');
        testResults.push('  • Firewall blocking connection');
        testResults.push('  • Wrong IP address');
        testResults.push('  • Server not running');
      }
    } finally {
      setTesting(false);
      setResults(testResults);
      
      // Show summary in alert
      const summary = testResults.join('\\n');
      Alert.alert('Network Test Results', summary);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Connection Test</Text>
      
      <TouchableOpacity 
        style={[styles.testButton, testing && styles.testButtonDisabled]}
        onPress={testNetworkConnection}
        disabled={testing}
      >
        <Text style={styles.testButtonText}>
          {testing ? 'Testing...' : 'Test Network Connection'}
        </Text>
      </TouchableOpacity>
      
      {results.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          {results.map((result, index) => (
            <Text key={index} style={styles.resultText}>
              {result}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  testButtonDisabled: {
    backgroundColor: '#ccc',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
});

export default NetworkTest;
