import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import OpenAI from 'openai';

// File processing statuses
export const FILE_STATUS = {
  PENDING: 'pending',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  AI_PROCESSING: 'ai_processing',
  AI_PROCESSED: 'ai_processed',
  GENERATING_SPEECH: 'generating_speech',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Async thunks for processing
export const transcribeFile = createAsyncThunk(
  'fileProcessing/transcribeFile',
  async ({ fileId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('temperature', '0.0');

      const response = await fetch('http://0.0.0.0:8080/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { fileId, result };
    } catch (error) {
      return rejectWithValue({ fileId, error: error.message });
    }
  }
);

export const processWithAI = createAsyncThunk(
  'fileProcessing/processWithAI',
  async ({ fileId, text, prompt, apiKey }, { rejectWithValue }) => {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that processes and rewrites text according to user instructions. Return only the processed text without any additional commentary."
          },
          {
            role: "user",
            content: `${prompt}\n\nText to process:\n${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const processedText = completion.choices[0]?.message?.content || '';
      
      const result = {
        processed_text: processedText,
        original_text: text,
        prompt_used: prompt,
        model: "gpt-3.5-turbo",
        tokens_used: completion.usage?.total_tokens || 0
      };

      return { fileId, result };
    } catch (error) {
      return rejectWithValue({ fileId, error: error.message });
    }
  }
);

export const generateSpeech = createAsyncThunk(
  'fileProcessing/generateSpeech',
  async ({ fileId, text, voiceSettings }, { rejectWithValue }) => {
    try {
      const response = await fetch('http://0.0.0.0:8880/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: voiceSettings.model,
          input: text,
          voice: voiceSettings.voice,
          response_format: voiceSettings.format,
          speed: voiceSettings.speed,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return { fileId, audioUrl, audioBlob };
    } catch (error) {
      return rejectWithValue({ fileId, error: error.message });
    }
  }
);

const fileProcessingSlice = createSlice({
  name: 'fileProcessing',
  initialState: {
    files: [],
    processingQueue: [],
    currentlyProcessing: null,
    completedJobs: [],
    globalSettings: {
      aiPrompt: 'Please rewrite this text to make it more professional and well-structured while maintaining the original meaning.',
      selectedPromptType: 'professional',
      voiceSettings: {
        voice: 'af_heart',
        speed: 1.0,
        format: 'mp3',
        model: 'kokoro'
      }
    },
    statistics: {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      totalProcessingTime: 0
    }
  },
  reducers: {
    addFiles: (state, action) => {
      const newFiles = action.payload.map((file, index) => ({
        id: `${Date.now()}_${index}`,
        originalFile: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: FILE_STATUS.PENDING,
        progress: 0,
        transcription: null,
        aiResult: null,
        finalAudio: null,
        timestamps: {
          added: new Date().toISOString(),
          transcriptionStart: null,
          transcriptionEnd: null,
          aiProcessingStart: null,
          aiProcessingEnd: null,
          speechGenerationStart: null,
          speechGenerationEnd: null
        },
        errors: []
      }));
      
      state.files.push(...newFiles);
      state.statistics.totalFiles += newFiles.length;
    },
    
    removeFile: (state, action) => {
      const fileId = action.payload;
      state.files = state.files.filter(f => f.id !== fileId);
      state.processingQueue = state.processingQueue.filter(id => id !== fileId);
      if (state.currentlyProcessing === fileId) {
        state.currentlyProcessing = null;
      }
    },
    
    clearAllFiles: (state) => {
      state.files = [];
      state.processingQueue = [];
      state.currentlyProcessing = null;
      state.statistics = {
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        totalProcessingTime: 0
      };
    },
    
    addToQueue: (state, action) => {
      const fileIds = Array.isArray(action.payload) ? action.payload : [action.payload];
      state.processingQueue.push(...fileIds.filter(id => !state.processingQueue.includes(id)));
    },
    
    removeFromQueue: (state, action) => {
      const fileId = action.payload;
      state.processingQueue = state.processingQueue.filter(id => id !== fileId);
    },
    
    setCurrentlyProcessing: (state, action) => {
      state.currentlyProcessing = action.payload;
    },
    
    updateFileStatus: (state, action) => {
      const { fileId, status, progress } = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file) {
        file.status = status;
        if (progress !== undefined) {
          file.progress = progress;
        }
      }
    },
    
    updateGlobalSettings: (state, action) => {
      state.globalSettings = { ...state.globalSettings, ...action.payload };
    },
    
    updateFileTranscription: (state, action) => {
      const { fileId, transcription, editableText } = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file) {
        file.transcription = transcription;
        file.editableTranscription = editableText || transcription.text;
      }
    },
    
    updateFileAIResult: (state, action) => {
      const { fileId, aiResult, editableText } = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file) {
        file.aiResult = aiResult;
        file.editableAIResult = editableText || aiResult.processed_text;
      }
    },
    
    updateFileFinalAudio: (state, action) => {
      const { fileId, audioUrl, audioBlob } = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file) {
        file.finalAudio = { url: audioUrl, blob: audioBlob };
      }
    },
    
    addCompletedJob: (state, action) => {
      const job = {
        ...action.payload,
        completedAt: new Date().toISOString()
      };
      state.completedJobs.unshift(job);
      state.statistics.completedFiles++;
    },
    
    markFileCompleted: (state, action) => {
      const fileId = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file && file.status !== FILE_STATUS.COMPLETED) {
        file.status = FILE_STATUS.COMPLETED;
        file.progress = 100;
        file.timestamps.completedAt = new Date().toISOString();
        state.statistics.completedFiles++;
      }
    },
    
    markFileFailed: (state, action) => {
      const { fileId, error } = action.payload;
      const file = state.files.find(f => f.id === fileId);
      if (file) {
        file.status = FILE_STATUS.FAILED;
        file.errors.push({
          message: error,
          timestamp: new Date().toISOString()
        });
        state.statistics.failedFiles++;
      }
    }
  },
  
  extraReducers: (builder) => {
    // Transcription reducers
    builder
      .addCase(transcribeFile.pending, (state, action) => {
        const { fileId } = action.meta.arg;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.TRANSCRIBING;
          file.timestamps.transcriptionStart = new Date().toISOString();
        }
      })
      .addCase(transcribeFile.fulfilled, (state, action) => {
        const { fileId, result } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.TRANSCRIBED;
          file.transcription = result;
          file.editableTranscription = result.text;
          file.timestamps.transcriptionEnd = new Date().toISOString();
          file.progress = 33;
        }
      })
      .addCase(transcribeFile.rejected, (state, action) => {
        const { fileId, error } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.FAILED;
          file.errors.push({
            stage: 'transcription',
            message: error,
            timestamp: new Date().toISOString()
          });
          state.statistics.failedFiles++;
        }
      })
      
      // AI Processing reducers
      .addCase(processWithAI.pending, (state, action) => {
        const { fileId } = action.meta.arg;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.AI_PROCESSING;
          file.timestamps.aiProcessingStart = new Date().toISOString();
        }
      })
      .addCase(processWithAI.fulfilled, (state, action) => {
        const { fileId, result } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.AI_PROCESSED;
          file.aiResult = result;
          file.editableAIResult = result.processed_text;
          file.timestamps.aiProcessingEnd = new Date().toISOString();
          file.progress = 66;
        }
      })
      .addCase(processWithAI.rejected, (state, action) => {
        const { fileId, error } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.FAILED;
          file.errors.push({
            stage: 'ai_processing',
            message: error,
            timestamp: new Date().toISOString()
          });
          state.statistics.failedFiles++;
        }
      })
      
      // Speech Generation reducers
      .addCase(generateSpeech.pending, (state, action) => {
        const { fileId } = action.meta.arg;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.GENERATING_SPEECH;
          file.timestamps.speechGenerationStart = new Date().toISOString();
        }
      })
      .addCase(generateSpeech.fulfilled, (state, action) => {
        const { fileId, audioUrl, audioBlob } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.COMPLETED;
          file.finalAudio = { url: audioUrl, blob: audioBlob };
          file.timestamps.speechGenerationEnd = new Date().toISOString();
          file.progress = 100;
          state.statistics.completedFiles++;
        }
      })
      .addCase(generateSpeech.rejected, (state, action) => {
        const { fileId, error } = action.payload;
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.status = FILE_STATUS.FAILED;
          file.errors.push({
            stage: 'speech_generation',
            message: error,
            timestamp: new Date().toISOString()
          });
          state.statistics.failedFiles++;
        }
      });
  }
});

export const {
  addFiles,
  removeFile,
  clearAllFiles,
  addToQueue,
  removeFromQueue,
  setCurrentlyProcessing,
  updateFileStatus,
  updateGlobalSettings,
  updateFileTranscription,
  updateFileAIResult,
  updateFileFinalAudio,
  addCompletedJob,
  markFileCompleted,
  markFileFailed
} = fileProcessingSlice.actions;

export default fileProcessingSlice.reducer;