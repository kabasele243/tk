import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  approveFile,
  rejectFile,
  updateEditableAIResult,
  removeFromReviewQueue,
  processWithAI
} from '../store/slices/fileProcessingSlice';

function ReviewModal({ isOpen, onClose, fileId }) {
  const dispatch = useDispatch();
  
  // Memoize selectors to prevent unnecessary re-renders
  const file = useSelector(state => 
    state.fileProcessing.files.find(f => f.id === fileId), 
    (left, right) => left?.id === right?.id && left?.editableAIResult === right?.editableAIResult
  );
  const { aiSettings } = useSelector(state => state.settings);
  
  const [editedText, setEditedText] = useState('');
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [showComparison, setShowComparison] = useState(true);

  // Only update when file changes or when editableAIResult actually changes
  useEffect(() => {
    if (file?.editableAIResult && file.editableAIResult !== editedText) {
      setEditedText(file.editableAIResult);
    }
  }, [file?.editableAIResult, file?.id]);

  const handleApprove = useCallback(() => {
    if (editedText !== file?.editableAIResult) {
      dispatch(updateEditableAIResult({ fileId, text: editedText }));
    }
    dispatch(approveFile(fileId));
    dispatch(removeFromReviewQueue(fileId));
    onClose();
  }, [editedText, file?.editableAIResult, fileId, dispatch, onClose]);

  const handleReject = useCallback(() => {
    dispatch(rejectFile(fileId));
    dispatch(removeFromReviewQueue(fileId));
    onClose();
  }, [fileId, dispatch, onClose]);

  const handleReprocess = useCallback(async () => {
    if (isReprocessing) return; // Prevent multiple calls
    
    setIsReprocessing(true);
    try {
      const result = await dispatch(processWithAI({
        fileId,
        text: file?.editableTranscription || file?.transcription?.text,
        prompt: aiSettings.customPrompt || aiSettings.aiPrompt,
        apiKey: aiSettings.openaiApiKey
      })).unwrap();
      
      // Update the edited text with the new result
      if (result?.result?.processed_text) {
        setEditedText(result.result.processed_text);
      }
    } catch (error) {
      console.error('Reprocessing failed:', error);
      alert('Reprocessing failed: ' + error.message);
    } finally {
      setIsReprocessing(false);
    }
  }, [isReprocessing, fileId, file?.editableTranscription, file?.transcription?.text, aiSettings.customPrompt, aiSettings.aiPrompt, aiSettings.openaiApiKey, dispatch]);

  const handleSaveEdit = useCallback(() => {
    dispatch(updateEditableAIResult({ fileId, text: editedText }));
  }, [fileId, editedText, dispatch]);

  // Conditional return after all hooks are defined
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Review AI Processed Script</h2>
              <p className="text-blue-100 text-sm mt-1">{file.name}</p>
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
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {/* Toggle View */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {showComparison ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Edit Mode
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    Compare Mode
                  </>
                )}
              </button>
              
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {isReprocessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                    Reprocessing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reprocess with AI
                  </>
                )}
              </button>
            </div>

            {/* Character Count */}
            <div className="text-sm text-gray-500">
              {editedText.length} characters
            </div>
          </div>

          {/* Content Display */}
          {showComparison ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Original Transcription */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Original Transcription</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {file.transcription?.text || 'No transcription available'}
                  </pre>
                </div>
              </div>

              {/* AI Processed */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Processed Script</h3>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {file.aiResult?.processed_text || 'No AI result available'}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Edit AI Processed Script</h3>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Edit the AI processed text here..."
              />
              {editedText !== file.editableAIResult && (
                <div className="mt-2 flex items-center text-sm text-orange-600">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  You have unsaved changes
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Model Used</p>
              <p className="text-sm font-semibold text-gray-900">{file.aiResult?.model || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Tokens Used</p>
              <p className="text-sm font-semibold text-gray-900">{file.aiResult?.tokens_used || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Processing Time</p>
              <p className="text-sm font-semibold text-gray-900">
                {file.timestamps?.aiProcessingEnd && file.timestamps?.aiProcessingStart
                  ? `${Math.round((new Date(file.timestamps.aiProcessingEnd) - new Date(file.timestamps.aiProcessingStart)) / 1000)}s`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex space-x-3">
              {!showComparison && editedText !== file.editableAIResult && (
                <button
                  onClick={handleSaveEdit}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                  </svg>
                  Save Edit
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleReject}
                className="inline-flex items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject & Skip
              </button>
              
              <button
                onClick={handleApprove}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewModal;