import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X, ChevronLeft, ChevronRight, ChevronDown, Search, AlertTriangle, RotateCw, Check, TrendingUp, MoreVertical, ShieldOff, FileQuestion, WifiOff, Info } from 'lucide-react';
import { NETWORK_ERROR } from '../services/api';
import { STATUS_TONE, initials } from '../utils/format';

export const cx = (...c) => c.filter(Boolean).join(' ');

// ---------- Buttons ----------
const BTN = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-input bg-background shadow-xs hover:bg-muted',
  danger: 'bg-destructive text-white hover:bg-destructive/90',
  success: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'hover:bg-muted',
  soft: 'bg-muted hover:bg-muted/70',
  link: 'underline-offset-4 hover:underline',
};
const BTN_SIZE = { xs: 'h-7 gap-1 px-2.5 text-xs', sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm', lg: 'h-10 px-6 text-sm' };
const BTN_SQUARE = { xs: 'size-7', sm: 'size-8', md: 'size-9', lg: 'size-10' };

export const buttonClass = ({ variant = 'primary', size = 'md', square, className } = {}) =>
  cx(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium outline-none',
    'transition-[color,background-color,border-color,transform] duration-150 active:translate-y-px',
    'focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50',
    BTN[variant], square ? BTN_SQUARE[size] : BTN_SIZE[size], className
  );

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} className={buttonClass({ variant, size, square: !children && !!Icon, className })} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
});

// A real link that looks like a button (no <button> nested inside <a>).
export function ButtonLink({ to, variant = 'primary', size = 'md', icon: Icon, className, children, ...rest }) {
  return (
    <Link to={to} className={buttonClass({ variant, size, square: !children && !!Icon, className })} {...rest}>
      {Icon && <Icon className="size-4" aria-hidden />}{children}
    </Link>
  );
}

// ---------- Form fields ----------
const control = cx(
  'w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none',
  'transition-[color,box-shadow,border-color] placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20'
);

function Field({ label, error, hint, required, id, children }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label}{required && <span className="text-destructive" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, className, icon: Icon, ...rest }, ref) {
  const id = useId();
  return (
    <Field {...{ label, error, hint, required, id }}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />}
        <input ref={ref} id={id} aria-invalid={error ? true : undefined} className={cx(control, 'h-9', Icon && 'pl-9', className)} {...rest} />
      </div>
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, options = [], placeholder, className, ...rest }, ref) {
  const id = useId();
  return (
    <Field {...{ label, error, hint, required, id }}>
      <div className="relative">
        <select ref={ref} id={id} aria-invalid={error ? true : undefined} className={cx(control, 'h-9 appearance-none pr-9', className)} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const [value, text] = Array.isArray(o) ? o : [o, o];
            return <option key={value} value={value}>{text}</option>;
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, rows = 4, ...rest }, ref) {
  const id = useId();
  return (
    <Field {...{ label, error, hint, required, id }}>
      <textarea ref={ref} id={id} rows={rows} aria-invalid={error ? true : undefined} className={cx(control, 'py-2', className)} {...rest} />
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ className, ...rest }, ref) {
  return (
    <span className={cx('relative inline-flex size-4 shrink-0', className)}>
      <input ref={ref} type="checkbox"
        className="peer size-4 appearance-none rounded-[4px] border border-input bg-background shadow-xs outline-none transition-colors checked:border-primary checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
        {...rest} />
      <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-primary-foreground peer-checked:block" />
    </span>
  );
});

export const Radio = forwardRef(function Radio(props, ref) {
  return (
    <input ref={ref} type="radio"
      className="size-4 shrink-0 appearance-none rounded-full border border-input bg-background shadow-xs outline-none transition-colors checked:border-primary checked:bg-[radial-gradient(circle,var(--primary)_0_38%,transparent_42%)] focus-visible:ring-[3px] focus-visible:ring-ring/40"
      {...props} />
  );
});

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40', checked ? 'bg-primary' : 'bg-input')}>
      <span className={cx('block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-150', checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0')} />
    </button>
  );
}

// Round colour dots (multi-select), as used for the colour filter.
export function Swatches({ options, value = [], onChange }) {
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label="Colour">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} aria-label={o.label} title={o.label}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            style={{ backgroundColor: o.swatch }}
            className={cx('size-7 rounded-full border border-foreground/15 outline-none ring-offset-2 ring-offset-background transition-shadow duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring', on && 'ring-2 ring-foreground')} />
        );
      })}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={cx(control, 'h-9 pl-9')} />
    </div>
  );
}

// Two-column form section: a title/description rail on the left (15rem, like the filter column), fields on the right.
export const FormSection = ({ title, description, single, children }) => (
  <section className="grid gap-6 border-t border-border py-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
    <div>
      <h2 className="text-sm font-medium">{title}</h2>
      {description && <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>}
    </div>
    <div className={cx('grid content-start gap-5', !single && 'sm:grid-cols-2')}>{children}</div>
  </section>
);

