// Time handling. The workbook stores MST — the protocol converts GPS UTC
// timestamps to MST before entry — so exports use a FIXED UTC-7 forever.
// This is deliberately immune to Alberta's move to permanent daylight time
// (civil clocks will read UTC-6 in winter after the switch): the dataset
// keeps one convention across all years, and QC cross-referencing against
// audio/photos (which stamp civil time) simply allows for the 1-hour skew.

export interface MstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function mstParts(date: Date): MstParts {
  const shifted = new Date(date.getTime() - 7 * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Recruitment year: the calendar year of the immediately previous June
 *  (when calves are born) — Jan–May look to last year, Jun–Dec to this one.
 *  E.g. a Jan-1970 survey recruits from June 1969 → 1969. */
export function recruitmentYear(date: Date): number {
  const p = mstParts(date);
  return p.month >= 6 ? p.year : p.year - 1;
}

/** Management year spans the winter across New Year's: "1969-1970". */
export function managementYear(date: Date): string {
  const ry = recruitmentYear(date);
  return `${ry}-${ry + 1}`;
}
