/**
 * Radiocarbon and the "bomb peak". Atmospheric nuclear tests (1954–1963) nearly
 * doubled the carbon-14 in the air; it has been falling ever since. Oil pressed
 * from seeds records the air of the year they grew, so a modern binder carries
 * the spike — and one measurement can match a year on the way up and a year on
 * the way down.
 *
 * Data: annual mean atmospheric 14C, Northern Hemisphere zone 1, 1950–2019
 * (Hua et al. 2022, Radiocarbon 64, doi:10.1017/RDC.2021.95), from the
 * rintcal package file postbomb_NH1.14C. 14C ages were converted to
 * F14C = exp(−age/8033). Years are mid-year (1950.5 = mid-1950).
 */

/** [year, F14C] — 70 annual values, generated from the published table. */
export const BOMB_NH1: [number, number][] = [
  [1950.5, 0.9741], [1951.5, 0.9742], [1952.5, 0.9743], [1953.5, 0.9764], [1954.5, 0.9775], [1955.5, 1.0137],
  [1956.5, 1.0408], [1957.5, 1.0820], [1958.5, 1.1542], [1959.5, 1.2975], [1960.5, 1.2295], [1961.5, 1.2266],
  [1962.5, 1.3891], [1963.5, 1.8310], [1964.5, 1.8993], [1965.5, 1.7853], [1966.5, 1.7105], [1967.5, 1.6374],
  [1968.5, 1.5785], [1969.5, 1.5627], [1970.5, 1.5267], [1971.5, 1.5169], [1972.5, 1.4649], [1973.5, 1.4461],
  [1974.5, 1.4191], [1975.5, 1.3903], [1976.5, 1.3603], [1977.5, 1.3405], [1978.5, 1.3325], [1979.5, 1.2955],
  [1980.5, 1.2787], [1981.5, 1.2678], [1982.5, 1.2479], [1983.5, 1.2349], [1984.5, 1.2171], [1985.5, 1.2101],
  [1986.5, 1.1972], [1987.5, 1.1894], [1988.5, 1.1774], [1989.5, 1.1685], [1990.5, 1.1566], [1991.5, 1.1478],
  [1992.5, 1.1429], [1993.5, 1.1340], [1994.5, 1.1250], [1995.5, 1.1201], [1996.5, 1.1123], [1997.5, 1.1083],
  [1998.5, 1.1065], [1999.5, 1.0995], [2000.5, 1.0927], [2001.5, 1.0878], [2002.5, 1.0819], [2003.5, 1.0759],
  [2004.5, 1.0721], [2005.5, 1.0661], [2006.5, 1.0642], [2007.5, 1.0583], [2008.5, 1.0554], [2009.5, 1.0525],
  [2010.5, 1.0477], [2011.5, 1.0438], [2012.5, 1.0388], [2013.5, 1.0308], [2014.5, 1.0280], [2015.5, 1.0230],
  [2016.5, 1.0201], [2017.5, 1.0163], [2018.5, 1.0124], [2019.5, 1.0085],
]

const FIRST = BOMB_NH1[0][0]
const LAST = BOMB_NH1[BOMB_NH1.length - 1][0]

/** F14C of the northern-hemisphere air at a (fractional) year, linearly interpolated. */
export function f14cAt(year: number): number {
  if (year <= FIRST) return BOMB_NH1[0][1]
  if (year >= LAST) return BOMB_NH1[BOMB_NH1.length - 1][1]
  const i = Math.floor(year - FIRST)
  const [x0, y0] = BOMB_NH1[i]
  const [x1, y1] = BOMB_NH1[i + 1]
  return y0 + ((y1 - y0) * (year - x0)) / (x1 - x0)
}

/**
 * Calendar windows (within 1950.5–2019.5) where the curve lies within k·σ of a
 * measured F14C. A pre-bomb sample matches the flat start of the curve: the
 * window then begins at 1950.5 and means "about 1955 or earlier".
 */
export function matchWindows(F: number, sigma: number, k = 2, step = 0.02): [number, number][] {
  const tol = k * sigma
  const out: [number, number][] = []
  let start: number | null = null
  let prev = FIRST
  const n = Math.round((LAST - FIRST) / step)
  for (let j = 0; j <= n; j++) {
    const t = FIRST + j * step
    const inside = Math.abs(f14cAt(t) - F) <= tol
    if (inside && start === null) start = t
    if (!inside && start !== null) {
      out.push([round1(start), round1(prev)])
      start = null
    }
    prev = t
  }
  if (start !== null) out.push([round1(start), round1(LAST)])
  return out
}

/** True when the measurement sits on the pre-bomb plateau (before the 1955 rise). */
export function isPreBomb(F: number, sigma: number, k = 2) {
  return F + k * sigma < f14cAt(1955.5)
}

const round1 = (x: number) => Math.round(x * 10) / 10
