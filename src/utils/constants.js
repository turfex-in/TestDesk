export const ROLES = {
  DEVELOPER: 'developer',
  TESTER: 'tester',
}

export const PRIORITY = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export const PRIORITY_ORDER = [PRIORITY.CRITICAL, PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW]

export const PRIORITY_WEIGHT = {
  [PRIORITY.CRITICAL]: 3,
  [PRIORITY.HIGH]: 2,
  [PRIORITY.MEDIUM]: 1.5,
  [PRIORITY.LOW]: 1,
}

export const PRIORITY_COLOR = {
  [PRIORITY.CRITICAL]: 'danger',
  [PRIORITY.HIGH]: 'tertiary',
  [PRIORITY.MEDIUM]: 'primary',
  [PRIORITY.LOW]: 'secondary',
}

export const SEVERITY = ['Critical', 'High', 'Medium', 'Low']

export const TESTCASE_STATUS = {
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
  RETEST: 'retest',
}

export const BUG_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  FIXED: 'fixed',
  RETEST: 'retest',
  CLOSED: 'closed',
  REJECTED: 'rejected',
}

export const BUG_STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  retest: 'Retest',
  closed: 'Closed',
  rejected: 'Backlog',
}

export const ROUND_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
}

export const DEFAULT_DAILY_CAPACITY = 35
export const DAILY_WEIGHT_CAP = 120
export const DAILY_HARD_CAP = 45

// Effort → minutes mapping. Used when CSV has an Effort column.
export const EFFORT_MINUTES = {
  Easy: 3,
  Medium: 6,
  Hard: 12,
  Complex: 20,
}
export const EFFORT_OPTIONS = ['Easy', 'Medium', 'Hard', 'Complex']

// Fallback minutes when no Effort column is provided, derived from priority.
export const PRIORITY_MINUTES = {
  Critical: 10,
  High: 6,
  Medium: 4,
  Low: 3,
}

// Daily time budget for a tester, in minutes (~2.5 hours of focused execution).
export const DEFAULT_DAILY_MINUTES = 150

export const DEVICES = [
  'Android 14 — Pixel 8',
  'Android 13 — Samsung Galaxy S21',
  'Android 12 — OnePlus 9',
  'iOS 17 — iPhone 15 Pro',
  'iOS 17 — iPhone 14',
  'iOS 16 — iPhone 13',
  'iPadOS 17 — iPad Pro',
  'Web — Chrome Desktop',
  'Web — Safari Desktop',
  'Web — Firefox Desktop',
]

export const TD = {
  users: 'td_users',
  projects: 'td_projects',
  rounds: 'td_rounds',
  testcases: 'td_testcases',
  bugs: 'td_bugs',
  comments: 'td_comments',
  batches: 'td_batches',
}
