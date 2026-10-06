import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, ImageOff, RefreshCw, Trash2 } from 'lucide-react';
import { Button, cx } from './ui';
import SafeImage from './SafeImage';
import { IMAGE_ERROR, MAX_IMAGE_MB, fileSize, validateImage } from '../utils/format';

// Photo picker: click or drop a file, preview it, replace it, remove it.
//   value    the photo that is already saved (URL) or nothing
//   onChange({ file, remove })  file = newly chosen File (or null); remove = the saved photo should be deleted
// Wrong type or size shows one clear message and keeps whatever was selected before.
export default function ImageUpload({ value, onChange, label = 'Photo', compact = false }) {
  const id = useId();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = preview || (removed ? null : value);
  const update = (nextFile, nextRemoved) => {
    setFile(nextFile);
    setRemoved(nextRemoved);
    onChange({ file: nextFile, remove: nextRemoved && !nextFile });
  };

  const choose = (picked) => {
    if (!picked) return;
    const problem = validateImage(picked);
    setError(problem);
    if (!problem) update(picked, false);
  };
  const remove = () => {
    setError('');
    if (input.current) input.current.value = '';
    // dropping a new selection falls back to the saved photo; removing the saved photo marks it for deletion
    file ? update(null, false) : update(null, !!value);
  };

  const box = compact ? 'size-24' : 'size-36';
  return (
    <div>
      <p id={`${id}-label`} className="mb-2 text-sm font-medium leading-none">{label}</p>
      <div className={cx('flex gap-4', compact ? 'items-center' : 'flex-col sm:flex-row sm:items-center')}>
        {src ? (
          <div className={cx('relative shrink-0 overflow-hidden rounded-md border border-border bg-muted', box)}>
            <SafeImage src={src} alt="Selected photo preview" eager
              fallback={<span role="img" aria-label="Photo could not be loaded" className="grid size-full place-items-center text-muted-foreground"><ImageOff className="size-5" strokeWidth={1.5} /></span>} />
          </div>
        ) : (
          <label
            htmlFor={id}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
            className={cx('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 text-center text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-muted/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40',
              dragging ? 'border-ring bg-muted/60' : 'border-input', compact ? 'h-24 w-full sm:w-56' : 'h-36 w-full sm:w-56')}>
            <ImagePlus className="size-5" strokeWidth={1.5} aria-hidden />
            <span>Upload image<span className="block text-xs">or drop a file here</span></span>
          </label>
        )}
        <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-describedby={`${id}-hint`}
          onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} />

        {src && (
          <div className="flex flex-col items-start gap-2">
            {file && <p className="max-w-52 truncate text-xs text-muted-foreground">{file.name} · {fileSize(file.size)}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" icon={RefreshCw} onClick={() => input.current?.click()}>Replace</Button>
              <Button type="button" variant="ghost" size="sm" icon={Trash2} className="text-muted-foreground hover:text-destructive" onClick={remove}>Remove</Button>
            </div>
          </div>
        )}
      </div>
      <p id={`${id}-hint`} className="mt-2 text-xs text-muted-foreground">JPG, PNG or WEBP, up to {MAX_IMAGE_MB} MB.</p>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-destructive">{error || IMAGE_ERROR}</p>}
      {removed && !file && <p className="mt-1 text-xs text-muted-foreground">The current photo will be removed when you save.</p>}
    </div>
  );
}
