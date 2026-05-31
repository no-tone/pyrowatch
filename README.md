<div align="center">

# PyroWatch

[![Astro](https://img.shields.io/badge/Astro-6.x-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![D3.js](https://img.shields.io/badge/D3.js-7.x-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.x-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)

<p>
  <a href="#project-goal">Project Goal</a>
  ·
  <a href="#dashboard-features">Features</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#installation">Installation</a>
  ·
  <a href="#development">Development</a>
  ·
  <a href="#build">Build</a>
</p>

Portuguese version: [README.pt.md](README.pt.md)

</div>

---

PyroWatch is a geographic dashboard about rural fires in Portugal. It combines an interactive Leaflet map with D3.js visualizations built from official INE/ICNF forestry statistics.

The project was built for a data visualization / geographic information assignment. It is a static Astro app, so it can be deployed to GitHub Pages without a backend.

## Project Goal

PyroWatch helps explore rural fire activity across Portuguese NUTS-3 regions. It focuses on:

- geographic distribution of rural fire occurrences;
- proportion of burned area;
- regional comparison between Norte, Centro, Lisboa, Alentejo, and Algarve;
- top municipalities by number of fires;
- interactive layout composition through drag-and-drop KPI cards.

## Data Sources

The dashboard uses official public data:

| Dataset | Indicator | Description | Latest snapshot |
|---|---:|---|---:|
| INE / ICNF | `0008386` | Rural fires, by geographic location, annual | 2023 |
| INE / ICNF | `0013537` | Proportion of burned area, by geographic location and burned surface type, annual | 2024 |

Runtime behavior:

1. The app loads local JSON snapshots from `public/data/`.
2. These snapshots are official INE responses saved with the project.
3. Refresh redraws the dashboard from the same data source layer.
4. The architecture keeps remote INE endpoints in the code, but local snapshots make the GitHub Pages deployment reliable even if the API is slow, blocked, or rate-limited.

Local data files:

- `public/data/incendios-rurais-ine.json`
- `public/data/superficie-ardida-ine.json`

## Dashboard Features

- Dark mode dashboard UI.
- Fixed full-height sidebar.
- Scrollable KPI list inside the sidebar.
- Scrollable main dashboard area.
- Leaflet map centered on mainland Portugal.
- Circle markers for NUTS-3 regions.
- Metric selector for fire occurrences or burned area share.
- Marker click filters dashboard by region.
- D3 tooltips on charts.
- Drag KPIs from sidebar into dashboard slots.
- Reorder existing charts by dragging cards inside the grid.
- Remove a chart with the `x` button.
- Removed/empty slots persist after refresh and page reload.
- Layout and selected metric are saved to `localStorage`.

## D3 Visualizations

Available KPI chart types:

| Chart | D3 technique | Purpose |
|---|---|---|
| Top regions | Horizontal bar chart | Compare NUTS-3 regions by rural fire count |
| Regional distribution | Donut chart | Compare fire counts by major region group |
| Occurrences vs burned area | Scatter plot | Relate fire count to burned surface share |
| Top municipalities | Horizontal bar chart | Show municipalities with most rural fires |
| Burned area type | Vertical bar chart | Compare burned surface types |
| Annual evolution | Line chart | Show national annual fire-count trend when historical data is available |
| Cumulative trend | Area chart | Show accumulated national fire count trend |
| Regional weight | Treemap | Show proportional regional contribution |
| Region/indicator matrix | Heatmap | Compare fire count and burned share by region group |
| Burned area ranking | Lollipop chart | Rank regions by burned area share |
| National summary | KPI cards | Show totals, averages, top region, and high-fire region count |

## Interaction Model

The page has two work areas:

- left sidebar: data metric selector, KPI chart list, data source info, refresh action;
- right workspace: map, selected-region summary, and chart grid.

Drag-and-drop behavior:

- dragging from sidebar into a slot creates/replaces a chart;
- dragging a chart card onto another slot swaps both charts;
- deleting a chart sets that slot to empty;
- empty slots stay empty after refresh because empty state is saved explicitly.

## Architecture

```text
src/
  pages/
    index.astro            Astro page composition
  layouts/
    Layout.astro           HTML shell
  components/
    Sidebar.astro          Controls, KPI sources, source info
    MapPanel.astro         Map container and selected-region summary
    ChartGrid.astro        Dashboard drop slots
  scripts/
    dashboard.js           D3, Leaflet, data parsing, state, interactions
  styles/
    dashboard.css          Dark UI, layout, responsive behavior
public/
  data/
    incendios-rurais-ine.json
    superficie-ardida-ine.json
```

## Technical Choices

- **Astro**: static build, simple GitHub Pages deployment, low runtime overhead.
- **D3.js**: custom SVG charts, scales, axes, transitions, treemap, heatmap, donut, and interaction tooltips.
- **Leaflet**: lightweight geographic map, markers, zoom controls, and region selection.
- **LocalStorage**: persistence for dashboard layout and metric selection.
- **CSS Grid/Flexbox**: fixed sidebar plus scrollable dashboard workspace.

## Limitations

- NUTS-3 marker positions are approximate centroids, not administrative polygons.
- The dashboard uses official snapshots for reliability; refreshing does not guarantee newer data unless snapshots are updated.
- Some INE indicators expose only the latest period in the current JSON response, so trend charts depend on historical availability from the data endpoint.
- The map is a proportional marker map, not a full choropleth boundary map.

## Possible Future Work

- Add NUTS-3 GeoJSON polygons for a true choropleth.
- Add year selector if historical periods are made available in the snapshot.
- Add data-update script to refresh local snapshots automatically.
- Add export to PNG/PDF for report submission.
- Add comparison mode between two regions.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Local route:

```text
http://127.0.0.1:4321/pyrowatch
```

## Build

```bash
npm run build
npm run preview
```
