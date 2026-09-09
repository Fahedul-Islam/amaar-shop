import Link from 'next/link';
import { MetaTrackingSection } from '../SettingsSections';
export default function Page() { return <div className="max-w-3xl px-5 py-7 md:px-8"><MetaTrackingSection /><Link href="/dashboard/facebook" className="block mt-6 text-sm text-teal-700 underline underline-offset-2">How to add your shop link to Facebook</Link></div>; }
