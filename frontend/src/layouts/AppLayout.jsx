import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Search, PackageSearch, PackagePlus, FolderOpen, ClipboardCheck, Sparkles, Bell, MessageSquare, UserCircle,
  Users, FileSearch, FileCheck2, Tags, MapPin, BarChart3, ScrollText, ShieldAlert, Menu, X, LogOut, Home, Plus, ShieldCheck, ChevronDown, Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Badge } from '../components/ui';
import { BrandMark } from '../components/PublicChrome';
import { api } from '../services/api';
import { useAppSettings, useDebounce } from '../hooks/hooks';
import { fmtDate } from '../utils/format';
import { TypeBadge } from '../components/ItemCard';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse Items', icon: PackageSearch },
  { to: '/report/lost', label: 'Report Lost', icon: Search },
  { to: '/report/found', label: 'Report Found', icon: PackagePlus },
  { to: '/my-reports', label: 'My Reports', icon: FolderOpen },
  { to: '/my-claims', label: 'My Claims', icon: ClipboardCheck },
  { to: '/matches', label: 'Matches', icon: Sparkles },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];
const STAFF_NAV = [
  { group: 'Staff tools' },
  { to: '/admin', label: 'Staff Dashboard', icon: ShieldCheck },
  { to: '/admin/reports', label: 'Verify Reports', icon: FileSearch },
  { to: '/admin/claims', label: 'Review Claims', icon: FileCheck2 },
];
const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/reports?type=lost', label: 'Lost Reports', icon: Search },
  { to: '/admin/reports?type=found', label: 'Found Reports', icon: PackagePlus },
  { to: '/admin/claims', label: 'Claims', icon: FileCheck2 },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/locations', label: 'Locations', icon: MapPin },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/abuse', label: 'Abuse Reports', icon: ShieldAlert },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  { group: 'Account' },
  { to: '/browse', label: 'Browse Items', icon: PackageSearch },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { to: '/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

const navFor = (role) => (role === 'admin' ? ADMIN_NAV : role === 'staff' ? [...STUDENT_NAV, ...STAFF_NAV] : STUDENT_NAV);

function NavItems({ items, counts, onNavigate }) {
  const { pathname, search } = useLocation();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
      <ul className="space-y-0.5">
        {items.map((it) => {
          if (it.group) return <li key={it.group} className="eyebrow px-2.5 pb-1.5 pt-6">{it.group}</li>;
          const [path, query] = it.to.split('?');
          const active = query ? pathname === path && search === `?${query}` : pathname === path && !(path === '/admin/reports' && search);
          const count = it.badge && counts[it.badge];
          return (
            <li key={it.to}>
              <NavLink to={it.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                <it.icon className="size-4" strokeWidth={active ? 2 : 1.75} aria-hidden />
                <span className="flex-1">{it.label}</span>
                {count > 0 && <span className="rounded-md bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">{count}</span>}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand() {
  const { appName } = useAppSettings();
  return (
    <Link to="/" className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
      <BrandMark />
      <span className="truncate text-sm font-semibold tracking-tight">{appName}</span>
    </Link>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const debounced = useDebounce(q, 300);
  const navigate = useNavigate();
  const box = useRef(null);

  useEffect(() => {
    if (debounced.trim().length < 2) return setResults([]);
    let live = true;
    api.get('/search', { q: debounced }).then((r) => live && setResults(r)).catch(() => {});
    return () => { live = false; };
  }, [debounced]);
  useEffect(() => {
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => { setOpen(false); setQ(''); navigate(path); };
  return (
    <div ref={box} className="relative w-full min-w-0 max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input type="search" value={q} aria-label="Search items, report IDs, locations" placeholder="Search items, report ID, brand, location..."
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && q.trim() && go(`/browse?q=${encodeURIComponent(q.trim())}`)}
        className="h-9 w-full rounded-md border border-input bg-muted/40 pl-9 pr-3 text-sm shadow-xs outline-none transition-[background-color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/30" />
      {open && q.trim().length >= 2 && (
        <div className="swap absolute left-0 right-0 top-11 z-40 max-h-96 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-md">
          {results.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No items match &quot;{q}&quot;</p> : results.map((r) => (
            <button key={r._id} onClick={() => go(`/items/${r.type}/${r._id}`)} className="flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left hover:bg-muted">
              <TypeBadge type={r.type} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.itemName}</span>
                <span className="block truncate text-xs text-muted-foreground"><span className="font-mono">{r.reportId}</span> · {r.location} · {fmtDate(r.date)}</span></span>
            </button>
          ))}
          <button onClick={() => go(`/browse?q=${encodeURIComponent(q.trim())}`)} className="mt-1 w-full rounded-sm border-t border-border px-2.5 pb-1.5 pt-2.5 text-left text-sm font-medium hover:bg-muted">See all results</button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });
  const items = navFor(user.role);

  const refreshCounts = useCallback(() => {
    Promise.all([api.get('/notifications'), api.get('/messages/unread')])
      .then(([n, m]) => setCounts({ notifications: n.unread, messages: m.unread }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshCounts();
    const t = setInterval(refreshCounts, 30000);
    window.addEventListener('clf:refresh-counts', refreshCounts);
    return () => { clearInterval(t); window.removeEventListener('clf:refresh-counts', refreshCounts); };
  }, [refreshCounts, pathname]);
  useEffect(() => { setDrawer(false); setMenu(false); window.scrollTo(0, 0); }, [pathname]);

  const doLogout = () => { logout(pathname + search); toast.info('You have been logged out.'); navigate('/login'); };
  const bottom = user.role === 'admin'
    ? [['/admin', 'Home', Home], ['/admin/reports', 'Reports', FileSearch], ['/admin/claims', 'Claims', FileCheck2], ['/profile', 'Profile', UserCircle]]
    : [['/dashboard', 'Home', Home], ['/browse', 'Browse', PackageSearch], ['/report/lost', 'Report', Plus], ['/matches', 'Matches', Sparkles], ['/profile', 'Profile', UserCircle]];

  return (
    <div className="min-h-screen lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm">Skip to content</a>
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background lg:flex"><Brand /><NavItems items={items} counts={counts} /></aside>
      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="slide-x absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-background">
            <div className="flex items-center justify-between border-b border-border pr-3"><div className="flex-1"><Brand /></div>
              <button onClick={() => setDrawer(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close menu"><X className="size-4" /></button></div>
            <NavItems items={items} counts={counts} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6 lg:px-10">
        <button onClick={() => setDrawer(true)} className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
        <GlobalSearch />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link to="/notifications" className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Notifications, ${counts.notifications} unread`}>
            <Bell className="size-[18px]" />
            {counts.notifications > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium tabular-nums text-primary-foreground">{counts.notifications}</span>}
          </Link>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-muted" aria-haspopup="menu" aria-expanded={menu}>
              <span className="sr-only">Account menu</span>
              <Avatar user={user} size="sm" />
              <span className="hidden whitespace-nowrap text-left leading-tight sm:block"><span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-xs capitalize text-muted-foreground">{user.role}</span></span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />
            </button>
            {menu && (
              <div role="menu" className="swap absolute right-0 mt-2 w-56 rounded-md border border-border bg-background p-1 shadow-md">
                <div className="border-b border-border px-2.5 pb-2.5 pt-2"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  {user.requestedRole && <Badge tone="amber" className="mt-2">Staff request pending</Badge>}</div>
                <Link role="menuitem" to="/profile" className="mt-1 flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-muted"><UserCircle className="size-4 text-muted-foreground" />Profile</Link>
                <button role="menuitem" onClick={doLogout} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm hover:bg-muted"><LogOut className="size-4 text-muted-foreground" />Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-6 py-10 pb-28 md:px-10 lg:pb-16"><Outlet /></main>

      {/* mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/90 backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${bottom.length}, 1fr)` }} aria-label="Quick navigation">
        {bottom.map(([to, label, Icon]) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
              <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.75} aria-hidden />{label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
