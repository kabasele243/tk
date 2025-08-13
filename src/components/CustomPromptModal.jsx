import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCustomPrompt, updateGlobalSettings } from '../store/slices/fileProcessingSlice';

const PROMPT_TEMPLATES = {
  professional: {
    name: '📋 Professional Rewrite',
    prompt: 'Please rewrite this text to make it more professional and well-structured while maintaining the original meaning.'
  },
  summary: {
    name: '📝 Summary',
    prompt: 'Provide a concise summary of the following text, capturing the main points and key information.'
  },
  bullet_points: {
    name: '• Bullet Points',
    prompt: 'Convert the following text into clear, organized bullet points highlighting the key information.'
  },
  formal: {
    name: '🏢 Formal Business',
    prompt: 'Rewrite this text in a formal business tone suitable for corporate communications.'
  },
  simple: {
    name: '🎯 Simplified Language', 
    prompt: 'Simplify this text to make it easier to understand, using plain language and shorter sentences.'
  },
  blog_post: {
    name: '📰 Blog Post',
    prompt: 'Transform this text into an engaging blog post with a catchy introduction and well-organized sections.'
  },
  email: {
    name: '📧 Email Format',
    prompt: 'Convert this text into a professional email format with appropriate greeting, body, and closing.'
  },
  presentation: {
    name: '🎤 Presentation',
    prompt: 'Restructure this text for a presentation, with clear talking points and logical flow.'
  },
  social_media: {
    name: '📱 Social Media',
    prompt: 'Adapt this text for social media, making it engaging, concise, and shareable.'
  },
  storytelling: {
    name: '📖 Storytelling',
    prompt: 'Transform this text into a narrative format with storytelling elements to make it more engaging.'
  },
  technical: {
    name: '⚙️ Technical',
    prompt: 'Rewrite this text with technical precision, including relevant terminology and detailed explanations.'
  },
  casual: {
    name: '😊 Casual',
    prompt: 'Rewrite this text in a casual, conversational tone as if speaking to a friend.'
  }
};

function CustomPromptModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { globalSettings } = useSelector(state => state.fileProcessing);
  const [customPromptText, setCustomPromptText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(globalSettings.selectedPromptType);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [promptVariables, setPromptVariables] = useState({
    tone: '',
    audience: '',
    format: '',
    additionalInstructions: ''
  });

  useEffect(() => {
    if (globalSettings.customPrompt) {
      setCustomPromptText(globalSettings.customPrompt);
    } else if (selectedTemplate && PROMPT_TEMPLATES[selectedTemplate]) {
      setCustomPromptText(PROMPT_TEMPLATES[selectedTemplate].prompt);
    }
  }, [globalSettings.customPrompt, selectedTemplate]);

  if (!isOpen) return null;

  const handleTemplateSelect = (templateKey) => {
    setSelectedTemplate(templateKey);
    setCustomPromptText(PROMPT_TEMPLATES[templateKey].prompt);
    dispatch(updateGlobalSettings({ 
      selectedPromptType: templateKey,
      aiPrompt: PROMPT_TEMPLATES[templateKey].prompt 
    }));
  };

  const handleSaveCustomPrompt = () => {
    dispatch(setCustomPrompt(customPromptText));
    dispatch(updateGlobalSettings({ 
      aiPrompt: customPromptText,
      selectedPromptType: 'custom'
    }));
    onClose();
  };

  const buildPromptFromVariables = () => {
    let prompt = 'Please process the following text';
    
    if (promptVariables.tone) {
      prompt += ` in a ${promptVariables.tone} tone`;
    }
    
    if (promptVariables.audience) {
      prompt += ` for ${promptVariables.audience}`;
    }
    
    if (promptVariables.format) {
      prompt += `. Format it as ${promptVariables.format}`;
    }
    
    if (promptVariables.additionalInstructions) {
      prompt += `. ${promptVariables.additionalInstructions}`;
    }
    
    prompt += '.';
    setCustomPromptText(prompt);
  };

  const handleTestPrompt = async () => {
    if (!testInput.trim()) return;
    
    setIsTesting(true);
    try {
      // Simulate AI processing
      setTimeout(() => {
        setTestOutput(`[This would be the AI-processed result using your custom prompt]\n\nOriginal: "${testInput}"\n\nPrompt: "${customPromptText}"`);
        setIsTesting(false);
      }, 1500);
    } catch (error) {
      console.error('Test failed:', error);
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Custom AI Prompt Configuration</h2>
              <p className="text-purple-100 text-sm mt-1">Configure how AI processes your transcriptions</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Panel - Templates */}
          <div className="w-1/3 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Prompt Templates</h3>
            <div className="space-y-2">
              {Object.entries(PROMPT_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleTemplateSelect(key)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    selectedTemplate === key
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className={`text-xs mt-1 ${selectedTemplate === key ? 'text-purple-100' : 'text-gray-500'}`}>
                    {template.prompt.substring(0, 60)}...
                  </div>
                </button>
              ))}
              
              <button
                onClick={() => {
                  setSelectedTemplate('custom');
                  setCustomPromptText('');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  selectedTemplate === 'custom'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <div className="font-medium">✏️ Custom Prompt</div>
                <div className={`text-xs mt-1 ${selectedTemplate === 'custom' ? 'text-purple-100' : 'text-gray-500'}`}>
                  Create your own custom prompt
                </div>
              </button>
            </div>
          </div>

          {/* Right Panel - Editor */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Prompt Builder */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Prompt Builder</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <input
                    type="text"
                    value={promptVariables.tone}
                    onChange={(e) => setPromptVariables({...promptVariables, tone: e.target.value})}
                    placeholder="e.g., professional, casual, formal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <input
                    type="text"
                    value={promptVariables.audience}
                    onChange={(e) => setPromptVariables({...promptVariables, audience: e.target.value})}
                    placeholder="e.g., executives, students, general public"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                  <input
                    type="text"
                    value={promptVariables.format}
                    onChange={(e) => setPromptVariables({...promptVariables, format: e.target.value})}
                    placeholder="e.g., bullet points, paragraphs, script"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions</label>
                  <input
                    type="text"
                    value={promptVariables.additionalInstructions}
                    onChange={(e) => setPromptVariables({...promptVariables, additionalInstructions: e.target.value})}
                    placeholder="e.g., include examples, keep it under 200 words"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <button
                onClick={buildPromptFromVariables}
                className="inline-flex items-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generate Prompt from Variables
              </button>
            </div>

            {/* Prompt Editor */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom Prompt</h3>
              <textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                className="w-full h-40 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your custom prompt here..."
              />
              <div className="mt-2 text-sm text-gray-500">
                {customPromptText.length} characters
              </div>
            </div>

            {/* Test Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Your Prompt</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Input</label>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm"
                    placeholder="Enter sample text to test your prompt..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Output</label>
                  <div className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm bg-gray-50 overflow-y-auto">
                    {isTesting ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      </div>
                    ) : (
                      testOutput || <span className="text-gray-400">Output will appear here...</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleTestPrompt}
                disabled={!testInput.trim() || isTesting}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Test Prompt
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCustomPrompt}
              className="px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              Save & Apply Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomPromptModal;