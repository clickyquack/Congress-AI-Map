import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { ColoredFeatureProps } from '../lib/geo'
import { joinHouseFeatures, joinSenateFeatures } from '../lib/geo'
import type { MapView as MapViewMode, Member, PartyFilter, Stance } from '../lib/types'
import { STANCE_COLORS, STANCE_SHORT } from '../lib/types'

interface Props {
  view: MapViewMode
  members: Member[]
  stanceById: Map<string, Stance>
  partyFilter: PartyFilter
  stanceFilter: Stance | 'All'
  selectedId: string | null
  onSelect: (memberId: string | null) => void
}

export function MapView({
  view,
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
    if (view === 'house') {
      if (!districts) return null
      return joinHouseFeatures(districts, members, stanceById)
    }
    if (!statesTopo) return null
    return joinSenateFeatures(statesTopo, members, stanceById, view)
  }, [view, members, stanceById, statesTopo, districts])

  useEffect(() => {
    if (!joined || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${size.w} ${size.h}`)

    const projection = d3.geoAlbersUsa().fitSize([size.w, size.h], joined)
    const path = d3.geoPath(projection)
    const g = svg.append('g')

    g.selectAll('path')
      .data(joined.features)
      .join('path')
      .attr('d', (d) => path(d) || '')
      .attr('fill', (d) => {
        const p = d.properties as ColoredFeatureProps
        if (partyFilter !== 'All' && p.party && p.party !== partyFilter) {
          return '#ebe7de'
        }
        if (stanceFilter !== 'All' && p.stance !== stanceFilter) {
          return '#ebe7de'
        }
        return STANCE_COLORS[p.stance] || STANCE_COLORS.unknown
      })
      .attr('stroke', (d) => {
        const p = d.properties as ColoredFeatureProps
        return p.memberId && p.memberId === selectedId ? '#1a1a1a' : '#f7f4ee'
      })
      .attr('stroke-width', (d) => {
        const p = d.properties as ColoredFeatureProps
        return p.memberId && p.memberId === selectedId
          ? 2.2
          : view === 'house'
            ? 0.35
            : 0.8
      })
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
  }, [joined, partyFilter, stanceFilter, selectedId, onSelect, view, size])

  return (
    <div className="map-wrap" ref={wrapRef}>
      {!joined && <div className="map-loading">Loading map…</div>}
      <svg ref={svgRef} className="map-svg" role="img" aria-label="US Congress AI stance map" />
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