// ---------- Surfaces ----------
export const Card = ({ className, children, ...rest }) => (
  <div className={cx('rounded-md border border-border bg-background', className)} {...rest}>{children}</div>
);

export const DOT = {
  slate: '#a1a1aa', blue: '#5b9bd5', amber: '#fab219', teal: '#1baf7a', violet: '#8b7bd8',
  indigo: '#6a6fd8', orange: '#ec835a', green: '#0ca30c', red: '#d03b3b',
};
export const Dot = ({ tone = 'slate', className }) => (
  <span aria-hidden className={cx('inline-block size-1.5 shrink-0 rounded-full', className)} style={{ backgroundColor: DOT[tone] }} />
);

// Outline badge; pass `tone` to add a status dot.
export const Badge = ({ tone, className, children }) => (
  <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium', className)}>
    {tone && <Dot tone={tone} />}{children}
  </span>
);
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{status}</Badge>;
export const StatusText = ({ status, className }) => (
  <span className={cx('inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground', className)}><Dot tone={STATUS_TONE[status] || 'slate'} />{status}</span>
);

export function Avatar({ user, size = 'md', className }) {
  const dims = { sm: 'size-8 text-[11px] rounded-md', md: 'size-9 text-xs rounded-md', lg: 'size-16 text-lg rounded-lg' }[size];
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.profileImage]);
  return user?.profileImage && !broken ? (
    <img src={user.profileImage} alt={user.name} onError={() => setBroken(true)} className={cx('shrink-0 border border-border object-cover', dims, className)} />
  ) : (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center border border-border bg-muted font-medium text-foreground', dims, className)}>
      {initials(user?.name)}
    </span>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cx('flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]', className)}>
      {tabs.map((t) => {
        const [id, label] = Array.isArray(t) ? t : [t, t];
        const active = value === id;
        return (
          <button key={id} role="tab" aria-selected={active} onClick={() => onChange(id)}
            className={cx('whitespace-nowrap border-b-2 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:text-foreground',
              active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Overlays ----------
const modalStack = [];

// Centered dialog on desktop, bottom sheet on phones. Dialogs can stack (confirm on top of edit).
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const token = {};
    modalStack.push(token);
    const onKey = (e) => e.key === 'Escape' && modalStack[modalStack.length - 1] === token && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = modalStack.length ? 'hidden' : '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={cx('swap relative flex max-h-[88svh] w-full flex-col rounded-t-xl border border-border bg-background shadow-lg focus:outline-none sm:rounded-lg', width)}>
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close dialog"><X className="size-4" /></button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

// `requireText` adds a type-to-confirm box (used for the most sensitive actions, such as making someone an admin).
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger', requireText, children }) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={variant} loading={busy} disabled={!!requireText && typed.trim() !== requireText} onClick={run}>{confirmLabel}</Button></>}>
      <p className="text-sm text-pretty text-muted-foreground">{message}</p>
      {children}
      {requireText && (
        <div className="mt-4">
          <Input label={`Type ${requireText} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        </div>
      )}
    </Modal>
  );
}

export function Dropdown({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div role="menu" className="swap absolute right-0 z-30 mt-1 w-44 rounded-md border border-border bg-background p-1 shadow-md">
          {items.filter(Boolean).map((it) => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              className={cx('flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-muted', it.danger && 'text-destructive')}>
              {it.icon && <it.icon className="size-4" />}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Data display ----------
export function Table({ columns, rows, rowKey = '_id', empty, label = 'Data table' }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border focus-visible:ring-[3px] focus-visible:ring-ring/40" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>{columns.map((c) => <th key={c.header} scope="col" className={cx('px-4 py-2.5 text-xs font-normal uppercase tracking-wider text-muted-foreground', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={columns.length}>{empty}</td></tr>}
          {rows.map((row) => (
            <tr key={row[rowKey]} className="transition-colors hover:bg-muted/40">
              {columns.map((c) => <td key={c.header} className={cx('px-4 py-3 align-middle', c.className)}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
      <span className="text-sm tabular-nums text-muted-foreground">Page {page} of {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next<ChevronRight className="size-4" /></Button>
    </nav>
  );
}

export function EmptyState({ icon: Icon, title, message, action, compact }) {
  return (
    <div className={cx('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-16')}>
      {Icon && <Icon className="mb-4 size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />}
      <h3 className="text-sm font-medium">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// Picks a calm, specific message for the common failures: offline, no permission, not found.
export function ErrorState({ message, status, notFound = 'This item could not be found.', onRetry }) {
  const offline = message === NETWORK_ERROR;
  const kind = status === 403 || status === 401 ? 'forbidden' : status === 404 ? 'missing' : offline ? 'offline' : 'error';
  const view = {
    forbidden: { Icon: ShieldOff, title: 'Access denied', text: "You don't have permission to access this page." },
    missing: { Icon: FileQuestion, title: 'Not found', text: notFound },
    offline: { Icon: WifiOff, title: 'No connection', text: NETWORK_ERROR },
    error: { Icon: AlertTriangle, title: 'Something went wrong', text: message },
  }[kind];
  return (
    <div className="flex flex-col items-center rounded-md border border-border px-6 py-16 text-center" role="alert">
      <view.Icon className="mb-4 size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <h3 className="text-sm font-medium">{view.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{view.text}</p>
      {onRetry && kind !== 'forbidden' && kind !== 'missing' && <Button className="mt-5" variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// Inline notice (not a popup): used for dev-only hints, role notes and read-only explanations.
export function Alert({ title, children, icon: Icon = Info, tone = 'neutral', className }) {
  return (
    <div role="note" className={cx('flex gap-3 rounded-md border p-3.5 text-sm', tone === 'dev' ? 'border-dashed border-input bg-muted/40' : 'border-border bg-muted/40', className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 space-y-1">{title && <p className="font-medium">{title}</p>}<div className="text-muted-foreground">{children}</div></div>
    </div>
  );
}

// Compact single-choice control (used for the dashboard time range).
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-input bg-background p-0.5 shadow-xs">
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
          className={cx('rounded-[5px] px-3 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            value === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {text}
        </button>
      ))}
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-md bg-muted', className)} aria-hidden />;

// Same silhouette as ItemCard so the grid does not jump when data arrives.
export const CardGridSkeleton = ({ count = 6, className = 'grid-cols-2 sm:grid-cols-3' }) => (
  <div className={cx('grid gap-x-4 gap-y-8 sm:gap-x-6', className)} aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="flex flex-col gap-3"><Skeleton className="aspect-[4/5]" /><div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
    ))}
  </div>
);

export const ListSkeleton = ({ rows = 5 }) => (
  <div className="space-y-2" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
);

// Wraps the loading / error / empty / data states every data screen needs.
export function Async({ state, skeleton, empty, isEmpty, notFound, children }) {
  if (state.loading && !state.data) return skeleton || <ListSkeleton />;
  if (state.error && !state.data) return <ErrorState message={state.error} status={state.errorStatus} notFound={notFound} onRetry={state.reload} />;
  if (state.data && isEmpty?.(state.data)) return empty;
  return children(state.data);
}

// Stat cells share hairlines instead of each being a card. Wrap a set of <StatCard>s in <StatGrid>.
const STAT_COLS = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'sm:grid-cols-3 xl:grid-cols-6' };
export const StatGrid = ({ cols = 4, children }) => (
  <div className="overflow-hidden rounded-md border border-border">
    <div className={cx('-mb-px -mr-px grid grid-cols-2', STAT_COLS[cols])}>{children}</div>
  </div>
);

// `added`: how many were added in the last 30 days (optional, shown under the number)
export function StatCard({ label, value, suffix, hint, added, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('flex flex-col items-start gap-3 border-b border-r border-border bg-background p-5 text-left outline-none', onClick && 'transition-colors hover:bg-muted/50 focus-visible:bg-muted/50')}>
      <span className="eyebrow">{label}</span>
      <span className="text-3xl font-semibold tracking-tight">{value}{suffix}</span>
      {hint && <span className="-mt-1.5 text-xs text-muted-foreground">{hint}</span>}
      {added !== undefined && added !== null && (
        <span className={cx('inline-flex items-center gap-1 text-xs tabular-nums', added > 0 ? 'text-positive' : 'text-muted-foreground')}>
          <TrendingUp className="size-3.5" aria-hidden />+{added}
          <span className="whitespace-nowrap text-muted-foreground">last 30 days</span>
        </span>
      )}
    </Tag>
  );
}

export const ChartCard = ({ title, subtitle, legend, children, className }) => (
  <section className={cx('rounded-md border border-border p-5', className)}>
    <div className="flex items-start justify-between gap-4">
      <div><h3 className="text-sm font-medium">{title}</h3>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
      {legend}
    </div>
    <div className="mt-4 h-64">{children}</div>
  </section>
);

// steps: [{ label, note, done, current }]
export function Timeline({ steps }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className={cx('absolute bottom-0 left-[11.5px] top-6 w-px', s.done ? 'bg-foreground' : 'bg-border')} />}
          <span className={cx('z-10 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium tabular-nums',
            s.done ? 'border-foreground bg-foreground text-background' : s.current ? 'border-foreground bg-background text-foreground' : 'border-border bg-background text-muted-foreground')}>
            {s.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
          </span>
          <div className="pt-0.5">
            <p className={cx('text-sm font-medium', !s.done && !s.current && 'text-muted-foreground')}>{s.label}</p>
            {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="enter mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-xl">
      <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export function ScoreRing({ score, size = 56 }) {
  const stroke = size >= 96 ? 6 : 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={score >= 80 ? 'var(--foreground)' : 'var(--muted-foreground)'} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-semibold tabular-nums" style={{ fontSize: Math.max(13, Math.round(size * 0.27)) }}>{score}%</span>
    </div>
  );
}
