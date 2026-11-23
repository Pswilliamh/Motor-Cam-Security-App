import {Language} from './types';

export const TRANSLATIONS: Record<
  Language,
  {
    appTitle: string;
    appSubtitle: string;
    zeroStorageBadge: string;
    step1Short: string;
    step2Short: string;
    step3Short: string;
    step4Short: string;
    step1Title: string;
    step1Desc: string;
    incidentDateTimeLabel: string;
    locationLabel: string;
    locationPlaceholder: string;
    motorcycleMakeLabel: string;
    motorcycleMakePlaceholder: string;
    motorcycleColorLabel: string;
    motorcycleColorPlaceholder: string;
    plateNumberLabel: string;
    plateNumberPlaceholder: string;
    reporterNotesLabel: string;
    reporterNotesPlaceholder: string;
    uuPdpHeader: string;
    uuPdpCheckboxText: string;
    uuPdpSubNote: string;
    proceedToStep2Btn: string;
    consentRequiredAlert: string;
    step2Title: string;
    step2Desc: string;
    uploadVideoBtn: string;
    uploadVideoDisabledHint: string;
    loadDemoVideoBtn: string;
    scanningFramesLabel: string;
    sampledFramesStat: string;
    sharpestSelectedStat: string;
    minSpacingStat: string;
    deselectHint: string;
    selectAllBtn: string;
    keepTop6Btn: string;
    sharpnessLabel: string;
    selectedCountLabel: string;
    step3Title: string;
    step3Desc: string;
    modelSelectLabel: string;
    flashDesc: string;
    proDesc: string;
    runAnalysisBtn: string;
    analyzingStatus: string;
    offlineQueueNotice: string;
    step4Title: string;
    step4Desc: string;
    printPdfBtn: string;
    copyWhatsappBtn: string;
    whatsappCopiedToast: string;
    unalteredCropLabel: string;
    fullFrameRefLabel: string;
    faceHeadCropLabel: string;
    fullBodyCropLabel: string;
    cropPaddingLabel: string;
    reportHeaderTitle: string;
    reportHeaderSub: string;
    vehicleSectionTitle: string;
    suspectProfileTitle: string;
    buildPostureLabel: string;
    hairFacialLabel: string;
    helmetHeadgearLabel: string;
    upperClothingLabel: string;
    lowerClothingLabel: string;
    footwearBagsLabel: string;
    getawayVehicleTitle: string;
    getawayTypeLabel: string;
    getawayColorLabel: string;
    getawayPlateLabel: string;
    getawayMarksLabel: string;
    timelineSectionTitle: string;
    caveatsSectionTitle: string;
    autoSavedIndicator: string;
    offlineModeBanner: string;
    onlineSyncedBanner: string;
    savedCasesDrawerTitle: string;
    newCaseBtn: string;
    emailAuthLabel: string;
    emailAuthPlaceholder: string;
    emailAuthSignInBtn: string;
    emailAuthSignOutBtn: string;
    emailAuthOfflineNote: string;
    appearanceMenuLabel: string;
    eyeComfortToggle: string;
    darkModeToggle: string;
    fontChoiceLabel: string;
  }
