import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Flag, FlagOff, Pencil, ShieldCheck, Trash2, FileSearch, Settings2 } from 'lucide-react';
import { Async, Button, ButtonLink, Card, ConfirmDialog, EmptyState, ListSkeleton, Modal, PageHeader, Pagination, SearchBar, Select, StatusBadge, Table, Tabs } from '../../components/ui';
import { TypeBadge } from '../../components/ItemCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounce, useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { ITEM_STATUSES, fmtDate } from '../../utils/format';

const TABS = [['all', 'All'], ['lost', 'Lost'], ['found', 'Found'], ['pending', 'Pending Verification'], ['flagged', 'Flagged'], ['recovered', 'Recovered']];

function tabQuery(tab) {
  if (tab === 'pending') return { type: 'found', status: 'Pending Verification' };
  if (tab === 'flagged') return { flagged: 'true' };
  return { type: tab === 'all' ? '' : tab };
}

export default function AdminReports() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('flagged') ? 'flagged' : params.get('status') === 'Pending Verification' ? 'pending' : params.get('type') || 'all';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const dq = useDebounce(q);
  const state = useFetch(() => api.get('/admin/reports', { ...tabQuery(tab), q: dq, page, limit: 10 }), [tab, dq, page]);

  const selectTab = (t) => { setPage(1); const p = tabQuery(t); setParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v))); };
  const act = (fn, msg) => async () => { try { await fn(); toast.success(msg); state.reload(); } catch (e) { toast.error(e.message); throw e; } };

  const columns = [
    { header: 'Report ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.reportId}</span> },
    { header: 'Type', render: (r) => <TypeBadge type={r.type} /> },
    { header: 'Item', render: (r) => <Link to={`/items/${r.type}/${r._id}`} className="font-medium underline-offset-4 hover:underline">{r.itemName}{r.flagged && <Flag className="ml-1.5 inline size-3.5 text-destructive" aria-label="Flagged" />}</Link> },
    { header: 'Reporter', render: (r) => r.reporter?.name || '-' },
    { header: 'Location', render: (r) => r.location },
    { header: 'Date', render: (r) => <span className="tabular-nums">{fmtDate(r.date)}</span> },
    { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <ButtonLink to={`/items/${r.type}/${r._id}`} size="sm" variant="ghost" icon={Eye} aria-label={`View ${r.itemName}`} />
          {!['Verified', 'Recovered', 'Closed', 'Claimed'].includes(r.status) && <Button size="sm" variant="ghost" icon={ShieldCheck} aria-label={`Verify ${r.itemName}`} onClick={act(() => api.put(`/admin/reports/${r.type}/${r._id}/verify`), 'Report verified.')} />}
          <Button size="sm" variant="ghost" icon={r.flagged ? FlagOff : Flag} aria-label={r.flagged ? 'Remove flag' : 'Flag report'} onClick={act(() => api.put(`/admin/reports/${r.type}/${r._id}/flag`), r.flagged ? 'Flag removed.' : 'Report flagged.')} />
          {isAdmin && (
            <>
              <ButtonLink to={`/edit/${r.type}/${r._id}`} size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.itemName}`} />
              <Button size="sm" variant="ghost" icon={Settings2} aria-label="Change status" onClick={() => { setStatusModal(r); setNewStatus(r.status); }} />
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" icon={Trash2} aria-label={`Delete ${r.itemName}`} onClick={() => setToDelete(r)} />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={isAdmin ? 'Report Management' : 'Verify Reports'} subtitle="Review, verify and moderate every lost and found report." />
      <div className="mb-5 flex flex-col gap-5">
        <Tabs tabs={TABS} value={tab} onChange={selectTab} />
        <SearchBar className="max-w-md" value={q} onChange={(v) => { setPage(1); setQ(v); }} placeholder="Search report ID, item, location..." />
      </div>
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0} empty={<Card><EmptyState icon={FileSearch} title="No reports found" message="Nothing matches this view right now." /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} rowKey="reportId" /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>

      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Change report status" size="sm"
        footer={<><Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
          <Button onClick={act(async () => { await api.put(`/admin/reports/${statusModal.type}/${statusModal._id}/status`, { status: newStatus }); setStatusModal(null); }, 'Status updated.')}>Update</Button></>}>
        <Select label={statusModal?.reportId} options={ITEM_STATUSES} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} />
      </Modal>
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete report" message={`Are you sure you want to delete ${toDelete?.reportId}? This cannot be undone.`}
        onConfirm={act(() => api.del(`/${toDelete.type}/${toDelete._id}`), 'Report deleted.')} />
    </div>
  );
}
