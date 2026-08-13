function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDateOrdinal(date: string): string {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return date;

  return `${day}${ordinalSuffix(day)} ${MONTH_NAMES[month - 1]}, ${year}`;
}

const MONTH_ABBR = MONTH_NAMES.map((name) => name.slice(0, 3));

/**
 * Formats a full timestamp (e.g. an ISO string) as an ordinal date with
 * abbreviated month + 12-hour time, no seconds: "7th Aug, 2026, 10:12 PM".
 */
export function formatDateTimeOrdinal(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;

  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();

  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${day}${ordinalSuffix(day)} ${month}, ${year}, ${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Formats a "YYYY-MM-DD" date as day + abbreviated month + year, e.g.
 * "30 Aug, 2026" — the convention used on spot cards.
 */
export function formatSpotDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
}

/**
 * Formats a "HH:MM" time string as 12-hour with lowercase am/pm, e.g.
 * "7:00 pm" — the convention used on spot cards.
 */
export function formatTime12h(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr ?? 0);
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}
