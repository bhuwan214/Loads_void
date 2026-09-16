const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

dotenv.config();

const app =express();

const PORT= Number(process.env.PORT) || 3000;

const YT_DLP_PATH = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

function resolveFfmpegLocation() {
  const configured = process.env.FFMPEG_LOCATION;

  if (configured && fs.existsSync(configured)) {
    const stat = fs.statSync(configured);
    return stat.isDirectory() ? configured : path.dirname(configured);
  }

  const ffmpegCommand = FFMPEG_PATH;

  try {
    const result = spawnSync(
      process.platform === "win32" ? "where" : "which",
      [ffmpegCommand],
      {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
      }
    );

    if (result.status === 0 && result.stdout) {
      const firstMatch = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

      if (firstMatch) {
        return path.dirname(firstMatch);
      }
    }
  } catch (error) {
    console.warn("Unable to auto-detect ffmpeg location:", error.message);
  }

  // Fall back to PATH lookup by not passing --ffmpeg-location.
  return null;
}

const FFMPEG_LOCATION = resolveFfmpegLocation();

const MAX_CONCURRENT_FRAGMENTS =
  Number(process.env.MAX_CONCURRENT_FRAGMENTS) || 16;

const MAX_DOWNLOADS_PER_IP =
  Number(process.env.MAX_DOWNLOADS_PER_IP) || 2;

const DOWNLOAD_DIR = path.join(__dirname, "downloads");

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });


// Middleware

app.use(cors({
    origin:true,
}));

app.use(express.json({
    limit:"10kb"
}));

// Storage 

const jobs = new Map();

app.disable("x-powered-by"); // security header

// validation

function validateUrl(value){
    if(typeof value !== "string"){
        return false;
    }

    if(value.length> 2048){
        return false;
    }
     try{
        const parsed = new URL(value);

        if(
            parsed.protocol !=="http:" && 
            parsed.protocol !== "https:"
        ){
            return false;
        }
        return true;
     } catch{
        return false;
     }
}

function createJobId(){
    return crypto.randomBytes(16).toString("hex");
}

function getClientIp(req){
    return(
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress || "unknown "
    )
}

function activeDownloadsFromIp(ip) {
  let count = 0;

  for (const job of jobs.values()) {
    if (
      job.ip === ip &&
      (job.status === "starting" ||
        job.status === "downloading")
    ) {
      count++;
    }
  }

  return count;
}

function parseProgress(line){

    const match = line.match(
         /\[download\]\s+([\d.]+)%.*?at\s+(.+?)\s+ETA\s+(.+)/

    );

    if(!match){
        return null;
    }
    return{
        progress:Number(match[1]),
        speed: match[2].trim(),
        eta: match[3].trim(),
    };
}

// Find downloaded file

function findDownloadedFile(jobDir, type = "video"){
    if(!fs.existsSync(jobDir)){
        return null;
    }

    const files = fs.readdirSync(jobDir);

    const validFiles =files.filter((file)=>{
        return(
            !file.startsWith(".") &&
            !file.endsWith(".part") &&
            !file.endsWith(".ytdl")
        );
    });

    if(validFiles.length === 0){
        return null;
    }

    // Prefer the actual media file produced for the selected mode.
    const preferredAudioExts = [".mp3", ".m4a", ".aac", ".opus", ".ogg", ".flac", ".wav", ".webm"];
    const preferredVideoExts = [".mp4", ".mkv", ".webm", ".mov", ".avi"];

    const preferredExts = type === "audio"
      ? preferredAudioExts
      : preferredVideoExts;

    for (const ext of preferredExts) {
      const match = validFiles.find((file) =>
        file.toLowerCase().endsWith(ext)
      );

      if (match) {
        return path.join(jobDir, match);
      }
    }

    return path.join(jobDir, validFiles[0]);
}



async function getFormats(url) {
  return new Promise((resolve, reject) => {
    const platformArgs = getPlatformArgs(url);
    const args = [
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      "--skip-download",
      ...platformArgs,
      url,
    ];

    const process = spawn(YT_DLP_PATH, args, {
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || "yt-dlp failed to retrieve information."
          )
        );

        return;
      }

      try {
        const info = JSON.parse(stdout);

        resolve(info);
      } catch {
        reject(
          new Error("Unable to parse yt-dlp response.")
        );
      }
    });
  });
}



