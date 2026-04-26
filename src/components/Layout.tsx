import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function Layout({ title, children, onBack, rightAction }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="flex-1 text-lg font-bold text-gray-900 truncate">{title}</h1>
          {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
