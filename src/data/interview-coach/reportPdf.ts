import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { competencyLabel, difficultyLabel, interviewTypeLabel } from "./constants";
import { readinessLabel } from "@/stores/interviewHistoryStore";
import type { HistoryEntry } from "./types";

/** Plain-text PDF export of a session report (same approach as billing/pdf.ts). */
export function exportReportPdf(entry: HistoryEntry) {
  const report = entry.report;
  if (!report) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureRoom = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string) => {
    ensureRoom(40);
    y += 18;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30);
    doc.text(text, margin, y);
    y += 14;
    doc.setDrawColor(210).line(margin, y - 8, pageW - margin, y - 8);
  };

  const para = (text: string, size = 10) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(60);
    const lines = doc.splitTextToSize(text, maxW);
    ensureRoom(lines.length * (size + 3));
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 4;
  };

  const bullet = (text: string) => para(`•  ${text}`);

  // Title block
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20);
  doc.text("Interview Performance Report", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
  doc.text(
    `${entry.config.role} · ${interviewTypeLabel(entry.config.type)} · ${difficultyLabel(entry.config.difficulty)} · ${format(new Date(entry.createdAt), "MMM d, yyyy")}`,
    margin,
    y,
  );
  y += 24;

  // Score summary
  doc.setFont("helvetica", "bold").setFontSize(34).setTextColor(79, 70, 229);
  doc.text(String(report.overallScore), margin, y + 8);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
  doc.text(`/ 100 — ${readinessLabel[report.readiness]}`, margin + 52, y + 6);
  y += 26;
  para(report.recommendation);

  heading("Competency scores");
  report.competencies.forEach((c) => {
    const trend =
      c.trendVsPrev != null ? `  (${c.trendVsPrev >= 0 ? "+" : ""}${c.trendVsPrev} vs previous)` : "";
    bullet(`${competencyLabel(c.id)}: ${c.score}${trend} — ${c.insight}`);
  });

  heading("Strengths");
  report.strengths.forEach(bullet);

  heading("Areas to improve");
  report.weaknesses.forEach(bullet);
  report.repeatedMistakes.forEach(bullet);

  heading("Recommended focus");
  para(report.focusAreas.join(" · "));
  report.resources.forEach((r) => bullet(`${r.title} (${r.kind}, ~${r.durationMin} min) — ${r.reason}`));

  if (report.sampleAnswers.length) {
    heading("Sample improved answers");
    report.sampleAnswers.forEach((sa, i) => {
      para(`Q${i + 1}: ${sa.questionText}`, 10);
      para(`Your answer: ${sa.original}`, 9);
      para(`Stronger version: ${sa.improved}`, 9);
      y += 4;
    });
  }

  doc.save(`interview-report-${format(new Date(entry.createdAt), "yyyy-MM-dd")}.pdf`);
}
