import React, {useEffect, useState} from 'react';
import {Download, Share, WifiOff, X} from 'lucide-react';
import {Language} from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as {standalone?: boolean}).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const {outcome} = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC<{language: Language}> = ({language}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const label = language === 'id' ? 'Instal PWA' : 'Install App';

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'id'
                  ? 'Pasang MotoGuard di Layar Utama HP'
                  : 'Install MotoGuard on Your Smartphone'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {isIOS ? (
                <>
                  <p>
                    {language === 'id'
                      ? 'Untuk memasang aplikasi ini di iPhone / iPad agar dapat mengekstrak frame CCTV secara offline:'
                      : 'To install this PWA on iPhone / iPad for instant offline CCTV frame extraction:'}
                  </p>
                  <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li className="flex items-center gap-2">
                      <span>
                        {language === 'id'
                          ? '1. Ketuk ikon Bagikan (Share) di bilah Safari'
                          : '1. Tap the Share button in the Safari toolbar'}
                      </span>
                      <Share className="w-4 h-4 text-cyan-600 inline" />
                    </li>
                    <li>
                      {language === 'id'
                        ? '2. Pilih "Tambah ke Layar Utama" (Add to Home Screen).'
                        : '2. Scroll down and tap "Add to Home Screen".'}
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p>
                    {language === 'id'
                      ? 'Aplikasi ini mendukung penuh standar Progressive Web App (PWA) dengan ekstraksi video 100% di perangkat:'
                      : 'This application is a full Progressive Web App (PWA) with 100% on-device video frame extraction:'}
                  </p>
                  <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li>
                      {language === 'id'
                        ? 'Ketuk ikon menu browser (⋮) di pojok kanan atas Chrome/Edge.'
                        : 'Tap your browser menu icon (⋮) or address bar install icon.'}
                    </li>
                    <li>
                      {language === 'id'
                        ? 'Pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".'
                        : 'Select "Install App" or "Add to Home Screen".'}
                    </li>
                  </ol>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-cyan-600 text-white text-sm font-semibold hover:opacity-95 transition-opacity"
            >
              {language === 'id' ? 'Mengerti' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineFloatingNotice: React.FC<{
  language: Language;
  offlineText: string;
}> = ({offlineText}) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 flex items-center gap-2.5 rounded-xl bg-amber-600 px-4 py-3 text-xs font-semibold text-white shadow-lg no-print">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{offlineText}</span>
    </div>
  );
};
