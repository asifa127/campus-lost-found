import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, Pencil, ShieldOff, ShieldCheck, Trash2, Users, UserCog } from 'lucide-react';
import { Alert, Async, Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Input, ListSkeleton, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useInvalid, useToast } from '../../context/ToastContext';
import { useDebounce, useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { DEPARTMENTS, YEARS, fmtDate } from '../../utils/format';

const ROLE_LABEL = { student: 'Student', staff: 'Staff', admin: 'Admin' };

// Every role change is confirmed. Promoting someone to Admin needs a typed confirmation.
function RoleChangeDialog({ open, user, to, onClose, onConfirm }) {
  const from = user.role;
  const isAdmin = to === 'admin';
  const promoting = ['student', 'staff', 'admin'].indexOf(to) > ['student', 'staff', 'admin'].indexOf(from);
  const message = isAdmin
    ? `Are you sure you want to make ${user.name} an Admin?`
    : promoting
      ? `Are you sure you want to promote ${user.name} to ${ROLE_LABEL[to]}?`
      : `Are you sure you want to change ${user.name}'s role from ${ROLE_LABEL[from]} to ${ROLE_LABEL[to]}?`;
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={onConfirm}
      title={isAdmin ? 'Make this user an Admin' : promoting ? 'Promote user' : 'Change role'}
      message={message} variant={isAdmin ? 'danger' : 'primary'} requireText={isAdmin ? 'ADMIN' : undefined}
      confirmLabel={isAdmin ? 'Make Admin' : promoting ? `Promote to ${ROLE_LABEL[to]}` : 'Change role'}>
      <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        {isAdmin ? 'Admins have full access: users, settings, every report and claim, and the audit log. Only do this for people you trust.'
          : to === 'staff' ? 'Staff can verify reports, review and approve claims and manage handovers.'
            : `They will lose access to ${from === 'admin' ? 'admin' : 'staff'} tools right away.`}
      </p>
    </ConfirmDialog>
  );
}

function EditModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const onInvalid = useInvalid();
  const { register, handleSubmit, setValue, getValues, formState: { isSubmitting } } = useForm({ defaultValues: user });
  const [pending, setPending] = useState(null); // values waiting for the role confirmation

  const save = async (values, extra = {}) => {
    try {
      await api.put(`/admin/users/${user._id}`, { ...values, ...extra });
      toast.success(extra.declineStaffRequest ? 'Staff request declined.' : 'User updated.');
      onSaved();
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  const submit = (values) => (values.role !== user.role ? setPending(values) : save(values));

  return (
    <>
      <Modal open onClose={onClose} title={`Edit ${user.name}`}
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={isSubmitting} onClick={handleSubmit(submit, onInvalid)}>Save</Button></>}>
        <form onSubmit={handleSubmit(submit, onInvalid)} className="grid gap-5 sm:grid-cols-2">
          {user.requestedRole && user.role === 'student' && (
            <div className="sm:col-span-2">
              <Alert icon={UserCog} title="This user asked for staff access">
                <p>Their account is still a Student account. Approve the request by choosing Staff below, or decline it.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setValue('role', 'staff')}>Choose Staff</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => save(getValues(), { declineStaffRequest: true })}>Decline request</Button>
                </div>
              </Alert>
            </div>
          )}
          <Input label="Name" {...register('name', { required: true })} />
          <Input label="Email" type="email" {...register('email', { required: true })} />
          <Select label="Role" options={[['student', 'Student'], ['staff', 'Staff'], ['admin', 'Admin']]} hint="Changing the role asks for confirmation." {...register('role')} />
          <Input label="Phone" {...register('phone')} />
          <Select label="Department" options={DEPARTMENTS} {...register('department')} />
          <Select label="Year" options={YEARS} {...register('year')} />
        </form>
      </Modal>
      {pending && <RoleChangeDialog open user={user} to={pending.role} onClose={() => setPending(null)} onConfirm={() => save(pending)} />}
    </>
  );
}

const Fact = ({ label, children }) => <div><dt className="eyebrow">{label}</dt><dd className="mt-1 break-all text-sm">{children}</dd></div>;

