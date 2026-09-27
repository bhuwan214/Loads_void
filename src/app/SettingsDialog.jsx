import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getSettings, updateSettings } from "./settingsStore";

const QUALITY_OPTIONS = ["240p", "480p", "720p", "1080p"];
const DOWNLOAD_TYPES = [
  { value: "video", label: "Video + Audio" },
  { value: "audio", label: "Audio Only (MP3)" },
];

export function SettingsDialog({ isOpen, onClose }) {
  const [settings, setSettings] = useState(getSettings());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
  }, [isOpen]);

  const handleQualityChange = (value) => {
    setSettings((prev) => ({ ...prev, defaultQuality: value }));
    setHasChanges(true);
  };

  const handleTypeChange = (value) => {
    setSettings((prev) => ({ ...prev, downloadType: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings(settings);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    setSettings(getSettings());
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white rounded-lg border border-gray-300 shadow-lg">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-xl font-bold text-gray-900">
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Default Quality */}
          <div className="space-y-3">
            <Label htmlFor="quality" className="text-sm font-semibold text-gray-700">
              Default Quality
            </Label>
            <Select
              value={settings.defaultQuality}
              onValueChange={handleQualityChange}
            >
              <SelectTrigger id="quality" className="rounded-md border border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Quality</SelectLabel>
                  {QUALITY_OPTIONS.map((quality) => (
                    <SelectItem key={quality} value={quality}>
                      {quality}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Select the default video quality for downloads
            </p>
          </div>

          <Separator className="bg-gray-200" />

          {/* Download Type */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700">
              Download Type
            </Label>
            <div className="space-y-2">
              {DOWNLOAD_TYPES.map((type) => (
                <div
                  key={type.value}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer"
                >
                  <input
                    type="radio"
                    id={type.value}
                    name="downloadType"
                    value={type.value}
                    checked={settings.downloadType === type.value}
                    onChange={() => handleTypeChange(type.value)}
                    className="w-4 h-4 cursor-pointer accent-gray-900"
                  />
                  <Label
                    htmlFor={type.value}
                    className="font-normal cursor-pointer text-sm text-gray-700"
                  >
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Choose whether to download video with audio or audio only
            </p>
          </div>

          <Separator className="bg-gray-200" />

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
