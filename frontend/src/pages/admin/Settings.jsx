import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { RefreshCw } from 'lucide-react';
import { Async, Badge, Button, FormSection, Input, PageHeader, Skeleton, Toggle } from '../../components/ui';
import { useInvalid, useToast } from '../../context/ToastContext';
import { refreshAppSettings, useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';

const toForm = (s) => ({ appName: s.appName, institutionName: s.institutionName, contactEmail: s.contactEmail || '', supportContact: s.supportContact || '' });
const uptime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

const Row = ({ title, hint, children }) => (
  <li className="flex items-center justify-between gap-6 px-4 py-3.5">
    <div className="min-w-0"><p className="text-sm font-medium">{title}</p>{hint && <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</p>}</div>
    <div className="shrink-0">{children}</div>
  </li>
);

// General details and notification switches: saved in the database and used by the app.
function SettingsForm({ initial, onSaved }) {
  const toast = useToast();
  const onInvalid = useInvalid();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: toForm(initial) });
  const [notifications, setNotifications] = useState(initial.notifications);
  const switchesChanged = JSON.stringify(notifications) !== JSON.stringify(initial.notifications);
  const dirty = isDirty || switchesChanged;

  const submit = async (values) => {
    try {
      const saved = await api.put('/admin/settings', { ...values, notifications });
      toast.success('Settings saved.');
      refreshAppSettings(); // header, sign-in pages and footer pick up the new name immediately
      onSaved(saved);
      reset(toForm(saved));
      setNotifications(saved.notifications);
    } catch (e) { toast.error(e.message); }
  };
  const discard = () => { reset(toForm(initial)); setNotifications(initial.notifications); };
  const set = (key) => (value) => setNotifications((n) => ({ ...n, [key]: value }));
  const off = !notifications.enabled;

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate>
      <FormSection title="General Settings" description="Shown in the header, on the sign-in pages, in the footer and on the contact page.">
        <Input label="Application name" required error={errors.appName?.message}
          {...register('appName', { required: 'Application name is required', minLength: { value: 2, message: 'Use at least 2 characters' }, maxLength: { value: 60, message: 'Use at most 60 characters' } })} />
        <Input label="Institution name" required error={errors.institutionName?.message}
          {...register('institutionName', { required: 'Institution name is required', minLength: { value: 2, message: 'Use at least 2 characters' }, maxLength: { value: 80, message: 'Use at most 80 characters' } })} />
        <Input label="Contact email" type="email" placeholder="lostfound@yourcollege.edu" error={errors.contactEmail?.message}
          {...register('contactEmail', { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } })} />
        <Input label="Support contact" placeholder="Security Office, Main Block" hint="A phone number, room or person to ask for help." {...register('supportContact', { maxLength: { value: 120, message: 'Use at most 120 characters' } })} />
      </FormSection>

      <FormSection title="Notification Settings" description="Controls which in-app notifications the system creates for everyone." single>
        <ul className="divide-y divide-border rounded-md border border-border">
          <Row title="Enable notifications" hint="Master switch. Turn off to stop creating in-app notifications altogether."><Toggle label="Enable notifications" checked={notifications.enabled} onChange={set('enabled')} /></Row>
          <Row title="Email notifications" hint="No email server (SMTP) is set up, so nothing is sent by email. Notifications appear in the app only.">
            <span className="flex items-center gap-3"><Badge tone="amber">Not configured</Badge><Toggle label="Email notifications (not available)" checked={false} onChange={() => {}} /></span>
          </Row>
          <Row title="Claim notifications" hint="Claim submitted, approved, rejected, more information needed, handover."><Toggle label="Claim notifications" checked={notifications.claims && !off} onChange={set('claims')} /></Row>
          <Row title="Match notifications" hint="A possible match was found for a lost report."><Toggle label="Match notifications" checked={notifications.matches && !off} onChange={set('matches')} /></Row>
        </ul>
        <p className="text-xs text-muted-foreground">Everyone can also choose their own alerts on their Profile page.{off && ' Claim and match notifications are paused while the master switch is off.'}</p>
      </FormSection>

      {dirty && (
        <div className="sticky bottom-16 z-10 -mx-2 mb-6 flex flex-col gap-2 rounded-md border border-border bg-background/90 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4" role="region" aria-label="Unsaved changes">
          <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={discard}>Discard</Button><Button type="submit" loading={isSubmitting}>Save changes</Button></div>
        </div>
      )}
    </form>
  );
}