function ViewModal({ id, onClose }) {
  const state = useFetch(() => api.get(`/admin/users/${id}`), [id]);
  return (
    <Modal open onClose={onClose} title="User details" size="sm">
      <Async state={state} skeleton={<ListSkeleton rows={3} />} notFound="This user could not be found.">
        {({ user, stats }) => (
          <div className="space-y-6">
            <div className="flex items-center gap-4"><Avatar user={user} size="lg" /><div><p className="text-lg font-semibold tracking-tight">{user.name}</p><p className="text-sm text-muted-foreground"><span className="font-mono text-xs">{user.studentId}</span> · <span className="capitalize">{user.role}</span></p></div></div>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Email">{user.email}</Fact>
              <Fact label="Phone">{user.phone}</Fact>
              <Fact label="Department">{user.department} · {user.year}</Fact>
              <Fact label="Joined">{fmtDate(user.createdAt)}</Fact>
            </dl>
            <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border text-center">
              {[['Lost', stats.lost], ['Found', stats.found], ['Claims', stats.claims]].map(([k, v]) => <div key={k} className="p-3"><p className="text-xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
            </div>
            {user.requestedRole && <Badge tone="amber">Requested {user.requestedRole} access</Badge>}
          </div>
        )}
      </Async>
    </Modal>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ role: '', status: '', requested: '' });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type, user }
  const dq = useDebounce(q);
  const state = useFetch(() => api.get('/admin/users', { ...filters, q: dq, page, limit: 10 }), [filters.role, filters.status, filters.requested, dq, page]);
  const requests = useFetch(() => api.get('/admin/users', { requested: 'staff', limit: 1 }), [state.data]);

  const act = (fn, msg) => async () => { try { await fn(); toast.success(msg); state.reload(); } catch (e) { toast.error(e.message); throw e; } };
  const columns = [
    { header: 'Name', render: (u) => (
      <div className="flex items-center gap-3 whitespace-nowrap">
        <Avatar user={u} size="sm" />
        <div><p className="font-medium">{u.name}</p><p className="font-mono text-xs text-muted-foreground">{u.studentId}</p></div>
      </div>
    ) },
    { header: 'Email', render: (u) => <span className="text-muted-foreground">{u.email}</span> },
    { header: 'Role', render: (u) => (
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={u.role === 'admin' ? 'violet' : u.role === 'staff' ? 'indigo' : undefined} className="capitalize">{u.role}</Badge>
        {u.requestedRole && u.role === 'student' && <Badge tone="amber">Staff requested</Badge>}
      </div>
    ) },
    // Department and Created are also in the View dialog; they only get a column when the screen has room for them.
    { header: 'Department', className: 'hidden xl:table-cell', render: (u) => u.department },
    { header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
    { header: 'Created', className: 'hidden min-[1440px]:table-cell', render: (u) => <span className="tabular-nums">{fmtDate(u.createdAt)}</span> },
    {
      header: 'Actions', className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-0.5">
          <Button size="sm" variant="ghost" icon={Eye} aria-label={`View ${u.name}`} onClick={() => setModal({ type: 'view', user: u })} />
          <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${u.name}`} onClick={() => setModal({ type: 'edit', user: u })} />
          {u._id !== me._id && (
            <>
              {u.status === 'active'
                ? <Button size="sm" variant="ghost" icon={ShieldOff} aria-label={`Block ${u.name}`} onClick={() => setModal({ type: 'block', user: u })} />
                : <Button size="sm" variant="ghost" icon={ShieldCheck} aria-label={`Unblock ${u.name}`} onClick={act(() => api.put(`/admin/users/${u._id}/unblock`), 'User unblocked.')} />}
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" icon={Trash2} aria-label={`Delete ${u.name}`} onClick={() => setModal({ type: 'delete', user: u })} />
            </>
          )}
        </div>
      ),
    },
  ];
  const set = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  const close = () => setModal(null);
  const pendingRequests = requests.data?.total || 0;

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage students, staff and administrators." />
      {pendingRequests > 0 && (
        <div className="mb-5">
          <Alert icon={UserCog} title={`${pendingRequests} ${pendingRequests === 1 ? 'person has' : 'people have'} asked for staff access`}>
            <p>Self-registered staff accounts stay Student accounts until an admin changes the role.</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => { setPage(1); setFilters({ role: '', status: '', requested: filters.requested ? '' : 'staff' }); }}>
              {filters.requested ? 'Show all users' : 'Show requests'}
            </Button>
          </Alert>
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchBar className="flex-1" value={q} onChange={(v) => { setPage(1); setQ(v); }} placeholder="Search name, email, ID, department..." />
        <Select aria-label="Filter by role" placeholder="All roles" options={[['student', 'Student'], ['staff', 'Staff'], ['admin', 'Admin']]} value={filters.role} onChange={set('role')} />
        <Select aria-label="Filter by status" placeholder="All statuses" options={[['active', 'Active'], ['blocked', 'Blocked']]} value={filters.status} onChange={set('status')} />
      </div>
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0} empty={<Card><EmptyState icon={Users} title="No users found" message="Try changing the filters or the search." /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>

      {modal?.type === 'view' && <ViewModal id={modal.user._id} onClose={close} />}
      {modal?.type === 'edit' && <EditModal user={modal.user} onClose={close} onSaved={state.reload} />}
      <ConfirmDialog open={modal?.type === 'block'} onClose={close} confirmLabel="Block" title="Block user" message={`Are you sure you want to block ${modal?.user.name}? They will not be able to log in.`}
        onConfirm={act(() => api.put(`/admin/users/${modal.user._id}/block`), 'User blocked.')} />
      <ConfirmDialog open={modal?.type === 'delete'} onClose={close} title="Delete user" message={`Are you sure you want to delete ${modal?.user.name}? Their reports, claims and messages will be removed too.`}
        onConfirm={act(() => api.del(`/admin/users/${modal.user._id}`), 'User deleted.')} />
    </div>
  );
}
