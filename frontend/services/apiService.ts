// API configuration - Use the actual gateway URL from the OpenAPI spec
const API_BASE_URL = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'https://talking-head-gateway-50v0hkfc.uc.gateway.dev';

// Types for API responses based on OpenAPI spec
interface UploadUrlResponse {
  upload_url: string;
  file_id: string;
  expires_at: string;
}

interface JobStatusResponse {
  job_id: string;
  status: string; // "queued", "processing", "completed", "failed"
  timestamp: string;
  updated_at?: string;
  data?: {
    object_path?: string;
    bucket?: string;
    configuration?: string;
    processing_type?: string;
    segments?: string; // Note: segments are stored as string in Firestore
    segment_count?: number;
    file_info?: {
      file_size_bytes?: number;
      local_filename?: string;
      bucket?: string;
    };
    [key: string]: any; // Allow other fields
  };
  error_message?: string;
  // Legacy fields for backward compatibility
  segments?: Array<{
    start: number;
    end: number;
  }>;
  downloadUrl?: string;
}

interface ProcessVideoRequest {
  objectPath: string;
  configuration?: string;
}

interface ProcessVideoResponse {
  job_id: string;
  message?: string;
}

// Get signed upload URL from API Gateway
export const getUploadUrl = async (): Promise<UploadUrlResponse> => {
  const response = await fetch(`${API_BASE_URL}/get-upload-url`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to get upload URL: ${response.statusText}`);
  }

  return response.json();
};

// Upload file directly to GCS using signed URL
export const uploadToGCS = async (file: File, signedUrl: string): Promise<void> => {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to GCS: ${response.statusText}`);
  }
};

// Notify backend that video has been uploaded and trigger processing
export const processVideo = async (fileId: string, configuration: string = 'default'): Promise<ProcessVideoResponse> => {
  const response = await fetch(`${API_BASE_URL}/process-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      objectPath: `${fileId}.mp4`,
      configuration,
    } as ProcessVideoRequest),
  });

  if (!response.ok) {
    throw new Error(`Failed to process video: ${response.statusText}`);
  }

  // API should return JSON with job_id (you'll need to update your backend to return this)
  return response.json();
};

// Get job status and results from API Gateway
export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/get-job-status?job_id=${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Job not found');
    }
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  return response.json();
};

// Upload video file to GCS (without triggering processing)
export const uploadVideoFile = async (
  file: File,
  onProgress?: (progress: { stage: string; percentage?: number }) => void
): Promise<{ fileId: string; message: string }> => {
  try {
    // Stage 1: Get signed upload URL
    onProgress?.({ stage: 'Getting upload URL...' });
    const { upload_url, file_id } = await getUploadUrl();

    // Stage 2: Upload to GCS
    onProgress?.({ stage: 'Uploading to cloud storage...' });
    await uploadToGCS(file, upload_url);

    onProgress?.({ stage: 'Upload completed!' });

    return {
      fileId: file_id,
      message: 'Video uploaded successfully',
    };
  } catch (error) {
    throw error;
  }
};

// Start processing for a specific video with configuration
export const startVideoProcessing = async (
  fileId: string, 
  configuration: string = 'default'
): Promise<{ jobId: string; message: string }> => {
  try {
    const processResult = await processVideo(fileId, configuration);
    return {
      jobId: processResult.job_id,
      message: processResult.message || 'Video processing started successfully',
    };
  } catch (error) {
    throw error;
  }
};

// Legacy functions for backward compatibility (can be removed later)
export const chat = async (message: string, chatHistory: any[], files: string[]): Promise<ReadableStream<any>> => {
  const formData = new FormData();
  formData.append('message', message);
  formData.append('chat_history', JSON.stringify(chatHistory));
  files.forEach(filePath => {
    formData.append('files', filePath);
  });

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to get response from server');
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return response.body;
};

export const uploadFiles = async (files: File[]): Promise<any> => {
  // Use new GCS upload flow for video files
  if (files.length === 1 && files[0].type.startsWith('video/')) {
    return uploadVideoFile(files[0]);
  }

  // Fallback to old upload method for non-video files
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'File upload failed');
  }

  return response.json();
};

export const getFiles = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/api/files`);

  if (!response.ok) {
    throw new Error('Failed to fetch files');
  }

  const data = await response.json();
  return data.files;
};

export const getStatus = async (): Promise<{ status: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/status`);

  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }

  return response.json();
};
