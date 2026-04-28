'use client';

interface StarRatingProps {
  value: number;
  size?: number;
  onChange?: (n: number) => void;
  className?: string;
}

// StarRating shows a 5-star rating. If onChange is provided it becomes interactive.
export function StarRating({ value, size = 16, onChange, className = '' }: StarRatingProps) {
  const interactive = typeof onChange === 'function';
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        const StarShape = (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? '#f59e0b' : 'none'}
            stroke={filled ? '#f59e0b' : '#d6d3d1'}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
        if (!interactive) return <span key={n}>{StarShape}</span>;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="p-0.5 -m-0.5 hover:scale-110 transition-transform"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            {StarShape}
          </button>
        );
      })}
    </div>
  );
}
