import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Feature, FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { ColoredFeatureProps } from '../lib/geo'
import { joinHouseFeatures, joinSenateFeatures } from '../lib/geo'
import type {
  MapChamber,
  Member,
  PartyFilter,
  SenateSeatFilter,
  Stance,
} from '../lib/types'
import { STANCE_COLORS, STANCE_SHORT } from '../lib/types'

interface Props {
  chamber: MapChamber
  senateSeat: SenateSeatFilter
  members: Member[]
  stanceById: Map<string, Stance>
  partyFilter: PartyFilter
  stanceFilter: Stance | 'All'
  selectedId: string | null
  onSelect: (memberId: string | null) => void
}

function fillFor(
  p: ColoredFeatureProps,
  partyFilter: PartyFilter,
  stanceFilter: Stance | 'All',
): string {
  if (partyFilter !== 'All' && p.party && p.party !== partyFilter) {
    return '#ebe7de'
  }
  if (stanceFilter !== 'All' && p.stance !== stanceFilter) {
    return '#ebe7de'
  }
  return STANCE_COLORS[p.stance] || STANCE_COLORS.unknown
}

export function MapView({
  chamber,
  senateSeat,
  members,
  stanceById,
  partyFilter,
  stanceFilter,
  selectedId,
  onSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [statesTopo, setStatesTopo] = useState<FeatureCollection | null>(null)
  const [districts, setDistricts] = useState<FeatureCollection | null>(null)
  const [size, setSize] = useState({ w: 960, h: 600 })
  const [hover, setHover] = useState<{
    x: number
    y: number
    props: ColoredFeatureProps
  } | null>(null)

  useEffect(() => {
    const geo = `${import.meta.env.BASE_URL}geo`
    fetch(`${geo}/states-10m.json`)
      .then((r) => r.json())
      .then((topo: Topology<{ states: GeometryCollection }>) => {
        const fc = feature(topo, topo.objects.states) as unknown as FeatureCollection
        setStatesTopo(fc)
      })
    fetch(`${geo}/districts-119.json`)
      .then((r) => r.json())
      .then((fc: FeatureCollection) => setDistricts(fc))
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ w: Math.max(320, cr.width), h: Math.max(280, cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const joined = useMemo(() => {
    if (chamber === 'house') {
      if (!districts) return null
      return joinHouseFeatures(districts, members, stanceById)
    }
    if (!statesTopo) return null
    return joinSenateFeatures(statesTopo, members, stanceById, senateSeat)
  }, [chamber, senateSeat, members, stanceById, statesTopo, districts])

  useEffect(() => {
    if (!joined || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${size.w} ${size.h}`)

    const projection = d3.geoAlbersUsa().fitSize([size.w, size.h], joined)
    const path = d3.geoPath(projection)
    const defs = svg.append('defs')
    const g = svg.append('g')

    const splitMode = chamber === 'senate' && senateSeat === 'both'

    const bindHover = (
      selection: d3.Selection<SVGPathElement, Feature, SVGGElement, unknown>,
    ) => {
      selection
        .style('cursor', (d) =>
          (d.properties as ColoredFeatureProps).memberId ? 'pointer' : 'default',
        )
        .on('mousemove', (event, d) => {
          const p = d.properties as ColoredFeatureProps
          if (!p.memberId) return
          const rect = wrapRef.current!.getBoundingClientRect()
          setHover({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            props: p,
          })
        })
        .on('mouseleave', () => setHover(null))
        .on('click', (_, d) => {
          const p = d.properties as ColoredFeatureProps
          if (p.memberId) onSelect(p.memberId)
        })
    }

    if (splitMode) {
      for (const d of joined.features) {
        const p = d.properties as ColoredFeatureProps
        if (!p.split) continue
        const bounds = path.bounds(d)
        const centroid = path.centroid(d)
        if (!bounds || !centroid || Number.isNaN(centroid[0])) continue
        const pad = 4
        const [[x0, y0], [x1, y1]] = bounds
        const cx = centroid[0]
        const clip = defs.append('clipPath').attr('id', `clip-${p.id}`)
        if (p.split === 'west') {
          clip
            .append('rect')
            .attr('x', x0 - pad)
            .attr('y', y0 - pad)
            .attr('width', Math.max(0, cx - (x0 - pad)))
            .attr('height', y1 - y0 + pad * 2)
        } else {
          clip
            .append('rect')
            .attr('x', cx)
            .attr('y', y0 - pad)
            .attr('width', Math.max(0, x1 + pad - cx))
            .attr('height', y1 - y0 + pad * 2)
        }
      }

      bindHover(
        g
          .selectAll<SVGPathElement, Feature>('path.state-fill')
          .data(joined.features)
          .join('path')
          .attr('class', 'state-fill')
          .attr('d', (d) => path(d) || '')
          .attr('clip-path', (d) => {
            const p = d.properties as ColoredFeatureProps
            return p.split ? `url(#clip-${p.id})` : null
          })
          .attr('fill', (d) =>
            fillFor(d.properties as ColoredFeatureProps, partyFilter, stanceFilter),
          )
          .attr('stroke', 'none') as d3.Selection<
          SVGPathElement,
          Feature,
          SVGGElement,
          unknown
        >,
      )

      const outlined = new Map<string, Feature>()
      for (const d of joined.features) {
        const p = d.properties as ColoredFeatureProps
        if (!outlined.has(p.state)) outlined.set(p.state, d)
      }
      g.selectAll('path.state-outline')
        .data([...outlined.values()])
        .join('path')
        .attr('class', 'state-outline')
        .attr('d', (d) => path(d) || '')
        .attr('fill', 'none')
        .attr('stroke', (d) => {
          const p = d.properties as ColoredFeatureProps
          const selected = joined.features.some((f) => {
            const fp = f.properties as ColoredFeatureProps
            return fp.state === p.state && fp.memberId && fp.memberId === selectedId
          })
          return selected ? '#1a1a1a' : '#f7f4ee'
        })
        .attr('stroke-width', (d) => {
          const p = d.properties as ColoredFeatureProps
          const selected = joined.features.some((f) => {
            const fp = f.properties as ColoredFeatureProps
            return fp.state === p.state && fp.memberId && fp.memberId === selectedId
          })
          return selected ? 2.2 : 0.8
        })
        .style('pointer-events', 'none')
    } else {
      bindHover(
        g
          .selectAll<SVGPathElement, Feature>('path')
          .data(joined.features)
          .join('path')
          .attr('d', (d) => path(d) || '')
          .attr('fill', (d) =>
            fillFor(d.properties as ColoredFeatureProps, partyFilter, stanceFilter),
          )
          .attr('stroke', (d) => {
            const p = d.properties as ColoredFeatureProps
            return p.memberId && p.memberId === selectedId ? '#1a1a1a' : '#f7f4ee'
          })
          .attr('stroke-width', (d) => {
            const p = d.properties as ColoredFeatureProps
            return p.memberId && p.memberId === selectedId
              ? 2.2
              : chamber === 'house'
                ? 0.35
                : 0.8
          }) as d3.Selection<SVGPathElement, Feature, SVGGElement, unknown>,
      )
    }
  }, [
    joined,
    partyFilter,
    stanceFilter,
    selectedId,
    onSelect,
    chamber,
    senateSeat,
    size,
  ])

  return (
    <div className="map-wrap" ref={wrapRef}>
      {!joined && <div className="map-loading">Loading map…</div>}
      <svg ref={svgRef} className="map-svg" role="img" aria-label="US Congress AI stance map" />
      {chamber === 'senate' && senateSeat === 'both' ? (
        <p className="map-caption">Left half = senior senator · Right half = junior senator</p>
      ) : null}
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="tooltip-name">
            {hover.props.memberName || 'Vacant / unmatched'}
            {hover.props.party ? ` (${hover.props.party})` : ''}
          </div>
          <div className="tooltip-meta">{hover.props.label}</div>
          <div className="tooltip-stance">
            <span
              className="swatch"
              style={{ background: STANCE_COLORS[hover.props.stance] }}
            />
            {STANCE_SHORT[hover.props.stance]}
          </div>
        </div>
      )}
    </div>
  )
}
