"use client";

import { useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { CoverageStatus } from "@/engines/matching";

export interface MapNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "kitchen" | "kopdes";
}

export interface MapLink {
  from: MapNode;
  to: MapNode;
  status: CoverageStatus;
  label: string;
}

const LINE: Record<CoverageStatus, { color: string; dash?: string }> = {
  green: { color: "#2e9e5b" },
  yellow: { color: "#c98a0c", dash: "10 6" },
  red: { color: "#c8412d", dash: "3 6" },
  none: { color: "#a9a59b", dash: "2 6" },
};

export default function RegencyMapInner({ nodes, links, onTilesFailed }: { nodes: MapNode[]; links: MapLink[]; onTilesFailed: () => void }) {
  const [errors, setErrors] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats) - 0.012, Math.min(...lngs) - 0.02],
    [Math.max(...lats) + 0.012, Math.max(...lngs) + 0.02],
  ];
  return (
    <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-[420px] w-full" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          tileload: () => setLoaded(true),
          tileerror: () => {
            const n = errors + 1;
            setErrors(n);
            if (!loaded && n >= 3) onTilesFailed();
          },
        }}
      />
      {links.map((l) => (
        <Polyline
          key={`${l.from.id}-${l.to.id}`}
          positions={[
            [l.from.lat, l.from.lng],
            [l.to.lat, l.to.lng],
          ]}
          pathOptions={{ color: LINE[l.status].color, weight: 5, dashArray: LINE[l.status].dash, opacity: 0.9 }}
        >
          <Tooltip sticky>{l.label}</Tooltip>
        </Polyline>
      ))}
      {nodes.map((n) => (
        <CircleMarker
          key={n.id}
          center={[n.lat, n.lng]}
          radius={n.kind === "kopdes" ? 13 : 10}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: n.kind === "kopdes" ? "#1f6f4a" : "#e3a21a", fillOpacity: 1 }}
        >
          <Tooltip permanent direction={n.kind === "kopdes" ? "top" : "bottom"} offset={[0, n.kind === "kopdes" ? -12 : 10]}>
            {n.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
