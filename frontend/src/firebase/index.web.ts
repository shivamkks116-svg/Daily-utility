/**
 * Web / Expo Go stubs — Metro selects this over `index.native.ts` so the
 * Firebase native modules never get statically imported on unsupported
 * platforms. All methods throw a friendly error the UI can display.
 */
export type FirebaseUserSlim = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

export const firebaseNativeAvailable = false;

export function configureFirebaseAuth(): void { /* no-op */ }

function unsupported(): never {
  throw new Error(
    "Firebase authentication only works in an Android development / release build. Install the APK to try it.",
  );
}

export async function signInWithGoogle(): Promise<string> { return unsupported(); }
export async function fetchEmailSignInMethods(_email: string): Promise<string[]> { return unsupported(); }
export async function signInWithEmail(_email: string, _pw: string): Promise<string> { return unsupported(); }
export async function signUpWithEmail(_email: string, _pw: string, _n?: string): Promise<string> { return unsupported(); }
export async function sendPasswordReset(_email: string): Promise<void> { unsupported(); }
export async function resendEmailVerification(): Promise<void> { unsupported(); }
export async function reloadCurrentUser(): Promise<FirebaseUserSlim | null> { return null; }
export async function getFreshIdToken(_force = false): Promise<string | null> { return null; }
export async function firebaseSignOut(): Promise<void> { /* no-op */ }
export function humanizeFirebaseError(e: unknown): string {
  return (e as { message?: string })?.message || String(e);
}
