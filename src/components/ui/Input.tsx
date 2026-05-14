import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', style, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={`
          w-full px-3 py-2 rounded-xl border border-gray-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
          placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed
          ${error ? 'border-red-400' : ''} ${className}
        `}
        style={{ fontSize: '16px', ...style }}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
