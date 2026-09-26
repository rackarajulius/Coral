import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { unsubscribeFromEmail } from "@/lib/api/recommendations";

const TOPIC_LABEL: Record<string, string> = {
  job_alerts: "job alert emails",
  job_recommendations: "“jobs picked for you” emails",
};

/**
 * The page an email's unsubscribe link opens.
 *
 * Works signed out — CASL wants unsubscribing to be easy — and asks for one
 * click rather than acting on arrival, because mail scanners open every link
 * in a message and would otherwise unsubscribe people on their own.
 */
export default function Unsubscribe() {
  useDocumentTitle("Unsubscribe");
  const [params] = useSearchParams();
  const u = params.get("u") ?? "";
  const t = params.get("t") ?? "";
  const s = params.get("s") ?? "";
  const label = TOPIC_LABEL[t];
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const confirm = async () => {
    setState("working");
    try {
      await unsubscribeFromEmail({ u, t, s });
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };

  const valid = !!(u && s && label);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        {state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We won't send you {label} any more. You can turn them back on in Settings → Notifications.
            </p>
          </>
        ) : (
          <>
            <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 text-lg font-semibold">Unsubscribe</h1>
            {valid ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">Stop receiving {label} from Coral?</p>
                <Button className="mt-5 w-full" onClick={() => void confirm()} disabled={state === "working"}>
                  {state === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Unsubscribe
                </Button>
                {state === "error" && <p className="mt-3 text-sm text-destructive">{error}</p>}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                This link is incomplete. Open it again from the email, or change your email settings in
                Settings → Notifications.
              </p>
            )}
          </>
        )}
        <Link to="/" className="mt-5 inline-block text-xs text-muted-foreground hover:underline">
          Go to Coral
        </Link>
      </div>
    </div>
  );
}
