import { useFieldArray, useFormContext, Controller, type Control, type UseFormRegister } from "react-hook-form";
import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { uploadCompanyMedia } from "@/lib/api/employerCompany";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, X, GripVertical, Video, Upload, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** A storage/object URL we can preview inline as a <video> (vs. an embed link). */
function isPlayableVideoUrl(v: string): boolean {
  return (
    v.startsWith("data:video") ||
    v.startsWith("blob:") ||
    v.includes("/storage/v1/object/public/") ||
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v)
  );
}

export function VisualsMediaStep() {
  const { control, register } = useFormContext<EmployerBrand>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "gallery" });
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function addFiles(list?: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setUploadingPhotos(true);
    try {
      for (const f of images) {
        const url = await uploadCompanyMedia(f);
        append({ id: crypto.randomUUID(), url, caption: "" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload photo");
    } finally {
      setUploadingPhotos(false);
    }
  }

  function addPhotoUrl() {
    const url = photoUrl.trim();
    if (!url) return;
    append({ id: crypto.randomUUID(), url, caption: "" });
    setPhotoUrl("");
  }

  async function handleVideoFile(file: File | undefined, onChange: (v: string) => void) {
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadCompanyMedia(file);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload video");
    } finally {
      setUploadingVideo(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <Label className="text-sm font-semibold">Photo gallery</Label>
            <p className="text-xs text-muted-foreground">Upload images or paste a link. Drag to reorder.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingPhotos}>
              {uploadingPhotos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {uploadingPhotos ? "Uploading…" : "Add photos"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        </div>

        {/* Paste an image URL */}
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhotoUrl(); } }}
            placeholder="https://…/photo.jpg"
            className="h-9"
          />
          <Button type="button" size="sm" variant="secondary" onClick={addPhotoUrl} disabled={!photoUrl.trim()}>
            <Plus className="w-3.5 h-3.5" /> Add link
          </Button>
        </div>

        {/* Outer div keeps file-drop support (native drag events don't conflict with @dnd-kit pointer sensors) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed border-border p-3 bg-background",
            fields.length === 0 && "py-12 text-center"
          )}
        >
          {fields.length === 0 ? (
            <div>
              <div className="mx-auto w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center mb-3">
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Drop photos here</p>
              <p className="text-xs text-muted-foreground mt-1">or click "Add photos" / paste a link above</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fields.map((f, i) => (
                    <SortableGalleryCard
                      key={f.id}
                      id={f.id}
                      index={i}
                      control={control}
                      register={register}
                      onRemove={() => remove(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>

      <section>
        <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Video className="w-4 h-4" /> Culture video
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          Upload an MP4/WebM or paste a YouTube / Vimeo / Loom URL.
        </p>
        <Controller
          control={control}
          name="cultureVideo"
          render={({ field }) => {
            const v = field.value || "";
            const playable = isPlayableVideoUrl(v);
            const isEmbed = /^https?:\/\//.test(v) && !playable;
            return (
              <div className="space-y-3">
                <Input
                  value={isEmbed ? v : ""}
                  onChange={field.onChange}
                  placeholder="https://youtube.com/watch?v=…"
                />
                <div className="text-xs text-muted-foreground text-center">— or —</div>
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleVideoFile(e.target.files?.[0], field.onChange)}
                />
                <div
                  onClick={() => !uploadingVideo && videoRef.current?.click()}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-border bg-background hover:border-foreground/30 transition-colors aspect-video flex items-center justify-center relative overflow-hidden"
                >
                  {uploadingVideo ? (
                    <div className="text-center">
                      <Loader2 className="mx-auto w-6 h-6 text-muted-foreground animate-spin mb-2" />
                      <p className="text-sm font-medium">Uploading…</p>
                    </div>
                  ) : playable ? (
                    <video src={v} className="absolute inset-0 w-full h-full object-cover" muted />
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mb-2">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Drop a video file</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4 or WebM</p>
                    </div>
                  )}
                </div>
                {(isEmbed || playable) && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => field.onChange("")}
                  >
                    Clear video
                  </button>
                )}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}

interface SortableGalleryCardProps {
  id: string;
  index: number;
  control: Control<EmployerBrand>;
  register: UseFormRegister<EmployerBrand>;
  onRemove: () => void;
}

function SortableGalleryCard({ id, index, control, register, onRemove }: SortableGalleryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-xl overflow-hidden border border-border bg-card transition-all",
        isDragging && "opacity-40 scale-95 z-10",
        index === 0 && "row-span-2 col-span-2 md:col-span-1 md:row-span-1",
      )}
    >
      {/* The whole image is the drag handle (touch-none prevents page scroll from
          interfering with drag on touch devices). */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <Controller
          control={control}
          name={`gallery.${index}.url`}
          render={({ field }) => (
            <img src={field.value} alt="" className="w-full h-44 object-cover pointer-events-none select-none" draggable={false} />
          )}
        />
      </div>
      {/* Reorder hint (purely visual — the image itself is draggable) */}
      <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-foreground/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <GripVertical className="w-3.5 h-3.5 text-primary-foreground" />
      </div>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-card"
        onClick={onRemove}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-foreground/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <Input
          {...register(`gallery.${index}.caption`)}
          placeholder="Add a caption…"
          className="h-7 text-xs bg-card/90"
        />
      </div>
    </div>
  );
}
