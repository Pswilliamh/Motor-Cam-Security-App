import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowRight,
  Bluetooth,
  Camera,
  CheckCircle2,
  FileText,
  Film,
  Home,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  Wifi,
} from 'lucide-react';
import {Language} from '../types';

interface HomeLandingPageProps {
  language: Language;
  onStartRoadmapStep: (step: 1 | 2 | 3 | 4) => void;
  onOpenCameraHub: () => void;
  onOpenPoliceReportWorkspace: () => void;
  onLoadPromoIntoForensicPlayer?: (videoUrl: string, title: string) => void;
}

const PROMO_VIDEO_URL_STORAGE_KEY = 'motoguard_custom_promo_url_v3';
export const DEFAULT_ENGLISH_PROMO_MP4 = '/promo/motor-cam-promo-1.mp4';
export const DEFAULT_INDONESIAN_PROMO_MP4 =
  '/assets/aistudio/motorcam_indo_577f987a.mp4';
export const GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1uRGRlsaEdi2PVC0xSguttRkkrMdKct6h';
export const GOOGLE_DRIVE_FILE_PREVIEW_URL =
  'https://drive.google.com/file/d/1o0GW41Btd6BIhgfAo2zOZtSSoo7CR1AJ/preview';

export const HomeLandingPage: React.FC<HomeLandingPageProps> = ({
  language,
  onStartRoadmapStep,
  onOpenCameraHub,
  onOpenPoliceReportWorkspace,
  onLoadPromoIntoForensicPlayer,
}) => {
  // Custom uploaded/URL promo override (empty by default so official bilingual ID/EN videos play automatically)
  const [customOverrideUrl, setCustomOverrideUrl] = useState<string>(
    () => localStorage.getItem(PROMO_VIDEO_URL_STORAGE_KEY) || ''
  );
  // Active promo language track: syncs automatically with app language toggle, or user can manually switch ID/EN
  const [promoTrack, setPromoTrack] = useState<'id' | 'en' | 'custom'>(() =>
    localStorage.getItem(PROMO_VIDEO_URL_STORAGE_KEY) ? 'custom' : language
  );
  const [promoViewMode, setPromoViewMode] = useState<
    'mp4' | 'drive_embed' | 'canvas_demo'
  >('mp4');
  const [promoUrlInput, setPromoUrlInput] = useState<string>('');
  const [showPromoUploader, setShowPromoUploader] = useState<boolean>(false);
  const promoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync promo video language whenever the main bilingual toggle (ID / EN) changes
  useEffect(() => {
    if (promoTrack !== 'custom') {
      setPromoTrack(language);
    }
  }, [language]);

  const activePromoVideoUrl =
    promoTrack === 'custom' && customOverrideUrl
      ? customOverrideUrl
      : promoTrack === 'id'
        ? DEFAULT_INDONESIAN_PROMO_MP4
        : DEFAULT_ENGLISH_PROMO_MP4;

  const activePromoLabel =
    promoTrack === 'custom'
      ? language === 'id'
        ? 'Video Promo Kustom'
        : 'Custom Promo Video'
      : promoTrack === 'id'
        ? 'motorcam indo.mp4 · 6.9 MB (Versi Bahasa Indonesia)'
        : 'Motor cam promo 1.mp4 · 6.2 MB (English Version)';

  const activePromoTitle =
    promoTrack === 'id' ? 'motorcam_indo.mp4' : 'Motor_cam_promo_1.mp4';

  // Built-in Interactive Canvas Promotional Showcase Player (available via mode toggle)
  const promoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isBuiltInPromoPlaying, setIsBuiltInPromoPlaying] =
    useState<boolean>(true);
  const [promoSlideIndex, setPromoSlideIndex] = useState<number>(0);

  const promoSlides =
    language === 'id'
      ? [
          {
            stepTag: 'MULAI DI SINI · MOTOGUARD',
            headline: 'Hubungkan Kamera Rumah Wi-Fi atau Kamera Motor Anda',
            sub: 'Mendukung Home CCTV Wi-Fi, Kamera Kendaraan (Wi-Fi + Bluetooth + USB-C OTG), dan Pemutar Media Lokal.',
          },
          {
            stepTag: 'LANGKAH 01 & 02 · PEMUTAR MEDIA & FILTER LAPLACIAN',
            headline: 'Putar Video & Ekstrak 12 Frame Tertajam 100% di HP',
            sub: 'Tanpa unggah file video ke server. Pemutar media memiliki gerak lambat 0.25x dan pemindai ketajaman otomatis.',
          },
          {
            stepTag: 'LANGKAH 03 & 04 · ANALISIS GEMINI & LAPORAN POLISI',
            headline: 'Potongan Kanvas Otomatis, PDF Polisi & Ringkasan WhatsApp',
            sub: 'Buka menu Laporan Polisi kapan saja untuk membuat dokumen bukti visual objektif sesuai UU PDP No. 27/2022.',
          },
        ]
      : [
          {
            stepTag: 'START HERE · MOTOGUARD OVERVIEW',
            headline: 'Connect Your Home Wi-Fi Security Cam or Vehicle Camera',
            sub: 'Works with Home Wi-Fi IP Cameras, On-the-Go Vehicle Cameras (Wi-Fi + Bluetooth + USB-C OTG), and recorded clips.',
          },
          {
            stepTag: 'STEP 01 & 02 · MEDIA PLAYER & SHARPNESS EXTRACTOR',
            headline: 'Play Footage in the Built-In Media Player & Extract 12 Sharpest Frames',
            sub: '100% on-device video playback with 0.25x slow-motion, frame-by-frame stepping, and Laplacian edge-sharpness scoring.',
          },
          {
            stepTag: 'STEP 03 & 04 · GEMINI VISION & POLICE REPORT MENU',
            headline: 'Auto-Cropped Suspect Reference, Printable Police PDF & WhatsApp Brief',
            sub: 'Open the Police Report Workspace from the menu whenever you need to document and export an official incident brief.',
          },
        ];

  useEffect(() => {
    if (promoViewMode !== 'canvas_demo' || !isBuiltInPromoPlaying) return;
    const interval = setInterval(() => {
      setPromoSlideIndex((prev) => (prev + 1) % promoSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [promoViewMode, isBuiltInPromoPlaying, promoSlides.length]);

  useEffect(() => {
    if (promoViewMode !== 'canvas_demo') return;
    const canvas = promoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let tick = 0;

    const render = () => {
      tick += 0.025;
      const w = canvas.width;
      const h = canvas.height;

      // Deep Navy & Cyan-Teal gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.55, '#1e293b');
      grad.addColorStop(1, '#083344');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle perspective security grid
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 40; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 40; y < h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Animated scanning frame box
      const boxX = 80 + Math.sin(tick) * 28;
      const boxY = 75;
      const boxW = 240;
      const boxH = 190;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.fillRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(
        `MOTOGUARD PROMO PREVIEW · SLIDE 0${promoSlideIndex + 1}/03`,
        36,
        38
      );

      // Right side pipeline nodes
      const nodes = ['1. CAMERA / CLIP', '2. MEDIA PLAYER', '3. AI VISION', '4. POLICE PDF'];
      nodes.forEach((label, idx) => {
        const ny = 82 + idx * 54;
        const isHighlighted = idx === promoSlideIndex || (promoSlideIndex === 2 && idx === 3);
        ctx.fillStyle = isHighlighted
          ? 'rgba(8, 145, 178, 0.9)'
          : 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(420, ny, 330, 40);
        ctx.strokeStyle = isHighlighted ? '#22d3ee' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(420, ny, 330, 40);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(label, 438, ny + 25);
      });

      if (isBuiltInPromoPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [promoViewMode, isBuiltInPromoPlaying, promoSlideIndex]);

  const handlePromoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setCustomOverrideUrl(objUrl);
    setPromoTrack('custom');
    setPromoViewMode('mp4');
    setShowPromoUploader(false);
  };

  const handleSavePromoUrl = () => {
    const raw = promoUrlInput.trim();
    if (!raw) return;

    // Check if user pasted the Google Drive English promo link
    if (
      raw.includes('1uRGRlsaEdi2PVC0xSguttRkkrMdKct6h') ||
      raw.includes('1o0GW41Btd6BIhgfAo2zOZtSSoo7CR1AJ')
    ) {
      localStorage.removeItem(PROMO_VIDEO_URL_STORAGE_KEY);
      setCustomOverrideUrl('');
      setPromoTrack('en');
      setPromoViewMode('mp4');
      setShowPromoUploader(false);
      return;
    }

    const driveFileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileMatch?.[1]) {
      const directUrl = `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
      localStorage.setItem(PROMO_VIDEO_URL_STORAGE_KEY, directUrl);
      setCustomOverrideUrl(directUrl);
      setPromoTrack('custom');
      setPromoViewMode('drive_embed');
      setShowPromoUploader(false);
      return;
    }

    localStorage.setItem(PROMO_VIDEO_URL_STORAGE_KEY, raw);
    setCustomOverrideUrl(raw);
    setPromoTrack('custom');
    setPromoViewMode('mp4');
    setShowPromoUploader(false);
  };

  const currentSlide = promoSlides[promoSlideIndex];

  return (
    <div className="space-y-12 pb-8">
      {/* SECTION 1: HERO LANDING WITH BILINGUAL PROMOTIONAL VIDEO PLAYER */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Value Proposition & Primary Action */}
          <div className="lg:col-span-6 space-y-5">
            <div className="text-xs font-bold tracking-wide text-cyan-700 dark:text-cyan-400">
              {language === 'id'
                ? 'PLATFORM DOKUMENTASI KAMERA RUMAH & KENDARAAN · 100% DI PERANGKAT'
                : 'HOME & VEHICLE CAMERA INCIDENT DOCUMENTATION · 100% ON-DEVICE'}
            </div>

            <h1
              className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
              style={{textWrap: 'balance'}}
            >
              {language === 'id'
                ? 'Ubah Rekaman CCTV Rumah & Kamera Motor Menjadi Laporan Bukti Siap Pakai.'
                : 'Turn Home Security & Vehicle Camera Footage into Clear Incident Reports.'}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'id'
                ? 'Hubungkan kamera Wi-Fi rumah atau kamera eksternal motor/mobil Anda, putar video di Pemutar Media bawaan, ekstrak 12 frame paling tajam tanpa mengunggah video ke server, dan buka Formulir Laporan Polisi kapan saja dari menu.'
                : 'Connect your home Wi-Fi security camera or on-the-go vehicle camera, inspect clips in the built-in Media Player, extract the 12 sharpest frames locally with zero server video storage, and open the Police Report workspace from the menu whenever you need to file a report.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenPoliceReportWorkspace}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'id'
                    ? 'Buka Formulir Laporan Polisi / Insiden'
                    : 'Open Police & Incident Report Tool'}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={onOpenCameraHub}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>
                  {language === 'id'
                    ? 'Hubungkan Kamera Rumah / Kendaraan'
                    : 'Connect Home / Vehicle Camera'}
                </span>
              </button>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {language === 'id' ? 'Kepatuhan UU PDP No. 27/2022' : 'UU PDP No. 27/2022 Compliant'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {language === 'id' ? 'Pemutar Media Gerak Lambat' : 'Slow-Mo Forensic Media Player'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {language === 'id' ? 'Wi-Fi · Bluetooth · USB-C OTG' : 'Wi-Fi · Bluetooth · USB-C OTG'}
              </span>
            </div>
          </div>

          {/* Right Column: Bilingual Promotional Video Player Showcase (ID: motorcam indo.mp4 | EN: Motor cam promo 1.mp4) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 overflow-hidden shadow-lg">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Video className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {promoTrack === 'id'
                      ? language === 'id'
                        ? 'Video Promo Resmi (Bahasa Indonesia)'
                        : 'Official Promo (Bahasa Indonesia)'
                      : promoTrack === 'en'
                        ? language === 'id'
                          ? 'Video Promo Resmi (English)'
                          : 'Official Promo (English)'
                        : language === 'id'
                          ? 'Video Promo Kustom'
                          : 'Custom Promo Video'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(PROMO_VIDEO_URL_STORAGE_KEY);
                      setCustomOverrideUrl('');
                      setPromoTrack('id');
                      setPromoViewMode('mp4');
                    }}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      promoViewMode === 'mp4' && promoTrack === 'id'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ID · Indonesia
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(PROMO_VIDEO_URL_STORAGE_KEY);
                      setCustomOverrideUrl('');
                      setPromoTrack('en');
                      setPromoViewMode('mp4');
                    }}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      promoViewMode === 'mp4' && promoTrack === 'en'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    EN · English
                  </button>

                  <button
                    type="button"
                    onClick={() => setPromoViewMode('drive_embed')}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      promoViewMode === 'drive_embed'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Drive Embed
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPromoUploader((prev) => !prev)}
                    className="min-h-[30px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>
                      {language === 'id' ? 'Ganti' : 'Upload'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom Promo Video Uploader Bar */}
              {showPromoUploader && (
                <div className="p-3.5 bg-slate-900/95 border-b border-slate-800 space-y-2.5 text-xs text-slate-200">
                  <div className="font-semibold text-amber-300">
                    {language === 'id'
                      ? 'Pilih file video promosi baru (.mp4, .mov, .webm) atau tempel tautan Google Drive / URL video:'
                      : 'Select a new promotional video file (.mp4, .mov, .webm) or paste a Google Drive / video URL:'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={promoFileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                      onChange={handlePromoFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => promoFileInputRef.current?.click()}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
                    >
                      {language === 'id'
                        ? 'Pilih File Video dari Perangkat'
                        : 'Choose Video File from Device'}
                    </button>

                    <input
                      type="url"
                      value={promoUrlInput}
                      onChange={(e) => setPromoUrlInput(e.target.value)}
                      placeholder={GOOGLE_DRIVE_FOLDER_URL}
                      className="flex-1 min-h-[38px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSavePromoUrl}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
                    >
                      {language === 'id' ? 'Simpan URL' : 'Save URL'}
                    </button>
                  </div>
                </div>
              )}

              {/* Video or Google Drive Embed or Animated Promo Canvas Viewport */}
              {promoViewMode === 'mp4' && activePromoVideoUrl ? (
                <div className="aspect-video w-full bg-black relative">
                  <video
                    key={activePromoVideoUrl}
                    src={activePromoVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : promoViewMode === 'drive_embed' ? (
                <div className="aspect-video w-full bg-black relative">
                  <iframe
                    src={
                      customOverrideUrl.includes('/preview')
                        ? customOverrideUrl
                        : GOOGLE_DRIVE_FILE_PREVIEW_URL
                    }
                    title="Motor cam promo - Google Drive Video"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="relative aspect-video w-full bg-slate-950">
                  <canvas
                    ref={promoCanvasRef}
                    width={800}
                    height={450}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-4 sm:p-5 flex items-end justify-between gap-4">
                    <div className="space-y-1 max-w-lg">
                      <div className="text-[11px] font-mono-tabular font-bold text-amber-400">
                        {currentSlide.stepTag}
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white">
                        {currentSlide.headline}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {currentSlide.sub}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setIsBuiltInPromoPlaying((prev) => !prev)
                      }
                      aria-label="Play or pause promotional preview"
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {isBuiltInPromoPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom bar under the Promo Player: test active promo video in Forensic Media Player & 12-Frame Extractor */}
              <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 font-mono-tabular truncate">
                  {activePromoLabel}
                </span>

                <div className="flex items-center gap-2">
                  {onLoadPromoIntoForensicPlayer && (
                    <button
                      type="button"
                      onClick={() =>
                        onLoadPromoIntoForensicPlayer(
                          activePromoVideoUrl,
                          activePromoTitle
                        )
                      }
                      className="min-h-[32px] px-3 py-1 rounded-lg bg-[#0891B2] hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Film className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {language === 'id'
                          ? 'Uji Ekstrak 12 Frame dari Video Promo Ini'
                          : 'Analyze This Promo Video in Step 2 Player'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE STEP-BY-STEP ROADMAP ("START HERE -> STEP 1 -> STEP 2 -> STEP 3 -> STEP 4") */}
      <section aria-labelledby="roadmap-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {language === 'id'
                ? 'PETA JALAN PENGGUNAAN · MULAI DARI SINI'
                : 'INTERACTIVE WORKFLOW ROADMAP · START HERE'}
            </div>
            <h2
              id="roadmap-heading"
              className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1"
            >
              {language === 'id'
                ? 'Panduan Langkah demi Langkah: Dari Kamera ke Laporan Polisi'
                : 'Step-by-Step Roadmap: From Camera Feed to Police Brief'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onStartRoadmapStep(1)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-cyan-600 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <span>
              {language === 'id' ? 'Mulai Langkah 1 Sekarang' : 'Start Here at Step 1'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              stepNum: 1 as const,
              kicker: language === 'id' ? 'MULAI DI SINI · LANGKAH 01' : 'START HERE · STEP 01',
              title:
                language === 'id'
                  ? '01. Izin Sah & Data Kejadian'
                  : '01. Lawful Consent & Incident Info',
              desc:
                language === 'id'
                  ? 'Catat waktu kejadian, lokasi RT/RW, ciri motor/kendaraan, dan centang kepatuhan privasi UU PDP.'
                  : 'Enter incident date/time, location, vehicle details, and confirm UU PDP lawful reporting authority.',
              cta: language === 'id' ? 'Buka Langkah 1' : 'Go to Step 1',
              icon: ShieldCheck,
            },
            {
              stepNum: 2 as const,
              kicker: language === 'id' ? 'HUBUNGKAN & PUTAR · LANGKAH 02' : 'CONNECT & PLAY · STEP 02',
              title:
                language === 'id'
                  ? '02. Kamera Eksternal & Pemutar Media'
                  : '02. Camera Hub & Media Player',
              desc:
                language === 'id'
                  ? 'Hubungkan CCTV Rumah (Wi-Fi) atau Kamera Kendaraan (Wi-Fi/Bluetooth/USB), putar video di Media Player, & ambil 12 frame tertajam.'
                  : 'Connect Home Wi-Fi CCTV or Vehicle Cam (Wi-Fi/Bluetooth/USB), play video in the Media Player, and extract 12 sharpest frames.',
              cta: language === 'id' ? 'Buka Pemutar & Kamera' : 'Go to Step 2',
              icon: Film,
            },
            {
              stepNum: 3 as const,
              kicker: language === 'id' ? 'ANALISIS OBJEKTIF · LANGKAH 03' : 'VISION AI · STEP 03',
              title:
                language === 'id'
                  ? '03. Analisis Visual Gemini Vision'
                  : '03. Gemini Vision Structured Analysis',
              desc:
                language === 'id'
                  ? 'Kirim hanya frame JPEG terpilih untuk mendeteksi kronologi aksi, rincian pakaian pelaku, dan koordinat wajah/tubuh.'
                  : 'Analyze selected JPEG frames at HIGH resolution for chronological timeline, clothing breakdown, and bounding boxes.',
              cta: language === 'id' ? 'Buka Langkah 3' : 'Go to Step 3',
              icon: Sparkles,
            },
            {
              stepNum: 4 as const,
              kicker: language === 'id' ? 'CETAK & BAGIKAN · LANGKAH 04' : 'EXPORT BRIEF · STEP 04',
              title:
                language === 'id'
                  ? '04. Laporan Polisi PDF & WhatsApp'
                  : '04. Police PDF & WhatsApp Brief',
              desc:
                language === 'id'
                  ? 'Hasilkan potongan kanvas asli tanpa rekayasa, cetak Laporan PDF resmi untuk Polsek/RT-RW, atau salin teks WhatsApp.'
                  : 'Generate unaltered HTML5 canvas crops, print a clean Police/Community PDF report, or copy a formatted WhatsApp brief.',
              cta: language === 'id' ? 'Buka Laporan Polisi' : 'Go to Step 4',
              icon: FileText,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.stepNum}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-tabular font-bold text-cyan-700 dark:text-cyan-400">
                      {card.kicker}
                    </span>
                    <Icon className="w-5 h-5 text-amber-500 shrink-0" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onStartRoadmapStep(card.stepNum)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-[#0F172A] hover:text-white dark:hover:bg-cyan-600 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>{card.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: HOME SECURITY WI-FI CAMERA VS. ON-THE-GO VEHICLE CAMERA ARCHITECTURE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Home Security Wi-Fi Camera */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'id'
                  ? 'Saat di Rumah: Kamera Keamanan Rumah (Wi-Fi LAN / IP Cam)'
                  : 'At Home: Home Security Wi-Fi Cameras (LAN / IP CCTV)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                TP-Link Tapo · Xiaomi · Hikvision · EZVIZ · Reolink · ESP32-CAM
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {language === 'id'
              ? 'Kamera keamanan rumah terhubung ke router Wi-Fi rumah Anda (misal 192.168.1.x). Anda dapat menghubungkan stream HTTP/MJPEG lokalnya, atau mengunduh potongan klip rekaman kejadian dari aplikasi CCTV rumah Anda dan memutarnya di Pemutar Media MotoGuard untuk diekstrak 12 frame tertajamnya.'
              : 'Home security cameras sit on your home Wi-Fi router (192.168.1.x). You can connect to their local HTTP/MJPEG stream endpoint, or export an alert clip from your home camera app and open it directly in the MotoGuard Media Player for frame-by-frame inspection.'}
          </p>

          <button
            type="button"
            onClick={onOpenCameraHub}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Wifi className="w-4 h-4" />
            <span>
              {language === 'id'
                ? 'Konfigurasi Kamera Wi-Fi Rumah'
                : 'Connect Home Security Wi-Fi Camera'}
            </span>
          </button>
        </div>

        {/* Card B: Out & About Vehicle / Motorcycle Camera (Wi-Fi Direct + Bluetooth + USB-C) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'id'
                  ? 'Saat di Jalan: Kamera Motor & Mobil (Bluetooth + Wi-Fi + USB-C)'
                  : 'On the Road: Vehicle & Motorcycle Cameras (Bluetooth + Wi-Fi + USB)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Web Bluetooth BLE Wake · 5GHz Wi-Fi Direct Hotspot · USB-C OTG Live
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {language === 'id'
              ? 'Kamera kendaraan modern menggunakan kombinasi pintar: Bluetooth Low Energy (BLE) digunakan untuk membangunkan kamera & mengunci rekaman darurat, lalu kamera menyalakan Wi-Fi Direct (atau kabel USB-C OTG) untuk mentransfer video HD dengan cepat ke Pemutar Media ponsel Anda.'
              : 'Modern vehicle and action cameras use a hybrid pairing architecture: Bluetooth (BLE) pairs instantly to wake the camera and trigger incident locks, while Wi-Fi Direct (or USB-C OTG) handles the high-speed HD video stream into your phone’s Media Player.'}
          </p>

          <button
            type="button"
            onClick={onOpenCameraHub}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-amber-600 hover:opacity-95 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {language === 'id'
                ? 'Hubungkan Kamera Kendaraan (BT / Wi-Fi / USB)'
                : 'Connect Vehicle Camera (BT / Wi-Fi / USB)'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
