import Link from 'next/link';

export function MarketplaceFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white mt-12">
      <div className="max-w-container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-semibold text-stone-900 mb-3">AmaarShop</div>
          <p className="text-stone-500 leading-relaxed">A warmer marketplace for Bangladesh&rsquo;s small businesses.</p>
        </div>
        <div>
          <div className="font-medium text-stone-700 mb-3">Discover</div>
          <ul className="space-y-2 text-stone-500">
            <li><Link href="/" className="hover:text-teal-600">All products</Link></li>
            <li><Link href="/shops" className="hover:text-teal-600">All shops</Link></li>
            <li><Link href="/order-lookup" className="hover:text-teal-600">Track an order</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-medium text-stone-700 mb-3">Sell</div>
          <ul className="space-y-2 text-stone-500">
            <li><Link href="/signup" className="hover:text-teal-600">Start your shop</Link></li>
            <li><Link href="/login" className="hover:text-teal-600">Seller sign in</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-medium text-stone-700 mb-3">Support</div>
          <ul className="space-y-2 text-stone-500">
            <li>hello@amaar.shop</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-500">
        © AmaarShop
      </div>
    </footer>
  );
}
