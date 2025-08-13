import { createSlice } from '@reduxjs/toolkit';

const defaultPrompts = {
  professional: 'Please rewrite this text to make it more professional and well-structured while maintaining the original meaning.',
  summary: 'Please create a concise summary of this text, highlighting the main points and key information.',
  bullet_points: 'Please convert this text into clear, organized bullet points that capture all the important information.',
  formal: 'Please rewrite this text in a formal, business-appropriate tone suitable for professional communication.',
  simple: 'Please rewrite this text using simple, easy-to-understand language while keeping all the important information.',
  blog_post: 'Please rewrite this text as an engaging blog post with a clear introduction, body, and conclusion.',
  email: 'Please rewrite this text as a professional email with appropriate greeting, body, and closing.',
  presentation: 'Please rewrite this text as talking points for a presentation, making it engaging and easy to present.',
  social_media: 'Please rewrite this text as engaging social media content that would work well on platforms like LinkedIn or Twitter.',
  storytelling: 'Please rewrite this text as a compelling story with narrative flow, making it more engaging and memorable.',
  technical: 'Please rewrite this text with more technical detail and precision, suitable for a technical audience.',
  casual: 'Please rewrite this text in a casual, conversational tone that feels friendly and approachable.',
  custom: ''
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    // AI Processing Settings
    aiSettings: {
      selectedPromptType: 'professional',
      customPrompt: '',
      prompts: defaultPrompts,
      openaiApiKey: '',
      hasEnvApiKey: false
    },
    
    // Voice Settings
    voiceSettings: {
      voice: 'af_heart',
      speed: 1.0,
      format: 'mp3',
      model: 'kokoro'
    },
    
    // Available voices from API
    availableVoices: [],
    
    // Processing Settings
    processingSettings: {
      autoProcess: false,
      batchSize: 5,
      retryFailedFiles: true,
      maxRetries: 3,
      deleteOriginalAfterProcessing: false
    },
    
    // UI Settings
    uiSettings: {
      theme: 'light',
      showAdvancedOptions: false,
      autoDownload: false,
      showProgressDetails: true,
      compactMode: false
    },
    
    // Download Settings
    downloadSettings: {
      createFolders: true,
      includeMetadata: true,
      zipFormat: 'zip',
      filenameTemplate: '{originalName}_{timestamp}'
    }
  },
  reducers: {
    updateAISettings: (state, action) => {
      state.aiSettings = { ...state.aiSettings, ...action.payload };
    },
    
    updateVoiceSettings: (state, action) => {
      state.voiceSettings = { ...state.voiceSettings, ...action.payload };
    },
    
    setAvailableVoices: (state, action) => {
      state.availableVoices = action.payload;
    },
    
    updateProcessingSettings: (state, action) => {
      state.processingSettings = { ...state.processingSettings, ...action.payload };
    },
    
    updateUISettings: (state, action) => {
      state.uiSettings = { ...state.uiSettings, ...action.payload };
    },
    
    updateDownloadSettings: (state, action) => {
      state.downloadSettings = { ...state.downloadSettings, ...action.payload };
    },
    
    setPromptType: (state, action) => {
      const type = action.payload;
      state.aiSettings.selectedPromptType = type;
      if (type !== 'custom') {
        state.aiSettings.customPrompt = state.aiSettings.prompts[type];
      }
    },
    
    setCustomPrompt: (state, action) => {
      state.aiSettings.customPrompt = action.payload;
      state.aiSettings.selectedPromptType = 'custom';
    },
    
    resetToDefaults: (state) => {
      return {
        ...state,
        aiSettings: {
          ...state.aiSettings,
          selectedPromptType: 'professional',
          customPrompt: ''
        },
        voiceSettings: {
          voice: 'af_heart',
          speed: 1.0,
          format: 'mp3',
          model: 'kokoro'
        },
        processingSettings: {
          autoProcess: false,
          batchSize: 5,
          retryFailedFiles: true,
          maxRetries: 3,
          deleteOriginalAfterProcessing: false
        }
      };
    }
  }
});

export const {
  updateAISettings,
  updateVoiceSettings,
  setAvailableVoices,
  updateProcessingSettings,
  updateUISettings,
  updateDownloadSettings,
  setPromptType,
  setCustomPrompt,
  resetToDefaults
} = settingsSlice.actions;

export default settingsSlice.reducer;