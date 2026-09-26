import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, X, ImageIcon, Film, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  className?: string;
  shape?: "rectangle" | "circle";
  size?: "default" | "compact";
  label?: string;
  hint?: string;
  accept?: string;
  fileTypeLabel?: string;
  /** Shows a loading overlay and disables interaction while an upload is in flight. */
  uploading?: boolean;
  /** When provided, picked/dropped files are handed off here instead of being read as a data URL. */
  onFile?: (file: File) => void;
}

export function ImageDropzone({
  value,
  onChange,
  className,
  shape = "rectangle",
  size = "default",
  label = "Drop an image",
  hint,
  accept = "image/*",
  fileTypeLabel = "image",
  uploading = false,
  onFile,
}: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = accept.startsWith("video/");

  function handleFile(file?: File) {
    if (!file) return;
    if (onFile) {
      onFile(file);
      return;
    }
    const acceptBase = accept.split("/")[0];
    if (!file.type.startsWith(acceptBase)) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (uploading) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  function onSelect(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function clearMedia() {
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasMedia = Boolean(value?.trim());

  const isCompact = size === "compact";

  return (
    <div className={cn("relative group w-full max-w-full", className)}>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onSelect} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "cursor-pointer relative overflow-hidden border-2 border-dashed transition-all flex items-center justify-center",
          shape === "circle"
            ? "rounded-full aspect-square w-full h-full min-h-0"
            : cn(
                "w-full h-full min-h-0",
                isCompact ? "rounded-xl" : "rounded-2xl min-h-[220px]"
              ),
          over ? "border-accent bg-accent/5" : "border-border bg-muted/40 hover:border-foreground/30",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {hasMedia ? (
          <>
            {isVideo ? (
              <video src={value} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="text-primary-foreground text-xs font-medium bg-foreground/60 backdrop-blur px-3 py-1.5 rounded-lg">
                Upload
              </span>
            </div>
          </>
        ) : shape === "circle" ? (
          <div className="flex flex-col items-center justify-center gap-0.5 p-1 text-center">
            <Camera className="w-5 h-5 text-muted-foreground shrink-0" />
            {label ? (
              <span className="text-[9px] font-medium text-muted-foreground leading-tight line-clamp-1">
                {label}
              </span>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              "text-center w-full",
              isCompact ? "px-2 py-2" : "px-4 py-8"
            )}
          >
            <div
              className={cn(
                "mx-auto rounded-lg bg-card border border-border flex items-center justify-center mb-1",
                isCompact ? "w-8 h-8" : "w-10 h-10 rounded-xl mb-2"
              )}
            >
              <Camera className={cn("text-muted-foreground", isCompact ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            <p className={cn("font-medium", isCompact ? "text-xs" : "text-sm")}>{label}</p>
            {hint && (
              <p className={cn("text-muted-foreground mt-0.5", isCompact ? "text-[10px] line-clamp-1" : "text-xs mt-1")}>
                {hint}
              </p>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-sm">
            <Loader2 className="w-5 h-5 animate-spin text-foreground" />
          </div>
        )}
      </div>
      
      {hasMedia && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-card opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            clearMedia();
          }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
