import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const items = [
  { label: "Select desired quality", value:null },
  { label: "1080p", value: "21", default: true },
  { label: "720p", value: "18" },
  { label: "480p", value: "15" },
  { label: "240p", value: "12" },

]

export function Selector() {
  return (
    <Select items={items}>
      <SelectTrigger className="w-full max-w-48 rounded-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Select Quality</SelectLabel>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
