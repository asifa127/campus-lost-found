import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Trash2, Sparkles, FolderOpen } from 'lucide-react';
import { Async, Button, ButtonLink, Card, ConfirmDialog, EmptyState, ListSkeleton, PageHeader, Pagination, StatusBadge, Table, Tabs } from '../components/ui';
import { useFetch } from '../hooks/hooks';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { fmtDate } from '../utils/format';

export default function MyReports() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'found' ? 'found' : 'lost';
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const toast = useToast();
  const state = useFetch(() => api.get(`/${tab}`, { mine: 'true', page, limit: 10 }), [tab, page]);

  const columns = [
    { header: 'Report ID', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.reportId}</span> },
    { header: 'Item', render: (r) => <Link to={`/items/${tab}/${r._id}`} className="font-medium underline-offset-4 hover:underline">{r.itemName}</Link> },
    { header: 'Category', render: (r) => r.category || '-' },
    { header: tab === 'lost' ? 'Lost Date' : 'Found Date', render: (r) => <span className="tabular-nums">{fmtDate(r.date)}</span> },
    { header: 'Location', render: (r) => r.location || '-' },
    { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(tab === 'lost' ? [{ header: 'Matches', render: (r) => <span className={`tabular-nums ${r.matchCount ? 'font-medium' : 'text-muted-foreground'}`}>{r.matchCount || 0}</span> }] : []),
    { header: 'Created', render: (r) => <span className="tabular-nums">{fmtDate(r.createdAt)}</span> },
    {
      header: 'Actions', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <ButtonLink to={`/items/${tab}/${r._id}`} size="sm" variant="ghost" icon={Eye} aria-label={`View ${r.itemName}`} />
          {!['Recovered', 'Closed'].includes(r.status) && <ButtonLink to={`/edit/${tab}/${r._id}`} size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.itemName}`} />}
          {tab === 'lost' && r.matchCount > 0 && <ButtonLink to={`/matches?lost=${r._id}`} size="sm" variant="ghost" icon={Sparkles} aria-label="View matches" />}
          {!['Claimed', 'Recovered'].includes(r.status) && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" icon={Trash2} aria-label={`Delete ${r.itemName}`} onClick={() => setToDelete(r)} />}
        </div>
      ),
    },
  ];

  const remove = async () => {
    await api.del(`/${tab}/${toDelete._id}`);
    toast.success('Report deleted.');
    state.reload();
  };

  return (
    <div>
      <PageHeader title="My Reports" subtitle="Everything you have reported, including drafts." />
      <Tabs className="mb-6" tabs={[['lost', 'Lost Reports'], ['found', 'Found Reports']]} value={tab} onChange={(t) => { setPage(1); setParams(t === 'found' ? { tab: 'found' } : {}); }} />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0}
        empty={<Card><EmptyState icon={FolderOpen} title={tab === 'lost' ? 'No lost items found.' : 'No found items reported.'} message="Your reports will appear here once you create them."
          action={<ButtonLink to={`/report/${tab}`}>{tab === 'lost' ? 'Report a Lost Item' : 'Report a Found Item'}</ButtonLink>} /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Delete report" message="Are you sure you want to delete this report?" />
    </div>
  );
}
