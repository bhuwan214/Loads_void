import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALLOWED_QUALITIES = ["240p", "480p", "720p", "1080p"];

export function Selector({
  formats = [],
  value,
  onChange,
  disabled,
  mode = "video",
}) {
  const filteredFormats =
    mode === "audio"
      ? formats.filter((format) => format.kind === "audio" || (!format.hasVideo && format.hasAudio))
      : formats.filter((format) => {
          const height = format.height;
          if (!height) return false;

          const quality = `${height}p`;
          return ALLOWED_QUALITIES.includes(quality);
        });

  const sortedFormats =
    mode === "audio"
      ? [...filteredFormats]
      : [...filteredFormats].sort((a, b) => {
          const aHeight = a.height || 0;
          const bHeight = b.height || 0;
          return aHeight - bHeight;
        });

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full rounded-none">
        <SelectValue placeholder={mode === "audio" ? "Select audio format" : "Select quality"} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{mode === "audio" ? "Audio Formats" : "Select Quality"}</SelectLabel>
          {sortedFormats.length === 0 ? (
            <SelectItem value="no-quality" disabled>
              {mode === "audio" ? "No audio format available" : "No quality available"}
            </SelectItem>
          ) : (
            sortedFormats.map((format) => {
              const label =
                mode === "audio"
                  ? `${format.ext || "audio"}${format.acodec ? ` - ${format.acodec}` : ""}`
                  : `${format.height}p`;

              return (
                <SelectItem key={format.format_id} value={format.format_id}>
                  {label}
                  {mode === "video" && format.ext ? ` - ${format.ext}` : ""}
                  {format.filesize ? ` - ${Math.round(format.filesize / 1024 / 1024)} MB` : ""}
                </SelectItem>
              );
            })
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}