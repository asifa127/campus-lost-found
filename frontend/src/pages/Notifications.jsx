import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Sparkles, ClipboardCheck, MessageSquare, ShieldCheck, PartyPopper } from 'lucide-react';
import { Async, Button, Card, EmptyState, ListSkeleton, PageHeader, Tabs } from '../components/ui';
import { useFetch } from '../hooks/hooks';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { stagger, timeAgo } from '../utils/format';

const ICONS = { match: Sparkles, claim: ClipboardCheck, message: MessageSquare, report: ShieldCheck, handover: PartyPopper };
const refreshCounts = () => window.dispatchEvent(new Event('clf:refresh-counts'));

export default function Notifications() {
  const [tab, setTab] = useState('all');
  const navigate = useNavigate();
  const toast = useToast();
  const state = useFetch(() => api.get('/notifications'));

  const open = async (n) => {
    if (!n.read) {
      await api.put(`/notifications/${n._id}/read`).catch(() => {});
      state.setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x._id === n._id ? { ...x, read: true } : x)) }));
      refreshCounts();
    }
    if (n.link) navigate(n.link);
  };
  const markAll = async () => {
    await api.put('/notifications/read-all');
    state.setData((d) => ({ ...d, unread: 0, items: d.items.map((x) => ({ ...x, read: true })) }));
    refreshCounts();
    toast.success('All notifications marked as read.');
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" subtitle={state.data ? `${state.data.unread} unread` : ' '}
        actions={<Button variant="secondary" icon={CheckCheck} disabled={!state.data?.unread} onClick={markAll}>Mark all as read</Button>} />
      <Tabs className="mb-6" tabs={[['all', 'All'], ['unread', 'Unread']]} value={tab} onChange={setTab} />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.items.filter((n) => tab === 'all' || !n.read).length === 0}
        empty={<Card><EmptyState icon={Bell} title={tab === 'unread' ? "You're all caught up" : 'No notifications yet'} message="Match alerts, claim updates and messages will appear here." /></Card>}>
        {(d) => (
          <ul style={stagger(1)} className="enter divide-y divide-border overflow-hidden rounded-md border border-border">
            {d.items.filter((n) => tab === 'all' || !n.read).map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <li key={n._id}>
                  <button onClick={() => open(n)} className="flex w-full items-start gap-4 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${n.read ? 'text-muted-foreground' : 'text-foreground'}`} strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1"><span className={`block text-sm ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</span>
                      <span className="block text-sm text-muted-foreground">{n.message}</span><span className="mt-1 block text-xs tabular-nums text-muted-foreground">{timeAgo(n.createdAt)}</span></span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </div>
  );
}
