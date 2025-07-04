import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full p-4 md:p-6 z-20">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4">
        <a href="https://www.orbifold.ai" target="_blank" rel="noopener noreferrer">
          <img src="/logo.png" alt="Orbifold AI Logo" className="h-8" />
        </a>
        <a
          href="https://www.orbifold.ai/request-a-demo"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3 font-inconsolata text-xl font-semibold text-white bg-gradient-to-r from-figma-gradient-start to-figma-gradient-end rounded-figma-pill shadow-md transition-all duration-300 transform hover:scale-105"
          style={{ letterSpacing: '-0.6px' }} // letter-spacing from figma
        >
          Request a Demo
        </a>
      </div>
    </header>
  );
};

export default Header;
