import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input, Modal, Select, Textarea } from './ui';
import ImageUpload from './ImageUpload';
import { api, toFormData } from '../services/api';
import { useInvalid, useToast } from '../context/ToastContext';
import { today } from '../utils/format';

// "Claim This Item" form. Multipart because proof of ownership can be an image.
export default function ClaimModal({ open, onClose, found, myLostReports = [], defaultLostId = '', onDone }) {
  const toast = useToast();
  const onInvalid = useInvalid();
  const [file, setFile] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { lostItemId: defaultLostId, lostDate: today() },
  });

  const submit = async (values) => {
    try {
      const claim = await api.post('/claims', toFormData({ ...values, foundItemId: found._id }, 'evidence', file));
      toast.success('Claim submitted. Staff will review it shortly.');
      onDone(claim);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Claim "${found.itemName}"`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={isSubmitting} onClick={handleSubmit(submit, onInvalid)}>Submit Claim</Button></>}>
      <form onSubmit={handleSubmit(submit, onInvalid)} className="space-y-5" noValidate>
        <p className="rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          Answer honestly - staff compare your answers with the private details recorded by the finder before approving.
        </p>
        <Input label="Where did you lose the item?" required placeholder="e.g. Library, 2nd floor reading hall" error={errors.lostLocation?.message}
          {...register('lostLocation', { required: 'Tell us where you lost it' })} />
        <Input label="When did you lose it?" type="date" required max={today()} error={errors.lostDate?.message}
          {...register('lostDate', { required: 'Select the date' })} />
        <Textarea label="Describe a unique identifying feature" required rows={3} placeholder="Scratches, stickers, contents, serial number..." error={errors.uniqueFeature?.message}
          {...register('uniqueFeature', { required: 'A unique feature is required to verify ownership', minLength: { value: 8, message: 'Please add a little more detail' } })} />
        {myLostReports.length > 0 && (
          <Select label="Link one of your lost reports" placeholder="None" options={myLostReports.map((r) => [r._id, `${r.reportId} - ${r.itemName}`])} {...register('lostItemId')} />
        )}
        <Textarea label="Additional verification information" rows={2} {...register('additional')} />
        <ImageUpload label="Proof (optional image)" compact onChange={({ file: f }) => setFile(f)} />
      </form>
    </Modal>
  );
}
