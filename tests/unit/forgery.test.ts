import { describe, expect, it } from 'vitest'
import { pigmentVerdict, terminusPostQuem, type PigmentInfo } from '../../src/plugins/forgery/pigments'
import { SAPWOOD, dendroVerdict, fellingDates, plausibleFrom } from '../../src/plugins/forgery/dendro'
import { BOMB_NH1, f14cAt, isPreBomb, matchWindows } from '../../src/plugins/forgery/carbon'
import { chainStats } from '../../src/plugins/forgery/provenance'
import { readCourses } from '../../scripts/read-courses'

const CATALOG: Record<string, PigmentInfo> = {
  'lead-white': { id: 'lead-white', name: 'Lead white', earliest: null, when: 'antiquity' },
  'prussian-blue': { id: 'prussian-blue', name: 'Prussian blue', earliest: 1704, when: '1704' },
  'zinc-white': { id: 'zinc-white', name: 'Zinc white', earliest: 1800, when: 'early 19th century' },
  'titanium-rutile': { id: 'titanium-rutile', name: 'Titanium white (rutile)', earliest: 1937, when: '1937/38' },
}

describe('pigment dating (terminus post quem)', () => {
  it('takes the newest material as the earliest possible date', () => {
    const tpq = terminusPostQuem(
      [
        { pigment: 'lead-white', where: 'collar' },
        { pigment: 'prussian-blue', where: 'sky' },
        { pigment: 'zinc-white', where: 'cloud' },
      ],
      CATALOG,
    )
    expect(tpq).toEqual({ year: 1800, pigment: 'zinc-white' })
    expect(pigmentVerdict(1631, tpq)).toBe('anachronism')
    expect(pigmentVerdict(1875, tpq)).toBe('consistent')
  })

  it('the Campendonk case: rutile titanium white (1937/38) in a picture signed 1914', () => {
    const tpq = terminusPostQuem([{ pigment: 'titanium-rutile', where: 'two paint layers' }], CATALOG)
    expect(pigmentVerdict(1914, tpq)).toBe('anachronism')
  })

  it('ignores retouchings unless asked: a modern restoration does not date the picture', () => {
    const found = [
      { pigment: 'lead-white', where: 'face' },
      { pigment: 'titanium-rutile', where: 'old damage', retouch: true },
    ]
    expect(terminusPostQuem(found, CATALOG)).toEqual({ year: null, pigment: null })
    expect(terminusPostQuem(found, CATALOG, { ignoreRetouch: false }).year).toBe(1937)
  })

  it('pigments from antiquity never constrain the date', () => {
    expect(pigmentVerdict(1500, terminusPostQuem([{ pigment: 'lead-white', where: 'x' }], CATALOG))).toBe('consistent')
  })

  it('refuses an unknown pigment id', () => {
    expect(() => terminusPostQuem([{ pigment: 'nope', where: 'x' }], CATALOG)).toThrow(/unknown pigment/)
  })
})

describe('dendrochronology (Klein, NGV Art Journal 40)', () => {
  it('reproduces worked example 1: youngest ring 1466, Baltic oak', () => {
    const f = fellingDates(1466, 'baltic')
    expect(f.earliest).toBe(1475) // + minimum 9 sapwood rings
    expect(f.median).toBe(1481) // + median 15
    expect(plausibleFrom(1466, 'baltic', 10)).toBe(1491) // + ten years' seasoning
  })

  it('reproduces worked example 2: youngest ring 1603, Baltic oak', () => {
    expect(fellingDates(1603, 'baltic').earliest).toBe(1612)
    expect(plausibleFrom(1603, 'baltic', 2)).toBe(1620)
  })

  it('uses the western-European sapwood statistics', () => {
    expect(SAPWOOD.west).toEqual({ min: 7, median: 17, max: 50 })
    expect(fellingDates(1600, 'west').earliest).toBe(1607)
  })

  it('surviving sapwood shortens the estimate', () => {
    expect(fellingDates(1500, 'baltic', 5).earliest).toBe(1504)
    expect(fellingDates(1500, 'baltic', 20).earliest).toBe(1500) // more sapwood than the minimum: felled no earlier than the last ring
  })

  it('grades a claimed date against the panel', () => {
    expect(dendroVerdict(1559, 1561, 'baltic', 2)).toBe('impossible')
    expect(dendroVerdict(1480, 1466, 'baltic', 10)).toBe('tight')
    expect(dendroVerdict(1631, 1598, 'baltic', 2)).toBe('consistent')
    expect(dendroVerdict(1500, 0, 'poplar', 2)).toBe('undatable')
  })
})

