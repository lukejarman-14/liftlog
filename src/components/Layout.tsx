import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  leftAction?: React.ReactNode;  // shown instead of the back button
  rightAction?: React.ReactNode;
}

export function Layout({ title, children, onBack, leftAction, rightAction }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm safe-area-pt">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
          ) : leftAction ? (
            <div className="flex-shrink-0">{leftAction}</div>
          ) : null}
          <h1 className="flex-1 text-lg font-bold text-gray-900 truncate">{title}</h1>
          {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
