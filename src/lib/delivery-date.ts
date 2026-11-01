import Holidays from "date-holidays";

export const STATES = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"] as const;
export type State = typeof STATES[number];
export function berlinDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}
export function addWorkingDays(start: string, state: State, days = 5): string {
  const holidays = new Holidays("DE", state);
  const date = new Date(`${start}T12:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const holiday = holidays.isHoliday(date);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && (!holiday || !holiday.some(h => h.type === "public"))) remaining--;
  }
  return date.toISOString().slice(0, 10);
}
export function dueDate(deliveredOn: string) {
  const date = new Date(`${deliveredOn}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}
