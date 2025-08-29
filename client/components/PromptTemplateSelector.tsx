import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import promptTemplateService, { PromptTemplate } from '../services/promptTemplateService';

interface PromptTemplateSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PromptTemplate) => void;
  selectedTemplateId?: string;
}

export default function PromptTemplateSelector({
  visible,
  onClose,
  onSelectTemplate,
  selectedTemplateId
}: PromptTemplateSelectorProps) {
  const colorScheme = useColorScheme();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  const styles = getStyles(colorScheme ?? 'light');
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await promptTemplateService.getTemplates();
      if (response.success) {
        setTemplates(response.data.templates);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
      // Handle authentication errors more gracefully
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        Alert.alert('Authentication Required', 'Please log in to access prompt templates.');
      } else {
        Alert.alert('Error', 'Failed to load prompt templates');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: PromptTemplate) => {
    try {
      // Record usage
      await promptTemplateService.useTemplate(template._id);
      onSelectTemplate(template);
      onClose();
    } catch (error) {
      console.error('Error using template:', error);
      // Still allow selection even if usage tracking fails
      onSelectTemplate(template);
      onClose();
    }
  };

  const handleDeleteTemplate = async (template: PromptTemplate) => {
    if (template.isSystemTemplate) {
      Alert.alert('Cannot Delete', 'System templates cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await promptTemplateService.deleteTemplate(template._id);
              loadTemplates();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        }
      ]
    );
  };

  const handleDuplicateTemplate = async (template: PromptTemplate) => {
    try {
      await promptTemplateService.duplicateTemplate(template._id);
      loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      Alert.alert('Error', 'Failed to duplicate template');
    }
  };

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'educational', label: 'Educational' },
    { key: 'technical', label: 'Technical' },
    { key: 'creative', label: 'Creative' },
    { key: 'professional', label: 'Professional' },
    { key: 'casual', label: 'Casual' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'custom', label: 'Custom' }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    const icons = {
      educational: '🎓',
      technical: '⚙️',
      creative: '🎨',
      professional: '💼',
      casual: '😊',
      accessibility: '♿',
      custom: '📝'
    };
    return icons[category as keyof typeof icons] || '📝';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Prompt Templates</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => setShowCreateForm(true)}
            >
              <Text style={styles.createButtonText}>+ New</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor={colors.tabIconDefault}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {/* Categories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          {categories.map(category => (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryButton,
                activeCategory === category.key && styles.activeCategoryButton
              ]}
              onPress={() => setActiveCategory(category.key)}
            >
              <Text style={[
                styles.categoryButtonText,
                activeCategory === category.key && styles.activeCategoryButtonText
              ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Templates List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={styles.loadingText}>Loading templates...</Text>
          </View>
        ) : (
          <ScrollView style={styles.templatesContainer}>
            {filteredTemplates.map(template => (
              <View key={template._id} style={styles.templateCard}>
                <TouchableOpacity
                  style={[
                    styles.templateMain,
                    selectedTemplateId === template._id && styles.selectedTemplate
                  ]}
                  onPress={() => handleSelectTemplate(template)}
                >
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateIcon}>
                      {getCategoryIcon(template.category)}
                    </Text>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateDescription}>
                        {template.description}
                      </Text>
                    </View>
                    <View style={styles.templateMeta}>
                      <Text style={styles.usageCount}>
                        Used {template.usageCount} times
                      </Text>
                      {template.isSystemTemplate && (
                        <Text style={styles.systemBadge}>System</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Template Actions */}
                <View style={styles.templateActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDuplicateTemplate(template)}
                  >
                    <Text style={styles.actionButtonText}>Duplicate</Text>
                  </TouchableOpacity>
                  {!template.isSystemTemplate && (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setEditingTemplate(template)}
                      >
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteTemplate(template)}
                      >
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Create/Edit Template Form would go here */}
      <TemplateForm
        visible={showCreateForm || !!editingTemplate}
        template={editingTemplate}
        onClose={() => {
          setShowCreateForm(false);
          setEditingTemplate(null);
        }}
        onSave={() => {
          setShowCreateForm(false);
          setEditingTemplate(null);
          loadTemplates();
        }}
      />
    </Modal>
  );
}

// Simple form component for creating/editing templates
function TemplateForm({ 
  visible, 
  template, 
  onClose, 
  onSave 
}: {
  visible: boolean;
  template?: PromptTemplate | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const colorScheme = useColorScheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [category, setCategory] = useState<PromptTemplate['category']>('custom');
  const [saving, setSaving] = useState(false);

  const styles = getStyles(colorScheme ?? 'light');
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setTemplateText(template.template);
      setCategory(template.category);
    } else {
      setName('');
      setDescription('');
      setTemplateText('');
      setCategory('custom');
    }
  }, [template, visible]);

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !templateText.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      const templateData = {
        name: name.trim(),
        description: description.trim(),
        template: templateText.trim(),
        category
      };

      if (template) {
        await promptTemplateService.updateTemplate(template._id, templateData);
      } else {
        await promptTemplateService.createTemplate(templateData);
      }

      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {template ? 'Edit Template' : 'Create Template'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.formContainer}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter template name"
              placeholderTextColor={colors.tabIconDefault}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what this template does"
              placeholderTextColor={colors.tabIconDefault}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Template Text</Text>
            <TextInput
              style={[styles.input, styles.templateInput]}
              value={templateText}
              onChangeText={setTemplateText}
              placeholder="Enter the prompt template text..."
              placeholderTextColor={colors.tabIconDefault}
              multiline
              numberOfLines={6}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') => {
  const colors = Colors[colorScheme ?? 'light'];
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.tabIconDefault,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    createButton: {
      backgroundColor: colors.tint,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    createButtonText: {
      color: 'white',
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.tint,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    saveButtonText: {
      color: 'white',
      fontWeight: '600',
    },
    closeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    closeButtonText: {
      color: colors.tint,
      fontWeight: '600',
    },
    searchContainer: {
      padding: 16,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
    },
    categoriesContainer: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    categoryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
    },
    activeCategoryButton: {
      backgroundColor: colors.tint,
      borderColor: colors.tint,
    },
    categoryButtonText: {
      color: colors.text,
      fontSize: 14,
    },
    activeCategoryButtonText: {
      color: 'white',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 8,
      color: colors.text,
    },
    templatesContainer: {
      flex: 1,
      padding: 16,
    },
    templateCard: {
      marginBottom: 12,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
    },
    templateMain: {
      padding: 12,
    },
    selectedTemplate: {
      borderColor: colors.tint,
      backgroundColor: colors.tint + '10',
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    templateIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    templateInfo: {
      flex: 1,
    },
    templateName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    templateDescription: {
      fontSize: 14,
      color: colors.tabIconDefault,
    },
    templateMeta: {
      alignItems: 'flex-end',
    },
    usageCount: {
      fontSize: 12,
      color: colors.tabIconDefault,
    },
    systemBadge: {
      fontSize: 10,
      color: colors.tint,
      fontWeight: '600',
      marginTop: 2,
    },
    templateActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.tabIconDefault,
      padding: 8,
      gap: 8,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 12,
    },
    deleteButton: {
      borderColor: '#ff4444',
    },
    deleteButtonText: {
      color: '#ff4444',
    },
    formContainer: {
      flex: 1,
      padding: 16,
    },
    formGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.tabIconDefault,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
    },
    templateInput: {
      height: 120,
      textAlignVertical: 'top',
    },
  });
};
