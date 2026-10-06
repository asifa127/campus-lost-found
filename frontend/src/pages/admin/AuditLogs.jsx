import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Async, Badge, Card, EmptyState, ListSkeleton, PageHeader, Pagination, SearchBar, Table } from '../../components/ui';
import { useDebounce, useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';
import { fmtDateTime } from '../../utils/format';

const tone = (a) => (/DELETE|BLOCK|REJECT|REMOVE/.test(a) ? 'red' : /CREATE|REGISTER/.test(a) ? 'green' : /APPROVE|VERIFY|HANDOVER/.test(a) ? 'indigo' : undefined);

export default function AuditLogs() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const state = useFetch(() => api.get('/admin/audit', { q: dq, page, limit: 15 }), [dq, page]);
  const columns = [
    { header: 'When', render: (l) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{fmtDateTime(l.createdAt)}</span> },
    { header: 'User', render: (l) => <div><p className="font-medium">{l.user?.name || 'System'}</p><p className="text-xs capitalize text-muted-foreground">{l.user?.role}</p></div> },
    { header: 'Action', render: (l) => <Badge tone={tone(l.action)} className="font-mono">{l.action}</Badge> },
    { header: 'Target', render: (l) => <span className="font-mono text-xs">{l.target}</span> },
    { header: 'Details', render: (l) => <span className="text-muted-foreground">{l.details}</span> },
  ];
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="A record of important actions across the system." />
      <SearchBar className="mb-5 max-w-md" value={q} onChange={(v) => { setPage(1); setQ(v); }} placeholder="Search action, target, details..." />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.length === 0} empty={<Card><EmptyState icon={ScrollText} title="No log entries" /></Card>}>
        {(d) => (<><Table columns={columns} rows={d.items} /><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}
      </Async>
    </div>
  );
}
