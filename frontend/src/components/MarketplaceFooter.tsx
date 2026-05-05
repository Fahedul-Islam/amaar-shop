import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function MarketplaceFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white mt-10">
      <div className="max-w-container mx-auto px-4 pt-10 pb-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] text-sm">
          <div>
            <Logo size={24} />
            <p className="text-stone-500 leading-relaxed mt-3 max-w-[320px]">
              A warmer marketplace for Bangladesh&rsquo;s small businesses. Cash on delivery available across the country.
            </p>
          </div>
          <FooterCol title="Shop">
            <FooterLink href="/">All products</FooterLink>
            <FooterLink href="/shops">All shops</FooterLink>
            <FooterLink href="/order-lookup">Track an order</FooterLink>
          </FooterCol>
          <FooterCol title="Sellers">
            <FooterLink href="/signup">Start your shop</FooterLink>
            <FooterLink href="/login">Seller sign in</FooterLink>
          </FooterCol>
          <FooterCol title="Support">
            <li>
              <a href="mailto:hello@amaar.shop" className="text-stone-500 hover:text-teal-600 transition-colors">
                hello@amaar.shop
              </a>
            </li>
          </FooterCol>
        </div>
        <div className="border-t border-stone-100 mt-10 pt-5 flex items-center justify-between text-xs text-stone-500">
          <span>© AmaarShop · Made in Bangladesh</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium text-stone-900 mb-3">{title}</div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-stone-500 hover:text-teal-600 transition-colors">
        {children}
      </Link>
    </li>
  );
}