describe('radiocarbon bomb curve (Hua et al. 2022, NH zone 1)', () => {
  it('has the 70 annual values with the published shape', () => {
    expect(BOMB_NH1).toHaveLength(70)
    expect(BOMB_NH1[0]).toEqual([1950.5, 0.9741])
    expect(BOMB_NH1[BOMB_NH1.length - 1]).toEqual([2019.5, 1.0085])
    const peak = BOMB_NH1.reduce((a, b) => (b[1] > a[1] ? b : a))
    expect(peak).toEqual([1964.5, 1.8993]) // nearly double the pre-bomb level
  })

  it('interpolates between annual values', () => {
    expect(f14cAt(1964.5)).toBeCloseTo(1.8993, 4)
    expect(f14cAt(1964)).toBeCloseTo((1.831 + 1.8993) / 2, 4)
    expect(f14cAt(1900)).toBe(0.9741) // clamped
  })

  it('a measurement near the peak has one window', () => {
    const w = matchWindows(1.8993, 0.005)
    expect(w).toHaveLength(1)
    expect(w[0][0]).toBeGreaterThan(1963.5)
    expect(w[0][1]).toBeLessThan(1965)
  })

  it('a modern binder matches a year on the rise and a year on the fall (as in the Trotter case)', () => {
    const w = matchWindows(1.21, 0.006)
    expect(w.length).toBe(2)
    expect(w[0][0]).toBeGreaterThan(1958)
    expect(w[0][1]).toBeLessThan(1960)
    expect(w[1][0]).toBeGreaterThan(1983)
    expect(w[1][1]).toBeLessThan(1990)
  })

  it('recognises pre-bomb material', () => {
    expect(isPreBomb(0.976, 0.003)).toBe(true)
    expect(isPreBomb(1.21, 0.006)).toBe(false)
    expect(matchWindows(0.976, 0.003)[0][0]).toBe(1950.5)
  })
})

describe('provenance chain statistics', () => {
  const links = [
    { from: 1631, to: 1700 },
    { from: 1780, to: 1850 },
    { from: 1850, to: 1938 },
    { from: 1938, to: 1951 },
    { from: 1951, to: 2026 },
  ]

  it('counts documented years and finds the gaps', () => {
    const s = chainStats(links, ['weak', 'weak', 'documented', 'red', 'red'], 1631, 2026)
    expect(s.totalYears).toBe(395)
    expect(s.documentedYears).toBe(88)
    expect(s.gaps).toEqual([
      [1631, 1850],
      [1938, 2026],
    ])
    expect(s.longestGap).toBe(219)
    expect(s.naziEraGap).toBe(true)
  })

  it('a fully documented chain has no gaps', () => {
    const s = chainStats(links, ['documented', 'documented', 'documented', 'documented', 'documented'], 1631, 1700)
    expect(s.coverage).toBe(1)
    expect(s.gaps).toEqual([])
    expect(s.naziEraGap).toBe(false)
  })
})

describe('art-forgery course data', () => {
  const raw = readCourses('art-forgery')[0]

  it('every pigment-lab case uses known pigments and its stated answer matches the maths', () => {
    for (const lesson of Object.values(raw.lessons) as { steps: { widget?: string; props?: Record<string, unknown> }[] }[]) {
      for (const step of lesson.steps) {
        if (step.widget !== 'pigment-lab') continue
        const catalog = Object.fromEntries((step.props!.items as PigmentInfo[]).map((p) => [p.id, p]))
        for (const c of step.props!.cases as { claimed: number; found: { pigment: string; where: string; retouch?: boolean }[]; expect: string }[]) {
          expect(pigmentVerdict(c.claimed, terminusPostQuem(c.found, catalog))).toBe(c.expect)
        }
      }
    }
  })

  it('every dendro-lab case states the verdict the maths gives', () => {
    for (const lesson of Object.values(raw.lessons) as { steps: { widget?: string; props?: Record<string, unknown> }[] }[]) {
      for (const step of lesson.steps) {
        if (step.widget !== 'dendro-lab') continue
        for (const c of step.props!.cases as { claimed: number; lastRing: number; origin: 'baltic' | 'west' | 'poplar'; seasoning: number; expect: string }[]) {
          expect(dendroVerdict(c.claimed, c.lastRing, c.origin, c.seasoning)).toBe(c.expect)
        }
      }
    }
  })
})
