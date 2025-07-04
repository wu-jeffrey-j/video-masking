import React, { useEffect, useRef, useState } from 'react';
import { FileItem } from './FilePreview';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.min.mjs';

interface FileIconProps {
  file: FileItem;
}

const FileIcon: React.FC<FileIconProps> = ({ file }) => {
  const PdfPreview = ({ fileUrl }: { fileUrl: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const renderPdf = async () => {
        try {
          const loadingTask = pdfjsLib.getDocument(fileUrl);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const canvas = canvasRef.current;
          if (canvas) {
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (context) {
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };
              await page.render(renderContext).promise;
            }
          }
        } catch (error) {
          console.error('Error rendering PDF:', error);
        }
      };
      if (fileUrl) {
        renderPdf();
      }
    }, [fileUrl]);

    return <canvas ref={canvasRef} className="w-full h-full object-cover" />;
  };

  const TxtPreview = ({ fileUrl }: { fileUrl: string }) => {
    const [text, setText] = useState('');

    useEffect(() => {
      const fetchText = async () => {
        try {
          const response = await fetch(fileUrl);
          const fullText = await response.text();
          setText(fullText.split('\n').slice(0, 4).join('\n'));
        } catch (error) {
          console.error('Error fetching text:', error);
        }
      };
      if (fileUrl) {
        fetchText();
      }
    }, [fileUrl]);

    return (
      <div className="w-full h-full bg-white p-1 overflow-hidden">
        <pre className="text-[8px] text-gray-700 whitespace-pre-wrap break-words">
          {text}
        </pre>
      </div>
    );
  };

  const fileUrl = file.source === 'local' ? file.url : file.dataUrl;

  return (
    <div className="relative aspect-square w-full bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent group-hover:border-blue-500 transition-all duration-200">
      {file.type === 'image' && fileUrl && (
        <img
          src={fileUrl}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      )}
      {file.type === 'pdf' && fileUrl && <PdfPreview fileUrl={fileUrl} />}
      {file.type === 'video' && fileUrl && (
        <video
          src={fileUrl}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {file.type === 'txt' && fileUrl && <TxtPreview fileUrl={fileUrl} />}
      {file.type === 'other' && (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 font-bold">.{file.name.split('.').pop()}</span>
        </div>
      )}
    </div>
  );
};

export default FileIcon;
