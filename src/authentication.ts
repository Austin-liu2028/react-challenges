import type { User } from 'firebase/auth';
import { auth } from './firebase';

export const isGoogleUser = (user: User | null) => {
  if (!user || user.isAnonymous) return false;

  return user.providerData.some((provider) => provider.providerId === 'google.com');
};

// Check the live user and token at submission time, even if the UI is bypassed.
export const requireGoogleUser = async () => {
  const user = auth.currentUser;
  if (!user || !isGoogleUser(user)) {
    throw new Error('Sign in with Google to save courses.');
  }

  const token = await user.getIdTokenResult();
  // Token retrieval is asynchronous, so check that the account has not changed.
  if (auth.currentUser?.uid !== user.uid || token.signInProvider !== 'google.com') {
    throw new Error('Sign in with Google again before saving courses.');
  }
  return user;
};
