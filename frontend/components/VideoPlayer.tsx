import React, { useRef, useEffect } from 'react';
import { FileItem } from './FilePreview';

export interface VideoSegment {
  startTime: number;
  endTime: number;
  label?: string;
}

interface VideoPlayerProps {
  videoFile: FileItem;
  onClose: () => void;
  segment?: VideoSegment | null; // Optional segment to play
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoFile, onClose, segment }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle segment playback
  useEffect(() => {
    if (segment && videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedMetadata = () => {
        // Set start time when metadata is loaded
        video.currentTime = segment.startTime;
      };

      const handleTimeUpdate = () => {
        // Pause when reaching end time
        if (video.currentTime >= segment.endTime) {
          video.pause();
          video.currentTime = segment.startTime; // Reset to start of segment
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);

      // If metadata is already loaded, set the start time immediately
      if (video.readyState >= 1) {
        video.currentTime = segment.startTime;
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [segment]);

  // Function to play a specific segment (can be called externally)
  const playSegment = (newSegment: VideoSegment) => {
    if (videoRef.current) {
      const video = videoRef.current;
      video.currentTime = newSegment.startTime;
      video.play();
    }
  };

  // Function to play full video (reset any segment restrictions)
  const playFullVideo = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      video.currentTime = 0;
      video.play();
    }
  };

  return (
    <div className="w-full max-w-[650px] px-4 py-3 bg-transparent shadow-lg rounded-figma-lg flex flex-col items-center gap-3">
      <div className="relative w-full p-[2px] bg-gradient-to-r from-figma-gradient-start to-figma-gradient-end rounded-figma-md">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-20 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-lg"
          title="Close video player"
        >
          ×
        </button>
        
        <div className="px-4 py-4 bg-white rounded-figma-md flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-full h-full flex flex-col space-y-4">
            {/* Segment Info */}
            {segment && (
              <div className="text-center p-2 bg-blue-50 rounded-figma-md border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">
                  {segment.label || 'Playing Segment'}: {Math.round(segment.startTime)}s - {Math.round(segment.endTime)}s
                </p>
              </div>
            )}

            {/* Native Video Player - consistent size regardless of segments, rectangular shape */}
            <div className="flex-grow flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full bg-black object-contain"
                style={{ height: '270px' }}
                controls
                preload="metadata"
              >
                <source src={videoFile.dataUrl || videoFile.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Segment Controls */}
            {segment && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => playSegment(segment)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-figma-pill font-medium transition-colors flex items-center gap-2"
                >
                  <span>🔄</span> Replay Segment
                </button>
                <button
                  onClick={playFullVideo}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-figma-pill font-medium transition-colors flex items-center gap-2"
                >
                  <span>▶</span> Play Full Video
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
