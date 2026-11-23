# MotoGuard Incident Helper — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched (`match /{document=**}`) deny all reads and writes.
2. **Verified Authentication & Admin Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`. Admin privilege is granted only when `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or the bootstrapped owner email (`PsWilliamh@gmail.com`) is verified (`request.auth.token.email == "PsWilliamh@gmail.com" && request.auth.token.email_verified == true`).
3. **Strict Ownership (`ownerId`)**: Every document in `/incident_reports/{reportId}` and `/camera_profiles/{cameraId}` must have `ownerId == request.auth.uid`, and `ownerId` + `createdAt` are immutable on update.
4. **Strict Keys & Size Boundaries**: Every `create` checks `keys().hasAll(...)` and `keys().hasOnly(...)`. Every `update` invokes `isValid[Entity](incoming())` first and restricts mutable fields with `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
5. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on update.
6. **Terminal State Locking**: Once an `IncidentReport` reaches `status == 'archived'`, non-admin users cannot mutate it further (`existing().status != 'archived' || isAdmin()`).
7. **Secure List Queries**: `allow list` on `/incident_reports` and `/camera_profiles` explicitly checks `resource.data.ownerId == request.auth.uid || isAdmin()` without calling `get()` inside list rules.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating an `/incident_reports/rep_1` document -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', email: 'PsWilliamh@gmail.com', email_verified: false }` -> `PERMISSION_DENIED`.
3. **Cross-User Owner Spoofing**: `auth.uid = 'u1'`, payload `ownerId = 'u2'` on `/incident_reports/rep_1` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Adding `isSuperAdmin: true` to `/incident_reports/rep_1` -> `PERMISSION_DENIED`.
5. **ID Poisoning Attack**: Document ID containing invalid characters or length > 128 -> `PERMISSION_DENIED`.
6. **Resource Exhaustion (1MB String)**: `summaryText` length > 5000 chars -> `PERMISSION_DENIED`.
7. **Timestamp Forgery on Create**: Client-supplied `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation on Update**: Changing `ownerId` or `createdAt` during update -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Updating an `IncidentReport` where `existing().status == 'archived'` as a non-admin -> `PERMISSION_DENIED`.
10. **Invalid Enum Value**: Setting `mountPosition: 'roof_rack'` on `/camera_profiles/cam_1` -> `PERMISSION_DENIED`.
11. **Unauthorized List Scraping**: Listing `/incident_reports` without filtering `resource.data.ownerId == request.auth.uid` as a non-admin -> `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Non-bootstrapped user attempting to create `/admins/{uid}` -> `PERMISSION_DENIED`.
