# PyroWatch

[![Astro](https://img.shields.io/badge/Astro-6.x-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![D3.js](https://img.shields.io/badge/D3.js-7.x-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.x-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Preview](#preview) · [Workflow](#workflow) · [Data Sources](#data-sources) · [Project Structure](#project-structure) · [Installation](#installation) · [Development](#development)

---

Fire risk monitoring dashboard for Portugal. Displays rural fire statistics and burned area data from INE (Statistics Portugal) using an interactive map and D3.js charts.

Built with Astro + D3.js + Leaflet. Dark-themed single-page dashboard with drag-and-drop KPI layout and state persistence.

## Preview

Map markers show NUTS-3 regions with proportional circles (color-scaled by fire count or burned share). Click a marker to filter charts to that region. Six D3.js chart types: bar chart (top regions), donut (regional distribution), scatter (fires vs burned area), municipalities ranking, land use breakdown, and national summary cards.

## Workflow

### Data Pipeline

1. App loads on page init
2. Fetches two JSON datasets from INE (Statistics Portugal) via `dados.gov.pt` API, with local JSON snapshots as fallback
3. Data is parsed into regional NUTS-3 objects with fire counts and burned area percentages
4. Update propagates to all components: map, summary panel, and all KPI charts

### Data Sources

- **Incendios Rurais** (Rural Fires): Number of rural fires by NUTS-3 region (annual). Source: ICNF/DRRF RAA/IFCN RAM via INE indicator 0008386.
- **Superficie Ardida** (Burned Area): Proportion of burned area (%) by NUTS-3 region and land type (annual). Source: ICNF via INE indicator 0013537.
- Data is fetched live from INE API on each refresh. Falls back to local JSON snapshots in `public/data/` when the API is unreachable.
- Local snapshots are updated manually by rebuilding the app with fresh data.

### Map

- Leaflet map centered on mainland Portugal (zoom disabled for scroll)
- Dark-themed tiles via CSS filter
- Circle markers for each NUTS-3 region, color scale (YlOrRd) by metric value
- Click to select/deselect region; selected region highlights with outline
- Hover tooltip shows value per region
- Metric selector switches between fire count and burned share

### Charts

Six D3.js chart types rendered in a 2-column grid:

| Chart | Type | Description |
|-------|------|-------------|
| Top regioes | Horizontal bar | Top 8 NUTS-3 by fire count |
| Distribuicao regional | Donut | Grouped by Norte/Centro/Lisboa/Alentejo/Algarve |
| Ocorrencias vs ardida | Scatter | Fires vs burned share per region |
| Top municipios | Horizontal bar | Top 8 municipalities by fire count |
| Tipo de area ardida | Vertical bar | Burned area by land type (matos, povoamentos, etc.) |
| Resumo nacional | Stat cards | Total fires, average burned share, top region, regions >=300 fires |

### Interactivity

- **Drag-and-drop**: Drag KPI buttons from sidebar into dashboard slots to place charts. Drop on an occupied slot replaces it.
- **Remove chart**: Click the X on any chart card to clear its slot.
- **Save/Restore**: Save button persists current layout and metric to localStorage. Layout restores on page load.
- **Refresh**: Re-fetches live data from INE API and redraws all charts.
- **Region filter**: Click a map marker to filter all charts to that NUTS-3 region. Charts update with filtered data.

### State Management

- `selectedMetric`: `fires` or `burnedShare` — controls map and chart values
- `selectedRegion`: active NUTS-3 filter (null = all of Portugal)
- Layout (which chart type is in each grid slot) and selected metric saved to `localStorage` under `pyrowatch-state`

## Project Structure

```
src/
  pages/index.astro       Main page layout
  layouts/Layout.astro    HTML shell
  components/
    Sidebar.astro          Brand, metric selector, KPI drag sources, source info, actions
    MapPanel.astro         Leaflet map container + summary panel
    ChartGrid.astro        2-column drop-slot grid for D3 charts
  scripts/dashboard.js    All D3/Leaflet logic, data fetching, state, drag-drop
  styles/dashboard.css    Dark theme across all components
public/
  data/
    incendios-rurais-ine.json       Local snapshot of fire data
    superficie-ardida-ine.json      Local snapshot of burned area data
  favicon.ico
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens at `localhost:4321`.

## Build

```bash
npm run build
npm run preview
```

## Notes

- First load fetches INE API data; fallback to local JSON if API is unavailable.
- Map uses OpenStreetMap tiles with dark CSS inversion filter.
- All chart data reflects the currently selected metric (fires or burned share) and optional region filter.
- NUTS-3 region positions are approximate centroids for marker placement.
- Data refresh hits live INE endpoints; response time depends on API availability.
