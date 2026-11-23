/**
 * Phase 0 TDD Verification Specification for MotoGuard Firestore Security Rules
 * Verifies that all Dirty Dozen attack vectors are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Reject unauthenticated create on incident_reports',
    collectionPath: '/incident_reports/rep_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Reject unverified email spoof for bootstrapped admin',
    collectionPath: '/admins/uid_spoof',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Reject cross-user ownerId spoofing on incident_reports',
    collectionPath: '/incident_reports/rep_02',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Reject shadow field injection on incident_reports',
    collectionPath: '/incident_reports/rep_03',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Reject invalid document ID format',
    collectionPath: '/incident_reports/invalid$id!',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Reject oversized summaryText (>5000 chars)',
    collectionPath: '/incident_reports/rep_04',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Reject forged createdAt timestamp',
    collectionPath: '/incident_reports/rep_05',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Reject mutation of immutable ownerId or createdAt on update',
    collectionPath: '/incident_reports/rep_06',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Reject non-admin update once status reaches terminal archived state',
    collectionPath: '/incident_reports/rep_07',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Reject invalid enum value on camera_profiles mountPosition',
    collectionPath: '/camera_profiles/cam_01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Reject unauthorized list scraping across other users incident_reports',
    collectionPath: '/incident_reports',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Reject self-assigned admin creation by non-bootstrapped user',
    collectionPath: '/admins/non_admin_uid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
