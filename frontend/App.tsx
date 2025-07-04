import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import VideoUploadGroup from './components/VideoUploadGroup';
import VideoPlayer, { VideoSegment } from './components/VideoPlayer';
import ExampleButtons from './components/ExampleButtons';
import FileDetailsPanel from './components/FileDetailsPanel';
import { FileItem } from './components/FilePreview';
import { uploadVideoFile, startVideoProcessing, getJobStatus } from './services/apiService';

const getFileType = (fileName: string): 'video' | 'other' => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'webp':
      return 'video';
    case 'mp4':
      return "video";
    case 'mov':
      return 'video';
    case 'avi':
      return 'video';
    default:
      return 'other';
  }
};

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAttaching, setIsAttaching] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<FileItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [processingOperation, setProcessingOperation] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [lastProcessingFile, setLastProcessingFile] = useState<FileItem | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [processingResults, setProcessingResults] = useState<any>(null);

  // Example files for the interface
  const exampleFiles: FileItem[] = [
    { name: 'dog.mp4', type: 'video', source: 'local', url: '/dog.mp4' },
    { name: 'cups.mp4', type: 'video', source: 'local', url: '/cups.mp4' },
    { name: 'default_juggle.mp4', type: 'video', source: 'local', url: '/default_juggle.mp4' },
  ];

  // Reset function to return to initial state
  const resetApp = () => {
    setUploadedFiles([]);
    setCurrentVideo(null);
    setError(null);
    setIsLoading(false);
    setIsAttaching(false);
    setSelectedFile(null);
    setCurrentFileId(null);
    setCurrentJobId(null);
    setProcessingResults(null);
    setProcessingOperation(null);
    setProcessingStatus('');
    setLastProcessingFile(null);
  };

  const handleFileSelect = async (file: FileItem) => {
    // If it's a video file from examples, treat it as an upload
    if (file.type === 'video' && file.source === 'local') {
      await handleExampleVideoSelect(file);
    } else {
      // For non-video files, just show in details panel
      setSelectedFile(file);
    }
  };

  const handleExampleVideoSelect = async (file: FileItem) => {
    if (!file.url) {
      setError('Example file URL not found');
      return;
    }

    setIsAttaching(true);
    setError(null);
    setUploadProgress('');

    try {
      // Fetch the example file and convert to File object
      setUploadProgress('Loading example video...');
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error('Failed to load example video');
      }
      
      const blob = await response.blob();
      const videoFile = new File([blob], file.name, { type: 'video/mp4' });

      // Create FileItem for the uploaded file
      const newFileItem: FileItem = {
        name: file.name,
        type: 'video',
        source: 'uploaded',
        dataUrl: URL.createObjectURL(blob),
      };

      // Set as uploaded file
      setUploadedFiles([newFileItem]);

      // Upload to GCS using the same flow as regular uploads
      const result = await uploadVideoFile(videoFile, (progress) => {
        setUploadProgress(progress.stage);
      });
      
      console.log('Example video uploaded successfully:', result);
      
      // Store the file ID for processing
      setCurrentFileId(result.fileId);
      
      // Set the current video to switch to player view
      setCurrentVideo(newFileItem);
    } catch (e: any) {
      console.error('Example video upload error:', e);
      setError(e.message || "An error occurred while loading the example video.");
      setUploadedFiles([]);
    } finally {
      setIsAttaching(false);
      setUploadProgress('');
    }
  };

  const handleClosePanel = () => {
    setSelectedFile(null);
  };

  const handleExampleSelect = (operation: string) => {
    // Handle operation selection
    console.log('Operation selected:', operation);
    
    if (operation === 'Mask video') {
      handleMaskVideo();
    }
  };

  const handleMaskVideo = async () => {
    if (!currentVideo || !currentFileId) {
      setError('Please upload a video first before processing.');
      return;
    }

    // Create a processing file item to show in the right panel
    const processingFile: FileItem = {
      name: '',
      type: 'other',
      source: 'uploaded',
    };

    // Open the right panel and start processing
    setSelectedFile(processingFile);
    setLastProcessingFile(processingFile);
    setProcessingOperation('Mask Video');
    setProcessingStatus('Starting processing...');
    setError(null);

    try {
      console.log('Processing ', currentVideo.name);
      console.log('File ID:', currentFileId);
      
      // Start processing
      setProcessingStatus('Submitting video for processing...');
      const processResult = await startVideoProcessing(currentFileId, 'processing');
      
      console.log('Processing started:', processResult);
      setCurrentJobId(processResult.jobId);
      
      // Poll for job status
      setProcessingStatus('Processing video - this may take a few minutes...');
      
      let isProcessingComplete = false;
      
      const pollInterval = setInterval(async () => {
        try {
          const statusResult = await getJobStatus(processResult.jobId);
          console.log('Job status:', statusResult);
          
          if (statusResult.status === 'completed') {
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            isProcessingComplete = true;

            console.log(statusResult);
            
            // Extract segments from the result - they are in statusResult.data.segments as a string
            let segments = [];
            try {
              // Try to parse segments from data.segments (string format from Firestore)
              if (statusResult.data?.segments) {
                segments = JSON.parse(statusResult.data.segments);
              } else if (statusResult.segments) {
                // Fallback to direct segments array
                segments = statusResult.segments;
              }
            } catch (parseError) {
              console.error('Error parsing segments:', parseError);
              segments = [];
            }
            
            setProcessingResults({ ...statusResult, parsedSegments: segments });
            
            setProcessingStatus(`Processed successfully.`);
          } else if (statusResult.status === 'failed') {
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            isProcessingComplete = true;
            setProcessingStatus('❌ Processing failed. Please try again.');
          } else if (statusResult.status === 'processing') {
            setProcessingStatus('🔄 Processing video - propogating...');
          } else {
            setProcessingStatus(`⏳ Status: ${statusResult.status}`);
          }
        } catch (pollError: any) {
          console.error('Error polling job status:', pollError);
          // Don't clear interval on polling errors, just log them
        }
      }, 3000); // Poll every 3 seconds
      
      // Set a timeout to stop polling after 10 minutes
      const timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        if (!isProcessingComplete) {
          setProcessingStatus('⏰ Processing is taking longer than expected. Please check back later.');
        }
      }, 600000); // 10 minutes
      
    } catch (e: any) {
      console.error('Segment extraction error:', e);
      setProcessingStatus('❌ Error: ' + (e.message || 'An error occurred while starting the extraction process.'));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Filter for video files only
      const videoFiles = Array.from(files).filter(file => 
        file.type.startsWith('video/') || 
        ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(file.name.split('.').pop()?.toLowerCase() || '')
      );

      if (videoFiles.length === 0) {
        setError('Please select a video file (MP4, MOV, AVI, etc.)');
        return;
      }

      const largeFiles = videoFiles.filter(file => file.size > 500 * 1024 * 1024); // 500MB limit for videos
      if (largeFiles.length > 0) {
        setError(`Video file(s) ${largeFiles.map(f => f.name).join(', ')} exceed the 500MB limit.`);
        return;
      }

      setIsAttaching(true);
      setError(null);

      const newFileItems: FileItem[] = videoFiles.map(file => ({
        name: file.name,
        type: getFileType(file.name),
        source: 'uploaded',
        dataUrl: URL.createObjectURL(file),
      }));

      // Replace existing uploaded files (only allow one video at a time for now)
      setUploadedFiles(newFileItems);

      try {
        // Upload video file using GCS API
        const videoFile = videoFiles[0];
        const result = await uploadVideoFile(videoFile, (progress) => {
          setUploadProgress(progress.stage);
        });
        
        console.log('Video uploaded successfully:', result);
        
        // Store the file ID for processing
        setCurrentFileId(result.fileId);
        
        // Set the current video to switch to player view
        setCurrentVideo(newFileItems[0]);
      } catch (e: any) {
        setError(e.message || "An error occurred while uploading the video.");
        setUploadedFiles([]);
      } finally {
        setIsAttaching(false);
        setUploadProgress('');
      }
    }
  };

  const handleSubmit = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError("Please upload a video file first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Mock processing for now - replace with actual API call later
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Processing video:', uploadedFiles[0].name);
      setError("Video processing started! (This is a mock - actual processing will be implemented next)");
    } catch (e: any) {
      console.error("Processing error:", e);
      setError(e.message || "An error occurred while processing the video.");
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles]);

  return (
    <div className="h-screen bg-white flex flex-col relative overflow-hidden font-inconsolata">
      <div
        className="absolute top-0 right-0 w-[800px] h-[800px] bg-no-repeat bg-right-top z-0 bg-contain"
        style={{ backgroundImage: "url('/bg_1.png')" }}
      ></div>
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-no-repeat bg-left-bottom z-0 bg-contain"
        style={{ backgroundImage: "url('/bg_2.png')" }}
      ></div>
      <div className="flex flex-grow w-full h-full">
        <div className={`flex-grow flex flex-col z-10 transition-all duration-300 ${selectedFile ? 'mr-[40%]' : 'w-full'} overflow-hidden`}>
          <Header />
          <main className="flex-grow flex flex-col z-10 py-8 md:py-16 justify-center items-center overflow-hidden">
            <div className="w-full max-w-[900px] mx-auto flex flex-col justify-center items-center">
              {currentVideo ? (
                <>
                  <VideoPlayer
                    videoFile={currentVideo}
                    onClose={resetApp}
                  />
                  <ExampleButtons
                    onFileSelect={handleFileSelect}
                    onExampleSelect={handleExampleSelect}
                    exampleFiles={exampleFiles}
                    isLoading={isLoading}
                    showExampleFiles={false}
                    showOperations={true}
                  />
                </>
              ) : (
                <>
                  <VideoUploadGroup
                    onFileChange={handleFileChange}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    isAttaching={isAttaching}
                    uploadedFiles={uploadedFiles}
                    onFileSelect={handleFileSelect}
                    onExampleSelect={handleExampleSelect}
                    exampleFiles={exampleFiles}
                    error={error}
                    uploadProgress={uploadProgress}
                  />
                  <ExampleButtons
                    onFileSelect={handleFileSelect}
                    onExampleSelect={handleExampleSelect}
                    exampleFiles={exampleFiles}
                    isLoading={isLoading}
                    showExampleFiles={true}
                    showOperations={false}
                  />
                </>
              )}
            </div>
          </main>
          <footer className="w-full text-center py-4 text-xs text-gray-500 z-10 font-inconsolata">
            Video Masking Demo &copy; {new Date().getFullYear()}
          </footer>
        </div>
        {selectedFile && <FileDetailsPanel file={selectedFile} onClose={handleClosePanel} processingOperation={processingOperation} processingStatus={processingStatus} processingResults={processingResults} currentVideo={currentVideo} />}
        {!selectedFile && lastProcessingFile && currentVideo && (
          <button
            onClick={() => setSelectedFile(lastProcessingFile)}
            className="fixed right-0 top-0 h-full w-8 bg-blue-500/30 hover:bg-blue-500/50 text-white flex items-center justify-center shadow-lg z-20 transition-all duration-300"
            title="Show processing results"
          >
            <span className="text-2xl font-bold rotate-90 writing-mode-vertical">{'<'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
