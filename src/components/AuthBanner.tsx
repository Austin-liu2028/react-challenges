import type { User } from 'firebase/auth';
import { isGoogleUser } from '../authentication';

type AuthBannerProps = {
  user: User | null;
  loading: boolean;
  busy: boolean;
  error: string;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export const AuthBanner = ({ user, loading, busy, error, onSignIn, onSignOut }: AuthBannerProps) => {
  const signedIn = isGoogleUser(user);
  const status = loading
    ? 'Checking authentication...'
    : signedIn
      ? `Signed in as ${user?.email || 'Google user'}`
      : 'Not signed in';
  const controlsDisabled = loading || busy;

  return (
    <header className="mb-4 rounded border border-gray-300 bg-gray-50 p-3" aria-label="Authentication">
      <div className="flex items-center justify-between gap-3">
        <div role="status" aria-live="polite" className="min-w-0 break-words text-sm">
          {status}
        </div>
        <button
          type="button"
          disabled={controlsDisabled}
          className="shrink-0 rounded border px-3 py-2 text-sm disabled:opacity-50"
          onClick={signedIn ? onSignOut : onSignIn}
        >
          {signedIn ? 'Sign Out' : 'Sign in with Google'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </header>
  );
};
