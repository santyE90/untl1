export function isValidIanaTimeZone(value: string) {
  if (!value || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(); return true; }
  catch { return false; }
}

export function supportedIanaTimeZones() {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/Toronto", "America/Vancouver", "America/New_York", "Europe/London", "Asia/Tokyo"];
}
