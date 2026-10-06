import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Async, Button, Card, ConfirmDialog, EmptyState, ListSkeleton, PageHeader, StatusBadge, Table, Tabs } from '../../components/ui';
import { TypeBadge } from '../../components/ItemCard';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { timeAgo } from '../../utils/format';

export default function AbuseReports() {
  const toast = useToast();
  const [status, setStatus] = useState('Open');
  const [toRemove, setToRemove] = useState(null);
  const state = useFetch(() => api.get('/admin/abuse', { status: status === 'all' ? '' : status }), [status]);
  const handle = (r, action, msg) => async () => {
    try { await api.put(`/admin/abuse/${r._id}`, { action }); toast.success(msg); state.reload(); } catch (e) { toast.error(e.message); throw e; }
  };
  const columns = [
    { header: 'Item', render: (r) => <div className="flex items-center gap-2"><TypeBadge type={r.itemType} />{r.status === 'Resolved' ? <span className="font-medium" title="This item was removed">{r.itemName}</span> : <Link to={`/items/${r.itemType}/${r.itemId}`} className="font-medium underline-offset-4 hover:underline">{r.itemName}</Link>}</div> },
    { header: 'Report ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.reportId}</span> },
    { header: 'Reason', render: (r) => <div><p className="font-medium">{r.reason}</p>{r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}</div> },
    { header: 'Reported by', render: (r) => r.reporter?.name },
    { header: 'When', render: (r) => <span className="tabular-nums text-muted-foreground">{timeAgo(r.createdAt)}</span> },
    { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions', className: 'text-right',
      render: (r) => r.status === 'Open' && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={handle(r, 'dismiss', 'Report dismissed. The item is no longer flagged.')}>Dismiss</Button>
          <Button size="sm" variant="danger" onClick={() => setToRemove(r)}>Remove item</Button>
        </div>
      ),
    },
  ];
  return (
    <div>
      <PageHeader title="Abuse Reports" subtitle="Review items that users have flagged as fake, spam or inappropriate." />
      <Tabs className="mb-6" tabs={[['Open', 'Open'], ['Dismissed', 'Dismissed'], ['Resolved', 'Resolved'], ['all', 'All']]} value={status} onChange={setStatus} />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.length === 0} empty={<Card><EmptyState icon={ShieldAlert} title="Nothing to review" message="No abuse reports match this view." /></Card>}>
        {(rows) => <Table columns={columns} rows={rows} />}
      </Async>
      <ConfirmDialog open={!!toRemove} onClose={() => setToRemove(null)} confirmLabel="Remove" title="Remove item" message={`Are you sure you want to remove ${toRemove?.reportId}? The report will be deleted.`}
        onConfirm={handle(toRemove || {}, 'remove', 'Item removed.')} />
    </div>
  );
}
