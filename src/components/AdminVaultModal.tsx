import React, {useState} from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CloudUpload,
  KeyRound,
  LogIn,
  LogOut,
  Shield,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {User} from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  CameraProfileInput,
  deleteCameraProfileFromCloud,
  deleteCloudIncidentReport,
  updateCloudReportStatus,
} from '../firebase';
import {Language} from '../types';

export interface CloudIncidentReportRecord {
  id: string;
  ownerId: string;
  dateTime: string;
  location: string;
  motorcycleMakeModel: string;
  motorcycleColor: string;
  plateNumber: string;
  cameraSource: string;
  summaryText: string;
  status: 'draft' | 'verified' | 'archived';
}

interface AdminVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentUser: User | null;
  isOwnerAdmin: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  cloudReports: CloudIncidentReportRecord[];
  cameraProfiles: Array<CameraProfileInput & {id: string}>;
  onSyncCurrentIncidentToCloud: () => Promise<void>;
  canSyncCurrent: boolean;
}

const LOCAL_ADMIN_PIN_KEY = 'motoguard_local_admin_pin_v1';

export const AdminVaultModal: React.FC<AdminVaultModalProps> = ({
  isOpen,
  onClose,
  language,
  currentUser,
  isOwnerAdmin,
  onGoogleSignIn,
  onSignOut,
  cloudReports,
  cameraProfiles,
  onSyncCurrentIncidentToCloud,
  canSyncCurrent,
}) => {
  const [authBusy, setAuthBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Offline Personal Admin PIN Lock (for quick field access when offline on motorcycle)
  const [savedPin, setSavedPin] = useState<string>(
    () => localStorage.getItem(LOCAL_ADMIN_PIN_KEY) || ''
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [localPinUnlocked, setLocalPinUnlocked] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSignInClick = async () => {
    setAuthBusy(true);
    setErrorMsg(null);
    try {
      await onGoogleSignIn();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Google Admin Sign-In failed.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncClick = async () => {
    setSyncBusy(true);
    setErrorMsg(null);
    setSyncSuccess(false);
    try {
      await onSyncCurrentIncidentToCloud();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to sync report to Cloud Vault.'
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSaveOrVerifyPin = () => {
    if (!pinInput.trim()) return;
    if (!savedPin) {
      localStorage.setItem(LOCAL_ADMIN_PIN_KEY, pinInput.trim());
      setSavedPin(pinInput.trim());
      setLocalPinUnlocked(true);
      setPinInput('');
    } else if (pinInput.trim() === savedPin) {
      setLocalPinUnlocked(true);
      setPinInput('');
      setErrorMsg(null);
    } else {
      setErrorMsg(
        language === 'id'
          ? 'PIN Admin Offline tidak cocok.'
          : 'Incorrect Offline Admin PIN.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 no-print overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {language === 'id'
                  ? 'Portal Login Admin Pribadi & Brankas Cloud'
                  : 'Personal Admin Login & Motorcycle Cloud Vault'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'id'
                  ? `Akun Pemilik Utama Terdaftar: ${BOOTSTRAPPED_ADMIN_EMAIL}`
                  : `Registered Owner Admin Account: ${BOOTSTRAPPED_ADMIN_EMAIL}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Firebase Google Authentication for Owner Admin */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3">
          {!currentUser ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'id'
                  ? 'Masuk dengan akun Google Anda untuk membuka akses penuh Admin, menyinkronkan laporan insiden ke Firestore Cloud, dan menyimpan preset kamera eksternal motor Anda.'
                  : 'Sign in with your Google Account to unlock your personal Admin Console, sync incident reports across devices via Firestore, and manage your external motorcycle camera presets.'}
              </p>
              <button
                type="button"
                disabled={authBusy}
                onClick={handleSignInClick}
                className="w-full min-h-[48px] rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-700 text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  {authBusy
                    ? language === 'id'
                      ? 'Membuka Login Google...'
                      : 'Opening Google Sign-In...'
                    : language === 'id'
                      ? 'Login Admin dengan Google (Popup)'
                      : 'Admin Sign In with Google'}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <span>{currentUser.displayName || currentUser.email}</span>
                  <span aria-hidden="true">·</span>
                  {isOwnerAdmin ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'id' ? 'ADMIN PEMILIK SAH' : 'VERIFIED OWNER ADMIN'}
                    </span>
                  ) : (
                    <span className="text-cyan-600 dark:text-cyan-400">
                      {language === 'id' ? 'Pelapor Terautentikasi' : 'Authenticated Reporter'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  {currentUser.email} · UID: {currentUser.uid.slice(0, 10)}...
                </div>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'id' ? 'Keluar' : 'Sign Out'}</span>
              </button>
            </div>
          )}

          {/* Sync Current Report Button */}
          {currentUser && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={syncBusy || !canSyncCurrent}
                onClick={handleSyncClick}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  canSyncCurrent && !syncBusy
                    ? 'bg-[#D97706] hover:bg-amber-700 text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CloudUpload className="w-4 h-4 shrink-0" />
                <span>
                  {syncBusy
                    ? language === 'id'
                      ? 'Menyinkronkan ke Brankas Cloud...'
                      : 'Syncing to Cloud Vault...'
                    : language === 'id'
                      ? 'Simpan Laporan Saat Ini ke Brankas Cloud Admin'
                      : 'Backup Current Incident Report to Admin Cloud Vault'}
                </span>
              </button>

              {syncSuccess && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'id'
                    ? 'Tersimpan di Firestore!'
                    : 'Saved to Firestore Cloud!'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Offline Field PIN Lock (Works without internet while on motorcycle) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <KeyRound className="w-4 h-4 text-cyan-600" />
              <span>
                {language === 'id'
                  ? 'PIN Kunci Admin Offline (Akses Cepat Tanpa Sinyal)'
                  : 'Offline Field Admin PIN (Quick Access Without Cellular Signal)'}
              </span>
            </div>
            {localPinUnlocked && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {language === 'id' ? 'PIN Terbuka' : 'PIN Unlocked'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              maxLength={12}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={
                savedPin
                  ? language === 'id'
                    ? 'Masukkan PIN Admin Offline Anda'
                    : 'Enter your Offline Admin PIN'
                  : language === 'id'
                    ? 'Buat PIN Admin Baru (4-8 digit)'
                    : 'Set a new 4-8 digit Offline Admin PIN'
              }
              className="flex-1 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={handleSaveOrVerifyPin}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold cursor-pointer"
            >
              {savedPin
                ? language === 'id'
                  ? 'Buka Kunci'
                  : 'Unlock PIN'
                : language === 'id'
                  ? 'Simpan PIN'
                  : 'Set PIN'}
            </button>
          </div>
        </div>

        {/* Section 3: Saved External Motorcycle Camera Profiles in Cloud */}
        {currentUser && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Camera className="w-4 h-4 text-cyan-600" />
              <span>
                {language === 'id'
                  ? `Kamera Eksternal Motor Terdaftar (${cameraProfiles.length})`
                  : `Registered External Motorcycle Cameras (${cameraProfiles.length})`}
              </span>
            </div>

            {cameraProfiles.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'id'
                  ? 'Belum ada preset kamera motor yang disimpan di Cloud. Anda dapat menyimpannya dari Hub Kamera Eksternal di Langkah 2.'
                  : 'No motorcycle camera presets saved yet. You can save your USB OTG or Wi-Fi camera from the External Camera Hub in Step 2.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cameraProfiles.map((cam) => (
                  <div
                    key={cam.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {cam.cameraName}
                      </div>
                      <div className="text-[11px] text-cyan-700 dark:text-cyan-400">
                        {cam.mountPosition.replace('_', ' ')} · {cam.connectionType}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500 truncate mt-0.5">
                        {cam.streamUrl}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCameraProfileFromCloud(cam.id)}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Cloud-Synced Incident Reports Vault */}
        {currentUser && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>
                {language === 'id'
                  ? `Arsip Laporan Insiden Cloud (${cloudReports.length})`
                  : `Cloud-Backed Incident Reports (${cloudReports.length})`}
              </span>
            </div>

            {cloudReports.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'id'
                  ? 'Belum ada laporan insiden yang disimpan ke Cloud.'
                  : 'No incident reports backed up to your Cloud Vault yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {cloudReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {rep.plateNumber} · {rep.motorcycleMakeModel} ({rep.motorcycleColor})
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label="Report Status"
                          value={rep.status}
                          onChange={(e) =>
                            updateCloudReportStatus(
                              rep.id,
                              rep,
                              e.target.value as 'draft' | 'verified' | 'archived'
                            )
                          }
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold"
                        >
                          <option value="draft">Draft</option>
                          <option value="verified">Verified</option>
                          <option value="archived">Archived (Locked)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteCloudIncidentReport(rep.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {rep.dateTime} · {rep.location} · Cam: {rep.cameraSource}
                    </div>
                    <pre className="text-[11px] bg-slate-100 dark:bg-slate-950 p-2.5 rounded-lg whitespace-pre-wrap font-mono-tabular max-h-32 overflow-y-auto text-slate-700 dark:text-slate-300">
                      {rep.summaryText}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-xs font-medium text-red-800 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
