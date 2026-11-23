/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Film,
  FolderClock,
  Globe,
  Home,
  Lock,
  Mail,
  Moon,
  Play,
  Printer,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Type as TypeIcon,
  Upload,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {collection, onSnapshot, query, where} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CameraProfileInput,
  db,
  ensureBootstrappedAdminRecord,
  googleProvider,
  handleFirestoreError,
  OperationType,
  saveCameraProfileToCloud,
  saveIncidentReportToCloud,
} from './firebase';
import {
  ExtractedFrame,
  FontFamilyOption,
  GeminiIncidentAnalysis,
  GeminiModelOption,
  IncidentMetadata,
  Language,
  SavedIncidentCase,
} from './types';
import {TRANSLATIONS} from './i18n';
import {
  ExtractionProgress,
  extractSharpestFramesFromVideoFile,
  runOnDeviceSimulatedCctvExtraction,
} from './utils/videoFrameExtractor';
import {
  deleteSavedIncidentCase,
  loadActiveDraftMetadata,
  loadSavedIncidentCases,
  loadUIPreferences,
  saveActiveDraftMetadata,
  saveUIPreferences,
  upsertSavedIncidentCase,
} from './utils/offlineStorage';
import {
  OfflineFloatingNotice,
  PWAInstallButton,
  useOnlineStatus,
} from './components/PWAInstallPrompt';
import {SuspectCropCanvases} from './components/SuspectCropCanvases';
import {formatWhatsAppIncidentSummary} from './utils/whatsappFormatter';
import {ExternalMotoCameraHub} from './components/ExternalMotoCameraHub';
import {
  AdminVaultModal,
  CloudIncidentReportRecord,
} from './components/AdminVaultModal';
import {HomeLandingPage} from './components/HomeLandingPage';
import {IncidentMediaPlayer} from './components/IncidentMediaPlayer';

