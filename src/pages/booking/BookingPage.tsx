import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, CheckCircle2, Video, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { getBookingPage, bookSlot, downloadInterviewIcs, type BookingSlot } from "@/lib/api/booking";

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const BookingPage = () => {
  const { employerId } = useParams<{ employerId: string }>();
  const queryClient = useQueryClient();
  const [booked, setBooked] = useState<{ interviewId: string; slot: BookingSlot } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["booking-page", employerId],
    queryFn: () => getBookingPage(employerId!),
    enabled: !!employerId,
    retry: false,
  });

  const bookMut = useMutation({
    mutationFn: (slot: BookingSlot) => bookSlot(slot.id).then((r) => ({ interviewId: r.id, slot })),
    onSuccess: (res) => {
      setBooked(res);
      toast.success("Interview booked");
      queryClient.invalidateQueries({ queryKey: ["booking-page", employerId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const s of data?.slots ?? []) {
      const day = fmtDay(s.startAt);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-xl mx-auto px-4 py-6 pt-24">
        {isLoading ? (
          <Centered><Loader2 className="h-4 w-4 animate-spin" /> Loading…</Centered>
        ) : isError ? (
          <Centered><span className="text-destructive">{(error as Error)?.message || "Not available"}</span></Centered>
        ) : booked ? (
          <BookedConfirmation company={data!.company} booked={booked} />
        ) : (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-coral/10 text-coral px-3 py-1 text-xs font-medium mb-3">
                <CalendarClock className="h-3.5 w-3.5" /> Book an interview
              </div>
              <h1 className="text-2xl font-bold text-foreground">{data!.company}</h1>
              <p className="text-muted-foreground mt-1">Pick a time that works for you. You'll get a video room link and a calendar invite.</p>
            </div>

            {grouped.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No open times right now. Check back later or ask the employer to add availability.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map(([day, slots]) => (
                  <div key={day}>
                    <p className="text-sm font-semibold text-foreground mb-2">{day}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {slots.map((s) => (
                        <Button
                          key={s.id}
                          variant="outline"
                          className="h-auto py-2.5 flex-col items-start gap-0.5"
                          disabled={bookMut.isPending}
                          onClick={() => bookMut.mutate(s)}
                        >
                          <span className="font-semibold text-foreground">{fmtTime(s.startAt)}</span>
                          <span className="text-xs text-muted-foreground">{s.durationMins} min{s.role ? ` · ${s.role}` : ""}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

function BookedConfirmation({ company, booked }: { company: string; booked: { interviewId: string; slot: BookingSlot } }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Interview booked</h1>
      <p className="text-sm text-muted-foreground mt-2">
        {fmtDay(booked.slot.startAt)} at {fmtTime(booked.slot.startAt)} with {company}. A confirmation with a calendar
        invite is on its way.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => downloadInterviewIcs(booked.interviewId).catch(() => toast.error("Couldn't download the calendar file"))}>
          <CalendarPlus className="h-4 w-4" /> Add to calendar
        </Button>
        <Button asChild>
          <Link to="/activity?tab=interviews"><Video className="h-4 w-4" /> View in activity</Link>
        </Button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-20">{children}</div>;
}

export default BookingPage;
