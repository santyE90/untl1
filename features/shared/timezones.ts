export function isValidIanaTimeZone(value: string) {
  if (!value || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(); return true; }
  catch { return false; }
}

export function supportedIanaTimeZones() {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/Toronto", "America/Vancouver", "America/New_York", "Europe/London", "Asia/Tokyo"];
}

const familiarNames: Record<string, string> = {
  "America/Toronto": "Toronto · Eastern Time",
  "America/Vancouver": "Vancouver · Pacific Time",
  "America/Edmonton": "Edmonton · Mountain Time",
  "America/Winnipeg": "Winnipeg · Central Time",
  "America/Halifax": "Halifax · Atlantic Time",
  "America/St_Johns": "St. John’s · Newfoundland Time",
  "America/New_York": "New York · Eastern Time",
  "America/Chicago": "Chicago · Central Time",
  "America/Denver": "Denver · Mountain Time",
  "America/Los_Angeles": "Los Angeles · Pacific Time",
  "Europe/London": "London",
  "Europe/Paris": "Paris · Central European Time",
  "Asia/Kolkata": "Kolkata · India Standard Time",
  "Asia/Tokyo": "Tokyo · Japan Standard Time",
  "Australia/Sydney": "Sydney · Australian Eastern Time",
};

export function timeZoneLabel(zone: string) {
  const city = zone.split("/").at(-1)?.replaceAll("_", " ") ?? zone;
  return `${familiarNames[zone] ?? city} — ${zone}`;
}

export function supportedTimeZoneOptions() {
  const priority = Object.keys(familiarNames);
  const zones = supportedIanaTimeZones();
  return [...new Set([...priority.filter((zone) => zones.includes(zone) || isValidIanaTimeZone(zone)), ...zones])].map((value) => ({ value, label: timeZoneLabel(value) }));
}
