import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  listener: null as null | ((user: User | null) => void),
  admin: true, roleListener: null as null | ((snapshot: { exists: () => true, val: () => unknown }) => void),
  popup: vi.fn(), link: vi.fn(), signOut: vi.fn(), getDocs: vi.fn(),
}));
vi.mock('./firebase', () => ({ auth: mocks.auth, db: {}, realtimeDb: {} }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) => {
    mocks.listener = listener;
    return () => { mocks.listener = null; };
  },
  signInWithPopup: mocks.popup, linkWithPopup: mocks.link, signOut: mocks.signOut,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), getDocs: mocks.getDocs, addDoc: vi.fn(),
}));
vi.mock('firebase/database', () => ({
  get: vi.fn().mockResolvedValue({ exists: () => true, val: () => null }), ref: vi.fn(), set: vi.fn(),
  onValue: (_ref: unknown, listener: (snapshot: { exists: () => true, val: () => unknown }) => void) => {
    mocks.roleListener = listener;
    listener({ exists: () => true, val: () => mocks.admin });
    return () => { mocks.roleListener = null; };
  },
}));
import App from './App';

const user = (anonymous = false) => ({
  uid: 'owner', isAnonymous: anonymous, displayName: 'Test User', email: 'test@example.com',
  providerData: anonymous ? [] : [{ providerId: 'google.com' }],
  getIdToken: vi.fn().mockResolvedValue('token'),
  getIdTokenResult: vi.fn().mockResolvedValue({ signInProvider: 'google.com' }),
}) as unknown as User;
const changeUser = async (nextUser: User | null) => {
  await act(async () => {
    mocks.auth.currentUser = nextUser;
    mocks.listener?.(nextUser);
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.currentUser = null;
  mocks.admin = true;
  mocks.roleListener = null;
  vi.mocked(ref).mockImplementation(() => ({ toString: () => 'https://test.firebaseio.com/' }) as never);
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  mocks.getDocs.mockResolvedValue({ docs: [] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    title: 'Catalog', courses: { F101: { term: 'Fall', number: '101', title: 'Public Course', meets: 'MWF 10:00-10:50' } },
  }) }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows auth loading then signed-out browsing and popup sign-in', async () => {
  render(<App />);
  expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
  await changeUser(null);
  await screen.findByText('Public Course');
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Course' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() => expect(mocks.popup).toHaveBeenCalledOnce());
});