// One labelled row: title + description on the left, an optional status badge on the right.
const Line = ({ title, badge, children }) => (
  <li className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
    <div className="min-w-0"><p className="text-sm font-medium">{title}</p>{children && <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{children}</p>}</div>
    {badge}
  </li>
);

function SystemPanel({ state }) {
  return (
    <Async state={state} skeleton={<Skeleton className="h-64" />}>
      {(s) => (
        <ul aria-label="System status" className="rounded-md border border-border">
          <Line title="Environment" badge={<Badge tone={s.environment === 'production' ? 'green' : 'blue'} className="capitalize">{s.environment}</Badge>} />
          <Line title="API status" badge={<Badge tone="green" className="capitalize">{s.api.status}</Badge>}>Running for {uptime(s.api.uptimeSeconds)} · Node {s.api.nodeVersion} · port {s.api.port}</Line>
          <Line title="Database status" badge={<Badge tone={s.database.status === 'connected' ? 'green' : 'red'} className="capitalize">{s.database.status}</Badge>}>
            MongoDB · {s.database.name}{s.database.latencyMs !== null ? ` · ${s.database.latencyMs} ms` : ''}
          </Line>
          <Line title="Email delivery" badge={<Badge tone={s.email.configured ? 'green' : 'amber'}>{s.email.configured ? 'Configured' : 'Not configured'}</Badge>}>
            No SMTP server configured. Password-reset links are shown on screen in development only.
          </Line>
          <Line title="File storage" badge={<Badge tone="blue">{s.storage.type}</Badge>}>{s.storage.formats.join(', ')} up to {s.storage.maxUploadMb} MB</Line>
        </ul>
      )}
    </Async>
  );
}

function SecurityPanel({ state }) {
  return (
    <Async state={state} skeleton={<Skeleton className="h-48" />}>
      {(s) => (
        <div>
          <ul aria-label="Security rules" className="rounded-md border border-border">
            <Line title="Session settings">Sign-in lasts {s.session.standardDays} day, or {s.session.rememberDays} days when &quot;Remember me&quot; is ticked. Sessions are signed tokens (JWT) checked on every request.</Line>
            <Line title="Password policy">At least {s.passwordPolicy.minLength} characters with upper-case, lower-case and a number.</Line>
            <Line title="Password storage">Hashed with {s.passwordPolicy.hashing}. Plain-text passwords are never stored or returned.</Line>
            <Line title="Sign-in protection">Failed sign-ins and sign-up requests are rate limited per address.</Line>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground"><Badge className="mr-2">Read-only</Badge>These rules are set in the server code (backend/config/policy.js) and cannot be changed from this page.</p>
        </div>
      )}
    </Async>
  );
}

export default function Settings() {
  const settings = useFetch(() => api.get('/admin/settings'));
  const system = useFetch(() => api.get('/admin/system'));
  return (
    <div>
      <PageHeader title="Settings" subtitle="Application details, notifications, security rules and system status." />
      <Async state={settings} skeleton={<Skeleton className="h-96" />} notFound="Settings could not be found.">
        {(s) => <SettingsForm key={s.updatedAt} initial={s} onSaved={() => settings.reload()} />}
      </Async>

      <FormSection title="Security" description="How sessions and passwords are protected." single><SecurityPanel state={system} /></FormSection>

      <FormSection title="System" description="Live status of the services this application runs on." single>
        <div className="space-y-3">
          <SystemPanel state={system} />
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={system.loading && !!system.data} onClick={system.reload}>Refresh status</Button>
        </div>
      </FormSection>
    </div>
  );
}
