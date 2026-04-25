'use client';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'neutral';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white border-transparent hover:bg-teal-700 active:bg-teal-800 disabled:bg-stone-300 disabled:text-stone-500',
  secondary: 'bg-white text-teal-600 border-teal-600 hover:bg-teal-50',
  ghost: 'bg-transparent text-teal-600 border-transparent hover:bg-teal-50',
  accent: 'bg-coral-500 text-white border-transparent hover:bg-coral-600',
  danger: 'bg-red-600 text-white border-transparent hover:bg-red-700',
  neutral: 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref,
) {
  const sz = size === 'sm' ? 'h-8 text-xs px-3' : 'h-10 text-sm px-4';
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium leading-none border whitespace-nowrap transition-colors duration-150 ease-standard disabled:cursor-not-allowed ${sz} ${variantClass[variant]} ${className}`}
    >
      {children}
    </button>
  );
});
