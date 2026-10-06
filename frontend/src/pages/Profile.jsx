import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Bookmark, UserCog } from 'lucide-react';
import { Alert, Async, Avatar, Badge, Button, ButtonLink, Card, EmptyState, FormSection, Input, PageHeader, Select, Toggle, buttonClass } from '../components/ui';
import ItemCard from '../components/ItemCard';
import { useAuth } from '../context/AuthContext';
import { useInvalid, useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/hooks';
import { api, toFormData } from '../services/api';
import { DEPARTMENTS, MAX_IMAGE_MB, YEARS, validateImage } from '../utils/format';

const PREFS = [['matches', 'Match alerts', 'When a possible match is found for your lost item'], ['claims', 'Claim updates', 'Approvals, requests and handover details'], ['messages', 'New messages', 'When someone contacts you']];

// Profile photo: choose, preview, replace or remove. Wrong type or size shows the standard upload message.
function AvatarPicker({ user, onChange }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (picked) => {
    if (!picked) return;
    const problem = validateImage(picked);
    setError(problem);
    if (problem) return;
    setFile(picked); setRemoved(false); onChange({ file: picked, remove: false });
  };
  const remove = () => {
    setError('');
    const hadSaved = !!user.profileImage;
    setFile(null); setRemoved(!file && hadSaved);
    onChange({ file: null, remove: !file && hadSaved });
  };
  const hasPhoto = preview || (user.profileImage && !removed);

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      {preview
        ? <img src={preview} alt="New profile photo preview" className="size-16 shrink-0 rounded-lg border border-border object-cover" />
        : <Avatar user={removed ? { ...user, profileImage: null } : user} size="lg" />}
      <div className="min-w-0 space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">{user.name}</p>
        <span className="flex flex-wrap gap-2"><Badge className="capitalize">{user.role}</Badge>{user.requestedRole && <Badge tone="amber">Staff access pending</Badge>}</span>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <label className={`${buttonClass({ variant: 'secondary', size: 'xs' })} cursor-pointer has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40`}>
            <Camera className="size-3.5" aria-hidden />{hasPhoto ? 'Replace photo' : 'Add photo'}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {hasPhoto && <Button type="button" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={remove}>Remove photo</Button>}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to {MAX_IMAGE_MB} MB. Saved with the button below.</p>
        {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const onInvalid = useInvalid();
  const [photo, setPhoto] = useState({ file: null, remove: false });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: user });
  const submit = async ({ name, phone, department, year }) => {
    try {
      setUser(await api.put('/auth/profile', toFormData({ name, phone, department, year, removeAvatar: photo.remove ? 'true' : undefined }, 'avatar', photo.file)));
      setPhoto({ file: null, remove: false });
      toast.success('Profile updated.');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate>
      <FormSection title="Personal information">
        <AvatarPicker key={user.profileImage || 'none'} user={user} onChange={setPhoto} />
        {user.requestedRole && (
          <div className="sm:col-span-2">
            <Alert icon={UserCog} title="Your staff request is waiting for an administrator">Your account stays a Student account until an admin approves it. Staff tools unlock as soon as it is approved.</Alert>
          </div>
        )}
        <Input label="Full name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
        <Input label="Student / Staff ID" value={user.studentId} disabled readOnly />
        <Input label="Email" value={user.email} disabled readOnly />
        <Input label="Phone" error={errors.phone?.message} {...register('phone', { required: 'Phone is required' })} />
        <Select label="Department" options={DEPARTMENTS} {...register('department')} />
        <Select label="Year" options={YEARS} {...register('year')} />
        <div className="sm:col-span-2"><Button type="submit" loading={isSubmitting}>Save changes</Button></div>
      </FormSection>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const onInvalid = useInvalid();
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const submit = async ({ currentPassword, newPassword }) => {
    try { await api.put('/auth/password', { currentPassword, newPassword }); toast.success('Password changed.'); reset(); } catch (e) { toast.error(e.message); }
  };
  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate>
      <FormSection title="Change password" single>
        <div className="max-w-sm space-y-5">
          <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword', { required: 'Enter your current password' })} />
          <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message}
            {...register('newPassword', { required: 'Enter a new password', pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, message: 'Use 8+ characters with upper-case, lower-case and a number' } })} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message}
            {...register('confirm', { validate: (v) => v === watch('newPassword') || 'Passwords do not match' })} />
          <Button type="submit" variant="secondary" loading={isSubmitting}>Update password</Button>
        </div>
      </FormSection>
    </form>
  );
}

function Preferences() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const change = async (key, value) => {
    try {
      setUser(await api.put('/auth/profile', { notificationPrefs: { ...user.notificationPrefs, [key]: value } }));
      toast.success('Preferences saved.');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <FormSection title="Notification preferences" single>
      <ul className="max-w-lg divide-y divide-border rounded-md border border-border">
        {PREFS.map(([key, title, hint]) => (
          <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
            <Toggle label={title} checked={user.notificationPrefs?.[key] !== false} onChange={(v) => change(key, v)} />
          </li>
        ))}
      </ul>
    </FormSection>
  );
}

export default function Profile() {
  const saved = useFetch(() => api.get('/users/saved'));
  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your account, security and notifications." />
      <div>
        <ProfileForm />
        <PasswordForm />
        <Preferences />
        <FormSection title="Saved items" single>
          <Async state={saved} isEmpty={(d) => d.length === 0}
            empty={<Card><EmptyState icon={Bookmark} title="Nothing saved" message='Use "Save Item" on any report to keep it here.' action={<ButtonLink to="/browse" variant="secondary">Browse items</ButtonLink>} /></Card>}>
            {(items) => <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6">{items.map((it, i) => <ItemCard key={it._id} item={it} index={i} />)}</div>}
          </Async>
        </FormSection>
      </div>
    </div>
  );
}
