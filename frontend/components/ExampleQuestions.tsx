import React from 'react';

const operations = [
  'Mask Video',
];

interface ExampleQuestionsProps {
  onSelect: (operation: string) => void;
}

const ExampleQuestions: React.FC<ExampleQuestionsProps> = ({ onSelect }) => {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-white rounded-lg shadow-lg p-2">
      <ul>
        {operations.map((operation, index) => (
          <li
            key={index}
            onClick={() => onSelect(operation)}
            className="p-2 hover:bg-[#F4F0FF] cursor-pointer rounded-md flex justify-between items-center"
          >
            <span>{operation}</span>
            <span className="text-gray-400 ml-4">{'>'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ExampleQuestions;
