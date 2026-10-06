import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button, FormSection, Input, Select, Textarea } from './ui';
import ImageUpload from './ImageUpload';
import { api, toFormData } from '../services/api';
import { useInvalid, useToast } from '../context/ToastContext';
import { useCatalog } from '../hooks/hooks';
import { BUILDINGS, COLORS, today, toInputDate } from '../utils/format';

const FIELDS = [
  'itemName', 'category', 'description', 'brand', 'color', 'model', 'uniqueFeatures', 'date', 'time', 'location', 'building',
  'floor', 'locationDetails', 'estimatedValue', 'reward', 'contactPreference', 'currentLocation', 'foundBy',
];

const Wide = ({ children }) => <div className="sm:col-span-2">{children}</div>;

// One form for "report lost", "report found" and "edit report".
// The API stores the event moment in `date` / `time`; the form shows it as Lost Date / Lost Time or Found Date / Found Time.
export default function ItemForm({ kind, item, onSubmitted }) {
  const isLost = kind === 'lost';
  const when = isLost ? 'Lost' : 'Found';
  const toast = useToast();
  const onInvalid = useInvalid();
  const navigate = useNavigate();
  const { categories, locations } = useCatalog();
  const [photo, setPhoto] = useState({ file: null, remove: false });
  const [savingDraft, setSavingDraft] = useState(false);
  const { register, handleSubmit, getValues, trigger, formState: { errors, isSubmitting } } = useForm({
    defaultValues: item
      ? { ...item, date: toInputDate(item.date) }
      : { date: today(), contactPreference: 'in-app' },
  });
  const req = (msg) => ({ required: msg });

  const send = async (values, draft) => {
    const fields = Object.fromEntries(Object.entries(values).filter(([k]) => FIELDS.includes(k)));
    const body = toFormData({ ...fields, draft, removeImage: photo.remove ? 'true' : undefined }, 'image', photo.file);
    return item ? api.put(`/${kind}/${item._id}`, body) : api.post(`/${kind}`, body);
  };

  const submit = async (values) => {
    try {
      const wasDraft = item?.status === 'Draft';
      const result = await send(values, item && !wasDraft ? undefined : false);
      if (item) {
        toast.success('Report updated successfully.');
        navigate(`/items/${kind}/${item._id}`);
      } else {
        toast.success(isLost ? 'Lost item reported successfully.' : 'Found item reported successfully.');
        onSubmitted(result);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saveDraft = async () => {
    if (!(await trigger('itemName'))) return onInvalid();
    setSavingDraft(true);
    try {
      await send(getValues(), true);
      toast.success('Draft saved. Find it under My Reports.');
      navigate('/my-reports');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const catOptions = categories.map((c) => c.name);
  const locOptions = locations.map((l) => l.name);

  return (
    <form onSubmit={handleSubmit(submit, onInvalid)} noValidate>
      <FormSection title="Basic information" description="The more detail you give, the better the matching works.">
        <Wide><Input label="Item name" required placeholder={isLost ? 'e.g. Black Samsung Earbuds' : 'e.g. Samsung earbuds, black'} error={errors.itemName?.message} {...register('itemName', req('Item name is required'))} /></Wide>
        <Select label="Category" required placeholder="Select category" options={catOptions} error={errors.category?.message} {...register('category', req('Choose a category'))} />
        <Select label="Color" required placeholder="Select color" options={COLORS} error={errors.color?.message} {...register('color', req('Choose a color'))} />
        <Input label="Brand" placeholder="e.g. Samsung" {...register('brand')} />
        <Input label="Model" placeholder="e.g. Galaxy Buds Pro" {...register('model')} />
        <Wide><Textarea label="Description" required rows={3} placeholder="Describe the item, its condition and contents" error={errors.description?.message} {...register('description', req('Please describe the item'))} /></Wide>
        {isLost && <Wide><Textarea label="Unique identifying features" rows={2} placeholder="Scratches, stickers, engravings (kept private from finders)" {...register('uniqueFeatures')} /></Wide>}
      </FormSection>

      <FormSection title={isLost ? 'Where and when was it lost?' : 'Where and when was it found?'}>
        <Input label={`${when} Date`} type="date" required max={today()} error={errors.date?.message} {...register('date', req('Select the date'))} />
        <Input label={`${when} Time`} type="time" hint={isLost ? 'An approximate time is fine.' : undefined} {...register('time')} />
        <Select label="Location" required placeholder="Select location" options={locOptions} error={errors.location?.message} {...register('location', req('Choose a location'))} />
        <Select label="Building" placeholder="Select building" options={BUILDINGS} {...register('building')} />
        <Input label="Floor" placeholder="e.g. Ground, 2nd" {...register('floor')} />
        <Input label="Additional location details" placeholder="e.g. near the back-row tables" {...register('locationDetails')} />
        {!isLost && (
          <>
            <Input label="Current item location" placeholder="e.g. Security Office" {...register('currentLocation')} />
            <Input label="Found by" placeholder="Name of the finder" {...register('foundBy')} />
            <Wide><Textarea label="Hidden identifying details" rows={2} hint="Only staff see this. It is used to verify the real owner." {...register('uniqueFeatures')} /></Wide>
          </>
        )}
      </FormSection>

      {isLost && (
        <FormSection title="Optional details">
          <Input label="Estimated value (INR)" type="number" min="0" {...register('estimatedValue')} />
          <Input label="Reward" placeholder="e.g. Rs. 200 / treat" {...register('reward')} />
          <Select label="Contact preference" options={[['in-app', 'In-app messages'], ['phone', 'Phone'], ['email', 'Email']]} {...register('contactPreference')} />
        </FormSection>
      )}

      <FormSection title="Photo" single>
        <ImageUpload value={item?.image} onChange={setPhoto} label="Item image" />
      </FormSection>

      <div className="sticky bottom-16 z-10 -mx-2 flex flex-col-reverse gap-2 rounded-md border border-border bg-background/90 p-3 backdrop-blur sm:flex-row sm:justify-end lg:bottom-4">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        {(!item || item.status === 'Draft') && <Button type="button" variant="secondary" loading={savingDraft} onClick={saveDraft}>Save Draft</Button>}
        <Button type="submit" loading={isSubmitting}>{item && item.status !== 'Draft' ? 'Save Changes' : 'Submit Report'}</Button>
      </div>
    </form>
  );
}
