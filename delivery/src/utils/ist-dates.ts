const IST = 'Asia/Kolkata';

function ymdInKolkata(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function startOfIstDayIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toISOString();
}

export function endOfIstDayIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999+05:30`).toISOString();
}

/** Delivered-today filter uses order `updated_at` in Asia/Kolkata. */
export function istTodayBounds(now = new Date()): { startIso: string; endIso: string; ymd: string } {
  const ymd = ymdInKolkata(now);
  return {
    ymd,
    startIso: startOfIstDayIso(ymd),
    endIso: endOfIstDayIso(ymd),
  };
}
