import React, { useState, useRef, useCallback, useEffect } from 'react';
import OpenAI from 'openai';

function Transcribe() {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  
  // Step 1: Audio Upload & Transcription
  const [audioFile, setAudioFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [editableTranscription, setEditableTranscription] = useState('');
  
  // Step 2: AI Processing - Default presets
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
  
  const [selectedPromptType, setSelectedPromptType] = useState('professional');
  const [aiPrompt, setAiPrompt] = useState(defaultPrompts.professional);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [editableAiResult, setEditableAiResult] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const hasEnvApiKey = envApiKey && envApiKey.startsWith('sk-');
  
  // Initialize API key from environment on mount
  useEffect(() => {
    if (hasEnvApiKey) {
      setOpenaiApiKey(envApiKey);
    }
  }, [envApiKey, hasEnvApiKey]);
  
  // Step 3: Text-to-Speech
  const [voiceSettings, setVoiceSettings] = useState({
    voice: 'af_heart',
    speed: 1.0,
    format: 'mp3',
    model: 'kokoro'
  });
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [finalAudio, setFinalAudio] = useState(null);
  
  // Processing history
  const [processingHistory, setProcessingHistory] = useState([]);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // File validation
  const isValidFile = (file) => {
    const validTypes = [
      'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac',
      'video/mp4', 'video/avi', 'video/mov', 'video/mkv'
    ];
    return validTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|flac|mp4|avi|mov|mkv)$/i);
  };

  // Handle file selection
  const handleFileSelect = (selectedFiles) => {
    const file = Array.from(selectedFiles).find(isValidFile);
    if (file) {
      setAudioFile({
        file,
        name: file.name,
        size: file.size,
        type: file.type
      });
      setCurrentStep(1);
      // Reset all subsequent steps
      setTranscriptionResult(null);
      setEditableTranscription('');
      setAiResult(null);
      setEditableAiResult('');
      setFinalAudio(null);
      setCompletedSteps([]);
    }
  };

  // Step 1: Transcribe audio
  const transcribeAudio = async () => {
    if (!audioFile) return;
    
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioFile.file);
      formData.append('temperature', '0.0');

      const response = await fetch('http://0.0.0.0:8080/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setTranscriptionResult(result);
      setEditableTranscription(result.text);
      setCompletedSteps(prev => [...prev, 1]);
      setCurrentStep(2);
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Transcription failed. Please try again.');
    }
    setIsTranscribing(false);
  };

  // Step 2: Process with AI using OpenAI
  const processWithAI = async () => {
    if (!editableTranscription.trim() || !aiPrompt.trim()) return;
    
    if (!openaiApiKey.trim()) {
      alert('Please enter your OpenAI API key to use AI processing.');
      return;
    }
    
    setIsProcessingAI(true);
    try {
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
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
            content: `${aiPrompt}\n\nText to process:\n${editableTranscription}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const processedText = completion.choices[0]?.message?.content || '';
      
      const result = {
        processed_text: processedText,
        original_text: editableTranscription,
        prompt_used: aiPrompt,
        model: "gpt-3.5-turbo",
        tokens_used: completion.usage?.total_tokens || 0
      };
      
      setAiResult(result);
      setEditableAiResult(processedText);
      setCompletedSteps(prev => [...prev, 2]);
      setCurrentStep(3);
    } catch (error) {
      console.error('OpenAI processing failed:', error);
      if (error.message.includes('API key')) {
        alert('Invalid API key. Please check your OpenAI API key and try again.');
      } else if (error.message.includes('quota')) {
        alert('OpenAI API quota exceeded. Please check your billing and try again.');
      } else {
        alert(`AI processing failed: ${error.message}`);
      }
    }
    setIsProcessingAI(false);
  };

  // Load available voices on component mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch('http://0.0.0.0:8880/v1/audio/voices');
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      } catch (error) {
        console.error('Failed to load voices:', error);
        // Fallback voices if API fails
        setAvailableVoices(['af_heart', 'af_nova', 'am_adam', 'am_echo']);
      }
    };
    loadVoices();
  }, []);

  // Step 3: Generate speech using Kokoro TTS
  const generateSpeech = async () => {
    if (!editableAiResult.trim()) return;
    
    setIsGeneratingAudio(true);
    try {
      const response = await fetch('http://0.0.0.0:8880/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: voiceSettings.model,
          input: editableAiResult,
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
      setFinalAudio({
        url: audioUrl,
        blob: audioBlob
      });
      setCompletedSteps(prev => [...prev, 3]);
      
      // Add to processing history
      const historyItem = {
        id: Date.now(),
        originalFile: audioFile.name,
        transcription: editableTranscription,
        aiPrompt: aiPrompt,
        processedText: editableAiResult,
        audioUrl: audioUrl,
        voiceUsed: voiceSettings.voice,
        timestamp: new Date().toISOString()
      };
      setProcessingHistory(prev => [historyItem, ...prev]);
      
    } catch (error) {
      console.error('Kokoro TTS failed:', error);
      alert(`Text-to-speech generation failed: ${error.message}`);
    }
    setIsGeneratingAudio(false);
  };

  // Download functions
  const downloadText = (text, filename) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAudio = () => {
    if (!finalAudio) return;
    const a = document.createElement('a');
    a.href = finalAudio.url;
    a.download = `${audioFile.name.replace(/\.[^/.]+$/, '')}_processed.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Reset workflow
  const resetWorkflow = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setAudioFile(null);
    setTranscriptionResult(null);
    setEditableTranscription('');
    setAiResult(null);
    setEditableAiResult('');
    setFinalAudio(null);
  };

  // Handle drag and drop
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
  }, []);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      <div className="flex items-center space-x-8">
        {[
          { num: 1, title: 'Upload & Transcribe', icon: '🎵' },
          { num: 2, title: 'AI Processing', icon: '🤖' },
          { num: 3, title: 'Text-to-Speech', icon: '🔊' }
        ].map((step, index) => (
          <div key={step.num} className="flex items-center">
            <div className={`flex flex-col items-center ${
              completedSteps.includes(step.num) ? 'text-green-600' :
              currentStep === step.num ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${
                completedSteps.includes(step.num) 
                  ? 'bg-green-100 border-green-500 text-green-700' :
                currentStep === step.num 
                  ? 'bg-blue-100 border-blue-500 text-blue-700' : 
                  'bg-gray-100 border-gray-300 text-gray-500'
              }`}>
                {completedSteps.includes(step.num) ? '✓' : step.num}
              </div>
              <span className="mt-2 text-sm font-medium text-center max-w-20">{step.title}</span>
            </div>
            {index < 2 && (
              <div className={`w-12 h-1 mx-4 ${
                completedSteps.includes(step.num + 1) ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">AI Audio Processor</h1>
                <p className="text-sm text-gray-500 mt-1">Transcribe → AI Rewrite → Text-to-Speech</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {processingHistory.length > 0 && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {processingHistory.length} processed
                </span>
              )}
              <button
                onClick={resetWorkflow}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                New Process
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Step Indicator */}
        <StepIndicator />

        {/* Step 1: Upload & Transcribe */}
        {currentStep === 1 && (
          <div className="space-y-8">
            {/* File Upload */}
            {!audioFile && (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Upload Your Audio File</h2>
                <div
                  ref={dropZoneRef}
                  className="relative border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 group"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="mx-auto w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-12 h-12 text-blue-600" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 mb-4">
                    Drop your audio file here, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-500 font-semibold underline decoration-2 underline-offset-2"
                    >
                      browse
                    </button>
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-600 mb-4">
                    {['MP3', 'WAV', 'M4A', 'FLAC', 'MP4', 'AVI', 'MOV', 'MKV'].map((format) => (
                      <span key={format} className="px-3 py-1 bg-gray-100 rounded-full font-medium">
                        {format}
                      </span>
                    ))}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.mp4,.avi,.mov,.mkv"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* File Selected & Transcription */}
            {audioFile && (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Step 1: Transcription</h3>
                
                {/* File Info */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{audioFile.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(audioFile.size)} • {audioFile.type}</p>
                    </div>
                  </div>
                </div>

                {/* Transcription Button */}
                {!transcriptionResult && (
                  <div className="text-center">
                    <button
                      onClick={transcribeAudio}
                      disabled={isTranscribing}
                      className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                      {isTranscribing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Transcribing...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Start Transcription
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Transcription Result & Edit */}
                {transcriptionResult && (
                  <div className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="text-lg font-semibold text-green-900">Transcription Complete</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        Duration: {transcriptionResult.duration?.toFixed(1)}s | Processing: {transcriptionResult.processing_time?.toFixed(1)}s
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Edit Transcription (if needed):
                      </label>
                      <textarea
                        value={editableTranscription}
                        onChange={(e) => setEditableTranscription(e.target.value)}
                        rows={8}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Transcribed text will appear here..."
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => downloadText(editableTranscription, `${audioFile.name}_transcription.txt`)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Transcription
                      </button>
                      
                      <button
                        onClick={() => setCurrentStep(2)}
                        disabled={!editableTranscription.trim()}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        Continue to AI Processing
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: AI Processing */}
        {currentStep === 2 && editableTranscription && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Step 2: AI Processing & Rewriting</h3>
            
            <div className="space-y-6">
              {/* AI Processing Preset Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Processing Type:
                </label>
                <select
                  value={selectedPromptType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setSelectedPromptType(type);
                    if (type !== 'custom') {
                      setAiPrompt(defaultPrompts[type]);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">📋 Professional Rewrite</option>
                  <option value="summary">📝 Summary</option>
                  <option value="bullet_points">• Bullet Points</option>
                  <option value="formal">🏢 Formal Business</option>
                  <option value="simple">🎯 Simplified Language</option>
                  <option value="blog_post">📰 Blog Post</option>
                  <option value="email">📧 Email Format</option>
                  <option value="presentation">🎤 Presentation Points</option>
                  <option value="social_media">📱 Social Media</option>
                  <option value="storytelling">📖 Storytelling</option>
                  <option value="technical">⚙️ Technical Detail</option>
                  <option value="casual">😊 Casual Tone</option>
                  <option value="custom">✏️ Custom Instructions</option>
                </select>
              </div>
              
              {/* OpenAI API Key Input - Only show if no environment key */}
              {!hasEnvApiKey && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OpenAI API Key:
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      placeholder="sk-..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">OpenAI Platform</a> or set VITE_OPENAI_API_KEY in .env file
                  </p>
                </div>
              )}
              
              {/* Environment API Key Status */}
              {hasEnvApiKey && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-green-800 font-medium">OpenAI API key loaded from environment</span>
                  </div>
                  <p className="text-green-700 text-sm mt-1">Using API key from .env file (VITE_OPENAI_API_KEY)</p>
                </div>
              )}
              
              {/* AI Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedPromptType === 'custom' ? 'Custom AI Processing Instructions:' : 'AI Processing Instructions:'}
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => {
                    setAiPrompt(e.target.value);
                    if (selectedPromptType !== 'custom') {
                      setSelectedPromptType('custom');
                    }
                  }}
                  rows={selectedPromptType === 'custom' ? 4 : 3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder={selectedPromptType === 'custom' ? 'Enter your custom instructions for how you want the AI to process your text...' : 'Preset instructions loaded. You can edit them if needed.'}
                  disabled={selectedPromptType !== 'custom' && aiPrompt === defaultPrompts[selectedPromptType]}
                />
                {selectedPromptType !== 'custom' && (
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Using preset instructions. Click to edit or select "Custom Instructions" for full control.
                  </div>
                )}
              </div>

              {/* Original Text Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Transcription:
                </label>
                <div className="bg-gray-50 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-gray-800">{editableTranscription}</p>
                </div>
              </div>

              {/* Process Button */}
              {!aiResult && (
                <div className="text-center">
                  <button
                    onClick={processWithAI}
                    disabled={isProcessingAI || !aiPrompt.trim() || !openaiApiKey.trim()}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    {isProcessingAI ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Processing with OpenAI...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Process with OpenAI GPT-3.5
                      </>
                    )}
                  </button>
                  {(!openaiApiKey.trim() || !aiPrompt.trim()) && (
                    <p className="text-sm text-gray-500 mt-2">
                      {!openaiApiKey.trim() ? (hasEnvApiKey ? 'Loading API key...' : 'Enter your OpenAI API key') : 'Enter processing instructions'} to continue
                    </p>
                  )}
                </div>
              )}

              {/* AI Result & Edit */}
              {aiResult && (
                <div className="space-y-6">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="text-lg font-semibold text-purple-900">OpenAI Processing Complete</h4>
                      </div>
                      {aiResult?.tokens_used && (
                        <span className="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                          {aiResult.tokens_used} tokens used
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-purple-700">
                      Processed using {aiResult?.model || 'GPT-3.5 Turbo'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edit AI-Processed Text (if needed):
                    </label>
                    <textarea
                      value={editableAiResult}
                      onChange={(e) => setEditableAiResult(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="AI-processed text will appear here..."
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                        Back to Transcription
                      </button>
                      
                      <button
                        onClick={() => downloadText(editableAiResult, `${audioFile.name}_processed.txt`)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Processed Text
                      </button>
                    </div>
                    
                    <button
                      onClick={() => setCurrentStep(3)}
                      disabled={!editableAiResult.trim()}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                      Continue to Text-to-Speech
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Text-to-Speech */}
        {currentStep === 3 && editableAiResult && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Step 3: Text-to-Speech Generation</h3>
            
            <div className="space-y-6">
              {/* Voice Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Voice:</label>
                  <select
                    value={voiceSettings.voice}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {availableVoices.length > 0 ? (
                      availableVoices.map(voice => {
                        // Parse voice names for better display
                        const parts = voice.split('_');
                        const gender = parts[0];
                        const name = parts[1];
                        const displayName = `${name} (${gender === 'af' ? 'Female' : gender === 'am' ? 'Male' : gender === 'bf' ? 'British F' : gender === 'bm' ? 'British M' : gender === 'ef' ? 'Echo F' : gender === 'em' ? 'Echo M' : 'Other'})`;
                        return (
                          <option key={voice} value={voice}>
                            {displayName}
                          </option>
                        );
                      })
                    ) : (
                      <option value="af_heart">Loading voices...</option>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Speed: {voiceSettings.speed}x</label>
                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.1"
                    value={voiceSettings.speed}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format:</label>
                  <select
                    value={voiceSettings.format}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, format: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                    <option value="opus">Opus</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model:</label>
                  <select
                    value={voiceSettings.model}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="kokoro">Kokoro</option>
                    <option value="tts-1">TTS-1</option>
                    <option value="tts-1-hd">TTS-1 HD</option>
                  </select>
                </div>
              </div>

              {/* Text Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text to Convert to Speech:
                </label>
                <div className="bg-gray-50 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-gray-800">{editableAiResult}</p>
                </div>
                <p className="text-sm text-gray-500 mt-2">{editableAiResult.length} characters</p>
              </div>

              {/* Generate Button */}
              {!finalAudio && (
                <div className="text-center">
                  <button
                    onClick={generateSpeech}
                    disabled={isGeneratingAudio}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    {isGeneratingAudio ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Generating Audio...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        Generate Speech with Kokoro
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Final Result */}
              {finalAudio && (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="text-lg font-semibold text-green-900">Audio Generation Complete!</h4>
                    </div>
                    
                    {/* Audio Player */}
                    <audio controls className="w-full mb-4">
                      <source src={finalAudio.url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                        Back to AI Processing
                      </button>
                      
                      <button
                        onClick={downloadAudio}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Audio ({voiceSettings.format.toUpperCase()})
                      </button>
                    </div>
                    
                    <button
                      onClick={resetWorkflow}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Process Another Audio
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing History */}
        {processingHistory.length > 0 && (
          <div className="mt-16 bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200/50">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Processing History</h3>
            <div className="space-y-4">
              {processingHistory.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{item.originalFile}</h4>
                      <p className="text-sm text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => downloadText(item.transcription, `${item.originalFile}_transcription.txt`)}
                        className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Download Transcription
                      </button>
                      <button
                        onClick={() => downloadText(item.processedText, `${item.originalFile}_processed.txt`)}
                        className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        Download Processed
                      </button>
                      <a
                        href={item.audioUrl}
                        download={`${item.originalFile}_final.mp3`}
                        className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        Download Audio
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">AI Prompt Used:</p>
                      <p className="text-gray-600 bg-white rounded p-2">{item.aiPrompt}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Final Audio:</p>
                      <audio controls className="w-full">
                        <source src={item.audioUrl} type="audio/mpeg" />
                      </audio>
                      {item.voiceUsed && (
                        <p className="text-xs text-gray-500 mt-1">Voice: {item.voiceUsed}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transcribe;