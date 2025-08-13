import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  addFiles, 
  removeFile, 
  clearAllFiles,
  addToQueue,
  approveFile,
  rejectFile,
  approveAllReviewed,
  setBatchReviewMode,
  FILE_STATUS
} from '../store/slices/fileProcessingSlice';
import {
  updateAISettings,
  updateVoiceSettings,
  setAvailableVoices,
  setPromptType,
  setCustomPrompt
} from '../store/slices/settingsSlice';
import { useFileProcessor } from '../hooks/useFileProcessor';
import { 
  isValidAudioVideoFile, 
  formatFileSize, 
  bulkDownloadFiles,
  downloadSingleFileAssets,
  downloadAssetType 
} from '../utils/fileUtils';
import ReviewModal from '../components/ReviewModal';
import CustomPromptModal from '../components/CustomPromptModal';

function TranscribeBatchEnhanced() {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  
  // Modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [currentReviewFileId, setCurrentReviewFileId] = useState(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Redux state
  const { files, statistics, globalSettings, reviewQueue, approvedFiles } = useSelector(state => state.fileProcessing);
  const { aiSettings, voiceSettings, availableVoices } = useSelector(state => state.settings);
  
  // File processor hook
  const { 
    startBatchProcessing, 
    retryFailedFiles,
    reprocessFile,
    startBatchAudioGeneration,
    isProcessing, 
    currentFile, 
    queueLength,
    reviewQueueLength,
    stats 
  } = useFileProcessor();

  // Environment API key detection
  const envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const hasEnvApiKey = envApiKey && envApiKey.startsWith('sk-');

  // Load voices on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch('http://0.0.0.0:8880/v1/audio/voices');
        const data = await response.json();
        dispatch(setAvailableVoices(data.voices || []));
      } catch (error) {
        console.error('Failed to load voices:', error);
        dispatch(setAvailableVoices(['af_heart', 'af_nova', 'am_adam', 'am_echo']));
      }
    };
    loadVoices();
  }, [dispatch]);

  // Set API key from environment
  useEffect(() => {
    if (hasEnvApiKey && !aiSettings.openaiApiKey) {
      dispatch(updateAISettings({ 
        openaiApiKey: envApiKey,
        hasEnvApiKey: true 
      }));
    }
  }, [hasEnvApiKey, envApiKey, aiSettings.openaiApiKey, dispatch]);

  // Auto-open review modal when files are ready for review
  useEffect(() => {
    if (reviewQueue.length > 0 && !showReviewModal && globalSettings.batchReviewMode) {
      setCurrentReviewFileId(reviewQueue[0]);
      setCurrentReviewIndex(0);
      setShowReviewModal(true);
    }
  }, [reviewQueue, showReviewModal, globalSettings.batchReviewMode]);

  // File handling
  const handleFileSelect = useCallback((selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter(isValidAudioVideoFile);
    
    // Support for 100+ files
    if (validFiles.length > 100) {
      if (!confirm(`You're uploading ${validFiles.length} files. This may take some time. Continue?`)) {
        return;
      }
    }
    
    if (validFiles.length > 0) {
      dispatch(addFiles(validFiles));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [dispatch]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-blue-500', 'bg-blue-50');
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelect(droppedFiles);
  }, [handleFileSelect]);

  // Processing actions
  const handleStartBatchProcessing = () => {
    const pendingFileIds = files
      .filter(f => f.status === 'pending')
      .map(f => f.id);
    
    if (pendingFileIds.length === 0) {
      alert('No files ready for processing');
      return;
    }

    try {
      const count = startBatchProcessing(pendingFileIds);
      console.log(`Started processing ${count} files`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleReviewNext = () => {
    if (currentReviewIndex < reviewQueue.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
      setCurrentReviewFileId(reviewQueue[currentReviewIndex + 1]);
    } else {
      setShowReviewModal(false);
      if (approvedFiles.length > 0) {
        if (confirm(`${approvedFiles.length} files approved. Generate audio for all approved files?`)) {
          handleGenerateApprovedAudio();
        }
      }
    }
  };

  const handleGenerateApprovedAudio = async () => {
    try {
      const count = await startBatchAudioGeneration();
      console.log(`Generating audio for ${count} approved files`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleApproveAll = () => {
    dispatch(approveAllReviewed());
    setShowReviewModal(false);
    handleGenerateApprovedAudio();
  };

  const handleRetryFailed = () => {
    const count = retryFailedFiles();
    if (count > 0) {
      console.log(`Retrying ${count} failed files`);
    } else {
      alert('No failed files to retry');
    }
  };

  // Download actions
  const handleBulkDownload = async () => {
    try {
      const result = await bulkDownloadFiles(files);
      console.log(`Downloaded ${result.fileCount} files as ${result.filename}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDownloadAssetType = async (assetType) => {
    try {
      downloadAssetType(files, assetType);
    } catch (error) {
      alert(error.message);
    }
  };

  // Get status color for files
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-gray-700 bg-gray-100 border-gray-200';
      case 'transcribing': return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'transcribed': return 'text-indigo-700 bg-indigo-100 border-indigo-200';
      case 'ai_processing': return 'text-purple-700 bg-purple-100 border-purple-200';
      case 'ai_processed': return 'text-pink-700 bg-pink-100 border-pink-200';
      case 'review_pending': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'approved': return 'text-teal-700 bg-teal-100 border-teal-200';
      case 'generating_speech': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'completed': return 'text-green-700 bg-green-100 border-green-200';
      case 'failed': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Ready';
      case 'transcribing': return 'Transcribing...';
      case 'transcribed': return 'Transcribed';
      case 'ai_processing': return 'AI Processing...';
      case 'ai_processed': return 'AI Processed';
      case 'review_pending': return 'Review Required';
      case 'approved': return 'Approved';
      case 'generating_speech': return 'Generating Speech...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  AI Audio Batch Processor Pro
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Upload → AI Process → Review → Generate Audio
                </p>
              </div>
            </div>
            
            {/* Stats Display */}
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.reviewPending}</div>
                <div className="text-xs text-gray-500">Review</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-600">{stats.approved}</div>
                <div className="text-xs text-gray-500">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        {stats.total > 0 && (
          <div className="mb-8 bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{stats.completed}/{stats.total} completed</span>
                {reviewQueueLength > 0 && (
                  <button
                    onClick={() => {
                      setCurrentReviewFileId(reviewQueue[0]);
                      setCurrentReviewIndex(0);
                      setShowReviewModal(true);
                    }}
                    className="inline-flex items-center px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-full hover:bg-yellow-200"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Review {reviewQueueLength} Files
                  </button>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {stats.completionRate.toFixed(1)}% complete
              {queueLength > 0 && ` • ${queueLength} in queue`}
              {isProcessing && currentFile && ` • Processing: ${currentFile.name}`}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - File Upload & Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* File Upload Zone */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Files</h2>
              
              <div
                ref={dropZoneRef}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 group"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-blue-600" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Drop up to 100+ files here or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-500 underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Batch process multiple audio/video files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.mp4,.avi,.mov,.mkv"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </div>
            </div>

            {/* Processing Settings */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Processing Settings</h3>
              
              {/* Review Mode Toggle */}
              <div className="mb-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={globalSettings.batchReviewMode}
                    onChange={(e) => dispatch(setBatchReviewMode(e.target.checked))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable Review Mode (Review AI output before audio generation)
                  </span>
                </label>
              </div>

              {/* Custom Prompt Button */}
              <div className="mb-4">
                <button
                  onClick={() => setShowPromptModal(true)}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Configure AI Prompt
                </button>
              </div>

              {/* Current Prompt Display */}
              {globalSettings.customPrompt && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs font-medium text-purple-700 mb-1">Current Custom Prompt:</p>
                  <p className="text-xs text-gray-700">{globalSettings.customPrompt.substring(0, 100)}...</p>
                </div>
              )}

              {/* Voice Settings */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice:
                </label>
                <select
                  value={voiceSettings.voice}
                  onChange={(e) => dispatch(updateVoiceSettings({ voice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {availableVoices.map(voice => {
                    const parts = voice.split('_');
                    const gender = parts[0];
                    const name = parts[1];
                    const displayName = `${name} (${gender === 'af' ? 'Female' : gender === 'am' ? 'Male' : 'Other'})`;
                    return (
                      <option key={voice} value={voice}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speed: {voiceSettings.speed}x
                  </label>
                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.1"
                    value={voiceSettings.speed}
                    onChange={(e) => dispatch(updateVoiceSettings({ speed: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format:
                  </label>
                  <select
                    value={voiceSettings.format}
                    onChange={(e) => dispatch(updateVoiceSettings({ format: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                    <option value="opus">Opus</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={handleStartBatchProcessing}
                  disabled={isProcessing || stats.pending === 0}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m2-7V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2M4 12a8 8 0 1116 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" />
                      </svg>
                      Start Processing ({stats.pending})
                    </>
                  )}
                </button>

                {stats.approved > 0 && (
                  <button
                    onClick={handleGenerateApprovedAudio}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Generate Audio for Approved ({stats.approved})
                  </button>
                )}

                {reviewQueueLength > 0 && (
                  <button
                    onClick={handleApproveAll}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Approve All & Generate
                  </button>
                )}

                {stats.failed > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry Failed ({stats.failed})
                  </button>
                )}

                <button
                  onClick={() => dispatch(clearAllFiles())}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center px-4 py-3 border border-red-300 text-sm font-semibold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All
                </button>
              </div>
            </div>

            {/* Download Panel */}
            {stats.completed > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-200/50">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Downloads</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={handleBulkDownload}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download All ({stats.completed})
                  </button>

                  <button
                    onClick={() => handleDownloadAssetType('transcriptions')}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    📝 Transcriptions Only
                  </button>

                  <button
                    onClick={() => handleDownloadAssetType('ai_processed')}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    🤖 AI Processed Text
                  </button>

                  <button
                    onClick={() => handleDownloadAssetType('audio_files')}
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    🎵 Audio Files Only
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - File List */}
          <div className="lg:col-span-2">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50">
              <div className="p-6 border-b border-gray-200/50">
                <h2 className="text-xl font-bold text-gray-900">
                  File Queue ({files.length} files)
                </h2>
              </div>
              
              {files.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No files uploaded</h3>
                  <p className="text-gray-600">Upload audio or video files to start batch processing</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200/50 max-h-[600px] overflow-y-auto">
                  {files.map((file) => (
                    <div key={file.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 min-w-0 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            {file.progress > 0 && (
                              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${file.progress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(file.status)}`}>
                            {file.status === 'transcribing' && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                            )}
                            {file.status === 'ai_processing' && (
                              <div className="w-2 h-2 bg-purple-500 rounded-full mr-1 animate-bounce"></div>
                            )}
                            {file.status === 'review_pending' && (
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></div>
                            )}
                            {file.status === 'generating_speech' && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full mr-1 animate-spin"></div>
                            )}
                            {file.status === 'approved' && (
                              <div className="w-2 h-2 bg-teal-500 rounded-full mr-1"></div>
                            )}
                            {file.status === 'completed' && (
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                            )}
                            {file.status === 'failed' && (
                              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                            )}
                            {getStatusText(file.status)}
                          </span>
                          
                          {file.status === 'review_pending' && (
                            <button
                              onClick={() => {
                                setCurrentReviewFileId(file.id);
                                setShowReviewModal(true);
                              }}
                              className="text-yellow-600 hover:text-yellow-500 text-sm font-medium"
                              title="Review"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
                          
                          {file.status === 'ai_processed' && (
                            <button
                              onClick={() => reprocessFile(file.id)}
                              className="text-purple-600 hover:text-purple-500 text-sm font-medium"
                              title="Reprocess"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          
                          {file.status === 'completed' && (
                            <button
                              onClick={() => downloadSingleFileAssets(file)}
                              className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          )}
                          
                          <button
                            onClick={() => dispatch(removeFile(file.id))}
                            disabled={file.status === 'transcribing' || file.status === 'ai_processing' || file.status === 'generating_speech'}
                            className="text-red-600 hover:text-red-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          handleReviewNext();
        }}
        fileId={currentReviewFileId}
      />
      
      <CustomPromptModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
      />
    </div>
  );
}

export default TranscribeBatchEnhanced;