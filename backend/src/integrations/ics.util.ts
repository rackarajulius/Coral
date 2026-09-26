/** Minimal RFC-5545 iCalendar (.ics) builder — free "add to calendar" for any client. */

export interface IcsInput {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMins: number;
  location?: string;
  url?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
  sequence?: number;
  method?: 'PUBLISH' | 'CANCEL';
  status?: 'CONFIRMED' | 'CANCELLED';
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** UTC basic format: 20260715T143000Z */
function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(i: IcsInput): string {
  const end = new Date(i.start.getTime() + i.durationMins * 60_000);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coral//Interviews//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${i.method ?? 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${i.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(i.start)}`,
    `DTEND:${fmt(end)}`,
    `SEQUENCE:${i.sequence ?? 0}`,
    `STATUS:${i.status ?? 'CONFIRMED'}`,
    `SUMMARY:${esc(i.title)}`,
  ];

  const desc = [i.description, i.url].filter(Boolean).join('\n\n');
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (i.location) lines.push(`LOCATION:${esc(i.location)}`);
  if (i.url) lines.push(`URL:${esc(i.url)}`);
  if (i.organizerEmail) lines.push(`ORGANIZER:mailto:${i.organizerEmail}`);
  if (i.attendeeEmail) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${i.attendeeEmail}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
