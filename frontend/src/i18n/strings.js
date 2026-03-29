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
    save: 'Save',
    cancel: 'Cancel',
    submit: 'Submit',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    close: 'Close',
    search: 'Search',
    noResults: 'No results found',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    download: 'Download',
    export: 'Export',
    upload: 'Upload',
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
  dashboard: {
    title: 'Dashboard',
    noSubmissions: 'No submissions yet',
    noReviewTasks: 'No review tasks assigned',
    noSessions: 'No peer review sessions',
  },
  reviews: {
    score: 'Score',
    comments: 'Comments',
    submitReview: 'Submit Review',
    saveDraft: 'Save Draft',
    aiFeedback: 'AI Feedback',
    aiRewrite: 'AI Rewrite',
    aiPolish: 'AI Polish',
    adopted: 'Adopted',
  },
  peerReview: {
    technicalContributions: 'Technical Contributions',
    teamInteractions: 'Team Interactions',
    projectManagement: 'Project Management',
    teamChemistry: 'Team Chemistry',
    submitReviews: 'Submit Reviews',
  },
  rubric: {
    exceptional: 'Exceptional',
    proficient: 'Proficient',
    satisfactory: 'Satisfactory',
    developing: 'Developing',
    inadequate: 'Inadequate',
  },
  notifications: {
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',
    preferences: 'Notification Preferences',
  },
  enrollment: {
    addEnrollment: 'Add Enrollment',
    removeEnrollment: 'Remove Enrollment',
    courseId: 'Course ID',
    groupId: 'Group ID',
  },
  export: {
    fileReviewAnalytics: 'File Review Analytics',
    peerReviewSession: 'Peer Review Session',
    roster: 'Class Roster',
    exportCsv: 'Export CSV',
  },
};

export default strings;
