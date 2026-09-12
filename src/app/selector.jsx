import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function Selector({
  formats = [],
  value,
  onChange,
  disabled,
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-50 sm:ml-0 ml-3 rounded-none">
        <SelectValue placeholder="Select quality" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Select Quality</SelectLabel>
          {formats.length === 0 ? (
            <SelectItem value="no-quality" disabled>
              No quality available
            </SelectItem>
          ) : (
            formats.map((format) => {
              const label =
                format.height || format.resolution
                  ? `${format.height || format.resolution}p`
                  : format.format_id;

              return (
                <SelectItem key={format.format_id} value={format.format_id}>
                  {label}
                  {" - "}
                  {format.ext}
                  {format.filesize
                    ? ` - ${Math.round(format.filesize / 1024 / 1024)} MB`
                    : ""}
                </SelectItem>
              );
            })
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}