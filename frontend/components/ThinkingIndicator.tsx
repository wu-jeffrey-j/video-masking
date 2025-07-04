import React from 'react';

const ThinkingIndicator: React.FC = () => {
  return (
    <div className="flex items-center mb-4">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-3 text-gray-700">Thinking...</p>
    </div>
  );
};

export default ThinkingIndicator;
