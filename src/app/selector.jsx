import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALLOWED_QUALITY_BUCKETS = [240, 480, 720, 1080];

function formatSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  if (mb >= 10) {
    return `${Math.round(mb)} MB`;
  }
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

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
      : formats.filter(
          (format) =>
            format.hasVideo &&
            ALLOWED_QUALITY_BUCKETS.includes(format.qualityBucket)
        );

  const sortedFormats =
    mode === "audio"
      ? [...filteredFormats]
      : [...filteredFormats].sort((a, b) => {
          const aBucket = a.qualityBucket || 0;
          const bBucket = b.qualityBucket || 0;

          if (aBucket !== bBucket) {
            return aBucket - bBucket;
          }

          return (b.filesize || 0) - (a.filesize || 0);
        });

  const selectedFormatObj = sortedFormats.find((f) => String(f.format_id) === String(value));
  let selectedDisplayLabel;
  if (selectedFormatObj) {
    const qualityText = selectedFormatObj.qualityLabel || (selectedFormatObj.height ? `${selectedFormatObj.height}p` : "");
    const extText = selectedFormatObj.ext ? ` (${selectedFormatObj.ext.toUpperCase()})` : "";
    const sizeStr = formatSize(selectedFormatObj.filesize);
    const sizeText = sizeStr ? ` - ${sizeStr}` : "";

    selectedDisplayLabel =
      mode === "audio"
        ? `${selectedFormatObj.ext ? selectedFormatObj.ext.toUpperCase() : "AUDIO"}${selectedFormatObj.acodec ? ` (${selectedFormatObj.acodec})` : ""}${sizeText}`
        : `${qualityText}${extText}${sizeText}`;
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full rounded-none">
        <SelectValue placeholder={mode === "audio" ? "Select audio format" : "Select quality"}>
          {selectedDisplayLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{mode === "audio" ? "Audio Formats" : "Select Quality"}</SelectLabel>
          {sortedFormats.length === 0 ? (
            <SelectItem value="no-quality" disabled>
              {mode === "audio" ? "No audio format available" : "No quality available"}
            </SelectItem>
          ) : (
            sortedFormats.map((format, index, list) => {
              const sameQualityCount = list.filter(
                (item) => item.qualityBucket === format.qualityBucket
              ).length;
              const sameQualityIndex = list
                .filter((item) => item.qualityBucket === format.qualityBucket)
                .indexOf(format);

              const qualityText = format.qualityLabel || `${format.height}p`;
              const extText = format.ext ? ` (${format.ext.toUpperCase()})` : "";
              const sizeStr = formatSize(format.filesize);
              const sizeText = sizeStr ? ` - ${sizeStr}` : "";

              const variantHint =
                mode === "video" && sameQualityCount > 1
                  ? sameQualityIndex === 0
                    ? " (recommended)"
                    : " (alternate)"
                  : "";

              const label =
                mode === "audio"
                  ? `${format.ext ? format.ext.toUpperCase() : "AUDIO"}${format.acodec ? ` (${format.acodec})` : ""}${sizeText}`
                  : `${qualityText}${extText}${sizeText}${variantHint}`;

              return (
                <SelectItem key={format.format_id} value={format.format_id}>
                  {label}
                </SelectItem>
              );
            })
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}