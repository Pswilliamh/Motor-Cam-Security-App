import {IncidentMetadata, SavedIncidentCase} from '../types';

const CURRENT_DRAFT_KEY = 'motoguard_active_draft_v1';
const SAVED_CASES_KEY = 'motoguard_saved_cases_v1';
const UI_PREFS_KEY = 'motoguard_ui_prefs_v1';

export interface UIPreferences {
  language: 'id' | 'en';
  darkMode: boolean;
  eyeComfortSpectrum: boolean;
  fontFamily: 'jakarta' | 'public' | 'lexend' | 'hyperlegible';
  reporterEmail: string;
}

export function loadUIPreferences(): UIPreferences {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore storage errors
  }
  return {
    language: 'id',
    darkMode: false,
    eyeComfortSpectrum: true,
    fontFamily: 'jakarta',
    reporterEmail: '',
  };
}

export function saveUIPreferences(prefs: UIPreferences): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

export function loadActiveDraftMetadata(): IncidentMetadata {
  try {
    const raw = localStorage.getItem(CURRENT_DRAFT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localIso = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);

  return {
    dateTime: localIso,
    location: 'RT 04 / RW 07, Jl. Melati Raya No. 12',
    motorcycleMakeModel: 'Honda Vario 160 CBS',
    motorcycleColor: 'Hitam Doff (Matte Black)',
    plateNumber: 'B 4821 KXZ',
    reporterNotes: '',
    uuPdpConsentChecked: false,
    reporterEmail: '',
  };
}

export function saveActiveDraftMetadata(meta: IncidentMetadata): void {
  try {
    localStorage.setItem(CURRENT_DRAFT_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function loadSavedIncidentCases(): SavedIncidentCase[] {
  try {
    const raw = localStorage.getItem(SAVED_CASES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return [];
}

export function upsertSavedIncidentCase(incidentCase: SavedIncidentCase): SavedIncidentCase[] {
  try {
    const existing = loadSavedIncidentCases();
    const idx = existing.findIndex((c) => c.id === incidentCase.id);
    let updated: SavedIncidentCase[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = incidentCase;
    } else {
      updated = [incidentCase, ...existing].slice(0, 15);
    }
    localStorage.setItem(SAVED_CASES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteSavedIncidentCase(id: string): SavedIncidentCase[] {
  try {
    const existing = loadSavedIncidentCases().filter((c) => c.id !== id);
    localStorage.setItem(SAVED_CASES_KEY, JSON.stringify(existing));
    return existing;
  } catch {
    return [];
  }
}
