import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  listener: null as null | ((user: User | null) => void),
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
  get: vi.fn().mockResolvedValue({ val: () => null }), ref: vi.fn(), set: vi.fn(),
}));
import App from './App';

const user = (anonymous = false) => ({
  uid: 'owner', isAnonymous: anonymous, displayName: 'Test User', email: 'test@example.com',
  providerData: anonymous ? [] : [{ providerId: 'google.com' }],
  getIdToken: vi.fn().mockResolvedValue('token'),
}) as unknown as User;
const changeUser = async (nextUser: User | null) => {
  await act(async () => {
    mocks.auth.currentUser = nextUser;
    mocks.listener?.(nextUser);
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = null;
  mocks.getDocs.mockResolvedValue({ docs: [] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    title: 'Catalog', courses: { F101: { term: 'Fall', number: '101', title: 'Public Course', meets: 'MWF 10:00-10:50' } },
  }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

it('retains the anonymous account when linking an existing Google credential fails', async () => {
  const anonymous = user(true);
  mocks.link.mockRejectedValue({ code: 'auth/credential-already-in-use' });
  render(<App />);
  await changeUser(anonymous);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await screen.findByText(/That Google account already exists/);
  expect(mocks.auth.currentUser).toBe(anonymous);
  expect(mocks.popup).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
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
