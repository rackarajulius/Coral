import { toast } from "sonner";

/**
 * Shares a job.
 *
 * Prefers the device's own share sheet, which is what people expect on a phone
 * and reaches apps a web page never could. Everywhere else it copies the link,
 * because a fake share dialog of our own would be a worse version of something
 * the platform already does well.
 *
 * The URL carries `?job=<id>` — a bare `/jobs` link opens the list, not the
 * posting the sender meant, which is the whole reason this is not just
 * `window.location.href`.
 */
export async function shareJob(job: { id: string; title: string; company: string }) {
  const url = `${window.location.origin}/jobs?job=${encodeURIComponent(job.id)}`;
  const title = `${job.title} at ${job.company}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch (err) {
      // Dismissing the sheet rejects with AbortError. That is a choice, not a
      // failure, so it must not fall through to copying or show an error.
      if ((err as Error).name === "AbortError") return;
      // Anything else (a share sheet that exists but refuses) falls back.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: title });
  } catch {
    // Clipboard access needs a secure context and can be blocked outright.
    // Showing the link lets someone copy it by hand rather than being told
    // nothing happened.
    toast.error("Couldn't copy the link", { description: url });
  }
}
