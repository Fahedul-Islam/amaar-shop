/* eslint-disable @next/next/no-img-element */
interface Props {
  src?: string | null;
  alt?: string;
  hue?: number;
  ratio?: '1/1' | '4/3' | '16/10';
  className?: string;
}

const ratioClass = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '16/10': 'aspect-[16/10]',
};

export function ProductImage({ src, alt = '', hue, ratio = '1/1', className = '' }: Props) {
  const h = hue ?? Math.floor(Math.random() * 360);
  if (src) {
    return (
      <div className={`${ratioClass[ratio]} bg-stone-100 overflow-hidden ${className}`}>
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div
      className={`${ratioClass[ratio]} flex items-center justify-center text-xs ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${h}, 18%, 92%), hsl(${h}, 14%, 85%))`,
        color: `hsl(${h}, 14%, 55%)`,
      }}
    >
      photo
    </div>
  );
}

// Hash a string to a stable hue so a given shop/product always gets the same colour.
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
