import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
const { auth } = vi.hoisted(() => ({ auth: { currentUser: null as User | null } }));
vi.mock('./firebase', () => ({ auth }));
import { isGoogleUser, requireGoogleUser } from './authentication';

const googleUser = () => ({
  uid: 'owner', isAnonymous: false, providerData: [{ providerId: 'google.com' }],
  getIdTokenResult: vi.fn().mockResolvedValue({ signInProvider: 'google.com' }),
}) as unknown as User;

describe('course write authorization', () => {
  beforeEach(() => { auth.currentUser = null; });
  it('rejects signed-out direct calls', async () => {
    expect(isGoogleUser(null)).toBe(false);
    await expect(requireGoogleUser()).rejects.toThrow('Sign in with Google');
  });
  it('rejects anonymous users even with Google metadata', async () => {
    auth.currentUser = { ...googleUser(), isAnonymous: true } as User;
    await expect(requireGoogleUser()).rejects.toThrow('Sign in with Google');
  });
  it('rejects non-Google providers', async () => {
    auth.currentUser = { ...googleUser(), providerData: [] } as unknown as User;
    await expect(requireGoogleUser()).rejects.toThrow('Sign in with Google');
  });
  it('checks the token provider', async () => {
    auth.currentUser = googleUser();
    vi.mocked(auth.currentUser.getIdTokenResult).mockResolvedValue({ signInProvider: 'anonymous' } as never);
    await expect(requireGoogleUser()).rejects.toThrow('again');
  });
  it('rejects sign-out during token retrieval', async () => {
    auth.currentUser = googleUser();
    vi.mocked(auth.currentUser.getIdTokenResult).mockImplementation(async () => {
      auth.currentUser = null;
      return { signInProvider: 'google.com' } as never;
    });
    await expect(requireGoogleUser()).rejects.toThrow('again');
  });
  it('allows the current Google user', async () => {
    auth.currentUser = googleUser();
    await expect(requireGoogleUser()).resolves.toBe(auth.currentUser);
  });
});
