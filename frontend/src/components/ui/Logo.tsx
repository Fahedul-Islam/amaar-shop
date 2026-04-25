import Link from 'next/link';

export function Logo({ size = 32, href = '/' }: { size?: number; href?: string | null }) {
  const content = (
    <>
      <span
        className="relative grid place-items-center rounded-md bg-teal-600 flex-shrink-0"
        style={{ width: size, height: size, borderRadius: size / 4 }}
      >
        <svg
          width={size * 0.56}
          height={size * 0.56}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m2 7 4.5-4.5h11L22 7" />
          <path d="M4 7v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7" />
        </svg>
        <span
          className="absolute bg-coral-500 border-2 border-stone-50 rounded-full"
          style={{
            right: -4,
            bottom: -4,
            width: size * 0.36,
            height: size * 0.36,
          }}
        />
      </span>
      <span
        className="font-bold tracking-tight text-stone-900"
        style={{ fontSize: size * 0.55 }}
      >
        <span className="text-teal-600">amaar</span>shop
      </span>
    </>
  );
  const wrapperClass = 'inline-flex items-center gap-2';
  if (!href) return <span className={wrapperClass}>{content}</span>;
  return (
    <Link href={href} className={wrapperClass}>
      {content}
    </Link>
  );
}
