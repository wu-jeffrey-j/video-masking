import React, { useRef } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import FilePreview, { FileItem } from './FilePreview';
import ExampleQuestions from './ExampleQuestions';

interface ExampleButtonsProps {
  onFileSelect: (file: FileItem) => void;
  onExampleSelect: (question: string) => void;
  exampleFiles: FileItem[];
  isLoading?: boolean;
  showExampleFiles?: boolean;
  showOperations?: boolean;
}

const ExampleButtons: React.FC<ExampleButtonsProps> = ({
  onFileSelect,
  onExampleSelect,
  exampleFiles,
  isLoading = false,
  showExampleFiles = true,
  showOperations = true,
}) => {
  const [showExamplePreview, setShowExamplePreview] = React.useState(false);
  const [showQuestionsPreview, setShowQuestionsPreview] = React.useState(false);
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
    <div className="w-full max-w-[716px] flex flex-col items-center mt-6">
      <div className="flex flex-wrap gap-4 items-center justify-center">
        {showExampleFiles && (
          <div className="relative inline-block" onMouseEnter={handleExampleEnter} onMouseLeave={handleExampleLeave}>
            <button
              className="flex items-center gap-1 px-4 py-2.5 bg-white hover:bg-[#EBF7FF] border border-figma-border-gray hover:border-[#019AF9] backdrop-blur-figma rounded-figma-pill text-figma-text-primary font-medium text-base transition-colors"
              disabled={isLoading}
              style={{ letterSpacing: '-0.6px' }}
            >
              <SparklesIcon className="w-5 h-5 text-figma-icon-blue" />
              Example Files
            </button>
            {showExamplePreview && <FilePreview files={exampleFiles} onFileSelect={onFileSelect} />}
          </div>
        )}
        {showOperations && (
          <div className="relative" onMouseEnter={handleQuestionsEnter} onMouseLeave={handleQuestionsLeave}>
            <button
              className="flex items-center gap-1 px-4 py-2.5 bg-white/50 hover:bg-[#F4F0FF] border border-figma-border-gray hover:border-[#8964F9] backdrop-blur-figma rounded-figma-pill text-figma-text-primary font-medium text-base transition-colors"
              disabled={isLoading}
              style={{ letterSpacing: '-0.6px' }}
            >
              <SparklesIcon className="w-5 h-5 text-figma-icon-purple" />
              Operations
            </button>
            {showQuestionsPreview && <ExampleQuestions onSelect={onExampleSelect} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExampleButtons;
