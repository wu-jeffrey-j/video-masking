import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeInlineCode from '../lib/rehype-inline-code';
import { UserIcon } from './icons/UserIcon';

interface PromptProps {
  message: {
    text: string;
    isUser: boolean;
  };
}

const Prompt: React.FC<PromptProps> = ({ message }) => {
  return (
    <div className={`flex items-start ${message.isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!message.isUser && <img src="/logo_icon.png" alt="Orbifold AI Logo" className="h-8 w-8 mr-3 flex-shrink-0" />}
      <div className={`p-2 rounded-lg ${message.isUser ? 'bg-blue-100' : 'bg-gray-100'}`}>
        <div className="prose prose-sm max-w-none px-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeInlineCode]}
            components={{
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-4" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-xl font-bold my-3" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
              li: ({node, ...props}) => <li className="mb-1" {...props} />,
              code({node, style, className, children, ...props}: any) {
                const match = /language-(\w+)/.exec(className || '')
                return !props.inline && match ? (
                  <pre style={style} className="bg-gray-800 text-white p-2 rounded-md overflow-x-auto"><code className={className} {...props}>{children}</code></pre>
                ) : (
                  <code style={style} className="bg-gray-200 text-red-500 px-1 rounded" {...props}>
                    {children}
                  </code>
                )
              },
              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      </div>
      {message.isUser && <UserIcon className="h-8 w-8 ml-3 text-blue-500 flex-shrink-0" />}
    </div>
  );
};

export default Prompt;
