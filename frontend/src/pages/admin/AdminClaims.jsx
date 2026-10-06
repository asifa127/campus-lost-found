import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { Async, ButtonLink, Card, EmptyState, ListSkeleton, PageHeader, Pagination, StatusBadge, Table, Tabs } from '../../components/ui';
import { useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { CLAIM_STATUSES, fmtDate, timeAgo } from '../../utils/format';

export default function AdminClaims() {
  const [status, setStatus] = useState('Pending');
  const [page, setPage] = useState(1);
  const state = useFetch(() => api.get('/admin/claims', { status: status === 'all' ? '' : status, page, limit: 10 }), [status, page]);
  const columns = [
    { header: 'Claim ID', render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.claimId}</span> },
    { header: 'Claimant', render: (c) => <div><p className="font-medium">{c.claimant?.name}</p><p className="font-mono text-xs text-muted-foreground">{c.claimant?.studentId}</p></div> },
    { header: 'Found item', render: (c) => <Link to={`/items/found/${c.foundItem?._id}`} className="underline-offset-4 hover:underline">{c.foundItem?.itemName}</Link> },
    { header: 'Match', render: (c) => (c.matchScore ? <span className="font-medium tabular-nums">{c.matchScore}%</span> : <span className="text-muted-foreground">-</span>) },
    { header: 'Claim date', render: (c) => <span className="tabular-nums">{fmtDate(c.createdAt)}</span> },
    { header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { header: 'Updated', render: (c) => <span className="tabular-nums text-muted-foreground">{timeAgo(c.updatedAt)}</span> },
    { header: '', className: 'text-right', render: (c) => { const open = ['Pending', 'Under Review'].includes(c.status); return <ButtonLink to={`/claims/${c._id}`} size="sm" variant={open ? 'primary' : 'secondary'}>{open ? 'Review' : 'View'}</ButtonLink>; } },
  ];
  return (
    <div>
      <PageHeader title="Claims" subtitle="Verify ownership, approve or reject claims and manage handovers." />
      <Tabs className="mb-6" tabs={[['all', 'All'], ...CLAIM_STATUSES.map((s) => [s, s])]} value={status} onChange={(s) => { setPage(1); setStatus(s); }} />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0}
        empty={<Card><EmptyState icon={ClipboardCheck} title="No claims here" message="Claims with this status will show up in this list." /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>
    </div>
  );
}
