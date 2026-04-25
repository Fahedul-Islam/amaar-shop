'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IcCheck, IcCopy, IcFacebook } from '@/components/icons/Icons';
import { useShop } from '@/hooks/useShop';

export default function FacebookConnectPage() {
  const { shop } = useShop();
  const [copied, setCopied] = useState(false);
  if (!shop) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/s/${shop.slug}`;
  const displayUrl = url.replace(/^https?:\/\//, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const Step = ({ n, title, desc }: { n: string; title: string; desc: string }) => (
    <Card className="p-5 flex gap-4 items-start" hover={false}>
      <div className="w-9 h-9 rounded-full flex-shrink-0 bg-teal-600 text-white grid place-items-center font-bold">{n}</div>
      <div className="flex-1">
        <h3 className="text-base font-semibold mb-1.5">{title}</h3>
        <p className="text-sm text-stone-600 leading-relaxed">{desc}</p>
      </div>
      <div className="w-[180px] aspect-[16/10] bg-stone-100 rounded-md hidden md:grid place-items-center text-stone-400 text-xs">
        <IcFacebook size={32} />
      </div>
    </Card>
  );

  return (
    <div className="px-6 md:px-8 py-6 md:py-7 max-w-4xl">
      <h1 className="text-2xl md:text-[26px] font-bold tracking-tight">Connect your Facebook page</h1>
      <p className="text-stone-500 mt-1 mb-6">
        Turn your page&rsquo;s <strong className="text-stone-700 font-medium">Shop Now</strong> button into a link to your AmaarShop.
      </p>

      <Card className="p-5 mb-6" hover={false} style={{ background: 'var(--teal-50)', borderStyle: 'dashed', borderColor: 'var(--teal-300)' }}>
        <div className="text-xs font-medium text-teal-700 uppercase tracking-wider mb-1.5">Your shop is live at</div>
        <div className="flex gap-3 items-center flex-wrap">
          <code className="font-mono text-lg font-medium text-teal-700 flex-1 min-w-0 truncate">{displayUrl}</code>
          <Button variant="primary" size="sm" onClick={copy} className="min-w-[110px]">
            {copied ? (<><IcCheck size={14} /> Copied</>) : (<><IcCopy size={14} /> Copy link</>)}
          </Button>
        </div>
        <div className="text-xs text-teal-700 mt-2.5">
          Paste this into your Facebook page&rsquo;s <strong className="font-semibold">Shop Now</strong> button.
        </div>
      </Card>

      <div className="grid gap-3 mb-6">
        <Step
          n="1"
          title="Open your Facebook page settings"
          desc="Go to your business page on Facebook, tap the three dots near your profile, and select Manage page."
        />
        <Step
          n="2"
          title="Find the Shop Now button"
          desc="Under Add action button or Edit action button, choose Shop Now as the type."
        />
        <Step
          n="3"
          title="Paste your AmaarShop URL"
          desc="Paste the link you copied above into the website field and save. That's it — your button is live."
        />
      </div>
    </div>
  );
}
