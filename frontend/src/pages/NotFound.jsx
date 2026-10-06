import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="enter w-full max-w-md rounded-md border border-border">
        <EmptyState icon={Compass} title="Page not found" message="The page you are looking for does not exist or was moved."
          action={<ButtonLink to="/">Back to home</ButtonLink>} />
      </div>
    </div>
  );
}
