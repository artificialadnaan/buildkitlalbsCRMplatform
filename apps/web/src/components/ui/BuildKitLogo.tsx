/**
 * BuildKit Labs logo — "The Grid"
 * Nine modules at varying opacities in a diagonal pattern suggesting momentum and growth.
 */

interface BuildKitLogoProps {
  size?: number;
  className?: string;
}

/** The Grid icon — 3x3 rounded squares with diagonal opacity */
export function GridIcon({ size = 36, className }: BuildKitLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      {/* Row 1 */}
      <rect x="0" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.3} />
      <rect x="13" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.35} />
      <rect x="26" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.5} />
      {/* Row 2 */}
      <rect x="0" y="13" width="10" height="10" rx="2" fill="#d97706" opacity={0.35} />
      <rect x="13" y="13" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.6} />
      <rect x="26" y="13" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.8} />
      {/* Row 3 */}
      <rect x="0" y="26" width="10" height="10" rx="2" fill="#d97706" opacity={0.5} />
      <rect x="13" y="26" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.8} />
      <rect x="26" y="26" width="10" height="10" rx="2" fill="#f97316" opacity={1} />
    </svg>
  );
}

/** Light variant — for dark backgrounds (white text) */
export function BuildKitLogoDark({ size = 36 }: BuildKitLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <GridIcon size={size} />
      <div>
        <span className="text-xl font-extrabold text-white tracking-tight">
          Build<span className="text-orange-400">Kit</span>
        </span>
      </div>
    </div>
  );
}

/** Dark variant — for light backgrounds (dark text) */
export function BuildKitLogoLight({ size = 36 }: BuildKitLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <GridIcon size={size} />
      <div>
        <span className="text-xl font-extrabold text-slate-900 tracking-tight">
          Build<span className="text-orange-600">Kit</span>
        </span>
      </div>
    </div>
  );
}

/** Full logo with tagline — for login/splash screens */
export function BuildKitLogoFull({
  size = 48,
  variant = 'dark',
}: BuildKitLogoProps & { variant?: 'dark' | 'light' }) {
  const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const accentColor = variant === 'dark' ? 'text-orange-400' : 'text-orange-600';
  const subColor = variant === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex flex-col items-center gap-3">
      <GridIcon size={size} />
      <div className="text-center">
        <h1 className={`text-2xl font-extrabold ${textColor} tracking-tight`}>
          Build<span className={accentColor}>Kit</span> Labs
        </h1>
        <p className={`text-[10px] ${subColor} tracking-[0.2em] uppercase mt-0.5`}>
          Software + Web Development
        </p>
      </div>
    </div>
  );
}