> = {
  id: {
    appTitle: 'MotoGuard Incident Helper',
    appSubtitle: 'Bantu Cek Curanmor · Dokumentasi CCTV & Dashcam Warga',
    zeroStorageBadge: '100% Ekstraksi Video di Perangkat · Tanpa Simpan Video di Server',
    step1Short: '01. Izin & Data',
    step2Short: '02. Ekstrak Frame',
    step3Short: '03. Analisis AI',
    step4Short: '04. Laporan & WA',
    step1Title: 'Langkah 1: Otoritas Sah & Kepatuhan Privasi UU PDP',
    step1Desc:
      'Catat detail dasar kejadian dan konfirmasi kepemilikan sah sebelum mengekstrak frame CCTV secara lokal di ponsel Anda.',
    incidentDateTimeLabel: 'Waktu & Tanggal Kejadian',
    locationLabel: 'Lokasi Kejadian (RT/RW, Jalan, Area Parkir)',
    locationPlaceholder: 'Contoh: RT 04 / RW 07, Jl. Melati Raya No. 12, Kos Putri Amanah',
    motorcycleMakeLabel: 'Merek & Tipe Motor',
    motorcycleMakePlaceholder: 'Contoh: Honda Vario 160 CBS (2024)',
    motorcycleColorLabel: 'Warna Motor',
    motorcycleColorPlaceholder: 'Contoh: Hitam Doff (Matte Black)',
    plateNumberLabel: 'Nomor Polisi (Plat)',
    plateNumberPlaceholder: 'Contoh: B 4821 KXZ',
    reporterNotesLabel: 'Catatan Tambahan Saksi / Pelapor (Opsional)',
    reporterNotesPlaceholder:
      'Contoh: Pelaku datang berboncengan dari arah timur sekitar pukul 03:14 WIB, merusak kunci kontak dalam 25 detik.',
    uuPdpHeader: 'Pernyataan Kepatuhan Hukum & UU No. 27 Tahun 2022 (UU PDP)',
    uuPdpCheckboxText:
      'Saya menyatakan bahwa saya adalah pemilik sah kendaraan/rekaman CCTV atau pihak berwenang (Pengurus RT/RW/Korban) yang mendokumentasikan dugaan pencurian untuk laporan resmi. Saya memahami pemrosesan video dilakukan 100% lokal di browser tanpa penyimpanan file video di server.',
    uuPdpSubNote:
      'Penting: Aplikasi ini adalah alat bantu dokumentasi visual objektif dan TIDAK menebak nama/identitas hukum seseorang.',
    proceedToStep2Btn: 'Lanjut ke Ekstraksi Frame Video',
    consentRequiredAlert: 'Centang pernyataan kepatuhan UU PDP terlebih dahulu untuk mengaktifkan unggah video.',
    step2Title: 'Langkah 2: Ekstraktor Frame Video & Filter Ketajaman Laplacian',
    step2Desc:
      'Pilih klip video pendek (.mp4, .mov, .webm) dari galeri ponsel. Sistem memindai hingga 150 sampel frame di perangkat Anda (~5–10 fps) dan memilih 12 frame paling tajam (jarak minimal 0,3 detik).',
    uploadVideoBtn: 'Pilih Klip Video CCTV / Dashcam (.mp4, .mov, .webm)',
    uploadVideoDisabledHint: 'Harap centang persetujuan UU PDP di Langkah 1 untuk memilih video',
    loadDemoVideoBtn: 'Gunakan Simulasi Rekaman CCTV Curanmor (Uji Cepat di Perangkat)',
    scanningFramesLabel: 'Memindai ketajaman tepi (Laplacian Variance) secara lokal di browser...',
    sampledFramesStat: 'Sampel Dipindai',
    sharpestSelectedStat: 'Frame Tertajam',
    minSpacingStat: 'Jarak Antar Frame',
    deselectHint: 'Ketuk frame untuk memilih/membatalkan frame yang tidak relevan sebelum dikirim ke analisis Gemini.',
    selectAllBtn: 'Pilih Semua (12)',
    keepTop6Btn: 'Pilih 6 Tertajam',
    sharpnessLabel: 'Skor Ketajaman',
    selectedCountLabel: 'Frame Terpilih untuk Analisis',
    step3Title: 'Langkah 3: Analisis Insiden Terstruktur dengan Gemini Vision',
    step3Desc:
      'Hanya frame JPEG terpilih yang dikompresi yang dikirim untuk dianalisis dengan resolusi media TINGGI (HIGH). File video asli tidak pernah meninggalkan perangkat Anda.',
    modelSelectLabel: 'Pilih Model Gemini Vision',
    flashDesc: 'Cepat & Responsif · Ideal untuk dokumentasi lapangan RT/RW segera',
    proDesc: 'Penalaran Visual Mendalam · Detail ekstra untuk pencahayaan sulit',
    runAnalysisBtn: 'Jalankan Analisis Visual Kejadian',
    analyzingStatus: 'Menganalisis urutan kronologis, ciri pakaian, & koordinat pelaku...',
    offlineQueueNotice:
      'Perangkat sedang offline. Data dan frame telah disimpan otomatis di penyimpanan lokal dan siap dianalisis saat koneksi kembali.',
    step4Title: 'Langkah 4: Potongan Kanvas Otomatis & Laporan Siap Cetak / WhatsApp',
    step4Desc:
      'Potongan gambar otomatis dari frame paling jelas tanpa rekayasa piksel, dilengkapi rincian pakaian pelaku, kronologi waktu, cetak PDF, dan format teks WhatsApp.',
    printPdfBtn: 'Cetak / Simpan Laporan PDF',
    copyWhatsappBtn: 'Salin Ringkasan WhatsApp (RT/RW & Polsek)',
    whatsappCopiedToast: 'Ringkasan WhatsApp berhasil disalin ke papan klip!',
    unalteredCropLabel: 'Potongan Asli Tanpa Rekayasa — Referensi Visual',
    fullFrameRefLabel: 'Frame Referensi Utuh',
    faceHeadCropLabel: 'Potongan Area Kepala / Helm / Wajah',
    fullBodyCropLabel: 'Potongan Tubuh Penuh & Pakaian',
    cropPaddingLabel: 'Margin Area Potong',
    reportHeaderTitle: 'LAPORAN RINGKASAN VISUAL INSIDEN KENDARAAN (BANTU CEK CURANMOR)',
    reportHeaderSub:
      'Dokumen Bantu Bukti Awal Masyarakat · Diproses Lokal Sesuai Prinsip Minimisasi Data UU PDP No. 27/2022',
    vehicleSectionTitle: 'I. Identitas Kendaraan & Lokasi Kejadian',
    suspectProfileTitle: 'II. Profil Visual Terduga Pelaku (Observasi Objektif)',
    buildPostureLabel: 'Postur & Perawakan Tubuh',
    hairFacialLabel: 'Rambut & Area Wajah yang Terlihat',
    helmetHeadgearLabel: 'Helm / Penutup Kepala',
    upperClothingLabel: 'Pakaian Atas (Jaket / Baju)',
    lowerClothingLabel: 'Pakaian Bawah (Celana)',
    footwearBagsLabel: 'Alas Kaki & Tas / Atribut',
    getawayVehicleTitle: 'III. Kendaraan Rekan / Sarana Pelarian',
    getawayTypeLabel: 'Jenis & Tipe Kendaraan',
    getawayColorLabel: 'Warna Kendaraan',
    getawayPlateLabel: 'Keterbacaan Plat Nomor',
    getawayMarksLabel: 'Ciri Khusus / Stiker / Modifikasi',
    timelineSectionTitle: 'IV. Kronologi Urutan Frame (Timestamp Offset)',
    caveatsSectionTitle: 'V. Catatan Teknis Kualitas Visual & Pencahayaan',
    autoSavedIndicator: 'Tersimpan Otomatis (Lokal)',
    offlineModeBanner: 'Mode Offline Aktif — Semua input & frame tersimpan aman di perangkat',
    onlineSyncedBanner: 'Penyimpanan Lokal Tersinkronisasi',
    savedCasesDrawerTitle: 'Riwayat & Draf Laporan Tersimpan (Offline-First)',
    newCaseBtn: 'Buat Laporan Baru',
    emailAuthLabel: 'Identitas Pelapor (Email Lokal / Tanpa Perlu Internet)',
    emailAuthPlaceholder: 'pelapor@warga-rt04.id',
    emailAuthSignInBtn: 'Simpan Identitas',
    emailAuthSignOutBtn: 'Keluar',
    emailAuthOfflineNote: 'Login email bekerja secara offline untuk menandai draf laporan di perangkat Anda.',
    appearanceMenuLabel: 'Kenyamanan Mata & Tampilan',
    eyeComfortToggle: 'Spektrum Cyan-Hijau Ramah Mata',
    darkModeToggle: 'Mode Malam (Gelap)',
    fontChoiceLabel: 'Jenis Huruf Keterbacaan Tinggi',
  },
  en: {
    appTitle: 'MotoGuard Incident Helper',
    appSubtitle: 'Bantu Cek Curanmor · On-Device CCTV & Dashcam Theft Documentation',
    zeroStorageBadge: '100% On-Device Video Extraction · Zero Server Video Storage',
    step1Short: '01. Consent & Info',
    step2Short: '02. Frame Extract',
    step3Short: '03. AI Analysis',
    step4Short: '04. Brief & Export',
    step1Title: 'Step 1: Lawful Authority & UU PDP Privacy Gate',
    step1Desc:
      'Record core incident metadata and confirm lawful reporting authority before extracting video frames locally on your smartphone.',
    incidentDateTimeLabel: 'Incident Date & Time',
    locationLabel: 'Location (RT/RW, Street, or Parking Area)',
    locationPlaceholder: 'e.g., RT 04 / RW 07, Jl. Melati Raya No. 12, North Parking Bay',
    motorcycleMakeLabel: 'Motorcycle Make & Model',
    motorcycleMakePlaceholder: 'e.g., Honda Vario 160 CBS (2024)',
    motorcycleColorLabel: 'Motorcycle Color',
    motorcycleColorPlaceholder: 'e.g., Matte Black with Red Emblem',
    plateNumberLabel: 'License Plate Number',
    plateNumberPlaceholder: 'e.g., B 4821 KXZ',
    reporterNotesLabel: 'Additional Witness / Reporter Notes (Optional)',
    reporterNotesPlaceholder:
      'e.g., Two individuals approached from east alley at 03:14 AM; ignition lock forced in under 30 seconds.',
    uuPdpHeader: 'Lawful Authority & Indonesian Personal Data Protection (UU No. 27/2022) Gate',
    uuPdpCheckboxText:
      'I confirm that I am the lawful owner of the motorcycle/CCTV footage or an authorized community representative reporting a property theft (UU No. 27/2022 UU PDP compliance), and I acknowledge that video frame extraction runs 100% locally in my browser with zero server video retention.',
    uuPdpSubNote:
      'Note: This system generates objective visual observations only and never guesses or invents any person’s legal identity.',
    proceedToStep2Btn: 'Continue to Local Video Frame Extractor',
    consentRequiredAlert: 'Please check the mandatory UU PDP lawful authority box to unlock video selection.',
    step2Title: 'Step 2: In-Browser Video Frame Extractor & Sharpness Filter',
    step2Desc:
      'Select a short video clip (.mp4, .mov, .webm) from your phone gallery. The browser steps through up to 150 frames locally (~5–10 fps), scores edge sharpness via Laplacian variance, and selects the top 12 sharpest frames spaced ≥ 0.3s apart.',
    uploadVideoBtn: 'Select CCTV / Dashcam Video Clip (.mp4, .mov, .webm)',
    uploadVideoDisabledHint: 'Check the Step 1 UU PDP privacy consent checkbox to enable video selection',
    loadDemoVideoBtn: 'Generate & Load Simulated CCTV Incident Clip (100% On-Device Test)',
    scanningFramesLabel: 'Calculating grayscale Laplacian gradient variance locally on device...',
    sampledFramesStat: 'Frames Sampled',
    sharpestSelectedStat: 'Sharpest Kept',
    minSpacingStat: 'Min Temporal Gap',
    deselectHint: 'Tap any thumbnail to deselect irrelevant frames before running Gemini Vision analysis.',
    selectAllBtn: 'Select All (12)',
    keepTop6Btn: 'Select Top 6 Sharpest',
    sharpnessLabel: 'Sharpness Score',
    selectedCountLabel: 'Frames Selected for Analysis',
    step3Title: 'Step 3: Gemini Vision Structured Incident Analysis',
    step3Desc:
      'Only your selected compressed JPEG thumbnails are transmitted with HIGH media resolution. The raw video file never leaves your smartphone.',
    modelSelectLabel: 'Select Gemini Vision Model',
    flashDesc: 'Fast & Responsive · Recommended for rapid community & patrol documentation',
    proDesc: 'Deep Visual Reasoning · Enhanced detail extraction for difficult lighting',
    runAnalysisBtn: 'Run Structured Incident Analysis',
    analyzingStatus: 'Analyzing chronological actions, clothing breakdown, and normalized bounding boxes...',
    offlineQueueNotice:
      'You are currently offline. Your metadata and extracted JPEG frames are auto-saved locally and ready for analysis once connectivity resumes.',
    step4Title: 'Step 4: Automatic Canvas Cropping & Printable / WhatsApp Brief',
    step4Desc:
      'Automatically cropped zoomed-in HTML5 canvases from the clearest suspect frame alongside itemized clothing breakdown, timeline log, PDF print view, and one-tap WhatsApp summary.',
    printPdfBtn: 'Print / Save PDF Report',
    copyWhatsappBtn: 'Copy WhatsApp Summary (RT/RW & Police)',
    whatsappCopiedToast: 'Formatted WhatsApp summary copied to clipboard!',
    unalteredCropLabel: 'Unaltered Original Crop — Visual Reference',
    fullFrameRefLabel: 'Full Reference Frame',
    faceHeadCropLabel: 'Face / Head / Helmet Crop',
    fullBodyCropLabel: 'Full Body & Clothing Crop',
    cropPaddingLabel: 'Crop Margin Padding',
    reportHeaderTitle: 'INCIDENT VISUAL SUMMARY REPORT (MOTOGUARD / BANTU CEK CURANMOR)',
    reportHeaderSub:
      'Objective Visual Documentation Brief · Processed On-Device under UU PDP No. 27/2022 Data Minimization',
    vehicleSectionTitle: 'I. Target Motorcycle & Incident Metadata',
    suspectProfileTitle: 'II. Suspect Visual Profile (Objective Observation)',
    buildPostureLabel: 'Estimated Build & Posture',
    hairFacialLabel: 'Hair & Visible Facial Features',
    helmetHeadgearLabel: 'Helmet & Headgear',
    upperClothingLabel: 'Upper Clothing',
    lowerClothingLabel: 'Lower Clothing',
    footwearBagsLabel: 'Footwear & Bags / Gear',
    getawayVehicleTitle: 'III. Accomplice or Getaway Vehicle',
    getawayTypeLabel: 'Vehicle Type & Model',
    getawayColorLabel: 'Color',
    getawayPlateLabel: 'Plate Visibility',
    getawayMarksLabel: 'Distinguishing Marks',
    timelineSectionTitle: 'IV. Chronological Frame Action Log',
    caveatsSectionTitle: 'V. Technical Caveats (Lighting, Distance, Motion Blur)',
    autoSavedIndicator: 'Auto-Saved Locally',
    offlineModeBanner: 'Offline Mode — All inputs & extracted frames are safely stored on-device',
    onlineSyncedBanner: 'Local Storage Synchronized',
    savedCasesDrawerTitle: 'Saved Incident Reports & Offline Drafts',
    newCaseBtn: 'New Incident Report',
    emailAuthLabel: 'Reporter Email Session (Works Offline)',
    emailAuthPlaceholder: 'reporter@community-watch.org',
    emailAuthSignInBtn: 'Set Reporter Email',
    emailAuthSignOutBtn: 'Sign Out',
    emailAuthOfflineNote: 'Email login works without internet connectivity to tag and organize your local reports.',
    appearanceMenuLabel: 'Eye Comfort & Legibility Settings',
    eyeComfortToggle: 'Eye-Friendly Cyan-Green Spectrum',
    darkModeToggle: 'Dark Mode (Night Readability)',
    fontChoiceLabel: 'Device Legibility Font',
  },
};
