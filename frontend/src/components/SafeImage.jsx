import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';

// An <img> that never shows the browser's broken-image icon: it pulses while loading, fades in when ready
// and renders `fallback` if the file is missing or cannot be decoded. The parent must be `relative`.
export default function SafeImage({ src, alt, className, fallback = null, eager = false }) {
  const [state, setState] = useState('loading'); // loading | loaded | error
  const ref = useRef(null);

  useEffect(() => {
    setState('loading');
    // an image served from cache can finish before React attaches onLoad
    if (ref.current?.complete && ref.current.naturalWidth > 0) setState('loaded');
  }, [src]);

  if (!src || state === 'error') return fallback;
  return (
    <>
      {state === 'loading' && <span aria-hidden className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        ref={ref} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setState('loaded')} onError={() => setState('error')}
        className={cx('size-full object-cover transition-opacity duration-300', state === 'loaded' ? 'opacity-100' : 'opacity-0', className)}
      />
    </>
  );
}
