import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = true, className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`bg-white border border-stone-200 rounded-lg transition-shadow duration-200 ease-standard ${hover ? 'hover:shadow-sm' : ''} ${className}`}
    />
  );
}
