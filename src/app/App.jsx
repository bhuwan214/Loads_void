import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import "./App.css";
import { Selector } from "./selector";
import { SettingsDialog } from "./SettingsDialog";
import { getSettings } from "./settingsStore";

function App() {

  const API = "http://localhost:3000";

  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(getSettings());

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
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch video information.");
      }

      setVideoInfo(data);

      // Try to select the saved default mode/quality
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
      setError(err.message || "Something went wrong.");
    } finally {
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
          type: settings.downloadType, // Use setting: "video" or "audio"
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Download could not be started.");
      }

      const jobId = data.jobId;

      await monitorDownload(jobId);
    } catch (err) {
      setError(err.message || "Download failed.");
      setDownloading(false);
    }
  };

  // --------------------------------
  // Monitor download progress
  // --------------------------------
  const monitorDownload = async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API}/api/status/${jobId}`);

        if (!response.ok) {
          throw new Error("Unable to check download status.");
        }

        const data = await response.json();

        setProgress(data.progress || 0);

        if (data.status === "completed") {
          clearInterval(interval);

          setDownloading(false);

          // Automatically download the completed file
          const link = document.createElement("a");
          link.href = `${API}/api/file/${jobId}`;
          link.download = data.filename || "video.mp4";

          document.body.appendChild(link);
          link.click();
          link.remove();

          return;
        }

        if (data.status === "error") {
          clearInterval(interval);

          setDownloading(false);

          setError(data.error || "Download failed.");
        }
      } catch (err) {
        clearInterval(interval);

        setDownloading(false);
        setError(err.message || "Unable to monitor download.");
      }
    }, 1000);
  };

  return (
    <div className="app-body">
      <div className="main_box w-full flex flex-col justify-center items-center">
        {/* Header with Title and Settings Button */}
        <div className="w-full flex justify-between items-center px-5 pt-6">
          <h2 className="text-3xl custom-font font-bold text-center flex-1">
            Welcome to the Loader app
          </h2>
          
          {/* Settings Button */}
          <button
            onClick={() => {
              setSettings(getSettings());
              setSettingsOpen(true);
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-200 transition-colors"
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
        </div>

        <div
          className="container-box
            w-[90vw]
            sm:w-[80vw]
            max-w-5xl
            pt-10
            px-5
            h-[85vh]
            flex-col
            sm:gap-8
            gap-6
            pb-20
            flex
            border-gray-700
            border
            sm:items-center
            box-border
          "
        >
          {/* URL */}
          <div
            className="
              UrlContainer
              flex
              flex-col
              sm:flex-row
              gap-4
              items-center
              sm:gap-5
              justify-center
              sm:w-[50%]
            "
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFetch();
                }
              }}
              placeholder="Insert URL here"
              className="
                h-10
                p-2
                w-full
                border
                border-gray-700
                sm:w-150
                focus:outline-2
                focus:border-gray-500
              "
              disabled={loading || downloading}
            />
            
            <button
              onClick={handleFetch}
              disabled={loading || downloading}
              className=" bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 h-10 w-[95%] sm:w-30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Fetching...": "Fetch"}

            </button>
          </div>

          <Selector 
          formats= { videoInfo?.formats || []}
          value={selectedFormat}
          onChange= {setSelectedFormat}
          disabled={!videoInfo || downloading}
          mode={settings.downloadType}
          />

          <div className="flex w-full justify-center">
            <Card className="preview-card secondary-color w-full max-w-100 rounded-none bg-amber-500 overflow-hidden">
              <CardContent className="h-full w-full p-0">
                {videoInfo?.thumbnail ? (
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video Thumbnail"
                    className="preview-image"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                    <h3 className="mb-2 text-lg font-bold">Preview</h3>
                    <p className="text-sm text-gray-600">
                      {videoInfo
                        ? videoInfo.title
                        : "Video preview will be displayed here."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>


             {/* Progress */}
          {downloading && (
            <div className="w-[95%] sm:w-[50%]">
              <div className="w-full bg-gray-300 h-3">
                <div
                  className="bg-gray-950 h-3 transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="text-sm mt-2 text-center">
                Downloading {progress}%
              </p>
            </div>
          )}

             {/* Error */}
          {error && (
            <p className="text-red-600 text-sm text-center">
              {error}
            </p>
          )}

          <button
          onClick={handleDownload}
          disabled={!videoInfo || downloading}
            className="ml-2 bg-gray-950 hover:bg-gray-900 rounded-none text-white font-bold py-2 px-4 w-[95%] sm:w-[50%]
         h-10"
          >
           {downloading ?"Downloading": "Download"}
          </button>
        </div>
      </div>

      {/* Settings Dialog */}
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
