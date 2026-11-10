# Authentication challenge

Google sign-in uses `signInWithPopup`; authentication is observed with
`onAuthStateChanged`. The shared banner displays status, loading, errors, and
sign-in/sign-out controls. Browsing, term filters, selection, course plans, and
conflict checks remain available signed out. Adding and editing require a
non-anonymous Google user, checked again against the live user and token before
submitting. Private courses are cleared on account changes, and stale database
responses are ignored. No automatic anonymous sign-in occurs.

## Existing anonymous courses

An existing anonymous session can still read its own Firestore courses and
Realtime Database edits. Choose **Link Google and keep my courses** before
signing out. Linking uses `linkWithPopup`, retains the UID, and leaves data at
the same paths. No records are deleted or automatically moved.

If that Google credential already belongs to another account, linking fails
visibly and retains the anonymous session. Export the courses while still
authenticated as their anonymous owner, or arrange a trusted administrator
migration after verifying ownership of both accounts. Back up both accounts,
copy `users/{oldUid}/courses` in Firestore and
`users/{oldUid}/courseEdits` in Realtime Database to the Google UID, resolve
course ID collisions and edit references, and verify before deleting anything.
Export/import and administrative migration are not implemented here. Knowing a
UID alone is not proof of ownership. Signing out of an unlinked anonymous account
may make it unrecoverable, so the app explicitly warns before anonymous sign-out.

See the [Firebase account-linking documentation](https://firebase.google.com/docs/auth/web/anonymous-auth).

## Rules requiring manual deployment

- `database.rules.json`: owner-only reads are retained, including anonymous
  owners; writes additionally require the Google sign-in provider. Existing
  course validation remains intact.
- `firestore.rules`, referenced by `firebase.json`: owner-only reads, Google
  owner-only creates, required field/type/length checks, and no update/delete
  access. Edits remain in Realtime Database. Unmatched paths are denied.

The original checkout had no Firestore rules file. Currently deployed Console
rules have not been retrieved or verified. Compare this proposed baseline with
the deployed rules before manually deploying to `react-challenges-austin-c0167`;
retain stricter requirements and any rules needed by unrelated collections.
No deployment, Console changes, commits, or pushes are performed here.
Rules compilation and actual database permission enforcement still need emulator
or Rules Playground verification. Configure `VITE_FIREBASE_DATABASE_URL` for
Realtime Database persistence.

I've set up prototype Security Rules to keep the data in Firestore safe. They
are designed to be secure for owner-only reads and validated Google-only course
creation. However, you should review and verify them before broadly sharing your
app. If you'd like, I can help you harden these rules.

## Tests

Run `npm.cmd run build` and `npx.cmd vitest run` on Windows. The automated tests
cover direct authorization calls, anonymous/other-provider rejection, token
provider checks, sign-out during token loading, signed-out browsing, popup
invocation, private-course clearing, anonymous linking conflicts, and stale
database responses.

Manual checks:

1. Sign in with Google, add a course, edit it, reload, and confirm both databases
   restore it. Verify required fields, duplicate rejection, conflicts, term
   filters, selection, and course plans.
2. Sign out and reload: remain signed out, with no private courses or Edit
   buttons. Sign in as a second Google user and check account isolation.
3. Restore an existing anonymous session and link an unused Google account:
   confirm the same UID and retained additions/edits. Try an already-used Google
   account and confirm the session remains anonymous with a visible error.
4. Cancel/block the popup and test network failures: errors should be visible
   and authentication controls should allow retry.
5. In emulators or Rules Playground, verify signed-out reads/writes fail,
   anonymous owner reads succeed but writes fail, Google owners can create
   courses and save edits, and other-user reads/writes fail. Test malformed
   Firestore data, unknown paths, and forbidden update/delete operations.
