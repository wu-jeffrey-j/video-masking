import React from 'react';
import FileIcon from './FileIcon';

export interface FileItem {
  name: string;
  type: 'image' | 'pdf' | 'txt' | 'video' | 'other';
  source: 'local' | 'uploaded';
  url?: string;
  dataUrl?: string;
}

interface FilePreviewProps {
  files: FileItem[];
  onFileSelect: (file: FileItem) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onFileSelect }) => {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[400px] bg-white rounded-lg shadow-lg p-4 grid grid-cols-3 gap-4 z-20">
      {files.map((file) => (
        <div
          key={file.name}
          onClick={() => onFileSelect(file)}
          className="group cursor-pointer"
        >
          <FileIcon file={file} />
          <div className="mt-2 text-center">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FilePreview;
