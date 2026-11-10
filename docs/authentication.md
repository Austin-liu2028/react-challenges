# Authentication and authorization

Google login uses `signInWithPopup`, with `onAuthStateChanged` observing the
session. No anonymous sign-in, account linking, migration, or data deletion is
performed. Existing anonymous records remain at their original UID paths.
Public browsing, term filters, course selection, and Course Plan stay public.

Add Course requires a non-anonymous Google user and a live Google token check.
Its Firestore creates remain owner-only under `firestore.rules`. Firestore
cannot read Realtime Database administrator flags, so Add Course deliberately
has a separate policy; administrator-only creates would require a trusted
custom claim or a Firestore role model and corresponding rules.

Edit additionally requires boolean `true` at `admins/{uid}` in Realtime
Database. The app defaults the role to false, resets it on account changes,
and subscribes to role changes. Missing roles and read errors deny editing.
Submission rechecks the live Google token, administrator flag, and account
identity before writing. Published database rules enforce owner and admin
checks independently of the UI. Clients cannot write administrator flags.

`database.rules.json` was synchronized with the published rules retrieved
read-only from `react-challenges-austin-c0167-default-rtdb` on November 10,
2026. No rules were deployed or Console settings changed. The published rules
have no course-field validation; this local snapshot preserves them exactly.
Firestore rules were left unchanged and were not verified against production.

Run `npm.cmd run build` and `npx.cmd vitest run` on Windows. Automated tests
cover authentication, account isolation, Google write guards, role-based edit
visibility, and role revocation. Backend rule enforcement should also be
verified in a Firebase emulator before future rule changes are published.