app.post("/api/info", async (req, res) => {
  try {
    const { url } = req.body;

    // Validate URL
    if (!validateUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL.",
      });
    }

    const info = await getFormats(url);
    console.log(info);

    const formats = (info.formats || [])
      .filter((format) => {
        // Some sources omit vcodec for otherwise valid video entries,
        // especially on adaptive stream formats. Keep entries that still
        // expose a height/width or a video codec, and also keep audio-only
        // formats so audio downloads can be selected correctly.
        const hasVideoCodec =
          typeof format.vcodec === "string" &&
          format.vcodec !== "none";

        const hasVideoDimensions =
          typeof format.height === "number" ||
          typeof format.width === "number";

        const hasAudioCodec =
          typeof format.acodec === "string" &&
          format.acodec !== "none";

        return hasVideoCodec || hasVideoDimensions || hasAudioCodec;
      })
      .map((format) => {
        const hasVideo =
          (typeof format.vcodec === "string" && format.vcodec !== "none") ||
          typeof format.height === "number" ||
          typeof format.width === "number";

        const hasAudio =
          typeof format.acodec === "string" &&
          format.acodec !== "none";

        return {
          format_id: String(format.format_id),

          ext: format.ext,

          height: format.height || null,

          width: format.width || null,

          fps: format.fps || null,

          filesize: format.filesize || format.filesize_approx || null,

          vcodec: format.vcodec,

          acodec: format.acodec || null,

          hasAudio,

          hasVideo,

          kind: hasVideo ? "video" : "audio",
        };
      })
      // Remove duplicate resolutions
      .filter(
        (format, index, array) =>
          index ===
          array.findIndex(
            (item) =>
              item.format_id === format.format_id
          )
      );

    return res.json({
      title: info.title || "Unknown",
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      uploader: info.uploader || null,
      formats,
    });
  } catch (error) {
    console.error("INFO ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve video information.",
    });
  }
});


app.post("/api/download", async (req, res) => {
  try {
    const { url, formatId, type = "video" } = req.body;

    const ip = getClientIp(req);

    // ---------------------------------------------
    // Validate URL
    // ---------------------------------------------

    if (!validateUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL.",
      });
    }

    // ---------------------------------------------
    // Validate type
    // ---------------------------------------------

    if (type !== "video" && type !== "audio") {
      return res.status(400).json({
        error: "Invalid download type.",
      });
    }

    // ---------------------------------------------
    // Validate format ID
    // ---------------------------------------------

    if (
      typeof formatId !== "string" ||
      formatId.length > 50
    ) {
      return res.status(400).json({
        error: "Invalid format.",
      });
    }

    // Only allow simple format IDs.
    //
    // This prevents someone from submitting:
    //
    // bestvideo+bestaudio
    //
    // or arbitrary yt-dlp expressions.
    //
    if (!/^[A-Za-z0-9._+-]+$/.test(formatId)) {
      return res.status(400).json({
        error: "Invalid format ID.",
      });
    }

    // ---------------------------------------------
    // Rate / concurrency protection
    // ---------------------------------------------

    if (
      activeDownloadsFromIp(ip) >=
      MAX_DOWNLOADS_PER_IP
    ) {
      return res.status(429).json({
        error:
          "Too many active downloads from this IP.",
      });
    }

    // ---------------------------------------------
    // Verify format exists
    // ---------------------------------------------

    const info = await getFormats(url);
    const allowedFormatIds = new Set(
      (info.formats || []).map((item) => String(item.format_id))
    );

    if (!allowedFormatIds.has(String(formatId))) {
      return res.status(400).json({
        error: "Requested format is not available.",
      });
    }

    const format = (info.formats || []).find(
      (item) =>
        String(item.format_id) ===
        String(formatId)
    );

    if (!format) {
      return res.status(400).json({
        error: "Requested format is not available.",
      });
    }

    // ---------------------------------------------
    // Create job
    // ---------------------------------------------

    const jobId = createJobId();

    const jobDir = path.join(
      DOWNLOAD_DIR,
      jobId
    );

    fs.mkdirSync(jobDir, {
      recursive: true,
    });

    jobs.set(jobId, {
      id: jobId,

      ip,

      type,

      status: "starting",

      progress: 0,

      speed: null,

      eta: null,

      filename: null,

      error: null,

      createdAt: Date.now(),

      jobDir,
    });

    // ---------------------------------------------
    // Start download
    // ---------------------------------------------

    const selectedHasVideo =
      (typeof format.vcodec === "string" && format.vcodec !== "none") ||
      typeof format.height === "number" ||
      typeof format.width === "number";

    downloadMedia({
      jobId,
      url,
      formatId,
      type,
      selectedHasVideo,
      hasAudio:
        format.acodec &&
        format.acodec !== "none",
    });

    return res.status(202).json({
      jobId,
    });
  } catch (error) {
    console.error("DOWNLOAD START ERROR:", error);

    return res.status(500).json({
      error:
        "Unable to start the download.",
    });
  }
});


