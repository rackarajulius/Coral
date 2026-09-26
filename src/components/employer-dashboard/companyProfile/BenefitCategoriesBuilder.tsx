import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import {
  Plus,
  X,
  GripVertical,
  ChevronDown,
  Star,
  MapPin,
} from "lucide-react";
import {
  EmployerBrand,
  BENEFIT_TYPES,
} from "@/data/companyProfile/employer-brand-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconPicker, Icon } from "@/components/employer-dashboard/companyProfile/IconPicker";
import { cn } from "@/lib/utils";

type DragItemData = {
  type: "category" | "benefit";
  catIndex: number;
  itemIndex?: number;
};

function newCategory(): EmployerBrand["benefitCategories"][number] {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    expanded: true,
    items: [],
  };
}

function newBenefitItem(): EmployerBrand["benefitCategories"][number]["items"][number] {
  return {
    id: crypto.randomUUID(),
    label: "",
    icon: "Gift",
    featured: false,
    description: "",
    locations: [],
    eligibility: "",
    type: "Perk",
  };
}

export function BenefitCategoriesBuilder() {
  const { control, watch, getValues, setValue, formState: { errors } } = useFormContext<EmployerBrand>();
  const cats = useFieldArray({ control, name: "benefitCategories" });
  const allLocations = watch("locations")?.map((l) => l.city).filter(Boolean) || [];

  const [activeDrag, setActiveDrag] = useState<DragItemData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragItemData | undefined;
    if (data) setActiveDrag(data);
  }

  function findBenefitById(categories: EmployerBrand["benefitCategories"], itemId: string) {
    for (let ci = 0; ci < categories.length; ci++) {
      const ii = categories[ci].items.findIndex((it) => it.id === itemId);
      if (ii !== -1) return { catIndex: ci, itemIndex: ii };
    }
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over || active.id === over.id) return;

    const activeData = active.data.current as DragItemData | undefined;
    const overData = over.data.current as DragItemData | undefined;
    if (!activeData || !overData) return;

    const categories = getValues("benefitCategories") ?? [];

    if (activeData.type === "category" && overData.type === "category") {
      const oldIndex = cats.fields.findIndex((f) => f.id === active.id);
      const newIndex = cats.fields.findIndex((f) => f.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) cats.move(oldIndex, newIndex);
      return;
    }

    if (activeData.type === "benefit" && overData.type === "benefit") {
      const from = findBenefitById(categories, String(active.id));
      const to = findBenefitById(categories, String(over.id));
      if (!from || !to) return;

      const fromCat = from.catIndex;
      const toCat = to.catIndex;
      const fromIdx = from.itemIndex;
      const toIdx = to.itemIndex;
      const fromCategory = categories[fromCat];
      const toCategory = categories[toCat];
      if (!fromCategory || !toCategory) return;

      if (fromCat === toCat) {
        const next = arrayMove([...fromCategory.items], fromIdx, toIdx);
        cats.update(fromCat, { ...fromCategory, items: next });
        return;
      }

      const sourceItems = [...fromCategory.items];
      const [moved] = sourceItems.splice(fromIdx, 1);
      if (!moved) return;

      const destItems = [...toCategory.items];
      destItems.splice(toIdx, 0, moved);

      cats.update(fromCat, { ...fromCategory, items: sourceItems });
      cats.update(toCat, { ...toCategory, items: destItems });
    }
  }

  const categoryIds = cats.fields.map((f) => f.id);

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <Label className="text-sm font-semibold">Benefit categories</Label>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Organize perks into categories. Drag to reorder and expand to edit items.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => cats.append(newCategory())}>
          <Plus className="w-3.5 h-3.5" /> Add category
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-2xl border border-border bg-muted/20 p-3 sm:p-4 min-h-[320px]">
          {categoryIds.length > 0 ? (
            <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {cats.fields.map((f, i) => (
                  <SortableCategoryCard
                    key={f.id}
                    id={f.id}
                    catIndex={i}
                    onRemoveCategory={() => {
                      setActiveDrag(null);
                      const idx = cats.fields.findIndex((field) => field.id === f.id);
                      if (idx >= 0) {
                        cats.remove(idx);
                        const next = getValues("benefitCategories");
                        if (!Array.isArray(next)) {
                          setValue("benefitCategories", [], { shouldDirty: true });
                        }
                      }
                    }}
                    onClearDrag={() => setActiveDrag(null)}
                    allLocations={allLocations}
                  />
                ))}
              </div>
            </SortableContext>
          ) : null}

          {cats.fields.length === 0 && (
            <button
              type="button"
              onClick={() => cats.append(newCategory())}
              className="w-full text-sm text-muted-foreground py-12 text-center border-2 border-dashed rounded-xl hover:border-foreground/30 hover:text-foreground transition-colors mt-2"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add your first benefit category
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeDrag?.type === "category" && (() => {
            const cat = getValues("benefitCategories")?.[activeDrag.catIndex];
            return cat ? <CategoryDragPreview category={cat} /> : null;
          })()}
          {activeDrag?.type === "benefit" &&
            activeDrag.itemIndex !== undefined &&
            (() => {
              const item = getValues("benefitCategories")?.[activeDrag.catIndex]?.items[
                activeDrag.itemIndex
              ];
              return item ? <BenefitDragPreview item={item} /> : null;
            })()}
        </DragOverlay>
      </DndContext>

      {errors.benefitCategories && (
        <p className="text-xs text-destructive mt-2">
          {(errors.benefitCategories as { message?: string }).message}
        </p>
      )}
    </section>
  );
}

