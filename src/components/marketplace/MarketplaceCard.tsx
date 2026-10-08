import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { providerCategoryLabel } from "@/lib/api/providers";
import { marketplacePath, marketplacePrice, marketplaceStatusLabel, marketplaceWorkMode, type MarketplaceKind, type MarketplaceRecord } from "@/lib/api/marketplace";

export default function MarketplaceCard({ record, kind, management = false, children }: { record: MarketplaceRecord; kind: MarketplaceKind; management?: boolean; children?: React.ReactNode }) {
  return <Card className="h-full rounded-2xl"><CardContent className="flex h-full flex-col p-5">
    <div className="mb-3 flex flex-wrap gap-2"><Badge variant="secondary">{providerCategoryLabel(record.category)}</Badge>{management && <Badge variant="outline">{marketplaceStatusLabel(record.status)}</Badge>}</div>
    <h2 className="break-words text-lg font-semibold leading-6">{management ? record.title || "Untitled draft" : <Link to={`${marketplacePath(kind, record.id)}?source=directory`} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{record.title}</Link>}</h2>
    <p className="mt-2 text-xs text-muted-foreground">{record.company?.name || record.owner?.displayName || "Coral member"}</p>
    <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-muted-foreground">{record.description || "Add a description before sharing this listing."}</p>
    <p className="mt-4 text-sm font-medium">{marketplacePrice(record, kind)}</p>
    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{marketplaceWorkMode(record.workMode)}{record.city || record.country ? ` · ${[record.city, record.country].filter(Boolean).join(", ")}` : ""}</p>
    <div className="mb-5 mt-4 flex flex-wrap gap-1.5">{record.skills.slice(0, 4).map((skill) => <Badge key={skill} variant="outline" className="max-w-full break-words text-xs">{skill}</Badge>)}</div>
    {management ? <div className="mt-auto">{children}</div> : <Button asChild variant="outline" className="mt-auto w-full"><Link to={`${marketplacePath(kind, record.id)}?source=directory`}>View {kind === "service" ? "service" : "project brief"}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>}
  </CardContent></Card>;
}
