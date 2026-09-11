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
//   { label: "Select desired quality", value:null },
  { label: "1080", value: "21" },
  { label: "720", value: "18" },
  { label: "480", value: "15" },
  { label: "240", value: "12" },

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
