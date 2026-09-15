// Settings storage in localStorage
const SETTINGS_KEY = "loaderAppSettings";

const DEFAULT_SETTINGS = {
  defaultQuality: "720p",
  defaultDownloadPath: "",
  downloadType: "video", // "video" or "audio"
};

export function getSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error reading settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

export function updateSettings(updates) {
  const current = getSettings();
  const updated = { ...current, ...updates };
  return saveSettings(updated);
}