// Download workers

function downloadMedia({
  jobId,
  url,
  formatId,
  type,
  hasAudio,
  selectedHasVideo = true,
}) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  const platform = detectPlatform(url);
  const platformArgs = getPlatformArgs(url);

  if (platform !== "generic") {
    console.log(`[${jobId}] Detected platform: ${platform}`);
  }

  const args = [
    "--no-playlist",

    "--newline",

    "--no-warnings",

    "--restrict-filenames",

    "-N",
    String(MAX_CONCURRENT_FRAGMENTS),

    ...platformArgs,

    "-P",
    job.jobDir,

    "-o",
    "%(title).200s [%(id)s].%(ext)s",
  ];

  if (FFMPEG_LOCATION) {
    args.push(
      "--ffmpeg-location",
      FFMPEG_LOCATION
    );
  }

  // ------------------------------------------------
  // VIDEO
  // ------------------------------------------------

  if (type === "video") {
    if (selectedHasVideo && hasAudio) {
      /*
        The selected format already contains audio.

        Example:

        -f 1648
      */

      args.push(
        "-f",
        formatId
      );
    } else if (selectedHasVideo) {
      /*
        Selected format is video-only.

        We need audio too.
      */

      args.push(
        "-f",
        `${formatId}+bestaudio/best`
      );

      args.push(
        "--merge-output-format",
        "mp4"
      );
    } else {
      /*
        Instagram/TikTok often expose audio-only entries as the only
        downloadable stream. For video mode, fall back to a true
        video+audio selection instead of downloading an mp4a track.
      */
      args.push(
        "-f",
        "bestvideo+bestaudio/best"
      );

      args.push(
        "--merge-output-format",
        "mp4"
      );
    }
  }

  // ------------------------------------------------
  // AUDIO
  // ------------------------------------------------

  if (type === "audio") {
    args.push(
      "-f",
      hasAudio ? formatId : "bestaudio/best"
    );

    args.push(
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0"
    );
  }

  // ------------------------------------------------
  // Start yt-dlp
  // ------------------------------------------------

  args.push(url);

  console.log(
    `[${jobId}] Starting yt-dlp`
  );

  const process = spawn(
    YT_DLP_PATH,
    args,
    {
      shell: false,
      windowsHide: true,
    }
  );

  job.status = "downloading";

  let stderrOutput = "";

  // ------------------------------------------------
  // stdout
  // ------------------------------------------------

  process.stdout.on("data", (data) => {
    const lines = data
      .toString()
      .split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      console.log(`[${jobId}] ${line}`);

      const progress =
        parseProgress(line);

      if (progress) {
        job.progress =
          progress.progress;

        job.speed =
          progress.speed;

        job.eta =
          progress.eta;
      }
    }
  });

  // ------------------------------------------------
  // stderr
  // ------------------------------------------------

  process.stderr.on("data", (data) => {
    const text = data.toString();

    stderrOutput += text;

    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const progress =
        parseProgress(line);

      if (progress) {
        job.progress =
          progress.progress;

        job.speed =
          progress.speed;

        job.eta =
          progress.eta;
      }
    }
  });

  // ------------------------------------------------
  // Process error
  // ------------------------------------------------

  process.on("error", (error) => {
    console.error(
      `[${jobId}] Process error:`,
      error.message
    );

    job.status = "error";

    job.error =
      "Unable to start yt-dlp.";

    cleanupJobLater(jobId);
  });

  // ------------------------------------------------
  // Process finished
  // ------------------------------------------------

  process.on("close", (code) => {
    console.log(
      `[${jobId}] yt-dlp exited with code ${code}`
    );

    if (code !== 0) {
      job.status = "error";

      job.error =
        "Download failed.";

      console.error(
        `[${jobId}]`,
        stderrOutput
      );

      cleanupJobLater(jobId);

      return;
    }

    const downloadedFile =
      findDownloadedFile(
        job.jobDir,
        job.type
      );

    if (!downloadedFile) {
      job.status = "error";

      job.error =
        "Download completed but the file could not be found.";

      cleanupJobLater(jobId);

      return;
    }

    job.status = "completed";

    job.progress = 100;

    job.filename =
      path.basename(
        downloadedFile
      );

    job.filePath =
      downloadedFile;

    console.log(
      `[${jobId}] Completed: ${job.filename}`
    );

    // Keep completed job for 1 hour
    setTimeout(() => {
      cleanupJob(jobId);
    }, 60 * 60 * 1000);
  });
}


