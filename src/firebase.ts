import {initializeApp} from 'firebase/app';
import {getAuth, GoogleAuthProvider} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'PsWilliamh@gmail.com';

// Validate connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation helpers strictly synchronized with firebase-blueprint.json & firestore.rules
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)
    ? cleaned
    : `doc_${Date.now()}`;
}

export function clampStr(val: string | undefined, maxLen: number, fallback = '-'): string {
  const trimmed = (val ?? '').trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export async function ensureBootstrappedAdminRecord(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  if (
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified
  ) {
    const path = `admins/${user.uid}`;
    try {
      await setDoc(doc(db, 'admins', user.uid), {
        ownerId: user.uid,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    } catch {
      // Admin doc may already exist (update is disabled on /admins by design)
    }
  }
}

export interface CloudIncidentReportInput {
  id: string;
  dateTime: string;
  location: string;
  motorcycleMakeModel: string;
  motorcycleColor: string;
  plateNumber: string;
  cameraSource: string;
  summaryText: string;
  status: 'draft' | 'verified' | 'archived';
}

export async function saveIncidentReportToCloud(
  input: CloudIncidentReportInput
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to sync incident reports.');

  const reportId = sanitizeId(input.id);
  const path = `incident_reports/${reportId}`;

  try {
    await setDoc(doc(db, 'incident_reports', reportId), {
      ownerId: user.uid,
      dateTime: clampStr(input.dateTime, 64, new Date().toISOString()),
      location: clampStr(input.location, 300, 'RT/RW Location'),
      motorcycleMakeModel: clampStr(input.motorcycleMakeModel, 150, 'Motorcycle'),
      motorcycleColor: clampStr(input.motorcycleColor, 100, 'Black'),
      plateNumber: clampStr(input.plateNumber, 32, 'UNKNOWN'),
      cameraSource: clampStr(input.cameraSource, 120, 'External Moto Cam'),
      summaryText: clampStr(input.summaryText, 5000, 'Incident Visual Summary'),
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCloudReportStatus(
  reportId: string,
  existingDoc: {
    dateTime: string;
    location: string;
    motorcycleMakeModel: string;
    motorcycleColor: string;
    plateNumber: string;
    cameraSource: string;
    summaryText: string;
  },
  newStatus: 'draft' | 'verified' | 'archived'
): Promise<void> {
  const cleanId = sanitizeId(reportId);
  const path = `incident_reports/${cleanId}`;
  try {
    await updateDoc(doc(db, 'incident_reports', cleanId), {
      dateTime: clampStr(existingDoc.dateTime, 64),
      location: clampStr(existingDoc.location, 300),
      motorcycleMakeModel: clampStr(existingDoc.motorcycleMakeModel, 150),
      motorcycleColor: clampStr(existingDoc.motorcycleColor, 100),
      plateNumber: clampStr(existingDoc.plateNumber, 32),
      cameraSource: clampStr(existingDoc.cameraSource, 120),
      summaryText: clampStr(existingDoc.summaryText, 5000),
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudIncidentReport(reportId: string): Promise<void> {
  const cleanId = sanitizeId(reportId);
  const path = `incident_reports/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'incident_reports', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CameraProfileInput {
  id?: string;
  cameraName: string;
  mountPosition:
    | 'front_handlebar'
    | 'rear_tail'
    | 'helmet_mount'
    | 'side_fairing'
    | 'home_security'
    | 'vehicle_cabin';
  connectionType:
    | 'usb_otg_uvc'
    | 'wifi_stream'
    | 'microsd_reader'
    | 'home_wifi_ip'
    | 'vehicle_bt_wifi';
  streamUrl: string;
}

export async function saveCameraProfileToCloud(
  input: CameraProfileInput
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to save camera profiles.');

  const camId = sanitizeId(input.id || `cam_${Date.now()}`);
  const path = `camera_profiles/${camId}`;

  try {
    await setDoc(doc(db, 'camera_profiles', camId), {
      ownerId: user.uid,
      cameraName: clampStr(input.cameraName, 100, 'Motorcycle External Cam'),
      mountPosition: input.mountPosition,
      connectionType: input.connectionType,
      streamUrl: clampStr(input.streamUrl, 300, 'usb-uvc://external'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCameraProfileFromCloud(cameraId: string): Promise<void> {
  const cleanId = sanitizeId(cameraId);
  const path = `camera_profiles/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'camera_profiles', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
