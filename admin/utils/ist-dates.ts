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

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00+05:30`);
  date.setTime(date.getTime() + days * 86_400_000);
  return ymdInKolkata(date);
}

export type DayRange = {
  startIso: string;
  endIso: string;
  startYmd: string;
  endYmd: string;
};

export function istRangeForPreset(
  preset: 'today' | 'yesterday' | '7d' | '30d',
  now = new Date(),
): DayRange {
  const today = ymdInKolkata(now);
  if (preset === 'today') {
    return { startIso: startOfIstDayIso(today), endIso: endOfIstDayIso(today), startYmd: today, endYmd: today };
  }
  if (preset === 'yesterday') {
    const ymd = addDaysYmd(today, -1);
    return { startIso: startOfIstDayIso(ymd), endIso: endOfIstDayIso(ymd), startYmd: ymd, endYmd: ymd };
  }
  const days = preset === '7d' ? 6 : 29;
  const startYmd = addDaysYmd(today, -days);
  return {
    startIso: startOfIstDayIso(startYmd),
    endIso: endOfIstDayIso(today),
    startYmd,
    endYmd: today,
  };
}

export function istRangeForCustom(fromYmd: string, toYmd: string): DayRange {
  const startYmd = fromYmd <= toYmd ? fromYmd : toYmd;
  const endYmd = fromYmd <= toYmd ? toYmd : fromYmd;
  return {
    startIso: startOfIstDayIso(startYmd),
    endIso: endOfIstDayIso(endYmd),
    startYmd,
    endYmd,
  };
}

export function todayYmd(now = new Date()): string {
  return ymdInKolkata(now);
}
