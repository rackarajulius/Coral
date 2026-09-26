import { BRAND, type TabId } from './constants';

const EmptyIllustration = ({ variant }: { variant: TabId }) => {
    const stroke = "#1F2937";
  switch (variant) {
    case "saved":
      return (
        <svg viewBox="0 0 300 220" className="w-[260px] md:w-[300px] h-auto" aria-hidden>
          <circle cx="230" cy="50" r="36" fill={BRAND} opacity="0.12" />
          <rect x="60" y="40" width="160" height="140" rx="14" stroke={stroke} strokeWidth="2" fill="white" />
          <path d="M120 40v90l20-16 20 16V40" stroke={stroke} strokeWidth="2" fill={BRAND} fillOpacity="0.15" strokeLinejoin="round" />
          <rect x="78" y="150" width="124" height="6" rx="3" fill="#E5E7EB" />
          <rect x="78" y="162" width="80" height="6" rx="3" fill="#E5E7EB" />
        </svg>
      );
    case "alerts":
      return (
        <svg viewBox="0 0 300 220" className="w-[260px] md:w-[300px] h-auto" aria-hidden>
          <circle cx="70" cy="60" r="32" fill={BRAND} opacity="0.12" />
          <path d="M150 40c-22 0-40 18-40 40v28l-14 18h108l-14-18V80c0-22-18-40-40-40z" stroke={stroke} strokeWidth="2" fill="white" />
          <path d="M138 150a12 12 0 0024 0" stroke={stroke} strokeWidth="2" fill="none" />
          <circle cx="190" cy="60" r="10" fill={BRAND} />
        </svg>
      );
    case "applied":
      return (
        <svg viewBox="0 0 300 220" className="w-[260px] md:w-[300px] h-auto" aria-hidden>
          <circle cx="240" cy="170" r="30" fill={BRAND} opacity="0.12" />
          <rect x="70" y="40" width="140" height="160" rx="12" stroke={stroke} strokeWidth="2" fill="white" />
          <rect x="86" y="64" width="80" height="6" rx="3" fill={stroke} />
          <rect x="86" y="82" width="108" height="4" rx="2" fill="#E5E7EB" />
          <rect x="86" y="94" width="92" height="4" rx="2" fill="#E5E7EB" />
          <circle cx="96" cy="130" r="6" fill={BRAND} />
          <rect x="112" y="126" width="80" height="6" rx="3" fill="#E5E7EB" />
          <circle cx="96" cy="152" r="6" stroke={stroke} strokeWidth="2" fill="white" />
          <rect x="112" y="148" width="60" height="6" rx="3" fill="#E5E7EB" />
          <circle cx="96" cy="174" r="6" stroke={stroke} strokeWidth="2" fill="white" />
          <rect x="112" y="170" width="70" height="6" rx="3" fill="#E5E7EB" />
        </svg>
      );
    case "interviews":
      return (
        <svg viewBox="0 0 300 220" className="w-[260px] md:w-[300px] h-auto" aria-hidden>
          <circle cx="60" cy="170" r="28" fill={BRAND} opacity="0.12" />
          <rect x="60" y="50" width="180" height="130" rx="12" stroke={stroke} strokeWidth="2" fill="white" />
          <rect x="60" y="50" width="180" height="28" rx="12" fill={BRAND} fillOpacity="0.15" />
          <path d="M96 42v20M204 42v20" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <rect x="80" y="96" width="40" height="28" rx="4" fill="#E5E7EB" />
          <rect x="130" y="96" width="40" height="28" rx="4" fill={BRAND} fillOpacity="0.3" />
          <rect x="180" y="96" width="40" height="28" rx="4" fill="#E5E7EB" />
          <rect x="80" y="134" width="40" height="28" rx="4" fill="#E5E7EB" />
          <rect x="130" y="134" width="40" height="28" rx="4" fill="#E5E7EB" />
        </svg>
      );
    case "viewed":
      return (
        <svg viewBox="0 0 300 220" className="w-[260px] md:w-[300px] h-auto" aria-hidden>
          <circle cx="230" cy="60" r="30" fill={BRAND} opacity="0.12" />
          <path d="M40 110c30-50 190-50 220 0-30 50-190 50-220 0z" stroke={stroke} strokeWidth="2" fill="white" />
          <circle cx="150" cy="110" r="28" stroke={stroke} strokeWidth="2" fill="white" />
          <circle cx="150" cy="110" r="12" fill={BRAND} />
        </svg>
      );
    default:
      return null;
  }
};

export default EmptyIllustration;
