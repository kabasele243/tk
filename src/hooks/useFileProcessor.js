import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  transcribeFile,
  processWithAI,
  generateSpeech,
  setCurrentlyProcessing,
  markFileFailed,
  approveFile,
  addToReviewQueue,
  removeFromQueue,
  FILE_STATUS
} from '../store/slices/fileProcessingSlice';

export const useFileProcessor = () => {
  const dispatch = useDispatch();
  const { 
    files, 
    processingQueue, 
    currentlyProcessing,
    globalSettings,
    reviewQueue,
    approvedFiles 
  } = useSelector(state => state.fileProcessing);
  
  const { 
    aiSettings, 
    voiceSettings,
    processingSettings 
  } = useSelector(state => state.settings);

  // Use refs to store current values without causing re-renders
  const filesRef = useRef(files);
  const settingsRef = useRef({ aiSettings, voiceSettings, globalSettings });
  const processingRef = useRef(false);
  
  // Update refs when values change
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  
  useEffect(() => {
    settingsRef.current = { aiSettings, voiceSettings, globalSettings };
  }, [aiSettings, voiceSettings, globalSettings]);

  // Stable processing function that doesn't depend on changing state
  const processNextInQueue = useCallback(async () => {
    // Prevent concurrent processing
    if (processingRef.current) {
      return;
    }
    
    processingRef.current = true;
    
    try {
      // Get current state from store directly
      const state = dispatch((_, getState) => getState());
      const currentFiles = state.fileProcessing.files;
      const currentQueue = state.fileProcessing.processingQueue;
      const currentlyProcessingFile = state.fileProcessing.currentlyProcessing;
      const currentSettings = state.settings;
      const currentGlobalSettings = state.fileProcessing.globalSettings;
      
      // Don't start if already processing or queue is empty
      if (currentlyProcessingFile || currentQueue.length === 0) {
        return;
      }

      const nextFileId = currentQueue[0];
      const file = currentFiles.find(f => f.id === nextFileId);
      
      if (!file) {
        // Remove invalid file from queue
        dispatch(removeFromQueue(nextFileId));
        return;
      }

      // Skip files that are waiting for review
      if (currentGlobalSettings.batchReviewMode && file.status === FILE_STATUS.REVIEW_PENDING) {
        dispatch(removeFromQueue(nextFileId));
        return;
      }

      dispatch(setCurrentlyProcessing(nextFileId));

      try {
        // Step 1: Transcription
        if (file.status === FILE_STATUS.PENDING) {
          await dispatch(transcribeFile({
            fileId: nextFileId,
            file: file.originalFile
          })).unwrap();
          
          // Wait a bit before next step
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Step 2: AI Processing - get fresh file state
        const freshState = dispatch((_, getState) => getState());
        const freshFile = freshState.fileProcessing.files.find(f => f.id === nextFileId);
        
        if (freshFile && freshFile.status === FILE_STATUS.TRANSCRIBED) {
          const apiKey = currentSettings.aiSettings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;
          
          if (!apiKey) {
            throw new Error('No OpenAI API key available');
          }

          await dispatch(processWithAI({
            fileId: nextFileId,
            text: freshFile.editableTranscription || freshFile.transcription.text,
            prompt: currentSettings.aiSettings.customPrompt || currentSettings.aiSettings.prompts?.[currentSettings.aiSettings.selectedPromptType],
            apiKey: apiKey
          })).unwrap();
          
          // Wait a bit before next step
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Step 3: Get final fresh state for audio generation check
        const finalState = dispatch((_, getState) => getState());
        const finalFile = finalState.fileProcessing.files.find(f => f.id === nextFileId);
        const finalGlobalSettings = finalState.fileProcessing.globalSettings;
        
        // Check if review mode is enabled and file is pending review
        if (finalGlobalSettings.batchReviewMode && finalFile.status === FILE_STATUS.REVIEW_PENDING) {
          // File is waiting for review - stop processing this file
          dispatch(setCurrentlyProcessing(null));
          dispatch(removeFromQueue(nextFileId));
          return;
        }

        // Step 4: Speech Generation (only for approved files or when review mode is off)
        if (finalFile.status === FILE_STATUS.APPROVED || 
            (!finalGlobalSettings.batchReviewMode && finalFile.status === FILE_STATUS.AI_PROCESSED)) {
          await dispatch(generateSpeech({
            fileId: nextFileId,
            text: finalFile.editableAIResult || finalFile.aiResult.processed_text,
            voiceSettings: currentSettings.voiceSettings
          })).unwrap();
        }

      } catch (error) {
        console.error(`Processing failed for file ${file.name}:`, error);
        dispatch(markFileFailed({
          fileId: nextFileId,
          error: error.message || 'Unknown error occurred'
        }));
      } finally {
        // Always clean up
        dispatch(removeFromQueue(nextFileId));
        dispatch(setCurrentlyProcessing(null));
      }
    } finally {
      processingRef.current = false;
    }
  }, [dispatch]); // Only depend on dispatch

  // Simple effect to trigger processing - only depends on basic queue state
  useEffect(() => {
    if (!currentlyProcessing && processingQueue.length > 0 && !processingRef.current) {
      // Use a short timeout to avoid rapid fire calls
      const timeoutId = setTimeout(processNextInQueue, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentlyProcessing, processingQueue.length, processNextInQueue]);

  const startBatchProcessing = useCallback((fileIds) => {
    const validFileIds = fileIds.filter(id => {
      const file = files.find(f => f.id === id);
      return file && (
        file.status === FILE_STATUS.PENDING ||
        file.status === FILE_STATUS.TRANSCRIBED ||
        file.status === FILE_STATUS.AI_PROCESSED ||
        file.status === FILE_STATUS.APPROVED
      );
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

  const reprocessFile = useCallback(async (fileId) => {
    const file = files.find(f => f.id === fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const apiKey = aiSettings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('No OpenAI API key available');
    }

    try {
      const result = await dispatch(processWithAI({
        fileId,
        text: file.editableTranscription || file.transcription?.text,
        prompt: globalSettings.customPrompt || globalSettings.aiPrompt,
        apiKey
      })).unwrap();
      
      return result;
    } catch (error) {
      console.error(`Reprocessing failed for file ${file.name}:`, error);
      throw error;
    }
  }, [files, dispatch, aiSettings.openaiApiKey, globalSettings.customPrompt, globalSettings.aiPrompt]);

  const startBatchAudioGeneration = useCallback(async () => {
    const filesToProcess = approvedFiles
      .map(id => files.find(f => f.id === id))
      .filter(file => file && file.status === FILE_STATUS.APPROVED);

    if (filesToProcess.length === 0) {
      throw new Error('No approved files to generate audio for');
    }

    for (const file of filesToProcess) {
      try {
        await dispatch(generateSpeech({
          fileId: file.id,
          text: file.editableAIResult || file.aiResult?.processed_text,
          voiceSettings
        })).unwrap();
        
        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Audio generation failed for ${file.name}:`, error);
      }
    }

    return filesToProcess.length;
  }, [approvedFiles, files, dispatch, voiceSettings]);

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
    const reviewPending = files.filter(f => f.status === FILE_STATUS.REVIEW_PENDING).length;
    const approved = files.filter(f => f.status === FILE_STATUS.APPROVED).length;

    // Consider processing active if there's a current file OR files in processing states OR queue has items
    const isActivelyProcessing = currentlyProcessing !== null || 
                                processing > 0 || 
                                (processingQueue.length > 0 && (pending > 0 || approved > 0));

    return {
      total,
      completed,
      failed,
      processing,
      pending,
      reviewPending,
      approved,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      isProcessing: isActivelyProcessing
    };
  }, [files, currentlyProcessing, processingQueue.length]);

  const stats = getProcessingStats();
  
  return {
    // Actions
    startBatchProcessing,
    pauseProcessing,
    resumeProcessing,
    retryFailedFiles,
    reprocessFile,
    startBatchAudioGeneration,
    processNextInQueue,
    
    // State
    isProcessing: stats.isProcessing,
    currentFile: currentlyProcessing ? files.find(f => f.id === currentlyProcessing) : null,
    queueLength: processingQueue.length,
    reviewQueueLength: reviewQueue.length,
    
    // Stats
    stats
  };
};