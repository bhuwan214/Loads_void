import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import "./App.css";
import { Selector } from "./selector";
import { SettingsDialog } from "./SettingsDialog";
import { getSettings } from "./settingsStore";

const API = "http://localhost:3000";
const SLOW_LOAD_MS = 450;

function PreviewSkeleton() {
  return (
    <div className="preview-skeleton skeleton-pulse" aria-hidden="true">
      <div className="preview-skeleton-thumb" />
      <div className="preview-skeleton-line" />
      <div className="preview-skeleton-line short" />
    </div>
  );
}

function App() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [showFetchSkeleton, setShowFetchSkeleton] = useState(false);
  const [showDownloadSkeleton, setShowDownloadSkeleton] = useState(false);

  const fetchAbortRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const activeJobIdRef = useRef(null);

  useEffect(() => {
    if (!loading) {
      setShowFetchSkeleton(false);
      return;
    }

    const timer = setTimeout(() => setShowFetchSkeleton(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!downloading) {
      setShowDownloadSkeleton(false);
      return;
    }

    const timer = setTimeout(() => setShowDownloadSkeleton(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [downloading]);

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopDownloadPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleCancelFetch = () => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    setLoading(false);
    setShowFetchSkeleton(false);
  };

  const handleCancelDownload = async () => {
    stopDownloadPolling();

    const jobId = activeJobIdRef.current;
    activeJobIdRef.current = null;

    if (jobId) {
      try {
        await fetch(`${API}/api/cancel/${jobId}`, { method: "POST" });
      } catch {
        // Best-effort cancel; UI still resets locally.
      }
    }

    setDownloading(false);
    setProgress(0);
    setShowDownloadSkeleton(false);
  };

  // --------------------------------
  // Fetch video information
  // --------------------------------
  const handleFetch = async () => {
    setError("");
    setVideoInfo(null);
    setSelectedFormat("");

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch video information.");
      }

      setVideoInfo(data);

      if (data.formats?.length > 0) {
        if (settings.downloadType === "audio") {
          const audioFormat = data.formats.find(
            (f) => f.kind === "audio" || (!f.hasVideo && f.hasAudio)
          );

          setSelectedFormat(
            String(audioFormat?.format_id || data.formats[0].format_id)
          );
        } else {
          const qualityHeight = parseInt(settings.defaultQuality, 10);

          const matchingFormat = data.formats.find(
            (f) => f.height === qualityHeight && (f.kind === "video" || f.hasVideo)
          );

          setSelectedFormat(
            String(matchingFormat?.format_id || data.formats[0].format_id)
          );
        }
      } else {
        setSelectedFormat("");
        setError("No video qualities were found for this URL.");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      setError(err.message || "Something went wrong.");
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
      setLoading(false);
    }
  };

  // --------------------------------
  // Download video
  // --------------------------------

  const handleDownload = async () => {
    setError("");
    setProgress(0);

    if (!videoInfo) {
      setError("Fetch a video first.");
      return;
    }

    if (!selectedFormat) {
      setError("Please select a format.");
      return;
    }

    setDownloading(true);

    try {
      const response = await fetch(`${API}/api/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          formatId: selectedFormat,
          type: settings.downloadType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Download could not be started.");
      }

      activeJobIdRef.current = data.jobId;
      monitorDownload(data.jobId);
    } catch (err) {
      setError(err.message || "Download failed.");
      setDownloading(false);
      activeJobIdRef.current = null;
    }
  };

  // --------------------------------
  // Monitor download progress
  // --------------------------------
  const monitorDownload = (jobId) => {
    stopDownloadPolling();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API}/api/status/${jobId}`);

        if (!response.ok) {
          throw new Error("Unable to check download status.");
        }

        const data = await response.json();

        setProgress(data.progress || 0);

        if (data.status === "completed") {
          stopDownloadPolling();
          activeJobIdRef.current = null;
          setDownloading(false);

          const link = document.createElement("a");
          link.href = `${API}/api/file/${jobId}`;
          link.download = data.filename || "video.mp4";

          document.body.appendChild(link);
          link.click();
          link.remove();

          return;
        }

        if (data.status === "cancelled") {
          stopDownloadPolling();
          activeJobIdRef.current = null;
          setDownloading(false);
          setProgress(0);
          return;
        }

        if (data.status === "error") {
          stopDownloadPolling();
          activeJobIdRef.current = null;
          setDownloading(false);
          setError(data.error || "Download failed.");
        }
      } catch (err) {
        stopDownloadPolling();
        activeJobIdRef.current = null;
        setDownloading(false);
        setError(err.message || "Unable to monitor download.");
      }
    }, 1000);
  };

  const previewBusy = loading || (downloading && showDownloadSkeleton);

  return (
    <div className="app-body">
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-main">
            <h2 className="app-title custom-font font-bold">
              Welcome to the Loader app
            </h2>
            <p className="app-tagline">
              A solution to download from multiple websites in one go—paste a
              link, pick your format, and save video or audio locally.
            </p>
          </div>

          <button
            onClick={() => {
              setSettings(getSettings());
              setSettingsOpen(true);
            }}
            className="settings-btn flex shrink-0 items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-200 transition-colors"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </header>

        <div className="container-box">
          <div className="form-row flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !downloading) {
                  handleFetch();
                }
              }}
              placeholder="Insert URL here"
              className="h-10 min-w-0 flex-1 p-2 w-full border border-gray-700 focus:outline-2 focus:border-gray-500"
              disabled={loading || downloading}
            />

            {loading ? (
              <button
                type="button"
                onClick={handleCancelFetch}
                className="bg-red-700 hover:bg-red-800 rounded-none text-white font-bold py-2 px-4 h-10 w-full sm:w-28 shrink-0"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleFetch}
                disabled={downloading}
                className="bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 h-10 w-full sm:w-28 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fetch
              </button>
            )}
          </div>

          <div className="form-row">
            <Selector
              formats={videoInfo?.formats || []}
              value={selectedFormat}
              onChange={setSelectedFormat}
              disabled={!videoInfo || downloading || loading}
              mode={settings.downloadType}
            />
          </div>

          <div className="preview-section">
            <Card className="preview-card secondary-color rounded-none bg-amber-500 overflow-hidden">
              <CardContent className="h-full w-full p-0">
                {loading && showFetchSkeleton ? (
                  <PreviewSkeleton />
                ) : previewBusy && !videoInfo?.thumbnail ? (
                  <PreviewSkeleton />
                ) : videoInfo?.thumbnail ? (
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video Thumbnail"
                    className="preview-image"
                  />
                ) : (
                  <div className="preview-placeholder">
                    <h3 className="font-bold">Preview</h3>
                    <p className="text-gray-600">
                      {videoInfo
                        ? videoInfo.title
                        : "Video preview will be displayed here."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {downloading && (
            <div className="form-row">
              {showDownloadSkeleton && progress === 0 ? (
                <div className="progress-skeleton skeleton-pulse" aria-hidden="true" />
              ) : (
                <div className="w-full bg-gray-300 h-3">
                  <div
                    className="bg-gray-950 h-3 transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              )}

              <p className="text-sm mt-2 text-center">
                {showDownloadSkeleton && progress === 0
                  ? "Starting download…"
                  : `Downloading ${progress}%`}
              </p>
            </div>
          )}

          {error && (
            <p className="form-row text-red-600 text-sm text-center">{error}</p>
          )}

          <div className="action-row flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!videoInfo || downloading || loading}
              className="flex-1 bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 h-10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? "Downloading" : "Download"}
            </button>

            {downloading && (
              <button
                type="button"
                onClick={handleCancelDownload}
                className="bg-red-700 hover:bg-red-800 rounded-none text-white font-bold py-2 px-4 h-10 shrink-0"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => {
          setSettings(getSettings());
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

export default App;
