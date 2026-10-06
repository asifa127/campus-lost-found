import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Copy, Check, TerminalSquare, UserCog } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext';
import { useInvalid, useToast } from '../context/ToastContext';
import { useAppSettings } from '../hooks/hooks';
import { api } from '../services/api';
import { Alert, Badge, Button, ButtonLink, Checkbox, Input, Select } from '../components/ui';
import { BrandMark } from '../components/PublicChrome';
import { DEPARTMENTS, YEARS, stagger } from '../utils/format';

const DEMO = [
  ['Student', 'student@campus.com', 'Student@123'],
  ['Staff', 'staff@campus.com', 'Staff@123'],
  ['Admin', 'admin@campus.com', 'Admin@123'],
];
const EMAIL_RULE = { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } };
const PASSWORD_RULE = { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, message: 'Use 8+ characters with upper-case, lower-case and a number' };

function AuthShell({ title, subtitle, children, footer, wide }) {
  const { appName, institutionName } = useAppSettings();
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-muted/40 p-10 lg:flex">
        <div aria-hidden className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_bottom_left,black,transparent_70%)]" />
        <Link to="/" className="relative flex items-center gap-2.5"><BrandMark /><span className="text-sm font-semibold tracking-tight">{appName}</span></Link>
        <div className="relative max-w-md">
          <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight">Lost it on campus? Let&apos;s get it back to you.</h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">Report, match and recover belongings with the help of your campus community.</p>
        </div>
        <p className="relative text-sm text-muted-foreground">Smart matching · Verified claims · Safe handover{institutionName ? ` · ${institutionName}` : ''}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className={`enter w-full ${wide ? 'max-w-xl' : 'max-w-sm'}`}>
          <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" />Back to home</Link>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-muted-foreground">{subtitle}</p>
          {children}
          <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}

