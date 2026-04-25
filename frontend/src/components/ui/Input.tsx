'use client';
import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`w-full h-10 px-3 bg-white border rounded-md text-sm text-stone-900 placeholder-stone-400 transition-colors duration-150 ease-standard focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-50'
            : 'border-stone-300 focus:border-teal-500 focus:ring-teal-100'
        } ${className}`}
      />
      {(helper || error) && (
        <div className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-stone-500'}`}>
          {error || helper}
        </div>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`w-full min-h-[100px] p-3 bg-white border rounded-md text-sm text-stone-900 placeholder-stone-400 resize-y transition-colors duration-150 ease-standard focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-50'
            : 'border-stone-300 focus:border-teal-500 focus:ring-teal-100'
        } ${className}`}
      />
      {(helper || error) && (
        <div className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-stone-500'}`}>
          {error || helper}
        </div>
      )}
    </div>
  );
});