it('clears private courses and edit controls on sign-out', async () => {
  mocks.getDocs.mockResolvedValue({ docs: [{ id: 'private', data: () => ({
    term: 'Fall', number: '999', title: 'Private Course', meets: 'TuTh 13:00-13:50',
  }) }] });
  render(<App />);
  await changeUser(user());
  await screen.findByText('Private Course');
  expect(screen.getByText('Signed in as test@example.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Course' })).toBeEnabled();
  expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
  mocks.signOut.mockImplementation(async () => {
    mocks.auth.currentUser = null;
    mocks.listener?.(null);
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign Out' })); });
  await waitFor(() => expect(screen.queryByText('Private Course')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(mocks.auth.currentUser).toBeNull();
});

it('signs into an existing Google account directly from an anonymous session', async () => {
  render(<App />);
  await changeUser(user(true));
  expect(screen.getByText('Not signed in')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Course' })).not.toBeInTheDocument();
  mocks.popup.mockImplementation(async () => {
    mocks.auth.currentUser = user();
    mocks.listener?.(mocks.auth.currentUser);
    return { user: mocks.auth.currentUser };
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })); });
  expect(mocks.popup).toHaveBeenCalledOnce();
  expect(mocks.link).not.toHaveBeenCalled();
  expect(screen.getByText('Signed in as test@example.com')).toBeInTheDocument();
  expect(screen.queryByText('Checking authentication...')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Course' })).toBeEnabled();
});

it('clears a failed popup error after a successful retry and sign-out', async () => {
  render(<App />);
  await changeUser(null);
  mocks.popup.mockRejectedValueOnce(new Error('Popup closed'));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await screen.findByText('Google sign-in failed: Popup closed');
  mocks.popup.mockImplementation(async () => {
    mocks.auth.currentUser = user();
    mocks.listener?.(mocks.auth.currentUser);
    return { user: mocks.auth.currentUser };
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })); });
  expect(screen.queryByText(/Google sign-in failed/)).not.toBeInTheDocument();
  mocks.signOut.mockImplementation(async () => {
    mocks.auth.currentUser = null;
    mocks.listener?.(null);
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign Out' })); });
  expect(screen.getByText('Not signed in')).toBeInTheDocument();
  expect(screen.queryByText('Checking authentication...')).not.toBeInTheDocument();
});

it('ignores private database results arriving after sign-out', async () => {
  let resolveCourses!: (value: unknown) => void;
  mocks.getDocs.mockImplementation(() => new Promise((resolve) => { resolveCourses = resolve; }));
  render(<App />);
  await changeUser(user());
  await changeUser(null);
  await act(async () => { resolveCourses({ docs: [{ id: 'old', data: () => ({
    term: 'Fall', number: '999', title: 'Stale Private Course', meets: 'MWF 13:00-13:50',
  }) }] }); });
  expect(screen.queryByText('Stale Private Course')).not.toBeInTheDocument();
});

it('keeps the public catalog visible before authentication is ready', async () => {
  render(<App />);
  await screen.findByText('Public Course');
  expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
  expect(mocks.getDocs).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Add Course' })).not.toBeInTheDocument();
});

it('closes the edit form and drops the previous account data when switching users', async () => {
  mocks.getDocs.mockResolvedValueOnce({ docs: [{ id: 'private', data: () => ({
    term: 'Fall', number: '999', title: 'First Account Course', meets: 'TuTh 13:00-13:50',
  }) }] });
  render(<App />);
  await changeUser(user());
  await screen.findByText('First Account Course');
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  expect(screen.getByRole('heading', { name: 'Edit Course' })).toBeInTheDocument();
  await changeUser({ ...user(), uid: 'second-owner' } as User);
  expect(screen.queryByText('First Account Course')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Edit Course' })).not.toBeInTheDocument();
  expect(screen.getByText('Public Course')).toBeInTheDocument();
});

it('allows Google users to add but requires an administrator to edit', async () => {
  mocks.admin = false;
  render(<App />);
  await changeUser(user());
  await screen.findByText('Public Course');
  expect(screen.getByRole('button', { name: 'Add Course' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  await act(async () => { mocks.roleListener?.({ exists: () => true, val: () => true }); });
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('heading', { name: 'Edit Course' })).toBeInTheDocument();
  await act(async () => { mocks.roleListener?.({ exists: () => true, val: () => false }); });
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Edit Course' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Course Plan' })).toBeEnabled();
});

it('rechecks administrator access at submission before writing an edit', async () => {
  render(<App />);
  await changeUser(user());
  await screen.findByText('Public Course');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Course Title' }), {
    target: { value: 'Changed Course' },
  });
  // The listener still says admin, but the server-side role has been revoked.
  vi.mocked(get).mockResolvedValueOnce({ exists: () => true, val: () => false } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await screen.findByText('Could not save the course: Administrator access is required to edit courses.');
  expect(set).not.toHaveBeenCalled();
});

it('keeps administrator Edit buttons after an auth notification for the same user', async () => {
  const administrator = user();
  render(<App />);
  await changeUser(administrator);
  await screen.findByText('Public Course');
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  await changeUser(administrator);
  expect(screen.getByRole('button', { name: 'Add Course' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  await changeUser(null);
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});

it('does not reset or resubscribe administrator access for a refreshed user object', async () => {
  render(<App />);
  await changeUser(user());
  await screen.findByText('Public Course');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  const existingListener = mocks.roleListener;
  await changeUser({ ...user() } as User);
  expect(mocks.roleListener).toBe(existingListener);
  expect(screen.getByRole('heading', { name: 'Edit Course' })).toBeInTheDocument();
});