const FONT_MAP: Record<FontFamilyOption, {label: string; cssFamily: string}> = {
  jakarta: {
    label: 'Plus Jakarta Sans (Default)',
    cssFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  public: {
    label: 'Public Sans (Civic Clarity)',
    cssFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  lexend: {
    label: 'Lexend (Reduced Eye Strain)',
    cssFamily: "'Lexend', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  hyperlegible: {
    label: 'Atkinson Hyperlegible (High Outdoor Contrast)',
    cssFamily: "'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, sans-serif",
  },
};

export default function App() {
  // Load persistent UI preferences (dark mode, eye-comfort cyan-green spectrum, font, language, offline email)
  const initialPrefs = useMemo(() => loadUIPreferences(), []);
  const [language, setLanguage] = useState<Language>(initialPrefs.language);
  const [darkMode, setDarkMode] = useState<boolean>(initialPrefs.darkMode);
  const [eyeComfortSpectrum, setEyeComfortSpectrum] = useState<boolean>(
    initialPrefs.eyeComfortSpectrum
  );
  const [fontFamily, setFontFamily] = useState<FontFamilyOption>(
    initialPrefs.fontFamily
  );
  const [reporterEmail, setReporterEmail] = useState<string>(
    initialPrefs.reporterEmail
  );
  const [emailInputDraft, setEmailInputDraft] = useState<string>(
    initialPrefs.reporterEmail
  );
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [showSavedDrawer, setShowSavedDrawer] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  // Firebase Auth & Admin Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [cloudReports, setCloudReports] = useState<CloudIncidentReportRecord[]>(
    []
  );
  const [cameraProfiles, setCameraProfiles] = useState<
    Array<CameraProfileInput & {id: string}>
  >([]);

  const isOwnerAdmin = useMemo(() => {
    if (!currentUser?.email) return false;
    return (
      currentUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    );
  }, [currentUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (user) {
        if (user.email) {
          setReporterEmail(user.email);
        }
        await ensureBootstrappedAdminRecord();
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      setCloudReports([]);
      setCameraProfiles([]);
      return;
    }

    const reportsQuery = query(
      collection(db, 'incident_reports'),
      where('ownerId', '==', currentUser.uid)
    );
    const unsubReports = onSnapshot(
      reportsQuery,
      (snap) => {
        const list: CloudIncidentReportRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            ownerId: d.ownerId,
            dateTime: d.dateTime,
            location: d.location,
            motorcycleMakeModel: d.motorcycleMakeModel,
            motorcycleColor: d.motorcycleColor,
            plateNumber: d.plateNumber,
            cameraSource: d.cameraSource,
            summaryText: d.summaryText,
            status: d.status,
          });
        });
        setCloudReports(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'incident_reports');
      }
    );

    const camerasQuery = query(
      collection(db, 'camera_profiles'),
      where('ownerId', '==', currentUser.uid)
    );
    const unsubCameras = onSnapshot(
      camerasQuery,
      (snap) => {
        const list: Array<CameraProfileInput & {id: string}> = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            cameraName: d.cameraName,
            mountPosition: d.mountPosition,
            connectionType: d.connectionType,
            streamUrl: d.streamUrl,
          });
        });
        setCameraProfiles(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'camera_profiles');
      }
    );

    return () => {
      unsubReports();
      unsubCameras();
    };
  }, [isAuthReady, currentUser]);

  const handleGoogleAdminSignIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleGoogleSignOut = async () => {
    await signOut(auth);
  };

  const isOnline = useOnlineStatus();
  const t = TRANSLATIONS[language];

  // Primary View: 'home' (Landing Page with Promotional Video & Roadmap) vs 'report' (Menu-driven Police Report & Camera Workspace)
  const [activeView, setActiveView] = useState<'home' | 'report'>('home');

  // Active Step (1..4) for mobile navigation & focus inside the Police Report Workspace
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Built-in Forensic Video Media Player State (100% local blob URL, zero server upload)
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);

  // Step 1: Incident Metadata & UU PDP Consent (auto-saved to localStorage)
  const [caseId, setCaseId] = useState<string>(() => `case-${Date.now()}`);
  const [metadata, setMetadata] = useState<IncidentMetadata>(() =>
    loadActiveDraftMetadata()
  );
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
  );

  // Step 2: Extracted Frames State
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] =
    useState<ExtractionProgress | null>(null);
  const [extractionStats, setExtractionStats] = useState<{
    totalSampled: number;
    videoDuration: number;
    sourceName: string;
  } | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3: Gemini Vision Structured Incident Analysis State
  const [selectedModel, setSelectedModel] =
    useState<GeminiModelOption>('gemini-2.5-flash');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<GeminiIncidentAnalysis | null>(null);
  const [modelUsedForResult, setModelUsedForResult] = useState<string>('');

  // Step 4: Copy WhatsApp Toast & Saved Cases
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [savedCases, setSavedCases] = useState<SavedIncidentCase[]>(() =>
    loadSavedIncidentCases()
  );

  // Sync dark mode class on <html> and custom font variable
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--app-font', FONT_MAP[fontFamily].cssFamily);
    saveUIPreferences({
      language,
      darkMode,
      eyeComfortSpectrum,
      fontFamily,
      reporterEmail,
    });
  }, [language, darkMode, eyeComfortSpectrum, fontFamily, reporterEmail]);

  // Auto-save metadata & case draft whenever inputs change
  useEffect(() => {
    saveActiveDraftMetadata(metadata);
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastAutoSavedAt(nowTime);

    const clearestFrameObj = frames.find(
      (f) =>
        f.frameNumber ===
        (analysisResult?.clearest_suspect_frame?.frame_number ?? 1)
    );

    const updatedCases = upsertSavedIncidentCase({
      id: caseId,
      updatedAt: new Date().toISOString(),
      metadata: {...metadata, reporterEmail},
      framesCount: frames.filter((f) => f.selected).length,
      clearestFrameDataUrl: clearestFrameObj?.dataUrl || frames[0]?.dataUrl,
      analysis: analysisResult || undefined,
      modelUsed: modelUsedForResult || undefined,
      syncStatus: analysisResult
        ? 'synced-analyzed'
        : !isOnline && frames.length > 0
          ? 'queued-offline'
          : 'local-draft',
    });
    setSavedCases(updatedCases);
  }, [
    metadata,
    frames,
    analysisResult,
    modelUsedForResult,
    caseId,
    reporterEmail,
    isOnline,
  ]);

  const updateMetaField = <K extends keyof IncidentMetadata>(
    key: K,
    value: IncidentMetadata[K]
  ) => {
    setMetadata((prev) => ({...prev, [key]: value}));
  };

  // Handle Real Local Video File Upload
  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!metadata.uuPdpConsentChecked) {
      setExtractionError(t.consentRequiredAlert);
      return;
    }

    // Create local Object URL for the built-in Media Player
    const localVideoObjectUrl = URL.createObjectURL(file);
    setActiveVideoUrl(localVideoObjectUrl);
    setLastUploadedFile(file);
    setActiveView('report');

    setIsExtracting(true);
    setExtractionError(null);
    setAnalysisResult(null);
    setActiveStep(2);

    try {
      const result = await extractSharpestFramesFromVideoFile(file, (prog) => {
        setExtractionProgress(prog);
      });
      setFrames(result.frames);
      setExtractionStats({
        totalSampled: result.totalSampled,
        videoDuration: result.videoDuration,
        sourceName: file.name,
      });
    } catch (err: unknown) {
      setExtractionError(
        err instanceof Error ? err.message : 'Error extracting frames locally.'
      );
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle 1-Click Simulated On-Device CCTV Clip Extraction (for instant testing without a local MP4)
  const handleRunSimulatedCctvClip = async () => {
    if (!metadata.uuPdpConsentChecked) {
      updateMetaField('uuPdpConsentChecked', true);
    }

    setActiveView('report');
    setIsExtracting(true);
    setExtractionError(null);
    setAnalysisResult(null);
    setActiveStep(2);

    try {
      const result = await runOnDeviceSimulatedCctvExtraction(
        {
          plateNumber: metadata.plateNumber,
          location: metadata.location,
          makeModel: metadata.motorcycleMakeModel,
        },
        (prog) => {
          setExtractionProgress(prog);
        }
      );
      setFrames(result.frames);
      if (result.simulatedVideoUrl) {
        setActiveVideoUrl(result.simulatedVideoUrl);
      }
      setLastUploadedFile(null);
      setExtractionStats({
        totalSampled: result.totalSampled,
        videoDuration: result.videoDuration,
        sourceName: 'CAM02_RT04_RW07_Curanmor_Sim.webm (On-Device Canvas)',
      });
    } catch (err: unknown) {
      setExtractionError(
        err instanceof Error ? err.message : 'Error generating simulated CCTV frames.'
      );
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  };

  // Re-run automatic 12-frame sharpness scan from the Media Player
  const handleRescanActiveVideo = async () => {
    if (lastUploadedFile) {
      setIsExtracting(true);
      setExtractionError(null);
      try {
        const result = await extractSharpestFramesFromVideoFile(
          lastUploadedFile,
          (prog) => setExtractionProgress(prog)
        );
        setFrames(result.frames);
        setExtractionStats({
          totalSampled: result.totalSampled,
          videoDuration: result.videoDuration,
          sourceName: lastUploadedFile.name,
        });
      } catch (err: unknown) {
        setExtractionError(
          err instanceof Error ? err.message : 'Error re-scanning video frames.'
        );
      } finally {
        setIsExtracting(false);
        setExtractionProgress(null);
      }
    } else {
      await handleRunSimulatedCctvClip();
    }
  };

  // Load the Google Drive promotional video ('Motor cam promo 1.mp4') directly into the Step 2 Forensic Media Player & 12-Frame Extractor
  const handleLoadPromoIntoForensicPlayer = async (
    videoUrl: string,
    title: string
  ) => {
    if (!metadata.uuPdpConsentChecked) {
      updateMetaField('uuPdpConsentChecked', true);
    }
    setActiveVideoUrl(videoUrl);
    setActiveView('report');
    setActiveStep(2);
    setIsExtracting(true);
    setExtractionError(null);
    setAnalysisResult(null);

    try {
      const resp = await fetch(videoUrl);
      const blob = await resp.blob();
      const promoFile = new File([blob], title, {
        type: blob.type || 'video/mp4',
      });
      setLastUploadedFile(promoFile);
      const result = await extractSharpestFramesFromVideoFile(
        promoFile,
        (prog) => setExtractionProgress(prog)
      );
      setFrames(result.frames);
      setExtractionStats({
        totalSampled: result.totalSampled,
        videoDuration: result.videoDuration,
        sourceName: title,
      });
    } catch (err: unknown) {
      setExtractionError(
        err instanceof Error
          ? err.message
          : 'Error extracting frames from promo video.'
      );
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  };

  // Snap a single custom frame from the Built-in Media Player into the evidence grid
  const handleManualFrameCaptured = (newFrame: ExtractedFrame) => {
    setFrames((prev) => {
      const combined = [...prev, newFrame].sort(
        (a, b) => a.timestampSeconds - b.timestampSeconds
      );
      return combined.map((item, idx) => ({
        ...item,
        frameNumber: idx + 1,
      }));
    });
  };

  const toggleFrameSelection = (frameId: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === frameId ? {...f, selected: !f.selected} : f))
    );
  };

  const selectAllFrames = () => {
    setFrames((prev) => prev.map((f) => ({...f, selected: true})));
  };

  const selectTop6Sharpest = () => {
    const top6Ids = new Set(
      [...frames]
        .sort((a, b) => b.sharpnessScore - a.sharpnessScore)
        .slice(0, 6)
        .map((f) => f.id)
    );
    setFrames((prev) =>
      prev.map((f) => ({...f, selected: top6Ids.has(f.id)}))
    );
  };

  const selectedFrames = useMemo(
    () => frames.filter((f) => f.selected),
    [frames]
  );

  // Step 3: Trigger Gemini Vision Structured Analysis via Server Proxy
  const handleRunGeminiAnalysis = async () => {
    if (selectedFrames.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setActiveStep(3);

    try {
      const payloadFrames = selectedFrames.map((f, idx) => ({
        frame_number: idx + 1,
        timestamp_offset: f.timestampFormatted,
        base64Data: f.dataUrl,
        mimeType: 'image/jpeg',
      }));

      const response = await fetch('/api/analyze-incident', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          frames: payloadFrames,
          incidentMeta: {
            dateTime: metadata.dateTime,
            location: metadata.location,
            motorcycleDetails: `${metadata.motorcycleMakeModel} (${metadata.motorcycleColor}) - Plate: ${metadata.plateNumber}`,
            reporterNotes: metadata.reporterNotes,
          },
          modelName: selectedModel,
          language,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to analyze frames with Gemini Vision.'
        );
      }

      setAnalysisResult(data.analysis);
      setModelUsedForResult(data.modelUsed || selectedModel);
      setActiveStep(4);
    } catch (err: unknown) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : 'Failed to reach Gemini analysis endpoint.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Resolve the clearest frame image for Step 4 Canvas Cropping
  const clearestFrameData = useMemo(() => {
    if (selectedFrames.length === 0) return null;
    if (!analysisResult) return selectedFrames[0];
    const targetNum = analysisResult.clearest_suspect_frame.frame_number;
    // Match 1-based index within selectedFrames or fallback to middle sharpest frame
    const matched =
      selectedFrames[targetNum - 1] ||
      selectedFrames.find((f) => f.frameNumber === targetNum) ||
      [...selectedFrames].sort((a, b) => b.sharpnessScore - a.sharpnessScore)[0];
    return matched;
  }, [selectedFrames, analysisResult]);

  // Copy WhatsApp Summary
  const handleCopyWhatsApp = async () => {
    if (!analysisResult) return;
    const text = formatWhatsAppIncidentSummary(
      metadata,
      analysisResult,
      language
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3200);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3200);
    }
  };

  const handleLoadSavedCase = (saved: SavedIncidentCase) => {
    setCaseId(saved.id);
    setMetadata(saved.metadata);
    if (saved.analysis) {
      setAnalysisResult(saved.analysis);
      setModelUsedForResult(saved.modelUsed || 'gemini-2.5-flash');
      setActiveStep(4);
    } else {
      setAnalysisResult(null);
      setActiveStep(1);
    }
    setShowSavedDrawer(false);
  };

  const handleStartNewCase = () => {
    const newId = `case-${Date.now()}`;
    setCaseId(newId);
    setFrames([]);
    setAnalysisResult(null);
    setExtractionStats(null);
    setActiveStep(1);
    setShowSavedDrawer(false);
  };

  const handleSyncCurrentIncidentToCloud = async () => {
    const summaryText = analysisResult
      ? formatWhatsAppIncidentSummary(metadata, analysisResult, language)
      : `${metadata.motorcycleMakeModel} (${metadata.motorcycleColor}) - Plate: ${metadata.plateNumber}. Location: ${metadata.location}. Notes: ${metadata.reporterNotes || 'Draft report'}`;

    await saveIncidentReportToCloud({
      id: caseId,
      dateTime: metadata.dateTime || new Date().toISOString(),
      location: metadata.location || 'RT/RW Location',
      motorcycleMakeModel: metadata.motorcycleMakeModel || 'Motorcycle',
      motorcycleColor: metadata.motorcycleColor || 'Black',
      plateNumber: metadata.plateNumber || 'UNKNOWN',
      cameraSource:
        extractionStats?.sourceName || 'External Motorcycle Camera',
      summaryText,
      status: analysisResult ? 'verified' : 'draft',
    });
  };

  // Eye-comfort cyan-green spectrum canvas class vs classic slate canvas
  const pageBgClass = darkMode
    ? 'bg-slate-950 text-slate-100'
    : eyeComfortSpectrum
      ? 'bg-[#F0FDF9] text-slate-900'
      : 'bg-slate-50 text-slate-900';

  const cardSurfaceClass = darkMode
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : eyeComfortSpectrum
      ? 'bg-white border-teal-200/90 text-slate-900 shadow-xs'
      : 'bg-white border-slate-200 text-slate-900 shadow-xs';

  return (
    <div className={`min-h-screen flex flex-col pb-24 lg:pb-12 transition-colors ${pageBgClass}`}>
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-[#0F172A] text-white border-b border-slate-800 px-4 sm:px-6 py-3 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            {t.appTitle}
          </button>

          {/* Zone 2: 4 concise single-line navigation links (Home/Promo, Roadmap, Camera Hub, Police Report Menu) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'home'
                  ? 'text-cyan-400 underline underline-offset-4 font-bold'
                  : ''
              }`}
            >
              {language === 'id' ? 'Beranda & Video Promo' : 'Home & Promo Video'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('home');
                setTimeout(() => {
                  document
                    .getElementById('roadmap-section')
                    ?.scrollIntoView({behavior: 'smooth'});
                }, 60);
              }}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {language === 'id' ? 'Peta Jalan (Langkah 1-4)' : 'Step-by-Step Roadmap'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('report');
                setActiveStep(2);
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'report' && activeStep === 2
                  ? 'text-cyan-400 underline underline-offset-4 font-bold'
                  : ''
              }`}
            >
              {language === 'id' ? 'Hub Kamera (Wi-Fi/BT)' : 'Camera Hub (Wi-Fi/BT)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView('report');
                setActiveStep(1);
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'report' && activeStep !== 2
                  ? 'text-amber-400 underline underline-offset-4 font-bold'
                  : 'text-amber-300'
              }`}
            >
              {language === 'id' ? 'Menu Laporan Polisi' : 'Police Report Menu'}
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <PWAInstallButton language={language} />
          </div>
        </div>
      </header>

      {/* WORKSPACE UTILITY & EYE-COMFORT TOOLBAR (Below the Top Bar) */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-2.5 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Subtitle & Auto-Save / Zero Server Storage unboxed metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              {t.appSubtitle}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-700 dark:text-cyan-400 font-medium">
              {t.zeroStorageBadge}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
              {t.autoSavedIndicator} ({lastAutoSavedAt})
            </span>
          </div>

          {/* Interactive Utility Controls: Bilingual Switch, Eye-Comfort Cyan-Green, Dark Mode, Font, Email Login, Saved Drafts */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bilingual Toggle (ID / EN) */}
            <div
              role="group"
              aria-label="Language Toggle"
              className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
            >
              <button
                type="button"
                onClick={() => setLanguage('id')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  language === 'id'
                    ? 'bg-[#0F172A] text-white dark:bg-cyan-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                ID · Bahasa
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#0F172A] text-white dark:bg-cyan-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                EN · English
              </button>
            </div>

            {/* Eye-Friendly Cyan-Green Spectrum Toggle */}
            <button
              type="button"
              onClick={() => setEyeComfortSpectrum((prev) => !prev)}
              title={t.eyeComfortToggle}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                eyeComfortSpectrum && !darkMode
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'id' ? 'Cyan-Hijau Ramah Mata' : 'Cyan-Green Eye Comfort'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              title={t.darkModeToggle}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{language === 'id' ? 'Mode Terang' : 'Light Mode'}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>{language === 'id' ? 'Mode Malam' : 'Dark Mode'}</span>
                </>
              )}
            </button>

            {/* Custom Font Selector for Legibility */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 min-h-[40px]">
              <TypeIcon className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <select
                aria-label={t.fontChoiceLabel}
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as FontFamilyOption)}
                className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="jakarta" className="text-slate-900">
                  Font: Plus Jakarta
                </option>
                <option value="lexend" className="text-slate-900">
                  Font: Lexend (Eye-Friendly)
                </option>
                <option value="hyperlegible" className="text-slate-900">
                  Font: Hyperlegible
                </option>
                <option value="public" className="text-slate-900">
                  Font: Public Sans
                </option>
              </select>
            </div>

            {/* Personal Admin Login & Cloud Vault Button */}
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentUser
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-300'
                  : 'border-slate-800 bg-[#0F172A] text-white dark:bg-cyan-700 dark:border-cyan-600'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate max-w-[165px]">
                {currentUser
                  ? isOwnerAdmin
                    ? `Admin: ${currentUser.email}`
                    : currentUser.email
                  : language === 'id'
                    ? 'Login Admin Pribadi'
                    : 'Personal Admin Login'}
              </span>
            </button>

            {/* Offline-Capable Email Login Button */}
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <span className="truncate max-w-[130px]">
                {reporterEmail
                  ? reporterEmail
                  : language === 'id'
                    ? 'Email Offline'
                    : 'Offline Email'}
              </span>
            </button>

            {/* Saved Offline Drafts & Cases Button */}
            <button
              type="button"
              onClick={() => setShowSavedDrawer(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderClock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'id' ? 'Draf Tersimpan' : 'Saved Drafts'} ({savedCases.length})
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT CONTAINER: Conditional Home Landing Page vs Menu-Driven Police Report Workspace */}
      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {activeView === 'home' ? (
          <div id="roadmap-section">
            <HomeLandingPage
              language={language}
              onStartRoadmapStep={(step: 1 | 2 | 3 | 4) => {
                setActiveView('report');
                setActiveStep(step);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              onOpenCameraHub={() => {
                setActiveView('report');
                setActiveStep(2);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              onOpenPoliceReportWorkspace={() => {
                setActiveView('report');
                setActiveStep(1);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
              onLoadPromoIntoForensicPlayer={(videoUrl, title) => {
                handleLoadPromoIntoForensicPlayer(videoUrl, title);
                window.scrollTo({top: 0, behavior: 'smooth'});
              }}
            />
          </div>
        ) : (
          <>
            {/* ROADMAP BREADCRUMB & BACK TO HOME PROMO BAR */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span>
                    {language === 'id'
                      ? '← Kembali ke Beranda & Video Promo'
                      : '← Back to Home & Promo Video'}
                  </span>
                </button>
                <span className="text-slate-400 font-bold">→</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-400">
                  {language === 'id'
                    ? 'Peta Jalan Laporan Polisi (Langkah 1 → 2 → 3 → 4)'
                    : 'Police Report Roadmap (Step 1 → 2 → 3 → 4)'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {language === 'id'
                    ? 'Klik langkah di bawah untuk berpindah tahap:'
                    : 'Click any roadmap step below to jump:'}
                </span>
              </div>
            </div>

            {/* TOP WORKFLOW ROADMAP & STEP SELECTOR (Start Here -> Step 1 -> Step 2 -> Step 3 -> Step 4) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
              {[
                {
                  step: 1 as const,
                  badge: language === 'id' ? 'MULAI DI SINI · 01' : 'START HERE · 01',
                  label: t.step1Short,
                  sub: metadata.uuPdpConsentChecked
                    ? language === 'id'
                      ? 'UU PDP Disetujui'
                      : 'UU PDP Confirmed'
                    : language === 'id'
                      ? 'Wajib Centang Izin'
                      : 'Consent Required',
                  done: metadata.uuPdpConsentChecked,
                },
            {
              step: 2 as const,
              label: t.step2Short,
              sub:
                frames.length > 0
                  ? `${selectedFrames.length}/${frames.length} Frame JPEG`
                  : language === 'id'
                    ? 'Lokal di Browser'
                    : 'On-Device Canvas',
              done: frames.length > 0,
            },
            {
              step: 3 as const,
              label: t.step3Short,
              sub: selectedModel,
              done: !!analysisResult,
            },
            {
              step: 4 as const,
              label: t.step4Short,
              sub:
                language === 'id'
                  ? 'Potong Kanvas & Cetak PDF'
                  : 'Canvas Crops & PDF/WA',
              done: !!analysisResult,
            },
          ].map((item) => {
            const isCurrent = activeStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(item.step)}
                className={`min-h-[60px] p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isCurrent
                    ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-cyan-950 dark:border-cyan-500 shadow-sm'
                    : cardSurfaceClass
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{item.label}</div>
                  <div
                    className={`text-[11px] truncate mt-0.5 ${
                      isCurrent
                        ? 'text-cyan-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.sub}
                  </div>
                </div>
                {item.done && (
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      isCurrent ? 'text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* DESKTOP 2-COLUMN WORKSPACE / MOBILE STEPPED FLOW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (Steps 1, 2, 3 Input & Frame Extraction Controls — Hidden when printing PDF) */}
          <div className="lg:col-span-5 space-y-6 no-print">
            {/* STEP 1: Lawful Authority & UU PDP Privacy Gate */}
            <section
              aria-labelledby="step1-heading"
              className={`rounded-2xl border p-5 sm:p-6 transition-all ${cardSurfaceClass} ${
                activeStep === 1 ? 'ring-2 ring-cyan-600/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2
                    id="step1-heading"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                  >
                    {t.step1Title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step1Desc}
                  </p>
                </div>
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="inc-datetime"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {t.incidentDateTimeLabel}
                    </label>
                    <input
                      id="inc-datetime"
                      type="datetime-local"
                      value={metadata.dateTime}
                      onChange={(e) => updateMetaField('dateTime', e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="inc-plate"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {t.plateNumberLabel}
                    </label>
                    <input
                      id="inc-plate"
                      type="text"
                      value={metadata.plateNumber}
                      placeholder={t.plateNumberPlaceholder}
                      onChange={(e) =>
                        updateMetaField('plateNumber', e.target.value.toUpperCase())
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono-tabular font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inc-location"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.locationLabel}
                  </label>
                  <input
                    id="inc-location"
                    type="text"
                    value={metadata.location}
                    placeholder={t.locationPlaceholder}
                    onChange={(e) => updateMetaField('location', e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="inc-make"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {t.motorcycleMakeLabel}
                    </label>
                    <input
                      id="inc-make"
                      type="text"
                      value={metadata.motorcycleMakeModel}
                      placeholder={t.motorcycleMakePlaceholder}
                      onChange={(e) =>
                        updateMetaField('motorcycleMakeModel', e.target.value)
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="inc-color"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {t.motorcycleColorLabel}
                    </label>
                    <input
                      id="inc-color"
                      type="text"
                      value={metadata.motorcycleColor}
                      placeholder={t.motorcycleColorPlaceholder}
                      onChange={(e) =>
                        updateMetaField('motorcycleColor', e.target.value)
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inc-notes"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.reporterNotesLabel}
                  </label>
                  <textarea
                    id="inc-notes"
                    rows={2}
                    value={metadata.reporterNotes}
                    placeholder={t.reporterNotesPlaceholder}
                    onChange={(e) =>
                      updateMetaField('reporterNotes', e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  />
                </div>

                {/* Mandatory Bilingual UU No. 27/2022 (UU PDP) Privacy Gate */}
                <div className="rounded-xl border border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{t.uuPdpHeader}</span>
                  </div>

                  <label
                    htmlFor="uupdp-consent-checkbox"
                    className="flex items-start gap-3 cursor-pointer select-none pt-1"
                  >
                    <input
                      id="uupdp-consent-checkbox"
                      type="checkbox"
                      checked={metadata.uuPdpConsentChecked}
                      onChange={(e) =>
                        updateMetaField('uuPdpConsentChecked', e.target.checked)
                      }
                      className="mt-0.5 w-5 h-5 rounded border-slate-400 accent-cyan-600 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      {t.uuPdpCheckboxText}
                    </span>
                  </label>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {t.uuPdpSubNote}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!metadata.uuPdpConsentChecked}
                  onClick={() => setActiveStep(2)}
                  className={`w-full min-h-[48px] rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    metadata.uuPdpConsentChecked
                      ? 'bg-[#0891B2] hover:bg-cyan-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>{t.proceedToStep2Btn}</span>
                </button>
              </div>
            </section>

            {/* STEP 2: In-Browser Video Frame Extractor & Sharpness Filter */}
            <section
              aria-labelledby="step2-heading"
              className={`rounded-2xl border p-5 sm:p-6 transition-all ${cardSurfaceClass} ${
                activeStep === 2 ? 'ring-2 ring-cyan-600/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2
                    id="step2-heading"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                  >
                    {t.step2Title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step2Desc}
                  </p>
                </div>
                <Film className="w-6 h-6 text-cyan-600 dark:text-cyan-400 shrink-0" />
              </div>

              <div className="mt-4 space-y-4">
                {/* EXTERNAL MOTORCYCLE CAMERA CONNECTOR HUB (USB-C OTG Live / Wi-Fi Dashcam / MicroSD) */}
                <ExternalMotoCameraHub
                  language={language}
                  uuPdpConsentChecked={metadata.uuPdpConsentChecked}
                  onFramesExtracted={(extracted, stats) => {
                    setFrames(extracted);
                    setExtractionStats(stats);
                    setAnalysisResult(null);
                  }}
                  onTriggerLocalFilePicker={() => fileInputRef.current?.click()}
                  savedProfiles={cameraProfiles}
                  onSaveProfile={saveCameraProfileToCloud}
                  isAuthenticated={!!currentUser}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  disabled={!metadata.uuPdpConsentChecked || isExtracting}
                  onChange={handleVideoFileChange}
                  className="hidden"
                  id="local-video-file-input"
                />

                {/* Primary Video File Upload Button — Disabled until Step 1 UU PDP checkbox is checked */}
                <button
                  type="button"
                  disabled={!metadata.uuPdpConsentChecked || isExtracting}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full min-h-[52px] rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                    metadata.uuPdpConsentChecked
                      ? 'bg-[#0891B2] hover:bg-cyan-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-5 h-5 shrink-0" />
                  <span>{t.uploadVideoBtn}</span>
                </button>

                {!metadata.uuPdpConsentChecked && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 text-center">
                    {t.uploadVideoDisabledHint}
                  </p>
                )}

                {/* 1-Click Simulated On-Device CCTV Test Generator */}
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={handleRunSimulatedCctvClip}
                  className="w-full min-h-[44px] rounded-xl border border-cyan-600/40 bg-cyan-50/60 dark:bg-cyan-950/30 hover:bg-cyan-100/70 dark:hover:bg-cyan-900/40 px-4 py-2.5 text-xs font-semibold text-cyan-900 dark:text-cyan-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4 shrink-0 text-cyan-600" />
                  <span>{t.loadDemoVideoBtn}</span>
                </button>

                {/* Real-time Local Extraction Progress Bar */}
                {isExtracting && extractionProgress && (
                  <div className="rounded-xl border border-cyan-500/40 bg-slate-900 text-white p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-cyan-300">{t.scanningFramesLabel}</span>
                      <span className="font-mono-tabular">
                        {extractionProgress.percent}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-100"
                        style={{width: `${extractionProgress.percent}%`}}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-300">
                      <span>
                        Sample {extractionProgress.sampledCount} /{' '}
                        {extractionProgress.totalToSample}
                      </span>
                      <span>Offset: {extractionProgress.currentTimestamp}s</span>
                    </div>
                  </div>
                )}

                {extractionError && (
                  <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-xs font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{extractionError}</span>
                  </div>
                )}
              </div>
            </section>

            {/* STEP 3: Gemini Vision Structured Incident Analysis */}
            <section
              aria-labelledby="step3-heading"
              className={`rounded-2xl border p-5 sm:p-6 transition-all ${cardSurfaceClass} ${
                activeStep === 3 ? 'ring-2 ring-cyan-600/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2
                    id="step3-heading"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                  >
                    {t.step3Title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t.step3Desc}
                  </p>
                </div>
                <Sparkles className="w-6 h-6 text-amber-500 shrink-0" />
              </div>

              <div className="mt-4 space-y-4">
                {/* Model Toggle: gemini-2.5-flash vs gemini-2.5-pro */}
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t.modelSelectLabel} (Media Resolution: HIGH)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedModel('gemini-2.5-flash')}
                      className={`min-h-[56px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedModel === 'gemini-2.5-flash'
                          ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/50 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono-tabular">
                        gemini-2.5-flash
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {t.flashDesc}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedModel('gemini-2.5-pro')}
                      className={`min-h-[56px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedModel === 'gemini-2.5-pro'
                          ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono-tabular">
                        gemini-2.5-pro
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {t.proDesc}
                      </div>
                    </button>
                  </div>
                </div>

                {!isOnline && (
                  <div className="rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-300">
                    {t.offlineQueueNotice}
                  </div>
                )}

                <button
                  type="button"
                  disabled={selectedFrames.length === 0 || isAnalyzing || !isOnline}
                  onClick={handleRunGeminiAnalysis}
                  className={`w-full min-h-[52px] rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                    selectedFrames.length > 0 && !isAnalyzing && isOnline
                      ? 'bg-[#D97706] hover:bg-amber-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{t.analyzingStatus}</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 shrink-0" />
                      <span>
                        {t.runAnalysisBtn} ({selectedFrames.length} JPEG)
                      </span>
                    </>
                  )}
                </button>

                {analysisError && (
                  <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-xs font-medium text-red-800 dark:text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{analysisError}</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN (Built-in Video Media Player + Extracted 12 Sharpest Thumbnails Grid + Step 4 Printable & WhatsApp Incident Report) */}
          <div className="lg:col-span-7 space-y-6">
            {/* BUILT-IN FORENSIC VIDEO MEDIA PLAYER (Plays uploaded CCTV/dashcam video or simulated clip) */}
            {activeVideoUrl ? (
              <IncidentMediaPlayer
                videoUrl={activeVideoUrl}
                videoSourceName={
                  extractionStats?.sourceName ||
                  (language === 'id' ? 'Video Bukti Lokal' : 'Local Evidence Video')
                }
                language={language}
                onSnapCustomFrame={handleManualFrameCaptured}
                onRescanSharpestFrames={handleRescanActiveVideo}
                isExtracting={isExtracting}
                existingFramesCount={frames.length}
              />
            ) : (
              <section
                aria-label="Video Media Player Ready"
                className={`rounded-2xl border p-5 sm:p-6 no-print ${cardSurfaceClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <Play className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {language === 'id'
                          ? 'Pemutar Media Video Bukti (Siap Memutar Video Anda)'
                          : 'Built-In Evidence Video Media Player (Ready)'}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {language === 'id'
                          ? 'Unggah video CCTV/dashcam di Langkah 2 atau jalankan simulasi untuk memutar video, gerak lambat (0.25x), & tangkap frame manual.'
                          : 'Upload a CCTV/dashcam video in Step 2 or run the simulated clip to play video, scrub in 0.25x slow-motion, and snap frames.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!metadata.uuPdpConsentChecked) {
                          updateMetaField('uuPdpConsentChecked', true);
                        }
                        fileInputRef.current?.click();
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {language === 'id' ? 'Pilih & Putar Video' : 'Upload & Play Video'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRunSimulatedCctvClip}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span>
                        {language === 'id' ? 'Putar Simulasi' : 'Play Simulated Video'}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* EXTRACTED 12 SHARPEST JPEG THUMBNAILS GRID */}
            <section
              aria-label="Extracted Video Frames"
              className={`rounded-2xl border p-5 sm:p-6 no-print ${cardSurfaceClass}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {language === 'id'
                      ? '12 Frame JPEG Paling Tajam (Urutan Kronologis)'
                      : 'Top 12 Sharpest Extracted JPEG Frames (Chronological)'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {t.deselectHint}
                  </p>
                </div>

                {frames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllFrames}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.selectAllBtn}
                    </button>
                    <button
                      type="button"
                      onClick={selectTop6Sharpest}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-cyan-600/40 bg-cyan-50/50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 text-xs font-semibold hover:bg-cyan-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.keepTop6Btn}
                    </button>
                  </div>
                )}
              </div>

              {/* Extraction Telemetry Summary Row (Unboxed clean metadata) */}
              {extractionStats && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-mono-tabular">
                  <span>
                    {t.sampledFramesStat}: {extractionStats.totalSampled} frames
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.sharpestSelectedStat}: {selectedFrames.length}/{frames.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t.minSpacingStat}: ≥ 0.3s</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-xs">
                    Clip: {extractionStats.sourceName} ({extractionStats.videoDuration}s)
                  </span>
                </div>
              )}

              {frames.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
                  <Film className="w-10 h-10 text-cyan-600 mx-auto opacity-80" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'id'
                      ? 'Belum Ada Frame Video yang Diekstrak'
                      : 'No Video Frames Extracted Yet'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {language === 'id'
                      ? 'Centang persetujuan UU PDP di Langkah 1, lalu pilih file video CCTV (.mp4/.mov/.webm) atau gunakan tombol Simulasi Rekaman CCTV untuk mengekstrak 12 frame paling tajam.'
                      : 'Check the Step 1 UU PDP consent box, then pick a local CCTV clip (.mp4/.mov/.webm) or click the Simulated CCTV Clip button to extract the 12 sharpest frames.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleRunSimulatedCctvClip}
                    className="mt-2 inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>{t.loadDemoVideoBtn}</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {frames.map((frame) => {
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => toggleFrameSelection(frame.id)}
                        className={`group relative rounded-xl border overflow-hidden text-left transition-all cursor-pointer ${
                          frame.selected
                            ? 'border-cyan-600 ring-2 ring-cyan-500/40 bg-slate-900'
                            : 'border-slate-300 dark:border-slate-800 opacity-50 hover:opacity-80 bg-slate-900'
                        }`}
                      >
                        <div className="aspect-video w-full bg-slate-950 relative">
                          <img
                            src={frame.dataUrl}
                            alt={`Frame ${frame.frameNumber} at ${frame.timestampFormatted}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 left-1.5 bg-slate-950/85 text-white text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded">
                            #{frame.frameNumber} · {frame.timestampFormatted}
                          </div>
                          <div
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center ${
                              frame.selected
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-900/70 text-slate-400 border border-slate-600'
                            }`}
                          >
                            {frame.selected && <Check className="w-4 h-4" />}
                          </div>
                        </div>
                        <div className="px-2.5 py-1.5 bg-white dark:bg-slate-900 flex items-center justify-between text-[11px] font-mono-tabular text-slate-600 dark:text-slate-300">
                          <span>{t.sharpnessLabel}</span>
                          <span className="font-bold text-cyan-700 dark:text-cyan-400">
                            {frame.sharpnessScore}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* STEP 4: AUTOMATIC CANVAS CROPPING & PRINTABLE / WHATSAPP INCIDENT BRIEF */}
            <section
              aria-labelledby="step4-heading"
              className={`rounded-2xl border p-5 sm:p-6 print-container ${cardSurfaceClass}`}
            >
              {/* Action Toolbar (Hidden in Print) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 no-print">
                <div>
                  <h2
                    id="step4-heading"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                  >
                    {t.step4Title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {t.step4Desc}
                  </p>
                </div>

                {analysisResult && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{t.printPdfBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyWhatsApp}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedWhatsApp ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{t.whatsappCopiedToast}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 shrink-0" />
                          <span>{t.copyWhatsappBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {!analysisResult ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-2 no-print">
                  <FileText className="w-10 h-10 text-amber-600 mx-auto opacity-80" />
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {language === 'id'
                      ? 'Laporan Ringkasan Visual Siap Dibuat'
                      : 'Incident Visual Summary Brief Ready to Generate'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {language === 'id'
                      ? 'Setelah 12 frame tajam diekstrak di Langkah 2, klik tombol "Jalankan Analisis Visual Kejadian" di Langkah 3 untuk membuat potongan kanvas otomatis & laporan siap cetak.'
                      : 'Once your 12 sharpest frames are extracted in Step 2, click "Run Structured Incident Analysis" in Step 3 to render automatic HTML5 canvas crops and the bilingual brief.'}
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  {/* OFFICIAL REPORT HEADER (Visible on screen & print) */}
                  <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-4">
                    <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                      {t.reportHeaderTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>{t.reportHeaderSub}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        Model: {modelUsedForResult}
                      </span>
                      {reporterEmail && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Pelapor: {reporterEmail}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SECTION I: TARGET MOTORCYCLE & INCIDENT METADATA */}
                  <div className="space-y-3 print-break-inside-avoid">
                    <h3 className="text-xs font-bold tracking-wide text-cyan-800 dark:text-cyan-400">
                      {t.vehicleSectionTitle}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/50">
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.incidentDateTimeLabel}
                        </div>
                        <div className="text-xs font-bold font-mono-tabular mt-0.5">
                          {metadata.dateTime || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.plateNumberLabel}
                        </div>
                        <div className="text-xs font-bold font-mono-tabular text-amber-700 dark:text-amber-400 mt-0.5">
                          {metadata.plateNumber || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.motorcycleMakeLabel}
                        </div>
                        <div className="text-xs font-bold mt-0.5">
                          {metadata.motorcycleMakeModel || '-'} ({metadata.motorcycleColor || '-'})
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.locationLabel}
                        </div>
                        <div className="text-xs font-bold mt-0.5">
                          {metadata.location || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AUTOMATIC HTML5 CANVAS CROPPING (FACE/HEAD + FULL BODY + FULL REFERENCE) */}
                  {clearestFrameData && (
                    <SuspectCropCanvases
                      frameDataUrl={clearestFrameData.dataUrl}
                      frameTimestamp={clearestFrameData.timestampFormatted}
                      clearestSuspect={analysisResult.clearest_suspect_frame}
                      language={language}
                    />
                  )}

                  {/* SECTION II & III: ITEMIZED SUSPECT VISUAL PROFILE & GETAWAY VEHICLE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-break-inside-avoid">
                    {/* Suspect Visual Profile */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                      <h3 className="text-xs font-bold text-cyan-800 dark:text-cyan-400 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        {t.suspectProfileTitle}
                      </h3>
                      <dl className="space-y-2 text-xs">
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.buildPostureLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.estimated_build_and_posture}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.helmetHeadgearLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.helmet_and_headgear}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.hairFacialLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.hair_and_facial_features}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.upperClothingLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.upper_clothing}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.lowerClothingLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.lower_clothing}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">
                            {t.footwearBagsLabel}
                          </dt>
                          <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                            {analysisResult.suspect_visual_profile.footwear_and_bags}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Accomplice or Getaway Vehicle + Technical Caveats */}
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                        <h3 className="text-xs font-bold text-cyan-800 dark:text-cyan-400 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                          {t.getawayVehicleTitle}
                        </h3>
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">
                              {t.getawayTypeLabel}
                            </dt>
                            <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                              {analysisResult.accomplice_or_getaway_vehicle.vehicle_type_and_model}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">
                              {t.getawayColorLabel}
                            </dt>
                            <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                              {analysisResult.accomplice_or_getaway_vehicle.color}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">
                              {t.getawayPlateLabel}
                            </dt>
                            <dd className="text-slate-900 dark:text-slate-100 font-mono-tabular mt-0.5">
                              {analysisResult.accomplice_or_getaway_vehicle.plate_visibility}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">
                              {t.getawayMarksLabel}
                            </dt>
                            <dd className="text-slate-900 dark:text-slate-100 mt-0.5">
                              {analysisResult.accomplice_or_getaway_vehicle.distinguishing_marks}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-xl border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-1.5">
                        <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                          {t.caveatsSectionTitle}
                        </h3>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {analysisResult.technical_caveats}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION IV: CHRONOLOGICAL ACTION TIMELINE */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 print-break-inside-avoid">
                    <h3 className="text-xs font-bold text-cyan-800 dark:text-cyan-400 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      {t.timelineSectionTitle}
                    </h3>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {analysisResult.timeline.map((entry, idx) => (
                        <div
                          key={`${entry.frame_number}-${idx}`}
                          className="py-2.5 flex items-start gap-3 text-xs"
                        >
                          <div className="font-mono-tabular font-bold text-cyan-700 dark:text-cyan-400 whitespace-nowrap shrink-0 min-w-[110px]">
                            <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                            {entry.timestamp_offset} (#{entry.frame_number})
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 leading-relaxed">
                            {entry.action_summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
          </>
        )}
      </main>

      {/* MOBILE THUMB-ZONE BOTTOM NAVIGATION BAR (< 15% viewport height cap) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-16 px-1.5 no-print"
      >
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            activeView === 'home'
              ? 'text-cyan-600 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[68px]">
            {language === 'id' ? 'Beranda' : 'Home'}
          </span>
        </button>
        {[
          {step: 1 as const, label: t.step1Short, icon: ShieldCheck},
          {step: 2 as const, label: t.step2Short, icon: Film},
          {step: 3 as const, label: t.step3Short, icon: Sparkles},
          {step: 4 as const, label: t.step4Short, icon: FileText},
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeView === 'report' && activeStep === tab.step;
          return (
            <button
              key={tab.step}
              type="button"
              onClick={() => {
                setActiveView('report');
                setActiveStep(tab.step);
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[68px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* OFFLINE-CAPABLE EMAIL LOGIN MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t.emailAuthLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.emailAuthOfflineNote}
            </p>

            <div>
              <label
                htmlFor="offline-email-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Email
              </label>
              <input
                id="offline-email-input"
                type="email"
                value={emailInputDraft}
                placeholder={t.emailAuthPlaceholder}
                onChange={(e) => setEmailInputDraft(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {reporterEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setReporterEmail('');
                    setEmailInputDraft('');
                    setShowEmailModal(false);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t.emailAuthSignOutBtn}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setReporterEmail(emailInputDraft.trim());
                  setShowEmailModal(false);
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold"
              >
                {t.emailAuthSignInBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE SAVED INCIDENT REPORTS & AUTO-SAVED DRAFTS DRAWER */}
      {showSavedDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm no-print">
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t.savedCasesDrawerTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavedDrawer(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleStartNewCase}
                className="w-full min-h-[44px] rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>+ {t.newCaseBtn}</span>
              </button>

              <div className="space-y-3 pt-2">
                {savedCases.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      c.id === caseId
                        ? 'border-cyan-600 bg-cyan-50/40 dark:bg-cyan-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedCase(c)}
                        className="text-left flex-1 cursor-pointer"
                      >
                        <div className="text-xs font-bold font-mono-tabular text-slate-900 dark:text-white">
                          {c.metadata.plateNumber || 'Tanpa Plat'} ·{' '}
                          {c.metadata.motorcycleMakeModel || 'Motor'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {c.metadata.location}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">
                          <span>
                            {c.analysis
                              ? language === 'id'
                                ? 'Sudah Dianalisis AI'
                                : 'AI Analyzed'
                              : language === 'id'
                                ? 'Draf Lokal'
                                : 'Local Draft'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{c.framesCount} Frames</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setSavedCases(deleteSavedIncidentCase(c.id))
                        }
                        aria-label="Delete saved case"
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              {t.onlineSyncedBanner}
            </div>
          </div>
        </div>
      )}

      {/* PERSONAL ADMIN LOGIN & CLOUD VAULT MODAL */}
      <AdminVaultModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        language={language}
        currentUser={currentUser}
        isOwnerAdmin={isOwnerAdmin}
        onGoogleSignIn={handleGoogleAdminSignIn}
        onSignOut={handleGoogleSignOut}
        cloudReports={cloudReports}
        cameraProfiles={cameraProfiles}
        onSyncCurrentIncidentToCloud={handleSyncCurrentIncidentToCloud}
        canSyncCurrent={Boolean(metadata.plateNumber && metadata.location)}
      />

      {/* OFFLINE CONNECTIVITY FLOATING BANNER */}
      <OfflineFloatingNotice
        language={language}
        offlineText={t.offlineModeBanner}
      />
    </div>
  );
}
