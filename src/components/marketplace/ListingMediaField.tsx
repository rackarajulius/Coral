import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaUploadField } from "@/components/media/MediaUploadField";

/** The server's limit: 8 pictures, and one video. */
export const LISTING_MAX_PICTURES = 8;

/**
 * Pictures and a short video of the work, for a service listing. The first
 * picture is the cover people see on /services.
 */
export function ListingMediaField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Pictures and video</CardTitle>
        <CardDescription>Show the work itself. The first picture is the cover on the services page.</CardDescription>
      </CardHeader>
      <CardContent>
        <MediaUploadField value={value} onChange={onChange} maxPictures={LISTING_MAX_PICTURES} note="Save the listing to keep them." />
      </CardContent>
    </Card>
  );
}

export default ListingMediaField;
