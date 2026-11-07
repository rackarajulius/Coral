import { useWorkCategories } from "@/hooks/useWorkCategories";

/** A category's label, as the server names it. */
export function CategoryLabel({ value }: { value: string | null | undefined }) {
  const { label } = useWorkCategories();
  return <>{label(value)}</>;
}

/**
 * The `<option>`s for a category picker. A saved value the list doesn't know
 * yet (still loading) keeps an option of its own, so the picker never shows
 * a different category from the one saved.
 */
export function CategoryOptions({ selected }: { selected?: string }) {
  const { categories } = useWorkCategories();
  const known = !selected || categories.some((category) => category.value === selected);
  return (
    <>
      {!known && <option value={selected}>{selected}</option>}
      {categories.map((category) => (
        <option key={category.value} value={category.value}>{category.label}</option>
      ))}
    </>
  );
}
