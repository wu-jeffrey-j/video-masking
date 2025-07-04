import React, { useRef } from 'react';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import FilePreview, { FileItem } from './FilePreview';

interface VideoUploadGroupProps {
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isAttaching: boolean;
  uploadedFiles: FileItem[];
  onFileSelect: (file: FileItem) => void;
  onExampleSelect: (question: string) => void;
  exampleFiles: FileItem[];
  error: string | null;
  uploadProgress?: string;
}

const VideoUploadGroup: React.FC<VideoUploadGroupProps> = ({
  onFileChange,
  onSubmit,
  isLoading,
  uploadedFiles,
  onFileSelect,
  onExampleSelect,
  exampleFiles,
  isAttaching,
  error,
  uploadProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExamplePreview, setShowExamplePreview] = React.useState(false);
  const [showQuestionsPreview, setShowQuestionsPreview] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const examplePreviewTimeout = useRef<any>(null);
  const questionsPreviewTimeout = useRef<any>(null);

  const handleExampleEnter = () => {
    clearTimeout(examplePreviewTimeout.current);
    setShowExamplePreview(true);
  };

  const handleExampleLeave = () => {
    examplePreviewTimeout.current = window.setTimeout(() => {
      setShowExamplePreview(false);
    }, 200);
  };

  const handleQuestionsEnter = () => {
    clearTimeout(questionsPreviewTimeout.current);
    setShowQuestionsPreview(true);
  };

  const handleQuestionsLeave = () => {
    questionsPreviewTimeout.current = window.setTimeout(() => {
      setShowQuestionsPreview(false);
    }, 200);
  };

  return (
    <div className="w-full max-w-[650px] px-4 py-3 bg-transparent shadow-lg rounded-figma-lg flex flex-col items-center gap-3">
      <div className="relative w-full p-[2px] bg-gradient-to-r from-figma-gradient-start to-figma-gradient-end rounded-figma-md">
      <div 
        className={`px-4 py-8 bg-white rounded-figma-md flex flex-col items-center justify-center min-h-[350px] transition-colors ${
          isDragOver ? 'bg-blue-50' : ''
        }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const event = {
                target: {
                  files: e.dataTransfer.files,
                },
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              onFileChange(event);
            }
          }}
        >
          {isAttaching ? (
            <div className="text-center p-8">
              <div className="mb-6">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
              </div>
              <h3 className="text-xl font-semibold text-figma-text-primary mb-2">
                Uploading and Preparing Video
              </h3>
              {uploadProgress && (
                <p className="text-figma-text-secondary mb-4">
                  {uploadProgress}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="mb-4">
                <PaperClipIcon className="w-12 h-12 text-gray-400 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-figma-text-primary mb-2">
                Upload your own video or sample videos
              </h3>
              <p className="text-figma-text-secondary mb-4">
                Drag and drop your video file here, or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-gradient-to-r from-figma-gradient-start to-figma-gradient-end text-white rounded-figma-pill font-medium hover:opacity-90 transition-opacity"
                disabled={isLoading || isAttaching}
              >
                Choose Video File
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
        disabled={isLoading || isAttaching}
        accept="video/*"
        multiple={false}
      />

      {error && (
        <div className="w-full max-w-[757px] mt-4">
          <p className="text-red-600 bg-red-100 p-3 rounded-md animate-shake font-inconsolata text-center">
            {error}
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoUploadGroup;
