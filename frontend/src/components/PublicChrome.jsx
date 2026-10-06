import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { ButtonLink } from './ui';
import { useAuth, homeFor } from '../context/AuthContext';
import { useAppSettings } from '../hooks/hooks';

export const WRAP = 'mx-auto w-full max-w-6xl px-6 md:px-10';

export const BrandMark = ({ className = '' }) => (
  <span className={`grid size-7 place-items-center rounded-md bg-primary text-primary-foreground ${className}`}><GraduationCap className="size-4" aria-hidden /></span>
);

// Header used on the landing page and the info pages. `sections` are in-page anchors (landing only).
export function PublicHeader({ sections = [] }) {
  const { user } = useAuth();
  const { appName } = useAppSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className={`${WRAP} flex h-14 items-center justify-between gap-4`}>
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          <span className="truncate text-sm font-semibold tracking-tight">{appName}</span>
        </Link>
        {sections.length > 0 && (
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Sections">
            {sections.map(([href, label]) => <a key={href} href={href} className="transition-colors hover:text-foreground">{label}</a>)}
          </nav>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {user ? <ButtonLink to={homeFor(user)} size="sm">Go to Dashboard</ButtonLink> : (
            <><ButtonLink to="/login" variant="ghost" size="sm">Log in</ButtonLink><ButtonLink to="/register" size="sm">Get started</ButtonLink></>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { appName, institutionName } = useAppSettings();
  return (
    <footer>
      <div className={`${WRAP} flex flex-col items-start justify-between gap-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center`}>
        <div>
          <p className="font-medium text-foreground">{appName}</p>
          {institutionName && <p className="text-xs">{institutionName}</p>}
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          {[['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/terms', 'Terms']].map(([to, label]) => (
            <Link key={to} to={to} className="transition-colors hover:text-foreground">{label}</Link>
          ))}
        </nav>
        <p>© {new Date().getFullYear()} {appName}</p>
      </div>
    </footer>
  );
}
