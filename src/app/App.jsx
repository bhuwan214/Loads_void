import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import "./App.css";
import { Selector } from "./selector";

function App() {

  const API = "http://localhost:3000";

  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

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

      // Select first available format
      if (data.formats?.length > 0) {
        setSelectedFormat(String(data.formats[0].format_id));
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
          type: "video",
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
        <h2 className="text-3xl custom-font pt-9 font-bold mb-5 text-center">
          Welcome to the Loader app
        </h2>

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
    </div>
  );
}

export default App;
