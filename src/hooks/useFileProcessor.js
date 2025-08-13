import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  transcribeFile,
  processWithAI,
  generateSpeech,
  setCurrentlyProcessing,
  markFileFailed,
  FILE_STATUS
} from '../store/slices/fileProcessingSlice';

export const useFileProcessor = () => {
  const dispatch = useDispatch();
  const { 
    files, 
    processingQueue, 
    currentlyProcessing,
    globalSettings 
  } = useSelector(state => state.fileProcessing);
  
  const { 
    aiSettings, 
    voiceSettings,
    processingSettings 
  } = useSelector(state => state.settings);

  const processNextInQueue = useCallback(async () => {
    // Don't start if already processing or queue is empty
    if (currentlyProcessing || processingQueue.length === 0) {
      return;
    }

    const nextFileId = processingQueue[0];
    const file = files.find(f => f.id === nextFileId);
    
    if (!file) {
      return;
    }

    dispatch(setCurrentlyProcessing(nextFileId));

    try {
      // Step 1: Transcription
      if (file.status === FILE_STATUS.PENDING) {
        const transcriptionResult = await dispatch(transcribeFile({
          fileId: nextFileId,
          file: file.originalFile
        })).unwrap();
        
        // Wait a bit before next step
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2: AI Processing
      if (file.status === FILE_STATUS.TRANSCRIBED) {
        const apiKey = aiSettings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;
        
        if (!apiKey) {
          throw new Error('No OpenAI API key available');
        }

        await dispatch(processWithAI({
          fileId: nextFileId,
          text: file.editableTranscription || file.transcription.text,
          prompt: aiSettings.customPrompt || aiSettings.prompts[aiSettings.selectedPromptType],
          apiKey: apiKey
        })).unwrap();
        
        // Wait a bit before next step
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 3: Speech Generation
      if (file.status === FILE_STATUS.AI_PROCESSED) {
        await dispatch(generateSpeech({
          fileId: nextFileId,
          text: file.editableAIResult || file.aiResult.processed_text,
          voiceSettings: voiceSettings
        })).unwrap();
      }

    } catch (error) {
      console.error(`Processing failed for file ${file.name}:`, error);
      dispatch(markFileFailed({
        fileId: nextFileId,
        error: error.message || 'Unknown error occurred'
      }));
    } finally {
      dispatch(setCurrentlyProcessing(null));
      
      // Continue with next file after a short delay
      setTimeout(() => {
        processNextInQueue();
      }, 2000);
    }
  }, [
    currentlyProcessing, 
    processingQueue, 
    files, 
    dispatch, 
    aiSettings, 
    voiceSettings
  ]);

  // Auto-start processing when files are added to queue
  useEffect(() => {
    if (!currentlyProcessing && processingQueue.length > 0) {
      processNextInQueue();
    }
  }, [processNextInQueue, currentlyProcessing, processingQueue.length]);

  const startBatchProcessing = useCallback((fileIds) => {
    const validFileIds = fileIds.filter(id => {
      const file = files.find(f => f.id === id);
      return file && file.status === FILE_STATUS.PENDING;
    });

    if (validFileIds.length === 0) {
      throw new Error('No valid files to process');
    }

    // Add files to queue
    validFileIds.forEach(fileId => {
      if (!processingQueue.includes(fileId)) {
        dispatch({ type: 'fileProcessing/addToQueue', payload: fileId });
      }
    });

    return validFileIds.length;
  }, [files, processingQueue, dispatch]);

  const pauseProcessing = useCallback(() => {
    // This would require more complex state management to properly pause
    // For now, we can clear the queue to stop processing new files
    dispatch({ type: 'fileProcessing/clearQueue' });
  }, [dispatch]);

  const resumeProcessing = useCallback(() => {
    // Re-add pending files to queue
    const pendingFiles = files
      .filter(f => f.status === FILE_STATUS.PENDING)
      .map(f => f.id);
    
    pendingFiles.forEach(fileId => {
      dispatch({ type: 'fileProcessing/addToQueue', payload: fileId });
    });
  }, [files, dispatch]);

  const retryFailedFiles = useCallback(() => {
    const failedFiles = files
      .filter(f => f.status === FILE_STATUS.FAILED)
      .map(f => f.id);
    
    // Reset failed files to pending
    failedFiles.forEach(fileId => {
      dispatch({
        type: 'fileProcessing/updateFileStatus',
        payload: { fileId, status: FILE_STATUS.PENDING, progress: 0 }
      });
      dispatch({ type: 'fileProcessing/addToQueue', payload: fileId });
    });

    return failedFiles.length;
  }, [files, dispatch]);

  const getProcessingStats = useCallback(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === FILE_STATUS.COMPLETED).length;
    const failed = files.filter(f => f.status === FILE_STATUS.FAILED).length;
    const processing = files.filter(f => 
      f.status === FILE_STATUS.TRANSCRIBING || 
      f.status === FILE_STATUS.AI_PROCESSING || 
      f.status === FILE_STATUS.GENERATING_SPEECH
    ).length;
    const pending = files.filter(f => f.status === FILE_STATUS.PENDING).length;

    return {
      total,
      completed,
      failed,
      processing,
      pending,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      isProcessing: currentlyProcessing !== null
    };
  }, [files, currentlyProcessing]);

  return {
    // Actions
    startBatchProcessing,
    pauseProcessing,
    resumeProcessing,
    retryFailedFiles,
    processNextInQueue,
    
    // State
    isProcessing: currentlyProcessing !== null,
    currentFile: currentlyProcessing ? files.find(f => f.id === currentlyProcessing) : null,
    queueLength: processingQueue.length,
    
    // Stats
    stats: getProcessingStats()
  };
};