const TextLink = ({ to, children }) => <Link to={to} className="font-medium text-foreground underline underline-offset-4 hover:no-underline">{children}</Link>;

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const onInvalid = useInvalid();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { remember: false } });

  const submit = async ({ email, password, remember }) => {
    try {
      const user = await login(email, password, remember);
      toast.success(`Login successful. Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your reports and claims."
      footer={<>New here? <TextLink to="/register">Create an account</TextLink></>}>
      <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-5" noValidate>
        <Input label="Email" type="email" autoComplete="email" icon={Mail} placeholder="you@campus.com" error={errors.email?.message} {...register('email', EMAIL_RULE)} />
        <Input label="Password" type="password" autoComplete="current-password" icon={Lock} placeholder="Your password" error={errors.password?.message}
          {...register('password', { required: 'Password is required' })} />
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2"><Checkbox {...register('remember')} />Remember me</label>
          <TextLink to="/forgot-password">Forgot password?</TextLink>
        </div>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Log in</Button>
      </form>
      <div style={stagger(2)} className="mt-8 rounded-md border border-dashed border-input p-4">
        <p className="eyebrow mb-3">Demo accounts</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map(([role, email, password]) => (
            <Button key={role} type="button" variant="secondary" size="xs" onClick={() => { setValue('email', email); setValue('password', password); }}>{role}</Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Click a role to fill the form, then press Log in.</p>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { register: signUp } = useAuth();
  const toast = useToast();
  const onInvalid = useInvalid();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { role: 'student' } });
  const wantsStaff = watch('role') === 'staff';

  const submit = async (values) => {
    try {
      const user = await signUp(values);
      toast.success(values.role === 'staff'
        ? 'Account created as a Student account. An admin will review your staff request.'
        : 'Account created. Welcome aboard!');
      navigate(homeFor(user), { replace: true });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <AuthShell wide title="Create your account" subtitle="Join your campus community in a minute."
      footer={<>Already registered? <TextLink to="/login">Log in</TextLink></>}>
      <form onSubmit={handleSubmit(submit, onInvalid)} className="grid gap-5 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2"><Input label="Full name" required error={errors.name?.message} {...register('name', { required: 'Full name is required' })} /></div>
        <Input label="Student / Staff ID" required error={errors.studentId?.message} {...register('studentId', { required: 'ID is required' })} />
        <Select label="Role" options={[['student', 'Student'], ['staff', 'Staff']]} {...register('role')} />
        {wantsStaff && (
          <div className="sm:col-span-2">
            <Alert icon={UserCog} title="Staff accounts start as Student accounts">
              For safety, nobody can give themselves staff access. Your account is created as a Student account and an administrator reviews your request. Staff tools unlock once it is approved.
            </Alert>
          </div>
        )}
        <Input label="Email" type="email" required error={errors.email?.message} {...register('email', EMAIL_RULE)} />
        <Input label="Phone" type="tel" required error={errors.phone?.message} {...register('phone', { required: 'Phone is required', pattern: { value: /^[0-9+\-\s]{7,15}$/, message: 'Enter a valid phone number' } })} />
        <Select label="Department" required placeholder="Select department" options={DEPARTMENTS} error={errors.department?.message} {...register('department', { required: 'Select your department' })} />
        <Select label="Year" required placeholder="Select year" options={YEARS} error={errors.year?.message} {...register('year', { required: 'Select your year' })} />
        <Input label="Password" type="password" autoComplete="new-password" required hint="8+ characters with upper-case, lower-case and a number" error={errors.password?.message}
          {...register('password', { required: 'Password is required', pattern: PASSWORD_RULE })} />
        <Input label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message}
          {...register('confirmPassword', { required: 'Confirm your password', validate: (v) => v === watch('password') || 'Passwords do not match' })} />
        <div className="sm:col-span-2"><Button type="submit" size="lg" loading={isSubmitting} className="w-full">Create account</Button></div>
      </form>
    </AuthShell>
  );
}

// Shown only when the API returns a link, which it does outside production. There is no email server,
// so nothing is e-mailed and this panel says so plainly.
function DevResetPanel({ url, minutes }) {
  const [copied, setCopied] = useState(false);
  const target = new URL(url);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the link is still visible */ }
  };
  return (
    <section aria-label="Development only" className="rounded-md border border-dashed border-input bg-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="amber"><TerminalSquare className="size-3" aria-hidden />Development only</Badge><span className="text-xs text-muted-foreground">No email was sent</span></div>
      <p className="mt-3 text-sm text-muted-foreground">This app has no email server, so the reset link is shown here instead. It is never shown in production.</p>
      <code className="mt-3 block break-all rounded-md border border-border bg-background p-2.5 font-mono text-xs">{url}</code>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ButtonLink to={target.pathname + target.search} size="sm">Open reset link</ButtonLink>
        <Button type="button" variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
        {minutes && <span className="text-xs text-muted-foreground">Valid for {minutes} minutes</span>}
      </div>
    </section>
  );
}

export function ForgotPassword() {
  const toast = useToast();
  const onInvalid = useInvalid();
  const { supportContact, contactEmail } = useAppSettings();
  const [result, setResult] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const submit = async ({ email }) => {
    try { setResult(await api.post('/auth/forgot-password', { email })); } catch (e) { toast.error(e.message); }
  };
  const help = supportContact || contactEmail;
  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we will generate a reset link."
      footer={<TextLink to="/login">Back to login</TextLink>}>
      {result ? (
        <div className="space-y-4" role="status">
          <p className="rounded-md border border-border p-4 text-sm font-medium">{result.message}</p>
          {result.resetUrl ? <DevResetPanel url={result.resetUrl} minutes={result.expiresInMinutes} />
            : help && <p className="text-sm text-muted-foreground">Need help signing in? Contact {help}.</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-5" noValidate>
          <Input label="Email" type="email" icon={Mail} error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const toast = useToast();
  const onInvalid = useInvalid();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const submit = async ({ password }) => {
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password });
      toast.success('Password updated. Please log in with your new password.');
      navigate('/login');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you have not used before."
      footer={<TextLink to="/login">Back to login</TextLink>}>
      {params.get('token') ? (
        <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-5" noValidate>
          <Input label="New password" type="password" autoComplete="new-password" icon={Lock} hint="8+ characters with upper-case, lower-case and a number" error={errors.password?.message} {...register('password', { required: 'Password is required', pattern: PASSWORD_RULE })} />
          <Input label="Confirm password" type="password" autoComplete="new-password" icon={Lock} error={errors.confirm?.message} {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} />
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Update password</Button>
        </form>
      ) : (
        <Alert title="This reset link is incomplete">Open the full link you were given, or <TextLink to="/forgot-password">request a new one</TextLink>.</Alert>
      )}
    </AuthShell>
  );
}
