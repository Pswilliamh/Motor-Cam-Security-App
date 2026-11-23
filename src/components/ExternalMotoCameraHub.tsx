import React, {useEffect, useRef, useState} from 'react';
import {
  AlertTriangle,
  Bluetooth,
  Camera,
  CheckCircle2,
  HardDrive,
  Home,
  Play,
  Radio,
  RefreshCw,
  Save,
  Square,
  Usb,
  Video,
  Wifi,
} from 'lucide-react';
import {ExtractedFrame, Language} from '../types';
import {
  calculateFrameSharpness,
  ExtractionProgress,
  formatVideoTimestamp,
} from '../utils/videoFrameExtractor';
import {CameraProfileInput} from '../firebase';

interface ExternalMotoCameraHubProps {
  language: Language;
  uuPdpConsentChecked: boolean;
  onFramesExtracted: (
    frames: ExtractedFrame[],
    stats: {totalSampled: number; videoDuration: number; sourceName: string}
  ) => void;
  onTriggerLocalFilePicker: () => void;
  savedProfiles: Array<CameraProfileInput & {id: string}>;
  onSaveProfile?: (profile: CameraProfileInput) => Promise<void>;
  isAuthenticated: boolean;
}

export const ExternalMotoCameraHub: React.FC<ExternalMotoCameraHubProps> = ({
  language,
  uuPdpConsentChecked,
  onFramesExtracted,
  onTriggerLocalFilePicker,
  savedProfiles,
  onSaveProfile,
  isAuthenticated,
}) => {
  const [connectionTab, setConnectionTab] = useState<
    'home_wifi' | 'vehicle_bt_wifi' | 'usb_otg' | 'microsd'
  >('home_wifi');

  // USB OTG / UVC External Camera state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreamActive, setIsStreamActive] = useState<boolean>(false);
  const [isBurstSampling, setIsBurstSampling] = useState<boolean>(false);
  const [burstProgress, setBurstProgress] = useState<ExtractionProgress | null>(
    null
  );
  const [cameraError, setCameraError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Home Wi-Fi & Vehicle Wi-Fi / Bluetooth state
  const [wifiCamName, setWifiCamName] = useState<string>(
    'Home Driveway Wi-Fi CCTV'
  );
  const [wifiMountPos, setWifiMountPos] = useState<
    | 'front_handlebar'
    | 'rear_tail'
    | 'helmet_mount'
    | 'side_fairing'
    | 'home_security'
    | 'vehicle_cabin'
  >('home_security');
  const [wifiStreamUrl, setWifiStreamUrl] = useState<string>(
    'http://192.168.1.108:8080/video'
  );
  const [wifiPreviewActive, setWifiPreviewActive] = useState<boolean>(false);
  const [wifiImgLoadError, setWifiImgLoadError] = useState<boolean>(false);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileSavedToast, setProfileSavedToast] = useState<boolean>(false);

  // Web Bluetooth Pairing state for Vehicle / Action Cameras
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [btStatusMessage, setBtStatusMessage] = useState<string | null>(null);

  const wifiImgRef = useRef<HTMLImageElement | null>(null);

  // Enumerate connected video input devices (USB OTG UVC external cameras + phone lenses)
  const refreshVideoDevices = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setCameraError(
        language === 'id'
          ? 'Browser ini tidak mendukung akses perangkat kamera USB/UVC.'
          : 'This browser does not support USB/UVC camera enumeration.'
      );
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        const usbCam = videoInputs.find((d) =>
          /usb|uvc|external|capture|endoscope|dash|hdmi|akaso|gopro|novatek|webcam/i.test(
            d.label
          )
        );
        setSelectedDeviceId(
          usbCam?.deviceId || videoInputs[videoInputs.length - 1].deviceId
        );
      }
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error ? err.message : 'Unable to list camera devices.'
      );
    }
  };

  useEffect(() => {
    refreshVideoDevices();
    const handleDeviceChange = () => {
      refreshVideoDevices();
    };
    navigator.mediaDevices?.addEventListener?.(
      'devicechange',
      handleDeviceChange
    );
    return () => {
      stopLiveCamera();
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        handleDeviceChange
      );
    };
  }, []);

  const stopLiveCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
  };

  const startLiveCamera = async () => {
    if (!uuPdpConsentChecked) {
      setCameraError(
        language === 'id'
          ? 'Centang persetujuan UU PDP di Langkah 1 terlebih dahulu.'
          : 'Please check the Step 1 UU PDP consent box first.'
      );
      return;
    }
    setCameraError(null);
    stopLiveCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? {
              deviceId: {exact: selectedDeviceId},
              width: {ideal: 1280},
              height: {ideal: 720},
            }
          : {
              facingMode: {ideal: 'environment'},
              width: {ideal: 1280},
              height: {ideal: 720},
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
      setIsStreamActive(true);
      await refreshVideoDevices();
    } catch (err: unknown) {
      setCameraError(
        language === 'id'
          ? `Gagal membuka kamera eksternal: ${err instanceof Error ? err.message : 'Izin ditolak'}. Pastikan kabel USB-C OTG terpasang.`
          : `Could not open external camera feed: ${err instanceof Error ? err.message : 'Permission denied'}. Verify your USB-C OTG connection.`
      );
    }
  };

  // Web Bluetooth BLE Pairing for Vehicle / Motorcycle Action & Dash Cameras
  const handleBluetoothPairVehicleCamera = async () => {
    setCameraError(null);
    setBtStatusMessage(null);
    const navWithBt = navigator as unknown as {
      bluetooth?: {
        requestDevice: (options: {
          acceptAllDevices: boolean;
          optionalServices?: string[];
        }) => Promise<{name?: string; id: string}>;
      };
    };

    if (!navWithBt.bluetooth) {
      setCameraError(
        language === 'id'
          ? 'Web Bluetooth tidak tersedia di browser ini (Gunakan Chrome di Android/Desktop). Setelah Bluetooth kamera aktif, sambungkan Wi-Fi HP ke hotspot kamera untuk transfer video HD.'
          : 'Web Bluetooth API is not available in this browser (supported in Chrome on Android/Desktop). Use your camera’s Bluetooth wake button, then join its Wi-Fi hotspot for HD video transfer.'
      );
      return;
    }

    try {
      const device = await navWithBt.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information'],
      });
      const devLabel = device.name || `BLE-VehicleCam-${device.id.slice(0, 6)}`;
      setBtDeviceName(devLabel);
      setWifiCamName(devLabel);
      setBtStatusMessage(
        language === 'id'
          ? `Terhubung via Bluetooth BLE ke "${devLabel}". Sekarang sambungkan Wi-Fi HP ke Hotspot Wi-Fi kamera untuk streaming atau mengunduh video.`
          : `Paired via Bluetooth BLE with "${devLabel}". Now connect to the camera’s Wi-Fi Direct hotspot below for high-speed video streaming.`
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        setBtStatusMessage(
          language === 'id'
            ? 'Pemindaian Bluetooth dibatalkan.'
            : 'Bluetooth pairing dialog closed.'
        );
      } else {
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Bluetooth pairing could not complete.'
        );
      }
    }
  };

  /**
   * Samples 36 live frames over 5.4 seconds directly from the connected
   * external camera <video> stream, scores Laplacian edge sharpness on every frame,
   * and returns the top 12 sharpest frames spaced >= 0.3s apart.
   */
  const handleBurstCaptureFromLiveFeed = async () => {
    const videoEl = liveVideoRef.current;
    if (!videoEl || !isStreamActive) return;

    setIsBurstSampling(true);
    setCameraError(null);

    try {
      const totalSamples = 36;
      const intervalMs = 150;
      const nativeW = videoEl.videoWidth || 1280;
      const nativeH = videoEl.videoHeight || 720;

      const scoreW = 240;
      const scoreH = Math.max(135, Math.round((nativeH / nativeW) * scoreW));
      const scoreCanvas = document.createElement('canvas');
      scoreCanvas.width = scoreW;
      scoreCanvas.height = scoreH;
      const scoreCtx = scoreCanvas.getContext('2d', {
        willReadFrequently: true,
      });

      const outW = Math.min(960, nativeW);
      const outH = Math.round((nativeH / nativeW) * outW);
      const outCanvas = document.createElement('canvas');
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext('2d');

      if (!scoreCtx || !outCtx) {
        throw new Error('Canvas 2D context unavailable.');
      }

      interface LiveCandidate {
        timestampSeconds: number;
        sharpnessScore: number;
        dataUrl: string;
        width: number;
        height: number;
      }

      const candidates: LiveCandidate[] = [];

      for (let i = 0; i < totalSamples; i++) {
        const t = Number(((i * intervalMs) / 1000).toFixed(2));
        scoreCtx.drawImage(videoEl, 0, 0, scoreW, scoreH);
        const imgData = scoreCtx.getImageData(0, 0, scoreW, scoreH);
        const sharpnessScore = calculateFrameSharpness(imgData);

        outCtx.drawImage(videoEl, 0, 0, outW, outH);
        const dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);

        candidates.push({
          timestampSeconds: t,
          sharpnessScore,
          dataUrl,
          width: outW,
          height: outH,
        });

        setBurstProgress({
          sampledCount: i + 1,
          totalToSample: totalSamples,
          currentTimestamp: t,
          percent: Math.round(((i + 1) / totalSamples) * 100),
        });

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      const bySharpness = [...candidates].sort(
        (a, b) => b.sharpnessScore - a.sharpnessScore
      );
      const picked: LiveCandidate[] = [];
      for (const cand of bySharpness) {
        if (picked.length >= 12) break;
        const tooClose = picked.some(
          (p) => Math.abs(p.timestampSeconds - cand.timestampSeconds) < 0.3
        );
        if (!tooClose) picked.push(cand);
      }
      picked.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

      const activeDeviceLabel =
        videoDevices.find((d) => d.deviceId === selectedDeviceId)?.label ||
        'USB-OTG / External Camera';

      const finalFrames: ExtractedFrame[] = picked.map((item, idx) => ({
        id: `live-usb-frame-${idx + 1}-${Date.now()}`,
        frameNumber: idx + 1,
        timestampSeconds: item.timestampSeconds,
        timestampFormatted: formatVideoTimestamp(item.timestampSeconds),
        sharpnessScore: item.sharpnessScore,
        dataUrl: item.dataUrl,
        selected: true,
        width: item.width,
        height: item.height,
      }));

      onFramesExtracted(finalFrames, {
        totalSampled: totalSamples,
        videoDuration: 5.4,
        sourceName: `${activeDeviceLabel} (Live Capture)`,
      });
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Failed to sample frames from live external camera.'
      );
    } finally {
      setIsBurstSampling(false);
      setBurstProgress(null);
    }
  };

  const handleSaveCurrentProfile = async () => {
    if (!onSaveProfile) return;
    setSavingProfile(true);
    try {
      await onSaveProfile({
        cameraName: wifiCamName,
        mountPosition: wifiMountPos,
        connectionType:
          connectionTab === 'home_wifi'
            ? 'home_wifi_ip'
            : connectionTab === 'vehicle_bt_wifi'
              ? 'vehicle_bt_wifi'
              : connectionTab === 'usb_otg'
                ? 'usb_otg_uvc'
                : 'microsd_reader',
        streamUrl:
          connectionTab === 'usb_otg'
            ? selectedDeviceId || 'usb-uvc://external-cam'
            : wifiStreamUrl,
      });
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 3000);
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error ? err.message : 'Could not save camera profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="rounded-xl border border-cyan-600/30 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {language === 'id'
              ? 'Hub Kamera Eksternal: CCTV Rumah (Wi-Fi) & Kamera Kendaraan (Wi-Fi / Bluetooth / USB)'
              : 'External Camera Hub: Home Security (Wi-Fi) & Vehicle Camera (Wi-Fi / Bluetooth / USB)'}
          </span>
        </div>
        <span className="text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">
          {language === 'id' ? '100% Proses Lokal' : '100% On-Device Feed'}
        </span>
      </div>

      {/* 4 Hardware Connection Mode Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setConnectionTab('home_wifi');
            setWifiMountPos('home_security');
            setWifiCamName('Home Driveway Wi-Fi CCTV');
            setWifiStreamUrl('http://192.168.1.108:8080/video');
          }}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            connectionTab === 'home_wifi'
              ? 'bg-[#0F172A] text-white dark:bg-cyan-600 shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'id' ? '1. CCTV Rumah Wi-Fi' : '1. Home Wi-Fi Cam'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setConnectionTab('vehicle_bt_wifi');
            setWifiMountPos('front_handlebar');
            setWifiCamName('Vehicle / Moto Dashcam');
            setWifiStreamUrl('http://192.168.4.1:81/stream');
          }}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            connectionTab === 'vehicle_bt_wifi'
              ? 'bg-[#0F172A] text-white dark:bg-cyan-600 shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Bluetooth className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'id' ? '2. Kendaraan (BT+Wi-Fi)' : '2. Vehicle (BT+Wi-Fi)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setConnectionTab('usb_otg')}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            connectionTab === 'usb_otg'
              ? 'bg-[#0F172A] text-white dark:bg-cyan-600 shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Usb className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'id' ? '3. USB-C OTG Live' : '3. USB-C OTG Live'}</span>
        </button>

        <button
          type="button"
          onClick={() => setConnectionTab('microsd')}
          className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            connectionTab === 'microsd'
              ? 'bg-[#0F172A] text-white dark:bg-cyan-600 shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'id' ? '4. MicroSD / Klip' : '4. MicroSD / Clip'}</span>
        </button>
      </div>

      {/* Saved Cloud Camera Profiles Quick Selector */}
      {savedProfiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {language === 'id' ? 'Kamera Tersimpan:' : 'Saved Cameras:'}
          </span>
          {savedProfiles.map((prof) => (
            <button
              key={prof.id}
              type="button"
              onClick={() => {
                setWifiCamName(prof.cameraName);
                setWifiMountPos(prof.mountPosition);
                setWifiStreamUrl(prof.streamUrl);
                if (prof.connectionType === 'home_wifi_ip') {
                  setConnectionTab('home_wifi');
                } else if (
                  prof.connectionType === 'vehicle_bt_wifi' ||
                  prof.connectionType === 'wifi_stream'
                ) {
                  setConnectionTab('vehicle_bt_wifi');
                } else if (prof.connectionType === 'usb_otg_uvc') {
                  setConnectionTab('usb_otg');
                } else {
                  setConnectionTab('microsd');
                }
              }}
              className="px-2.5 py-1 rounded-lg border border-cyan-600/30 bg-white dark:bg-slate-900 text-[11px] font-semibold text-cyan-800 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {prof.cameraName} ({prof.mountPosition.replace('_', ' ')})
            </button>
          ))}
        </div>
      )}

      {/* TAB 1 & TAB 2: HOME SECURITY WI-FI CAMERA OR VEHICLE (BLUETOOTH + WI-FI) CAMERA */}
      {(connectionTab === 'home_wifi' ||
        connectionTab === 'vehicle_bt_wifi') && (
        <div className="space-y-3">
          {connectionTab === 'home_wifi' ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {language === 'id'
                ? 'Mode Rumah (Home Wi-Fi CCTV): Pastikan HP terhubung ke Wi-Fi rumah yang sama dengan kamera CCTV Anda (Tapo, Xiaomi, Hikvision, EZVIZ, Reolink, IP Webcam). Masukkan alamat stream HTTP/MJPEG lokal atau buka klip rekaman NVR di Pemutar Media.'
                : 'At-Home Mode (Home Security Wi-Fi Camera): Connect your smartphone to the same home Wi-Fi network as your security camera (Tapo, Xiaomi, Hikvision, EZVIZ, Reolink, IP Webcam). Enter its local HTTP/MJPEG stream URL or open exported alert clips in the Media Player.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'id'
                  ? 'Mode Kendaraan di Jalan (Bluetooth BLE + Wi-Fi Direct): Gunakan tombol Bluetooth di bawah untuk membangunkan/memasangkan kamera motor atau mobil Anda via BLE, lalu sambungkan ke hotspot Wi-Fi kamera untuk streaming video HD.'
                  : 'On-the-Go Vehicle Mode (Bluetooth BLE + Wi-Fi Direct): Tap Pair Bluetooth below to wake and pair your vehicle/action camera over BLE, then connect to the camera’s Wi-Fi Direct hotspot for high-speed video streaming.'}
              </p>

              {/* Web Bluetooth Pairing Bar */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
                  <Bluetooth className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {btDeviceName
                      ? language === 'id'
                        ? `Perangkat BLE Terhubung: ${btDeviceName}`
                        : `Paired BLE Camera: ${btDeviceName}`
                      : language === 'id'
                        ? 'Langkah A: Bangunkan Kamera Kendaraan via Bluetooth (BLE)'
                        : 'Step A: Wake / Pair Vehicle Camera via Bluetooth (BLE)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBluetoothPairVehicleCamera}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>
                    {language === 'id'
                      ? 'Pindai Bluetooth Kamera'
                      : 'Pair via Bluetooth'}
                  </span>
                </button>
              </div>

              {btStatusMessage && (
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {btStatusMessage}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'id' ? 'Nama Kamera' : 'Camera Label'}
              </label>
              <input
                type="text"
                value={wifiCamName}
                onChange={(e) => setWifiCamName(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'id' ? 'Lokasi / Posisi Kamera' : 'Camera Location / Mount'}
              </label>
              <select
                value={wifiMountPos}
                onChange={(e) =>
                  setWifiMountPos(
                    e.target.value as
                      | 'front_handlebar'
                      | 'rear_tail'
                      | 'helmet_mount'
                      | 'side_fairing'
                      | 'home_security'
                      | 'vehicle_cabin'
                  )
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
              >
                <option value="home_security">
                  {language === 'id'
                    ? 'CCTV Keamanan Rumah / Garasi (Home Security)'
                    : 'Home Security / Driveway / Garage'}
                </option>
                <option value="vehicle_cabin">
                  {language === 'id'
                    ? 'Dashcam Mobil / Kabin Kendaraan (Vehicle Dashcam)'
                    : 'Vehicle Dashcam / Windshield'}
                </option>
                <option value="front_handlebar">
                  {language === 'id'
                    ? 'Stang Depan Motor (Front Handlebar)'
                    : 'Motorcycle Front Handlebar'}
                </option>
                <option value="rear_tail">
                  {language === 'id'
                    ? 'Behel Belakang Motor (Rear Tail)'
                    : 'Motorcycle Rear Tail'}
                </option>
                <option value="helmet_mount">
                  {language === 'id'
                    ? 'Helm Pengendara (Helmet Mount)'
                    : 'Rider Helmet Mount'}
                </option>
                <option value="side_fairing">
                  {language === 'id'
                    ? 'Bodi Samping (Side Fairing)'
                    : 'Side Fairing'}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {connectionTab === 'home_wifi'
                ? language === 'id'
                  ? 'URL Stream Wi-Fi LAN Rumah (HTTP MJPEG / IP Gateway)'
                  : 'Home LAN Wi-Fi Camera Stream URL (HTTP MJPEG / IP Gateway)'
                : language === 'id'
                  ? 'Langkah B: URL Stream Hotspot Wi-Fi Kamera Kendaraan'
                  : 'Step B: Vehicle Camera Wi-Fi Direct Stream URL'}
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={wifiStreamUrl}
                onChange={(e) => {
                  setWifiStreamUrl(e.target.value);
                  setWifiImgLoadError(false);
                }}
                placeholder="http://192.168.1.108:8080/video"
                className="flex-1 min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono-tabular"
              />
              <button
                type="button"
                onClick={() => {
                  setWifiImgLoadError(false);
                  setWifiPreviewActive((prev) => !prev);
                }}
                className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>
                  {wifiPreviewActive
                    ? language === 'id'
                      ? 'Tutup Stream'
                      : 'Hide Stream'
                    : language === 'id'
                      ? 'Hubungkan Wi-Fi Stream'
                      : 'Connect Wi-Fi Stream'}
                </span>
              </button>
            </div>
          </div>

          {/* Preset common Home & Vehicle Wi-Fi camera IPs */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">Preset IP:</span>
            {(connectionTab === 'home_wifi'
              ? [
                  {
                    label: 'Home IP Cam (192.168.1.108:8080)',
                    url: 'http://192.168.1.108:8080/video',
                  },
                  {
                    label: 'Home Gateway / Frigate (192.168.1.50:5000)',
                    url: 'http://192.168.1.50:5000/api/front_yard',
                  },
                  {
                    label: 'ESP32 Home Cam (192.168.1.120)',
                    url: 'http://192.168.1.120:81/stream',
                  },
                ]
              : [
                  {
                    label: 'AKASO V50 / Novatek (192.168.1.254)',
                    url: 'http://192.168.1.254/DCIM',
                  },
                  {
                    label: 'AKASO / Action Cam AP (192.168.42.1)',
                    url: 'http://192.168.42.1/live',
                  },
                  {
                    label: 'Vehicle Hotspot (192.168.4.1)',
                    url: 'http://192.168.4.1:81/stream',
                  },
                ]
            ).map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => {
                  setWifiStreamUrl(preset.url);
                  setWifiImgLoadError(false);
                }}
                className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-mono-tabular cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {wifiPreviewActive && (
            <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-950 p-3 text-center space-y-2">
              {!wifiImgLoadError ? (
                <img
                  ref={wifiImgRef}
                  src={wifiStreamUrl}
                  alt="Wi-Fi Camera Stream"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={() => setWifiImgLoadError(true)}
                  className="max-h-56 mx-auto rounded-lg border border-slate-800"
                />
              ) : (
                <div className="p-4 text-xs text-amber-300 space-y-2 text-left">
                  <p className="font-semibold">
                    {language === 'id'
                      ? 'Mengapa Kamera Wi-Fi (seperti AKASO V50 / GoPro) Tidak Muncul Langsung di Browser?'
                      : 'Why Doesn’t a Wi-Fi Action Cam (like AKASO V50 / GoPro) Appear Directly in the Browser?'}
                  </p>
                  <ul className="list-disc pl-4 text-slate-300 text-[11px] space-y-1">
                    <li>
                      {language === 'id'
                        ? 'Keamanan Browser (HTTPS → HTTP) & Protokol RTSP: Kamera AKASO V50 menyiarkan preview via RTSP lokal tanpa internet, yang diblokir oleh Chrome/Safari.'
                        : 'Browser Security (HTTPS → HTTP) & RTSP Protocol: Action cams like the AKASO V50 broadcast local RTSP over an offline Wi-Fi hotspot, which mobile browsers block.'}
                    </li>
                    <li>
                      {language === 'id'
                        ? 'Cara Terbaik 1 (Wi-Fi): Simpan klip dari aplikasi AKASO GO ke Galeri HP, nyalakan internet kembali, lalu pilih video di Tab 4 (MicroSD / Klip).'
                        : 'Best Way 1 (Wi-Fi): Save the clip from the AKASO GO app to your phone gallery, reconnect to 4G/Wi-Fi, then open it in Tab 4 (MicroSD / Clip).'}
                    </li>
                    <li>
                      {language === 'id'
                        ? 'Cara Terbaik 2 (Kabel USB / MicroSD): Colokkan kabel USB ke AKASO V50 lalu pilih mode "PC Camera" (Tab 3 USB-C Live) atau "Mass Storage / Card Reader" untuk membuka folder DCIM/Movie.'
                        : 'Best Way 2 (USB Cable / MicroSD): Plug in via USB and pick "PC Camera" on the AKASO screen (Tab 3 USB-C Live), or use a MicroSD reader / "Mass Storage" mode to open DCIM/Movie/*.MP4.'}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && onSaveProfile && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleSaveCurrentProfile}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-cyan-600/50 bg-cyan-50/70 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-100 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {savingProfile
                    ? '...'
                    : language === 'id'
                      ? 'Simpan Kamera Ini ke Brankas Cloud Admin'
                      : 'Save Camera Preset to Admin Cloud Vault'}
                </span>
              </button>
              {profileSavedToast && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {language === 'id' ? 'Preset Tersimpan!' : 'Preset Saved!'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USB-C OTG / UVC EXTERNAL CAMERA LIVE FEED */}
      {connectionTab === 'usb_otg' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {language === 'id'
              ? 'Hubungkan kamera eksternal (AKASO V50 dalam mode "PC Camera", USB UVC, atau HDMI Capture) ke port USB-C HP/laptop menggunakan kabel data / adaptor OTG. Pilih perangkat di bawah untuk siaran langsung dan ambil 12 frame tertajam.'
              : 'Plug your external camera (AKASO V50 set to "PC Camera" mode, USB UVC mini cam, or capture dongle) into your phone/laptop via USB data cable / OTG adapter. Select it below to stream live and burst-extract 12 sharpest frames.'}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              aria-label="Select USB OTG or External Camera"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
            >
              {videoDevices.length === 0 ? (
                <option value="">
                  {language === 'id'
                    ? 'Kamera Eksternal / Default (Klik Buka Kamera untuk Deteksi Label)'
                    : 'External / Default Camera (Click Start Feed to Detect USB Labels)'}
                </option>
              ) : (
                videoDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label ||
                      (language === 'id'
                        ? `Kamera Video #${idx + 1} (USB/Lensa)`
                        : `Video Input #${idx + 1} (USB/Lens)`)}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={refreshVideoDevices}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'id' ? 'Pindai USB' : 'Scan USB'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isStreamActive ? (
              <button
                type="button"
                onClick={startLiveCamera}
                className="flex-1 min-h-[46px] rounded-xl bg-[#0891B2] hover:bg-cyan-700 text-white text-xs font-bold flex items-center justify-center gap-2 px-4 py-2.5 shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'id'
                    ? 'Buka Live Feed Kamera Eksternal'
                    : 'Start External Camera Live Feed'}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isBurstSampling}
                  onClick={handleBurstCaptureFromLiveFeed}
                  className="flex-1 min-h-[46px] rounded-xl bg-[#D97706] hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-2 px-4 py-2.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>
                    {isBurstSampling
                      ? language === 'id'
                        ? 'Memindai 36 Sampel Live...'
                        : 'Sampling 36 Live Frames...'
                      : language === 'id'
                        ? 'Rekam Burst 5 Detik & Ambil 12 Frame Tertajam'
                        : 'Burst Sample 5s & Extract 12 Sharpest Frames'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 text-red-500" />
                  <span>{language === 'id' ? 'Tutup' : 'Stop'}</span>
                </button>
              </>
            )}
          </div>

          {/* Live Video Preview Viewport */}
          <div
            className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 ${
              isStreamActive ? 'block' : 'hidden'
            }`}
          >
            <video
              ref={liveVideoRef}
              muted
              playsInline
              className="w-full aspect-video object-cover"
            />
            <div className="absolute top-2 left-2 bg-slate-950/80 text-cyan-300 text-[11px] font-mono-tabular px-2.5 py-1 rounded">
              LIVE EXTERNAL CAM · LOCAL CANVAS
            </div>
          </div>

          {isBurstSampling && burstProgress && (
            <div className="rounded-xl bg-slate-900 text-white p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-300">
                  {language === 'id'
                    ? 'Menghitung Laplacian Sharpness dari Live Kamera...'
                    : 'Scoring Live Camera Laplacian Sharpness...'}
                </span>
                <span className="font-mono-tabular">{burstProgress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{width: `${burstProgress.percent}%`}}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MICROSD OTG READER & DIRECT CLIP IMPORT INTO MEDIA PLAYER */}
      {connectionTab === 'microsd' && (
        <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="font-bold text-slate-900 dark:text-white mb-1">
                {language === 'id' ? 'A. CCTV Rumah (Klip Aplikasi)' : 'A. Home Security App Clip'}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'id'
                  ? 'Unduh klip gerakan mencurigakan dari aplikasi CCTV rumah Anda, lalu buka di Pemutar Media MotoGuard.'
                  : 'Save the motion-alert clip from your home security app to your phone, then open it in the MotoGuard Media Player.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="font-bold text-slate-900 dark:text-white mb-1">
                {language === 'id'
                  ? 'B. AKASO V50 / GoPro (Aplikasi Wi-Fi)'
                  : 'B. AKASO V50 / GoPro (Wi-Fi App)'}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'id'
                  ? 'Sambungkan Wi-Fi ke AKASO V50, unduh klip via aplikasi AKASO GO ke Galeri HP, lalu buka file .MP4 di Pemutar Media ini.'
                  : 'Join the AKASO V50 Wi-Fi, save the clip to your phone Gallery using the AKASO GO app, then open the .MP4 here.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="font-bold text-slate-900 dark:text-white mb-1">
                {language === 'id'
                  ? 'C. Kartu MicroSD / Kabel USB (DCIM/Movie)'
                  : 'C. MicroSD Card / USB Mass Storage'}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'id'
                  ? 'Pasang kartu MicroSD AKASO ke slot/card reader USB-C (atau colok kabel USB mode Mass Storage), lalu pilih folder DCIM → Movie → .MP4.'
                  : 'Insert the AKASO microSD card into your phone/USB-C reader (or plug in USB Mass Storage mode), then pick DCIM → Movie → .MP4.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!uuPdpConsentChecked}
            onClick={onTriggerLocalFilePicker}
            className={`w-full min-h-[44px] rounded-xl px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              uuPdpConsentChecked
                ? 'bg-[#0891B2] hover:bg-cyan-700 text-white cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>
              {language === 'id'
                ? 'Pilih Video untuk Diputar di Media Player & Ekstrak Frame (.mp4, .mov, .webm)'
                : 'Load Video into Media Player & Extract 12 Sharpest Frames (.mp4, .mov, .webm)'}
            </span>
          </button>
        </div>
      )}

      {cameraError && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 p-3 text-xs font-medium text-red-800 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}
    </div>
  );
};
