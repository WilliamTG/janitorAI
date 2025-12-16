import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { getApiBaseUrl, getApiHealthUrl, getBuildProfile, isDevelopmentBuild } from '../src/config/api';
import { router } from 'expo-router';

/**
 * Debug screen - only accessible in development builds
 * Shows API configuration and tests connectivity
 */
export default function DebugScreen() {
  const [healthStatus, setHealthStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [healthData, setHealthData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Redirect to home if not a development build
  useEffect(() => {
    if (!isDevelopmentBuild()) {
      router.replace('/(tabs)');
    }
  }, []);

  const checkHealth = async () => {
    setHealthStatus('loading');
    setErrorMessage('');
    
    try {
      const response = await fetch(getApiHealthUrl(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHealthData(data);
      setHealthStatus('success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Unknown error');
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Don't render if not dev build
  if (!isDevelopmentBuild()) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Debug Information</Text>
        <Text style={styles.subtitle}>Development Build Only</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Build Configuration</Text>
        <InfoRow label="Build Profile" value={getBuildProfile()} />
        <InfoRow label="Is Dev Build" value={isDevelopmentBuild() ? 'Yes' : 'No'} />
        <InfoRow label="__DEV__" value={__DEV__ ? 'true' : 'false'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <InfoRow label="Base URL" value={getApiBaseUrl()} valueStyle={styles.urlText} />
        <InfoRow label="Health URL" value={getApiHealthUrl()} valueStyle={styles.urlText} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Check</Text>
        
        {healthStatus === 'loading' && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.statusText}>Checking backend...</Text>
          </View>
        )}

        {healthStatus === 'success' && (
          <View style={styles.statusContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Backend is healthy</Text>
            {healthData && (
              <Text style={styles.healthData}>
                {JSON.stringify(healthData, null, 2)}
              </Text>
            )}
          </View>
        )}

        {healthStatus === 'error' && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorText}>Health check failed</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.retryButton}
          onPress={checkHealth}
        >
          <Text style={styles.retryButtonText}>
            🔄 Retry Health Check
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back to App</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={[styles.infoValue, valueStyle]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flexShrink: 1,
  },
  urlText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#007AFF',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  successIcon: {
    fontSize: 48,
  },
  successText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Courier',
  },
  healthData: {
    marginTop: 12,
    fontSize: 12,
    color: '#666',
    fontFamily: 'Courier',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