function SortableCategoryCard({
  id,
  catIndex,
  onRemoveCategory,
  onClearDrag,
  allLocations,
}: {
  id: string;
  catIndex: number;
  onRemoveCategory: () => void;
  onClearDrag: () => void;
  allLocations: string[];
}) {
  const { control, register, watch, setValue, getValues } = useFormContext<EmployerBrand>();
  const cat = watch(`benefitCategories.${catIndex}`);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "category", catIndex } satisfies DragItemData,
  });

  if (!cat) return null;

  const expanded = cat.expanded ?? true;
  const benefitItems = cat.items ?? [];
  const itemIds = benefitItems.map((f) => f.id);

  function updateCategoryItems(nextItems: EmployerBrand["benefitCategories"][number]["items"]) {
    const current = getValues(`benefitCategories.${catIndex}`);
    if (!current) return;
    setValue(`benefitCategories.${catIndex}`, { ...current, items: nextItems }, { shouldDirty: true });
  }

  function appendBenefitItem() {
    updateCategoryItems([...benefitItems, newBenefitItem()]);
  }

  function removeBenefitItem(itemId: string) {
    const current = getValues(`benefitCategories.${catIndex}`);
    if (!current) return;
    const nextItems = (current.items ?? []).filter((it) => it.id !== itemId);
    setValue(`benefitCategories.${catIndex}`, { ...current, items: nextItems }, { shouldDirty: true });
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        isDragging && "opacity-50 ring-2 ring-accent/30"
      )}
    >
      <Collapsible
        open={expanded}
        onOpenChange={(o) =>
          setValue(`benefitCategories.${catIndex}.expanded`, o, { shouldDirty: true })
        }
      >
        <div className="p-3 flex items-start gap-2">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 mt-1 shrink-0 touch-none"
            aria-label="Drag category"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 space-y-1.5">
            <Input
              {...register(`benefitCategories.${catIndex}.name`)}
              placeholder="Category name (e.g. Health & Wellness)"
              className="font-semibold h-9"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-[10px] text-muted-foreground hidden md:inline px-1">
              {benefitItems.length}
            </span>
            <CollapsibleTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                <ChevronDown
                  className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="Remove category"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveCategory();
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border/80 bg-muted/30 px-3 py-3 space-y-2">
            {itemIds.length > 0 ? (
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {benefitItems.map((it) => (
                    <SortableBenefitItem
                      key={it.id}
                      id={it.id}
                      catIndex={catIndex}
                      onRemove={() => {
                        onClearDrag();
                        removeBenefitItem(it.id);
                      }}
                      allLocations={allLocations}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-center text-muted-foreground border border-dashed border-border hover:border-foreground/30 rounded-xl py-3"
              onClick={appendBenefitItem}
            >
              <Plus className="w-3.5 h-3.5" />
              Add benefit to {cat?.name || "this category"}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SortableBenefitItem({
  id,
  catIndex,
  onRemove,
  allLocations,
}: {
  id: string;
  catIndex: number;
  onRemove: () => void;
  allLocations: string[];
}) {
  const { watch } = useFormContext<EmployerBrand>();
  const category = watch(`benefitCategories.${catIndex}`);
  const resolvedIndex = category?.items.findIndex((it) => it.id === id) ?? -1;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: {
      type: "benefit",
      catIndex,
      itemIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    } satisfies DragItemData,
  });

  if (resolvedIndex < 0) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border bg-card",
        isDragging && "opacity-40 shadow-md"
      )}
    >
      <BenefitItemForm
        catIndex={catIndex}
        itemIndex={resolvedIndex}
        onRemove={onRemove}
        allLocations={allLocations}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function BenefitItemForm({
  catIndex,
  itemIndex,
  onRemove,
  allLocations,
  dragHandleProps,
}: {
  catIndex: number;
  itemIndex: number;
  onRemove: () => void;
  allLocations: string[];
  dragHandleProps?: Record<string, unknown>;
}) {
  const { control, register, watch, setValue, formState: { errors } } = useFormContext<EmployerBrand>();
  const base = `benefitCategories.${catIndex}.items.${itemIndex}` as const;
  const featured = watch(`${base}.featured`);
  const selectedLocs = watch(`${base}.locations`) || [];
  const labelError = errors.benefitCategories?.[catIndex]?.items?.[itemIndex]?.label?.message;

  function toggleLoc(loc: string) {
    const next = selectedLocs.includes(loc)
      ? selectedLocs.filter((l) => l !== loc)
      : [...selectedLocs, loc];
    setValue(`${base}.locations`, next, { shouldDirty: true });
  }

  return (
    <div className="p-3 flex gap-2">
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground pt-1.5 shrink-0 touch-none"
        aria-label="Drag benefit"
        {...dragHandleProps}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Controller
            control={control}
            name={`${base}.icon`}
            render={({ field }) => (
              <IconPicker value={field.value} onChange={field.onChange} size="sm" />
            )}
          />
          <div className="flex-1 min-w-[140px]">
            <Input
              {...register(`${base}.label`)}
              placeholder="Benefit title"
              className="h-9 font-medium"
            />
            {labelError && <p className="text-[11px] text-destructive mt-0.5">{labelError}</p>}
          </div>
          <button
            type="button"
            onClick={() => setValue(`${base}.featured`, !featured, { shouldDirty: true })}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border text-xs font-medium transition-all",
              featured
                ? "bg-accent/10 text-accent border-accent/30"
                : "text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            <Star className={cn("w-3 h-3", featured && "fill-current")} />
            Featured
          </button>
        </div>

        <AutoTextarea
          name={`${base}.description`}
          placeholder="What does this benefit include?"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-xs hover:border-foreground/30 min-w-0"
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {selectedLocs.length === 0
                    ? "All locations"
                    : selectedLocs.length === 1
                      ? selectedLocs[0]
                      : `${selectedLocs.length} locations`}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              {allLocations.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Add locations in Step 1 first.</p>
              ) : (
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {allLocations.map((l) => {
                    const on = selectedLocs.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleLoc(l)}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded-md text-xs",
                          on ? "bg-accent/10 text-accent" : "hover:bg-muted"
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Controller
            control={control}
            name={`${base}.type`}
            render={({ field }) => (
              <Select
                value={field.value && BENEFIT_TYPES.includes(field.value as (typeof BENEFIT_TYPES)[number]) ? field.value : undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <Input
            {...register(`${base}.eligibility`)}
            placeholder="Eligibility"
            className="h-9 text-xs"
          />
        </div>
      </div>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove benefit"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function CategoryDragPreview({ category }: { category: EmployerBrand["benefitCategories"][number] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-elevated flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-semibold truncate">{category.name || "Category"}</span>
    </div>
  );
}

function BenefitDragPreview({
  item,
}: {
  item: EmployerBrand["benefitCategories"][number]["items"][number];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 shadow-elevated flex items-center gap-2 max-w-[240px]">
      <Icon name={item.icon} className="w-4 h-4" />
      <span className="text-sm font-medium truncate">{item.label || "Benefit"}</span>
    </div>
  );
}

function AutoTextarea({ name, placeholder }: { name: string; placeholder?: string }) {
  const { register } = useFormContext();
  return (
    <Textarea
      {...register(name)}
      placeholder={placeholder}
      rows={2}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      }}
      className="resize-none text-sm leading-relaxed"
    />
  );
}
