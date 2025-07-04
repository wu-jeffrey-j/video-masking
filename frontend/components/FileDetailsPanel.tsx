import React, { useState, useEffect } from 'react';
import { FileItem } from './FilePreview';

interface FileDetailsPanelProps {
  file: FileItem | null;
  onClose: () => void;
  processingOperation?: string | null;
  processingStatus?: string;
  processingResults?: any;
  currentVideo?: FileItem | null;
}

const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({ file, onClose, processingOperation, processingStatus, processingResults, currentVideo }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isPlayingFullVideo, setIsPlayingFullVideo] = useState(false);

  // Handle video time updates to pause at segment end
  useEffect(() => {
    if (videoRef && selectedSegment !== null && processingResults?.parsedSegments) {
      const segment = processingResults.parsedSegments[selectedSegment];
      if (segment && segment.length >= 2) {
        const endTime = segment[1];
        
        const handleTimeUpdate = () => {
          if (videoRef.currentTime >= endTime) {
            videoRef.pause();
            // Remove the event listener to prevent multiple pauses
            videoRef.removeEventListener('timeupdate', handleTimeUpdate);
          }
        };

        videoRef.addEventListener('timeupdate', handleTimeUpdate);
        
        // Cleanup function
        return () => {
          videoRef.removeEventListener('timeupdate', handleTimeUpdate);
        };
      }
    }
  }, [videoRef, selectedSegment, processingResults]);

  // Handle segment selection
  const handleSegmentSelect = (index: number) => {
    setSelectedSegment(index);
    setIsPlayingFullVideo(false);
    if (videoRef && processingResults?.parsedSegments) {
      const segment = processingResults.parsedSegments[index];
      if (segment && segment.length >= 2) {
        // Signal that this is a programmatic seek
        if ((videoRef as any)._programmaticSeek) {
          (videoRef as any)._programmaticSeek();
        }
        videoRef.currentTime = segment[0];
        videoRef.play();
      }
    }
  };

  // Detect when user manually seeks the video or plays after segment end
  useEffect(() => {
    if (videoRef) {
      let programmaticSeek = false; // Flag to track programmatic seeks
      
      const handleSeeked = () => {
        // Skip if this was a programmatic seek (from segment selection)
        if (programmaticSeek) {
          programmaticSeek = false;
          return;
        }
        
        // Check if the current time is outside any selected segment
        if (selectedSegment !== null && processingResults?.parsedSegments) {
          const segment = processingResults.parsedSegments[selectedSegment];
          if (segment && segment.length >= 2) {
            const [startTime, endTime] = segment;
            const currentTime = videoRef.currentTime;
            
            // Add small tolerance for floating point precision
            const tolerance = 0.1;
            
            // If user seeked outside the current segment, switch to "playing full video" mode
            if (currentTime < (startTime - tolerance) || currentTime > (endTime + tolerance)) {
              setIsPlayingFullVideo(true);
              setSelectedSegment(null);
            }
          }
        } else if (!isPlayingFullVideo && !selectedSegment) {
          // If no segment was selected and user seeks, they're playing full video
          setIsPlayingFullVideo(true);
        }
      };

      const handlePlay = () => {
        // If video starts playing and we're not in segment mode, switch to full video mode
        if (selectedSegment === null && !isPlayingFullVideo) {
          setIsPlayingFullVideo(true);
        }
      };

      // Store reference to programmatic seek flag for segment selection
      (videoRef as any)._programmaticSeek = () => {
        programmaticSeek = true;
      };

      videoRef.addEventListener('seeked', handleSeeked);
      videoRef.addEventListener('play', handlePlay);
      
      return () => {
        videoRef.removeEventListener('seeked', handleSeeked);
        videoRef.removeEventListener('play', handlePlay);
      };
    }
  }, [videoRef, selectedSegment, processingResults, isPlayingFullVideo]);

  useEffect(() => {
    if (file) {
      const url = file.source === 'local' ? file.name : file.dataUrl;
      if (url) {
        if (file.type === 'txt') {
          fetch(url)
            .then(response => {
              setFileSize(`${(response.headers.get('content-length') || 0)} bytes`);
              return response.text();
            })
            .then(text => {
              setTextContent(text);
            })
            .catch(error => console.error('Error fetching file:', error));
        } else if (file.source === 'uploaded' && url) {
           fetch(url)
            .then(response => response.blob())
            .then(blob => setFileSize(`${blob.size} bytes`))
            .catch(error => console.error('Error fetching file size:', error));
        }
      }
    }
  }, [file]);

  const handleClose = () => {
    setIsClosing(true);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  };

  if (!file) {
    return null;
  }

  const getFileTypeDisplay = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpeg':
      case 'jpg':
        return 'JPEG Image';
      case 'png':
        return 'PNG Image';
      case 'webp':
        return 'WEBP Image';
      case 'gif':
        return 'GIF Image';
      case 'pdf':
        return 'PDF Document';
      case 'txt':
        return 'Text File';
      case 'mp4':
        return 'MP4 Video';
      case 'mov':
        return 'MOV Video';
      case 'avi':
        return 'AVI Video';
      default:
        return 'File';
    }
  };

  const fileUrl = file.source === 'local' ? file.name : file.dataUrl;

  return (
    <div className={`fixed right-0 top-0 h-full w-2/5 flex z-30 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      {/* Close button on the left side */}
      <button
        onClick={handleClose}
        className="w-8 h-full bg-blue-500/30 hover:bg-blue-500/50 text-white flex items-center justify-center shadow-lg z-20 transition-all duration-300"
        title="Close panel"
      >
        <span className="text-2xl font-bold rotate-90 writing-mode-vertical">{'>'}</span>
      </button>
      
      {/* Panel content */}
      <div className="flex-1 bg-white shadow-lg z-30 p-6 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Details & Preview: {file.name}</h2>
        </div>
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 font-inconsolata">Video Masking Process</h3>
          {/* <p className="text-sm text-gray-700 mb-3 font-inconsolata">
            
          </p>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside font-inconsolata">
            <li>It is at least 10 seconds long.</li>
            <li>Exactly one big-enough, sufficiently-centered face appears in the segment.</li>
            <li>The position of the face doesn't change excessively.</li>
            <li>The lip movements are animate.</li>
            <li>The audio clearly contains speech.</li>
          </ul> */}
          <p className="text-xs text-gray-500 mt-3 font-inconsolata">
            Processing time varies based on video length and complexity (typically 1-5 minutes)
          </p>
        </div>
        {processingOperation ? (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Processing Status</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="font-medium text-blue-900 mb-2">{processingOperation}</p>
                <div className="flex items-center gap-2">
                  {!processingStatus?.includes('✅') && !processingStatus?.includes('❌') && (
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  )}
                  <p className="text-blue-800">{processingStatus}</p>
                </div>
              </div>
            </div>
            
            {/* Segment Player - Show when processing is complete and segments are available */}
            {processingResults?.parsedSegments && processingResults.parsedSegments.length > 0 && currentVideo && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Extracted Segments</h3>
                
                {/* Video Player */}
                <div className="mb-4">
                  <video 
                    ref={setVideoRef}
                    src={currentVideo.dataUrl} 
                    controls 
                    className="w-full rounded-md"
                  />
                </div>
                
                {/* Segment Selection - Hover-based Menu */}
                <div className="relative">
                  <div className="group">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-between">
                      <span>
                        {isPlayingFullVideo 
                          ? "Playing full video"
                          : selectedSegment !== null 
                            ? `Playing Segment ${selectedSegment + 1}` 
                            : `Select Segment (${processingResults.parsedSegments.length} found)`
                        }
                      </span>
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu - Shows on Hover */}
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 max-h-64 overflow-y-auto">
                      {processingResults.parsedSegments.map((segment: number[], index: number) => {
                        const startTime = segment[0];
                        const endTime = segment[1];
                        const duration = endTime - startTime;
                        
                        return (
                          <button
                            key={index}
                            onClick={() => handleSegmentSelect(index)}
                            className={`w-full p-3 text-left hover:bg-gray-50 transition-colors duration-150 border-b border-gray-100 last:border-b-0 ${
                              selectedSegment === index ? 'bg-blue-50 text-blue-900' : 'text-gray-700'
                            }`}
                          >
                            <div className="font-medium">
                              Segment {index + 1}
                            </div>
                            <div className="text-sm opacity-75">
                              {startTime.toFixed(1)}s - {endTime.toFixed(1)}s ({duration.toFixed(1)}s)
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Preview</h3>
            {file.type === 'image' && <img src={fileUrl} alt={file.name} className="w-full rounded-md" />}
            {file.type === 'pdf' && <iframe src={fileUrl} className="w-full h-[80vh]" title={file.name}></iframe>}
            {file.type === 'video' && <video src={fileUrl} controls className="w-full rounded-md"></video>}
            {file.type === 'txt' && <pre className="w-full bg-gray-100 p-4 rounded-md whitespace-pre-wrap">{textContent}</pre>}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDetailsPanel;
