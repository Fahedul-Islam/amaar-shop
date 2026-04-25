/* Lucide-style inline SVG icons — 1.5px stroke, currentColor, 24×24 viewbox. */
import type { SVGProps } from 'react';

interface P extends SVGProps<SVGSVGElement> {
  size?: number;
}

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IcSearch = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
export const IcCart = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>);
export const IcHeart = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
export const IcStore = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="m2 7 4.5-4.5h11L22 7"/><path d="M4 7v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"/><path d="M2 7h20"/></svg>);
export const IcPackage = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>);
export const IcTruck = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
export const IcCheck = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M20 6 9 17l-5-5"/></svg>);
export const IcCopy = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>);
export const IcPlus = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
export const IcMinus = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="5" y1="12" x2="19" y2="12"/></svg>);
export const IcTrash = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>);
export const IcX = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
export const IcMenu = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>);
export const IcChevR = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><polyline points="9 18 15 12 9 6"/></svg>);
export const IcChevL = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><polyline points="15 18 9 12 15 6"/></svg>);
export const IcChevD = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><polyline points="6 9 12 15 18 9"/></svg>);
export const IcHome = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
export const IcSettings = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
export const IcFacebook = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>);
export const IcBell = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
export const IcDownload = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
export const IcUpload = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>);
export const IcImage = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>);
export const IcChart = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="3" y1="3" x2="3" y2="21"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="6 16 11 11 14 14 20 7"/></svg>);
export const IcTag = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
export const IcLogout = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
export const IcEye = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
export const IcUser = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
export const IcArchive = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>);
export const IcArrowLeft = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>);
export const IcPhone = ({ size = 20, ...p }: P) => (<svg {...base(size)} {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
