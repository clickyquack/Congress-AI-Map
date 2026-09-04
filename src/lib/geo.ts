import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Member, SenateRank, SenateSeatFilter, Stance } from './types'

export interface ColoredFeatureProps {
  id: string
  label: string
  memberId?: string
  memberName?: string
  party?: string
  stance: Stance
  state: string
  district?: number
  split?: 'west' | 'east'
  senateRank?: SenateRank
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

/** Census STATEFP → postal */
export const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY', '72': 'PR',
}

export function stateName(abbr: string): string {
  return STATE_NAMES[abbr] || abbr
}

export function memberForHouse(
  members: Member[],
  state: string,
  district?: number,
): Member | undefined {
  return members.find(
    (m) =>
      m.chamber === 'house' &&
      m.state === state &&
      Number(m.district) === Number(district),
  )
}

export function memberForSenate(
  members: Member[],
  state: string,
  rank: SenateRank,
): Member | undefined {
  return members.find(
    (m) => m.chamber === 'senate' && m.state === state && m.senateRank === rank,
  )
}

function senateFeature(
  geometry: Geometry,
  state: string,
  member: Member | undefined,
  stanceById: Map<string, Stance>,
  rank: SenateRank,
  split?: 'west' | 'east',
): Feature {
  const stance = member ? stanceById.get(member.bioguideId) || 'unknown' : 'unknown'
  const rankLabel = rank === 'senior' ? 'Senior senator' : 'Junior senator'
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: split ? `${state}-${rank}-${split}` : `${state}-${rank}`,
      label: `${stateName(state)} · ${rankLabel}`,
      memberId: member?.bioguideId,
      memberName: member?.name,
      party: member?.party,
      stance,
      state,
      split,
      senateRank: rank,
    } satisfies ColoredFeatureProps,
  }
}

export function joinSenateFeatures(
  statesGeo: FeatureCollection,
  members: Member[],
  stanceById: Map<string, Stance>,
  seat: SenateSeatFilter,
): FeatureCollection {
  const features: Feature[] = []
  for (const f of statesGeo.features) {
    const fips = String(f.id ?? f.properties?.STATEFP ?? '').padStart(2, '0')
    const state = FIPS_TO_STATE[fips]
    if (!state || state === 'PR' || state === 'DC') continue
    const geometry = f.geometry as Geometry
    if (seat === 'both') {
      features.push(
        senateFeature(
          geometry,
          state,
          memberForSenate(members, state, 'senior'),
          stanceById,
          'senior',
          'west',
        ),
        senateFeature(
          geometry,
          state,
          memberForSenate(members, state, 'junior'),
          stanceById,
          'junior',
          'east',
        ),
      )
      continue
    }
    features.push(
      senateFeature(
        geometry,
        state,
        memberForSenate(members, state, seat),
        stanceById,
        seat,
      ),
    )
  }
  return { type: 'FeatureCollection', features }
}

export function joinHouseFeatures(
  districts: FeatureCollection,
  members: Member[],
  stanceById: Map<string, Stance>,
): FeatureCollection {
  const features: Feature[] = []
  for (const f of districts.features) {
    const state = f.properties?.state as string
    const district = Number(f.properties?.district)
    if (!state) continue
    const member = memberForHouse(members, state, district)
    const stance = member ? stanceById.get(member.bioguideId) || 'unknown' : 'unknown'
    const distLabel = district === 0 ? 'At-Large' : `District ${district}`
    features.push({
      type: 'Feature',
      geometry: f.geometry as Geometry,
      properties: {
        id: `${state}-${district}`,
        label: `${stateName(state)} · ${distLabel}`,
        memberId: member?.bioguideId,
        memberName: member?.name,
        party: member?.party,
        stance,
        state,
        district,
      } satisfies ColoredFeatureProps,
    })
  }
  return { type: 'FeatureCollection', features }
}
