import { ImagePlus, Loader2, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
/** 2x retina for the ~900px-wide hero; smaller uploads look soft on phones. */
const MIN_BANNER_WIDTH = 1200;

/** The natural width of an image file, or null when it can't be decoded. */
function imageWidth(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

interface BannerUploaderProps {
  /** Storage-plugin public URL of the current banner; empty string when none. */
  value: string;
  onChange: (bannerUrl: string) => void;
  disabled?: boolean;
}

export function BannerUploader({ value, onChange, disabled }: BannerUploaderProps) {
  const { uploadSingle, uploading } = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      inputRef.current?.setCustomValidity("Banner must be a PNG, JPEG, WebP or GIF image");
      inputRef.current?.reportValidity();
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      inputRef.current?.setCustomValidity("Banner must be 5 MB or smaller");
      inputRef.current?.reportValidity();
      return;
    }
    inputRef.current?.setCustomValidity("");
    const width = await imageWidth(file);
    if (width !== null && width < MIN_BANNER_WIDTH) {
      toast.error("Banner is too small", {
        description: `It's ${width}px wide; at least ${MIN_BANNER_WIDTH}px is needed to stay sharp (1600×512 recommended).`,
      });
      return;
    }
    const uploaded = await uploadSingle(file);
    if (uploaded) onChange(uploaded.url);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void pick(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void pick(file);
  };

  if (value) {
    return (
      <div className="space-y-2" data-testid="banner-preview">
        <div className="overflow-hidden rounded-lg border border-border">
          <img src={value} alt="Round banner preview" className="h-32 w-full object-cover" />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="text-xs text-foreground underline disabled:opacity-50"
          >
            {uploading ? "uploading..." : "replace"}
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            data-testid="banner-remove"
          >
            <X className="h-3 w-3" />
            remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={onSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-5 text-center transition-colors hover:border-foreground/30 hover:bg-accent/40",
          dragging && "border-foreground/40 bg-accent",
          disabled && "pointer-events-none opacity-60",
        )}
        data-testid="banner-dropzone"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">
          {uploading
            ? "uploading..."
            : "Click or drop an image — 1600×512 recommended; keep key content near the center (narrow screens crop the sides)"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={onSelect}
        className="hidden"
      />
    </div>
  );
}
