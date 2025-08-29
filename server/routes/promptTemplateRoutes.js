const express = require('express');
const router = express.Router();
const PromptTemplate = require('../models/PromptTemplate');
const { protect } = require('../middleware/auth');

// @route   GET /api/prompt-templates
// @desc    Get all prompt templates for the authenticated user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Get user's custom templates
    const userTemplates = await PromptTemplate.find({
      user: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    // Get system templates (if user doesn't have them, create them)
    let systemTemplates = await PromptTemplate.find({
      user: req.user.id,
      isSystemTemplate: true,
      isActive: true
    });

    // If user doesn't have system templates, create them
    if (systemTemplates.length === 0) {
      const defaultTemplates = PromptTemplate.getDefaultTemplates();
      const templatesWithUser = defaultTemplates.map(template => ({
        ...template,
        user: req.user.id
      }));
      
      systemTemplates = await PromptTemplate.insertMany(templatesWithUser);
    }

    // Combine and categorize templates
    const allTemplates = [...systemTemplates, ...userTemplates];
    const categorizedTemplates = {
      system: systemTemplates,
      custom: userTemplates.filter(t => !t.isSystemTemplate),
      byCategory: {
        educational: allTemplates.filter(t => t.category === 'educational'),
        technical: allTemplates.filter(t => t.category === 'technical'),
        creative: allTemplates.filter(t => t.category === 'creative'),
        professional: allTemplates.filter(t => t.category === 'professional'),
        casual: allTemplates.filter(t => t.category === 'casual'),
        accessibility: allTemplates.filter(t => t.category === 'accessibility'),
        custom: allTemplates.filter(t => t.category === 'custom')
      }
    };

    res.json({
      success: true,
      data: {
        templates: allTemplates,
        categorized: categorizedTemplates,
        total: allTemplates.length
      }
    });
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prompt templates',
      error: error.message
    });
  }
});

// @route   GET /api/prompt-templates/:id
// @desc    Get a specific prompt template
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const template = await PromptTemplate.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Prompt template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching prompt template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prompt template',
      error: error.message
    });
  }
});

// @route   POST /api/prompt-templates
// @desc    Create a new prompt template
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, template, category = 'custom' } = req.body;

    // Validation
    if (!name || !description || !template) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and template are required'
      });
    }

    // Check if template name already exists for this user
    const existingTemplate = await PromptTemplate.findOne({
      user: req.user.id,
      name: name.trim(),
      isActive: true
    });

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'A template with this name already exists'
      });
    }

    const newTemplate = new PromptTemplate({
      user: req.user.id,
      name: name.trim(),
      description: description.trim(),
      template: template.trim(),
      category,
      isSystemTemplate: false
    });

    await newTemplate.save();

    res.status(201).json({
      success: true,
      data: newTemplate,
      message: 'Prompt template created successfully'
    });
  } catch (error) {
    console.error('Error creating prompt template:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating prompt template',
      error: error.message
    });
  }
});

// @route   PUT /api/prompt-templates/:id
// @desc    Update a prompt template
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, description, template, category } = req.body;

    const existingTemplate = await PromptTemplate.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Prompt template not found'
      });
    }

    // Don't allow editing system templates
    if (existingTemplate.isSystemTemplate) {
      return res.status(403).json({
        success: false,
        message: 'System templates cannot be edited'
      });
    }

    // Check if new name conflicts with existing template
    if (name && name.trim() !== existingTemplate.name) {
      const nameConflict = await PromptTemplate.findOne({
        user: req.user.id,
        name: name.trim(),
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (nameConflict) {
        return res.status(400).json({
          success: false,
          message: 'A template with this name already exists'
        });
      }
    }

    // Update fields
    if (name) existingTemplate.name = name.trim();
    if (description) existingTemplate.description = description.trim();
    if (template) existingTemplate.template = template.trim();
    if (category) existingTemplate.category = category;

    await existingTemplate.save();

    res.json({
      success: true,
      data: existingTemplate,
      message: 'Prompt template updated successfully'
    });
  } catch (error) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating prompt template',
      error: error.message
    });
  }
});

// @route   DELETE /api/prompt-templates/:id
// @desc    Delete a prompt template (soft delete)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const template = await PromptTemplate.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Prompt template not found'
      });
    }

    // Don't allow deleting system templates
    if (template.isSystemTemplate) {
      return res.status(403).json({
        success: false,
        message: 'System templates cannot be deleted'
      });
    }

    // Soft delete
    template.isActive = false;
    await template.save();

    res.json({
      success: true,
      message: 'Prompt template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting prompt template',
      error: error.message
    });
  }
});

// @route   POST /api/prompt-templates/:id/use
// @desc    Use a prompt template (increment usage count)
// @access  Private
router.post('/:id/use', protect, async (req, res) => {
  try {
    const template = await PromptTemplate.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Prompt template not found'
      });
    }

    await template.incrementUsage();

    res.json({
      success: true,
      data: {
        templateId: template._id,
        usageCount: template.usageCount,
        template: template.template
      },
      message: 'Template usage recorded'
    });
  } catch (error) {
    console.error('Error recording template usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording template usage',
      error: error.message
    });
  }
});

// @route   POST /api/prompt-templates/:id/duplicate
// @desc    Duplicate a prompt template
// @access  Private
router.post('/:id/duplicate', protect, async (req, res) => {
  try {
    const originalTemplate = await PromptTemplate.findOne({
      _id: req.params.id,
      user: req.user.id,
      isActive: true
    });

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Prompt template not found'
      });
    }

    // Create duplicate with modified name
    const duplicateName = `${originalTemplate.name} (Copy)`;
    
    const duplicateTemplate = new PromptTemplate({
      user: req.user.id,
      name: duplicateName,
      description: originalTemplate.description,
      template: originalTemplate.template,
      category: originalTemplate.category,
      isSystemTemplate: false
    });

    await duplicateTemplate.save();

    res.status(201).json({
      success: true,
      data: duplicateTemplate,
      message: 'Prompt template duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating prompt template:', error);
    res.status(500).json({
      success: false,
      message: 'Error duplicating prompt template',
      error: error.message
    });
  }
});

module.exports = router;