app.get(
  "/api/status/:jobId",
  (req, res) => {
    const { jobId } = req.params;

    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found.",
      });
    }

    return res.json({
      status: job.status,

      progress: job.progress,

      speed: job.speed,

      eta: job.eta,

      filename:
        job.status === "completed"
          ? job.filename
          : null,

      error:
        job.status === "error"
          ? job.error
          : null,
    });
  }
);

// ----------------------------------------------------
// API: download completed file
// Supports HTTP range requests for faster seeking
// ----------------------------------------------------

app.get(
  "/api/file/:jobId",
  (req, res) => {
    const { jobId } = req.params;

    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found.",
      });
    }

    if (job.status !== "completed") {
      return res.status(409).json({
        error:
          "The download is not completed yet.",
      });
    }

    if (
      !job.filePath ||
      !fs.existsSync(job.filePath)
    ) {
      return res.status(404).json({
        error: "File no longer exists.",
      });
    }

    // Make sure file is inside job directory.
    const resolvedFile =
      path.resolve(job.filePath);

    const resolvedJobDir =
      path.resolve(job.jobDir) +
      path.sep;

    if (
      !resolvedFile.startsWith(
        resolvedJobDir
      )
    ) {
      return res.status(403).json({
        error: "Invalid file.",
      });
    }

    const stat = fs.statSync(resolvedFile);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set common headers first
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`);
    res.setHeader("Cache-Control", "public, max-age=86400");

    // Handle range requests for seeking/skipping
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return res.status(416).json({
          error: "Invalid range request.",
        });
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);

      const stream = fs.createReadStream(resolvedFile, { start, end });
      
      stream.on("error", (error) => {
        console.error(`[${jobId}] Stream error:`, error.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Stream error." });
        }
      });

      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);

      const stream = fs.createReadStream(resolvedFile);
      
      stream.on("error", (error) => {
        console.error(`[${jobId}] Stream error:`, error.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Stream error." });
        }
      });

      stream.pipe(res);
    }
  }
);

// ----------------------------------------------------
// Health check
// ----------------------------------------------------

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
    });
  }
);

// ----------------------------------------------------
// Cleanup
// ----------------------------------------------------

function cleanupJob(jobId) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  try {
    if (
      job.jobDir &&
      fs.existsSync(job.jobDir)
    ) {
      fs.rmSync(
        job.jobDir,
        {
          recursive: true,
          force: true,
        }
      );
    }
  } catch (error) {
    console.error(
      "Cleanup error:",
      error.message
    );
  }

  jobs.delete(jobId);
}

function cleanupJobLater(jobId) {
  setTimeout(() => {
    cleanupJob(jobId);
  }, 10 * 60 * 1000);
}

// ----------------------------------------------------
// Global error handler
// ----------------------------------------------------

app.use(
  (err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      error: "Internal server error.",
    });
  }
);




app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );

  console.log(
    `yt-dlp: ${YT_DLP_PATH}`
  );

  console.log(
    `FFmpeg: ${FFMPEG_PATH}`
  );

  if (FFMPEG_LOCATION) {
    console.log(
      `FFmpeg location: ${FFMPEG_LOCATION}`
    );
  } else {
    console.log(
      "FFmpeg location: using PATH lookup"
    );
  }
});


function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();

    if (hostname.includes("instagram.com")) {
      return "instagram";
    }

    if (hostname.includes("tiktok.com")) {
      return "tiktok";
    }

    return "generic";
  } catch {
    return "generic";
  }
}

function getPlatformArgs(url) {
  const platform = detectPlatform(url);
  const args = [];

  if (platform === "instagram") {
    args.push(
      "--add-header",
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    );
    args.push(
      "--add-header",
      "Referer: https://www.instagram.com/"
    );
  }

  if (platform === "tiktok") {
    args.push(
      "--add-header",
      "Referer: https://www.tiktok.com/"
    );
  }

  return args;
}