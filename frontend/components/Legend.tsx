import React from 'react';
import { useThemeGraph } from './use-theme-graph';

interface LegendProps {
  className?: string;
  visible?: boolean;
}

const Legend: React.FC<LegendProps> = ({ className, visible = true }) => {
  const theme = useThemeGraph();
  
  // Theme-based colors
  const classColor = theme === 'dark' ? '#F06292' : '#E91E63';
  const functionColor = theme === 'dark' ? '#64B5F6' : '#2196F3';
  const otherColor = theme === 'dark' ? '#FFD54F' : '#FFC107';
  
  const bgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
  
  if (!visible) {
    return null;
  }

  return (
    <div className={`${bgColor} ${textColor} rounded-lg border ${borderColor} p-3 shadow-lg max-w-xs ${className}`}>
      <h3 className="text-sm font-medium mb-2">Node Types</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: classColor }}
          />
          <span className="text-xs">Class</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: functionColor }}
          />
          <span className="text-xs">Function</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: otherColor }}
          />
          <span className="text-xs">Other</span>
        </div>
      </div>
    </div>
  );
};

export default Legend;
