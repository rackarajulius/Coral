import { useState, useRef } from "react";
import { MapPin, BriefcaseBusiness, Upload, X, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { EditJobFormReturn } from "@/data/employer/Jobs/types";
import { WORK_ARRANGEMENTS } from "@/lib/jobs/workArrangement";

const DEPARTMENTS = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "HR", "Finance", "Operations", "Legal", "Customer Success",
];

interface JobDetailsSectionProps {
  form: EditJobFormReturn;
  logoUrl?: string | null;
  onLogoChange?: (url: string | null) => void;
}

const JobDetailsSection = ({ form, logoUrl, onLogoChange }: JobDetailsSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCustomDept, setShowCustomDept] = useState(() => {
    const v = form.getValues("department");
    return !!v && !DEPARTMENTS.includes(v);
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLogoChange?.(URL.createObjectURL(file));
    }
  };

  const removeLogo = () => {
    onLogoChange?.(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className="shadow-card border border-gray-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" /> Job Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo Upload */}
        <div>
          <label className="text-sm font-medium leading-none mb-2 block">Company Logo</label>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/40 flex items-center justify-center cursor-pointer transition-colors overflow-hidden group"
            >
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeLogo(); }}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Logo
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title</FormLabel>
              <FormControl>
                <Input className="bg-card" placeholder="e.g. Senior Frontend Engineer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 bg-card" placeholder="San Francisco, CA" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="workArrangement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Arrangement</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select arrangement" />
                    </SelectTrigger>
                  </FormControl>
                  {/* Options come from the same module as the mapping, so an
                      option can't exist that nothing maps. */}
                  <SelectContent>
                    {WORK_ARRANGEMENTS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="experienceLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <Select
                onValueChange={(val) => {
                  if (val === "other") {
                    setShowCustomDept(true);
                    field.onChange("");
                  } else {
                    setShowCustomDept(false);
                    field.onChange(val);
                  }
                }}
                value={showCustomDept ? "other" : field.value}
              >
                <FormControl>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                  <SelectItem value="other">Other…</SelectItem>
                </SelectContent>
              </Select>
              {showCustomDept && (
                <Input className="mt-1 bg-card" placeholder="Enter department name" {...field} />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default JobDetailsSection;
