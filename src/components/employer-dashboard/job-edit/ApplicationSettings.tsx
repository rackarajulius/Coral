import { format } from "date-fns";
import { Settings2, CalendarIcon, Globe, X, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { EditJobFormReturn } from "@/data/employer/Jobs/types";

interface ApplicationSettingsProps {
  form: EditJobFormReturn;
  watchedApplicationMethod: string;
}

const ApplicationSettingsSection = ({ form, watchedApplicationMethod }: ApplicationSettingsProps) => (
  <Card className="shadow-card border border-gray-300">
    <CardHeader className="pb-4">
      <CardTitle className="text-base flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-muted-foreground" /> Application Settings
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <FormField
        control={form.control}
        name="applicationDeadline"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Application Deadline</FormLabel>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[280px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "PPP") : "Pick a deadline"}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {field.value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.onChange(undefined)}
                  className="h-9 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="applicationMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Application Method</FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  if (val !== "external") form.setValue("applicationUrl", "");
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="internal">Internal (via platform)</SelectItem>
                  <SelectItem value="external">External URL</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedApplicationMethod === "external" && (
          <FormField
            control={form.control}
            name="applicationUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Application URL</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 bg-card" placeholder="https://..." {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {watchedApplicationMethod === "email" && (
          <FormField
            control={form.control}
            name="applicationEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Application Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 bg-card" placeholder="jobs@company.com" type="email" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full sm:w-[200px] bg-card">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </CardContent>
  </Card>
);

export default ApplicationSettingsSection;
