/**
 * Centralized UI strings. Replace with i18n (e.g. react-i18next) when adding locales.
 * Usage: import { strings } from '../i18n/strings'; strings.results.loading
 */
export const strings = {
  common: {
    back: 'Back',
    error: 'Error',
    loading: 'Loading...',
    retry: 'Retry',
  },
  login: {
    signIn: 'Sign In',
    signInWithNetId: 'Sign in with UConn NetID',
    signInWithEmail: 'Sign in with Email',
    signingIn: 'Signing in…',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    loginFailed: 'Login failed',
    casFailed: 'Failed to verify CAS session. Please try again.',
    registrationSuccess: 'Registration successful! Please sign in.',
    orLabel: 'or',
    noAccount: 'No account?',
    createOne: 'Create one',
  },
  results: {
    loading: 'Loading results...',
    errorTitle: 'Error',
    reLogin: 'Re-login',
    backToSessions: 'Back to Sessions',
    noRawData: 'No raw data available.',
    showingReviews: (filtered, total) =>
      `Showing ${filtered} of ${total} review${total !== 1 ? 's' : ''}`,
  },
};

export default strings;
