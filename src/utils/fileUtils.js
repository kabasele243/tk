import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// File validation
export const isValidAudioVideoFile = (file) => {
  const validTypes = [
    'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/mpeg',
    'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'
  ];
  const validExtensions = /\.(mp3|wav|m4a|flac|mp4|avi|mov|mkv|webm)$/i;
  
  return validTypes.includes(file.type) || validExtensions.test(file.name);
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format duration
export const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Generate safe filename
export const generateSafeFilename = (originalName, suffix = '', extension = '') => {
  const basename = originalName.replace(/\.[^/.]+$/, '');
  const safeName = basename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  
  let filename = safeName;
  if (suffix) {
    filename += `_${suffix}`;
  }
  filename += `_${timestamp}`;
  
  if (extension) {
    filename += extension.startsWith('.') ? extension : `.${extension}`;
  }
  
  return filename;
};

// Create folder structure for a file
export const createFileFolder = async (file, zip) => {
  const folderName = generateSafeFilename(file.name, 'processed').replace(/\.[^/.]+$/, '');
  
  // Create main folder
  const folder = zip.folder(folderName);
  
  // Add transcription file
  if (file.transcription) {
    const transcriptionContent = `Original File: ${file.name}
Processed: ${new Date(file.timestamps.transcriptionEnd).toLocaleString()}
Duration: ${formatDuration(file.transcription.duration)}
Processing Time: ${file.transcription.processing_time?.toFixed(2)}s

TRANSCRIPTION:
${file.editableTranscription || file.transcription.text}`;
    
    folder.file(`transcription.txt`, transcriptionContent);
  }
  
  // Add AI processed text
  if (file.aiResult) {
    const aiContent = `Original File: ${file.name}
AI Model: ${file.aiResult.model}
Tokens Used: ${file.aiResult.tokens_used}
Processed: ${new Date(file.timestamps.aiProcessingEnd).toLocaleString()}
Prompt Used: ${file.aiResult.prompt_used}

ORIGINAL TEXT:
${file.aiResult.original_text}

PROCESSED TEXT:
${file.editableAIResult || file.aiResult.processed_text}`;
    
    folder.file(`ai_processed.txt`, aiContent);
  }
  
  // Add final audio file
  if (file.finalAudio && file.finalAudio.blob) {
    const audioExtension = file.voiceSettings?.format || 'mp3';
    folder.file(`final_audio.${audioExtension}`, file.finalAudio.blob);
  }
  
  // Add metadata file
  const metadata = {
    originalFile: {
      name: file.name,
      size: file.size,
      type: file.type
    },
    processing: {
      status: file.status,
      progress: file.progress,
      timestamps: file.timestamps,
      errors: file.errors
    },
    transcription: file.transcription ? {
      duration: file.transcription.duration,
      processing_time: file.transcription.processing_time,
      text_length: file.transcription.text?.length
    } : null,
    aiProcessing: file.aiResult ? {
      model: file.aiResult.model,
      tokens_used: file.aiResult.tokens_used,
      prompt_type: file.promptType
    } : null,
    voiceGeneration: file.finalAudio ? {
      voice: file.voiceSettings?.voice,
      speed: file.voiceSettings?.speed,
      format: file.voiceSettings?.format,
      model: file.voiceSettings?.model
    } : null
  };
  
  folder.file(`metadata.json`, JSON.stringify(metadata, null, 2));
  
  return folderName;
};

// Bulk download all completed files
export const bulkDownloadFiles = async (files, settings = {}) => {
  const zip = new JSZip();
  const completedFiles = files.filter(f => f.status === 'completed');
  
  if (completedFiles.length === 0) {
    throw new Error('No completed files to download');
  }
  
  // Create individual folders for each file
  const folderNames = [];
  for (const file of completedFiles) {
    try {
      const folderName = await createFileFolder(file, zip);
      folderNames.push(folderName);
    } catch (error) {
      console.error(`Error creating folder for ${file.name}:`, error);
    }
  }
  
  // Create summary file
  const summary = {
    generated: new Date().toISOString(),
    totalFiles: completedFiles.length,
    files: completedFiles.map(f => ({
      name: f.name,
      status: f.status,
      duration: f.transcription?.duration,
      tokensUsed: f.aiResult?.tokens_used,
      voice: f.voiceSettings?.voice,
      processingTime: {
        transcription: f.transcription?.processing_time,
        totalTime: f.timestamps.speechGenerationEnd ? 
          (new Date(f.timestamps.speechGenerationEnd) - new Date(f.timestamps.transcriptionStart)) / 1000 : null
      }
    }))
  };
  
  zip.file('processing_summary.json', JSON.stringify(summary, null, 2));
  
  // Generate and download zip
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `transcribe_batch_${new Date().toISOString().slice(0, 10)}_${completedFiles.length}files.zip`;
  
  saveAs(content, filename);
  
  return {
    filename,
    fileCount: completedFiles.length,
    folderNames
  };
};

// Download single file assets
export const downloadSingleFileAssets = async (file) => {
  const zip = new JSZip();
  await createFileFolder(file, zip);
  
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${generateSafeFilename(file.name, 'complete')}.zip`;
  
  saveAs(content, filename);
  
  return filename;
};

// Download specific asset type
export const downloadAssetType = (files, assetType) => {
  const completedFiles = files.filter(f => f.status === 'completed');
  
  switch (assetType) {
    case 'transcriptions':
      downloadTranscriptions(completedFiles);
      break;
    case 'ai_processed':
      downloadAIProcessedTexts(completedFiles);
      break;
    case 'audio_files':
      downloadAudioFiles(completedFiles);
      break;
    default:
      throw new Error(`Unknown asset type: ${assetType}`);
  }
};

// Download all transcriptions as single file
const downloadTranscriptions = (files) => {
  let combinedText = `Transcription Batch Export
Generated: ${new Date().toLocaleString()}
Total Files: ${files.length}

${'='.repeat(80)}

`;

  files.forEach((file, index) => {
    combinedText += `${index + 1}. ${file.name}
Duration: ${formatDuration(file.transcription?.duration)}
Processed: ${new Date(file.timestamps.transcriptionEnd).toLocaleString()}

${file.editableTranscription || file.transcription?.text}

${'='.repeat(80)}

`;
  });

  const blob = new Blob([combinedText], { type: 'text/plain' });
  const filename = `all_transcriptions_${new Date().toISOString().slice(0, 10)}.txt`;
  saveAs(blob, filename);
};

// Download all AI processed texts
const downloadAIProcessedTexts = (files) => {
  let combinedText = `AI Processed Text Batch Export
Generated: ${new Date().toLocaleString()}
Total Files: ${files.length}

${'='.repeat(80)}

`;

  files.forEach((file, index) => {
    if (file.aiResult) {
      combinedText += `${index + 1}. ${file.name}
Model: ${file.aiResult.model}
Tokens: ${file.aiResult.tokens_used}
Prompt: ${file.aiResult.prompt_used}

${file.editableAIResult || file.aiResult.processed_text}

${'='.repeat(80)}

`;
    }
  });

  const blob = new Blob([combinedText], { type: 'text/plain' });
  const filename = `all_ai_processed_${new Date().toISOString().slice(0, 10)}.txt`;
  saveAs(blob, filename);
};

// Download all audio files as zip
const downloadAudioFiles = async (files) => {
  const zip = new JSZip();
  
  files.forEach((file, index) => {
    if (file.finalAudio && file.finalAudio.blob) {
      const extension = file.voiceSettings?.format || 'mp3';
      const filename = `${index + 1}_${generateSafeFilename(file.name)}.${extension}`;
      zip.file(filename, file.finalAudio.blob);
    }
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `all_audio_files_${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(content, filename);
};