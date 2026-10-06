import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, MessageSquare, Send } from 'lucide-react';
import { Async, Avatar, Button, ButtonLink, Card, EmptyState, ListSkeleton, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/hooks';
import { api } from '../services/api';
import { fmtDateTime, timeAgo } from '../utils/format';

function Thread({ peerId, itemRef, onSent }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const state = useFetch(() => api.get('/messages', { with: peerId }), [peerId]);
  const { reload } = state;

  // simple polling keeps the conversation fresh without websockets
  useEffect(() => {
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [reload]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [state.data?.messages.length]);
  useEffect(() => { window.dispatchEvent(new Event('clf:refresh-counts')); }, [peerId, state.data?.messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post('/messages', { to: peerId, text, ...itemRef });
      setText('');
      toast.success('Message sent.');
      await reload();
      onSent();
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <Async state={state} skeleton={<div className="p-4"><ListSkeleton rows={3} /></div>}>
        {({ peer, messages }) => (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <Avatar user={peer} /><div><p className="text-sm font-medium">{peer.name}</p><p className="text-xs capitalize text-muted-foreground">{peer.role}{peer.department ? ` · ${peer.department}` : ''}</p></div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Say hello. Your phone number and email stay private.</p>}
              {messages.map((m) => {
                const mine = m.from === user._id;
                return (
                  <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted'}`}>
                      {m.itemRef?.itemId && <Link to={`/items/${m.itemRef.itemType}/${m.itemRef.itemId}`} className="mb-1 block text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100">Re: {m.itemRef.itemName} ({m.itemRef.reportId})</Link>}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums ${mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {fmtDateTime(m.createdAt)}{mine && (m.read ? <CheckCheck className="size-3" aria-label="Read" /> : <Check className="size-3" aria-label="Sent" />)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Message" placeholder="Type a message..."
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30" />
              <Button type="submit" icon={Send} loading={sending} disabled={!text.trim()}>Send</Button>
            </form>
          </>
        )}
      </Async>
    </div>
  );
}

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const peerId = params.get('with') || params.get('to');
  const itemRef = params.get('itemId') ? { itemType: params.get('itemType'), itemId: params.get('itemId') } : undefined;
  const list = useFetch(() => api.get('/messages'));

  return (
    <div>
      <PageHeader title="Messages" subtitle="Talk to reporters without sharing your phone number or email." />
      <Card className="enter grid h-[calc(100svh-17rem)] min-h-[420px] overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className={`overflow-y-auto border-r border-border ${peerId ? 'hidden md:block' : ''}`}>
          <Async state={list} skeleton={<div className="p-4"><ListSkeleton rows={4} /></div>} isEmpty={(d) => d.length === 0 && !peerId}
            empty={<EmptyState icon={MessageSquare} title="No conversations yet" message='Open an item and use "Contact Reporter" to start chatting.' action={<ButtonLink to="/browse">Browse Items</ButtonLink>} />}>
            {(convos) => convos.map((c) => (
              <button key={c.peer._id} onClick={() => setParams({ with: c.peer._id })}
                className={`flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/50 ${peerId === c.peer._id ? 'bg-muted/60' : ''}`}>
                <Avatar user={c.peer} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{c.peer.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.lastMessage.text}</span></span>
                <span className="flex flex-col items-end gap-1"><span className="text-[10px] tabular-nums text-muted-foreground">{timeAgo(c.lastMessage.createdAt)}</span>
                  {c.unread > 0 && <span className="rounded-md bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">{c.unread}</span>}</span>
              </button>
            ))}
          </Async>
        </div>
        <div className={peerId ? '' : 'hidden md:block'}>
          {peerId ? (
            <div className="flex h-full flex-col">
              <button onClick={() => setParams({})} className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-sm text-muted-foreground md:hidden"><ArrowLeft className="size-4" />All conversations</button>
              <div className="min-h-0 flex-1"><Thread key={peerId} peerId={peerId} itemRef={itemRef} onSent={() => { list.reload(); if (itemRef) setParams({ with: peerId }); }} /></div>
            </div>
          ) : <EmptyState icon={MessageSquare} title="Select a conversation" message="Pick a conversation on the left to read and reply." />}
        </div>
      </Card>
    </div>
  );
}
