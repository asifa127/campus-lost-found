import { useState } from 'react';
import { Pencil, Plus, Trash2, Tags, MapPin } from 'lucide-react';
import { Async, Button, Card, ConfirmDialog, EmptyState, Input, ListSkeleton, Modal, PageHeader, Table, Toggle } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { resetCatalog, useFetch } from '../../hooks/hooks';
import { api } from '../../services/api';

// Categories and locations are the same CRUD, differing only in endpoint and wording.
function CatalogPage({ title, singular, path, listKey, icon }) {
  const toast = useToast();
  const state = useFetch(async () => (await api.get('/catalog/all'))[listKey]);
  const [edit, setEdit] = useState(null); // { _id?, name }
  const [toDelete, setToDelete] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const act = (fn, msg) => async () => {
    try { await fn(); resetCatalog(); toast.success(msg); state.reload(); } catch (e) { toast.error(e.message); throw e; }
  };
  const save = async () => {
    setBusy(true);
    try {
      await act(() => (edit._id ? api.put(`/admin/${path}/${edit._id}`, { name }) : api.post(`/admin/${path}`, { name })), edit._id ? `${singular} updated.` : `${singular} added.`)();
      setEdit(null);
    } catch { /* toast already shown */ } finally { setBusy(false); }
  };
  const openEdit = (item) => { setEdit(item || {}); setName(item?.name || ''); };

  const columns = [
    { header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { header: 'Enabled', render: (r) => <Toggle label={`Enable ${r.name}`} checked={r.enabled} onChange={act(() => api.put(`/admin/${path}/${r._id}`, { enabled: !r.enabled }), r.enabled ? `${r.name} disabled.` : `${r.name} enabled.`)} /> },
    {
      header: 'Actions', className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)} />
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" icon={Trash2} aria-label={`Delete ${r.name}`} onClick={() => setToDelete(r)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={title} subtitle={`Disabled ${title.toLowerCase()} are hidden from report forms and filters.`} actions={<Button icon={Plus} onClick={() => openEdit()}>Add {singular}</Button>} />
      <Async state={state} skeleton={<ListSkeleton />} isEmpty={(d) => d.length === 0} empty={<Card><EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} action={<Button onClick={() => openEdit()}>Add {singular}</Button>} /></Card>}>
        {(rows) => <Table columns={columns} rows={rows} />}
      </Async>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${singular}` : `Add ${singular}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} disabled={!name.trim()} onClick={save}>Save</Button></>}>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}><Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></form>
      </Modal>
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Delete ${singular.toLowerCase()}`} message={`Are you sure you want to delete "${toDelete?.name}"?`}
        onConfirm={act(() => api.del(`/admin/${path}/${toDelete._id}`), `${singular} deleted.`)} />
    </div>
  );
}

export const Categories = () => <CatalogPage title="Categories" singular="Category" path="categories" listKey="categories" icon={Tags} />;
export const Locations = () => <CatalogPage title="Locations" singular="Location" path="locations" listKey="locations" icon={MapPin} />;
