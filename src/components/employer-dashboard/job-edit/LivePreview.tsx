import { format } from "date-fns";
import {
  MapPin, DollarSign, Clock, BriefcaseBusiness, Building2, ArrowRight, Globe,
} from "lucide-react";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$",
};
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EditJobForm, FieldArrayItem } from "@/data/employer/Jobs/types";

interface LivePreviewProps {
  values: EditJobForm;
  skillFields: FieldArrayItem[];
  benefitFields: FieldArrayItem[];
  previewOpen: boolean;
  setPreviewOpen: (v: boolean) => void;
  logoUrl?: string | null;
  companyName?: string;
}

const LivePreview = ({ values, skillFields, benefitFields, previewOpen, setPreviewOpen, logoUrl, companyName = "Your Company" }: LivePreviewProps) => (
  <>
    {/* Sidebar preview */}
    <div className="hidden lg:block w-[380px] shrink-0">
      <div className="sticky top-[8.5rem]">
        <Card className="shadow-card border border-gray-300 overflow-hidden">
          <div className="p-4 bg-secondary/40 border-b border-gray-300">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</p>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover shrink-0 border border-gray-300" />
              )}
              <div>
                <h3 className="font-semibold text-foreground leading-snug">
                  {values.title || "Job Title"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{companyName}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" /> {values.location || "Location"}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <BriefcaseBusiness className="h-3 w-3 mr-1" /> {values.jobType || "Type"}
              </Badge>
              {values.workArrangement && (
                <Badge variant="secondary" className="text-xs capitalize">
                  <Globe className="h-3 w-3 mr-1" /> {values.workArrangement}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" /> {values.experienceLevel || "Level"}
              </Badge>
            </div>

            {(values.salaryMin > 0 || values.salaryMax > 0) && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                {values.salaryMin > 0 && `${CURRENCY_SYMBOLS[values.currency] ?? values.currency}${(values.salaryMin / 1000).toFixed(0)}K`}
                {values.salaryMin > 0 && values.salaryMax > 0 && " – "}
                {values.salaryMax > 0 && `${CURRENCY_SYMBOLS[values.currency] ?? values.currency}${(values.salaryMax / 1000).toFixed(0)}K`}
                <span className="text-muted-foreground font-normal">
                  / {values.payType === "yearly" ? "yr" : values.payType === "monthly" ? "mo" : "hr"}
                </span>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Description</p>
              <p className="text-sm text-foreground/80 line-clamp-4 whitespace-pre-line leading-relaxed">
                {values.description || "No description yet…"}
              </p>
            </div>

            {skillFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skillFields.slice(0, 8).map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs">{s.value ?? ""}</Badge>
                  ))}
                  {skillFields.length > 8 && (
                    <Badge variant="outline" className="text-xs">+{skillFields.length - 8}</Badge>
                  )}
                </div>
              </div>
            )}

            {benefitFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Benefits</p>
                <div className="flex flex-wrap gap-1.5">
                  {benefitFields.slice(0, 6).map((b) => (
                    <Badge key={b.id} variant="secondary" className="text-xs">{b.value ?? ""}</Badge>
                  ))}
                  {benefitFields.length > 6 && (
                    <Badge variant="secondary" className="text-xs">+{benefitFields.length - 6}</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <div className="p-4 border-t border-gray-300">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => setPreviewOpen(true)}
            >
              View Full Preview <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>

    {/* Full Preview Modal */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar">
        <DialogHeader>
          <DialogTitle>Job Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-start gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-xl object-cover shrink-0 border border-border" />
            )}
            <div>
              <h2 className="text-2xl font-bold">{values.title || "Untitled"}</h2>
              <p className="text-muted-foreground mt-1">{companyName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <MapPin className="h-3 w-3 mr-1" /> {values.location}
            </Badge>
            <Badge variant="secondary">
              <BriefcaseBusiness className="h-3 w-3 mr-1" /> {values.jobType}
            </Badge>
            {values.workArrangement && (
              <Badge variant="secondary" className="capitalize">
                <Globe className="h-3 w-3 mr-1" /> {values.workArrangement}
              </Badge>
            )}
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" /> {values.experienceLevel}
            </Badge>
            {values.department && (
              <Badge variant="secondary">
                <Building2 className="h-3 w-3 mr-1" /> {values.department}
              </Badge>
            )}
          </div>

          {(values.salaryMin > 0 || values.salaryMax > 0) && (
            <div className="text-lg font-semibold flex items-center gap-1">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              {(() => {
                const sym = CURRENCY_SYMBOLS[values.currency] ?? values.currency;
                return (
                  <>
                    {values.salaryMin > 0 && `${sym}${values.salaryMin.toLocaleString()}`}
                    {values.salaryMin > 0 && values.salaryMax > 0 && " – "}
                    {values.salaryMax > 0 && `${sym}${values.salaryMax.toLocaleString()}`}
                  </>
                );
              })()}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                per {values.payType === "yearly" ? "year" : values.payType === "monthly" ? "month" : "hour"}
              </span>
            </div>
          )}
          

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">About the Role</h3>
            <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
              {values.description}
            </p>
          </div>

          {skillFields.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Skills & Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {skillFields.map((s) => (
                  <Badge key={s.id} variant="outline">{s.value ?? ""}</Badge>
                ))}
              </div>
            </div>
          )}

          {benefitFields.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Benefits & Perks</h3>
              <div className="flex flex-wrap gap-2">
                {benefitFields.map((b) => (
                  <Badge key={b.id} variant="secondary">{b.value ?? ""}</Badge>
                ))}
              </div>
            </div>
          )}

          {values.applicationDeadline && (
            <p className="text-sm text-muted-foreground">
              Application deadline: {format(values.applicationDeadline, "PPP")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>
);

export default LivePreview;
