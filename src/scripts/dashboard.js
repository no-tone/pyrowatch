import * as d3 from 'd3';
import L from 'leaflet';

const INE_FIRE_URL = 'https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0008386&lang=PT';
const INE_BURNED_URL = 'https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0013537&lang=PT';
const BASE = import.meta.env.BASE_URL;
const LOCAL_FIRE_URL = `${BASE}/data/incendios-rurais-ine.json`;
const LOCAL_BURNED_URL = `${BASE}/data/superficie-ardida-ine.json`;
const CACHE_KEY = 'pyrowatch-state';
const DEFAULT_METRIC = 'fires';
const DEFAULT_LAYOUT = ['bar', 'donut', 'scatter', 'municipalities', 'landuse', 'cards'];

const nutsRegions = [
  { code: '111', name: 'Alto Minho', lat: 41.78, lng: -8.54, group: 'Norte' },
  { code: '112', name: 'Cávado', lat: 41.55, lng: -8.43, group: 'Norte' },
  { code: '119', name: 'Ave', lat: 41.44, lng: -8.30, group: 'Norte' },
  { code: '11A', name: 'Área Metropolitana do Porto', lat: 41.15, lng: -8.61, group: 'Norte' },
  { code: '11B', name: 'Alto Tâmega', lat: 41.74, lng: -7.47, group: 'Norte' },
  { code: '11C', name: 'Tâmega e Sousa', lat: 41.20, lng: -8.10, group: 'Norte' },
  { code: '11D', name: 'Douro', lat: 41.15, lng: -7.55, group: 'Norte' },
  { code: '11E', name: 'Terras de Trás-os-Montes', lat: 41.65, lng: -6.85, group: 'Norte' },
  { code: '16B', name: 'Oeste', lat: 39.23, lng: -9.15, group: 'Centro' },
  { code: '16D', name: 'Região de Aveiro', lat: 40.64, lng: -8.65, group: 'Centro' },
  { code: '16E', name: 'Região de Coimbra', lat: 40.21, lng: -8.43, group: 'Centro' },
  { code: '16F', name: 'Região de Leiria', lat: 39.74, lng: -8.81, group: 'Centro' },
  { code: '16G', name: 'Viseu Dão Lafões', lat: 40.66, lng: -7.91, group: 'Centro' },
  { code: '16H', name: 'Beira Baixa', lat: 39.82, lng: -7.49, group: 'Centro' },
  { code: '16I', name: 'Médio Tejo', lat: 39.47, lng: -8.20, group: 'Centro' },
  { code: '16J', name: 'Beiras e Serra da Estrela', lat: 40.54, lng: -7.27, group: 'Centro' },
  { code: '170', name: 'Área Metropolitana de Lisboa', lat: 38.72, lng: -9.14, group: 'Lisboa' },
  { code: '181', name: 'Alentejo Litoral', lat: 38.05, lng: -8.73, group: 'Alentejo' },
  { code: '184', name: 'Baixo Alentejo', lat: 38.02, lng: -7.86, group: 'Alentejo' },
  { code: '185', name: 'Lezíria do Tejo', lat: 39.24, lng: -8.69, group: 'Alentejo' },
  { code: '186', name: 'Alto Alentejo', lat: 39.29, lng: -7.43, group: 'Alentejo' },
  { code: '187', name: 'Alentejo Central', lat: 38.57, lng: -7.91, group: 'Alentejo' },
  { code: '150', name: 'Algarve', lat: 37.02, lng: -7.93, group: 'Algarve' }
];

const chartTitles = {
  bar: 'Top regiões',
  donut: 'Distribuição regional',
  scatter: 'Ocorrências vs ardida',
  municipalities: 'Top municípios',
  landuse: 'Tipo de área ardida',
  line: 'Evolução anual',
  area: 'Tendência acumulada',
  treemap: 'Peso regional',
  heatmap: 'Matriz região/indicador',
  lollipop: 'Ranking área ardida',
  cards: 'Resumo nacional'
};

let selectedMetric = DEFAULT_METRIC;
let selectedRegion = null;
let regions = [];
let municipalities = [];
let burnedTypes = [];
let yearlyTotals = [];
let sourceText = '';
let map = null;
let markers = [];
let activeDropTarget = null;
let resizeFrame = 0;

const statusEl = document.querySelector('#status');
const metricSelect = document.querySelector('#metric');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadJson(remoteUrl, localUrl) {
  try {
    const data = await fetchJsonWithTimeout(localUrl);
    sourceText = 'Snapshot Local INE';
    return data;
  } catch {
    const data = await fetchJsonWithTimeout(remoteUrl);
    sourceText = 'INE Live';
    return data;
  }
}

function latestRows(indicator) {
  const item = Array.isArray(indicator) ? indicator[0] : indicator;
  const year = item.UltimoPref || Object.keys(item.Dados).sort().at(-1);
  return {
    year,
    title: item.IndicadorDsg,
    updated: item.DataUltimoAtualizacao,
    rows: item.Dados[year] || []
  };
}

function numberValue(row) {
  return Number.parseFloat(String(row.valor || '0').replace(',', '.')) || 0;
}

function buildRegionalData(fireIndicator, burnedIndicator) {
  const fire = latestRows(fireIndicator);
  const burned = latestRows(burnedIndicator);
  const burnedTotal = new Map(
    burned.rows
      .filter((row) => row.dim_3_t === 'Total')
      .map((row) => [normalizeName(row.geodsg), numberValue(row)])
  );

  regions = nutsRegions.map((region) => {
    const fireRow = fire.rows.find((row) => row.geocod === region.code);
    return {
      ...region,
      fires: fireRow ? numberValue(fireRow) : 0,
      burnedShare: burnedTotal.get(normalizeName(region.name)) || 0,
      fireYear: fire.year,
      burnedYear: burned.year
    };
  });

  municipalities = fire.rows
    .filter((row) => String(row.geocod).length > 3 && numberValue(row) > 0)
    .map((row) => ({ name: row.geodsg, fires: numberValue(row) }))
    .sort((a, b) => b.fires - a.fires);

  burnedTypes = d3.rollups(
    burned.rows.filter((row) => row.dim_3_t && row.dim_3_t !== 'Total'),
    (values) => d3.sum(values, numberValue),
    (row) => row.dim_3_t
  ).map(([name, value]) => ({ name, value }));

  yearlyTotals = Object.entries((Array.isArray(fireIndicator) ? fireIndicator[0] : fireIndicator).Dados)
    .map(([year, rows]) => {
      const portugal = rows.find((row) => row.geocod === 'PT');
      const continent = rows.find((row) => row.geocod === '1');
      return {
        year: Number(year),
        fires: numberValue(portugal || continent || { valor: 0 })
      };
    })
    .filter((item) => Number.isFinite(item.year))
    .sort((a, b) => a.year - b.year);
}

async function loadData() {
  setStatus('A carregar INE/dados.gov.pt');
  const [fireIndicator, burnedIndicator] = await Promise.all([
    loadJson(INE_FIRE_URL, LOCAL_FIRE_URL),
    loadJson(INE_BURNED_URL, LOCAL_BURNED_URL)
  ]);
  buildRegionalData(fireIndicator, burnedIndicator);
  setStatus(`${sourceText} · ${new Date().toLocaleTimeString('pt-PT')}`);
}

function currentData() {
  return selectedRegion ? regions.filter((item) => item.name === selectedRegion) : regions;
}

function metricValue(item) {
  return Number(item[selectedMetric] || 0);
}

function metricLabel() {
  return selectedMetric === 'burnedShare' ? '% superfície ardida' : 'incêndios rurais';
}

function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([39.65, -8.05], 6.55);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function drawMap() {
  if (!map) return;
  markers.forEach((marker) => marker.remove());
  markers = [];

  const extent = d3.extent(regions, metricValue);
  const domain = extent[0] === extent[1] ? [0, extent[1] || 1] : extent;
  const color = d3.scaleSequential(domain, d3.interpolateYlOrRd);
  const radius = d3.scaleSqrt(domain, [8, 28]);

  regions.forEach((item) => {
    const active = selectedRegion === item.name;
    const value = metricValue(item);
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: active ? radius(value) + 6 : radius(value),
      color: active ? '#e5edf6' : '#7f1d1d',
      weight: active ? 3 : 1,
      fillColor: color(value),
      fillOpacity: 0.86
    }).addTo(map);

    marker.bindTooltip(`${item.name}<br>${value.toLocaleString('pt-PT')} ${metricLabel()}`, { direction: 'top' });
    marker.on('click', () => {
      selectedRegion = selectedRegion === item.name ? null : item.name;
      updateAll();
    });
    markers.push(marker);
  });
}

function cardFrame(container, title) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `<strong>${title}</strong><button class="remove" title="Eliminar gráfico">x</button>`;
  container.appendChild(header);
  header.querySelector('.remove')?.addEventListener('click', () => {
    container.dataset.chart = '';
    container.innerHTML = '<div class="empty">Arraste um KPI para aqui</div>';
    saveState();
  });

  const body = document.createElement('div');
  body.className = 'chart-body';
  container.appendChild(body);
  return body;
}

function chartSize(body) {
  const rect = body.getBoundingClientRect();
  return { width: Math.max(280, rect.width), height: Math.max(190, rect.height) };
}

const chartTooltip = d3.select('body').append('div')
  .attr('class', 'd3-tooltip')
  .style('display', 'none');

function showTip(event, text) {
  chartTooltip
    .text(text)
    .style('display', 'block')
    .style('left', (event.pageX + 12) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

function moveTip(event) {
  chartTooltip
    .style('left', (event.pageX + 12) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

function hideTip() {
  chartTooltip.style('display', 'none');
}

function setDropTarget(slot) {
  if (activeDropTarget === slot) return;
  activeDropTarget?.classList.remove('drop-target');
  activeDropTarget = slot;
  activeDropTarget?.classList.add('drop-target');
}

function clearDropTarget() {
  activeDropTarget?.classList.remove('drop-target');
  activeDropTarget = null;
}

function appendAxes(svg, xAxis, yAxis, height, margin) {
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(xAxis);
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left},0)`)
    .call(yAxis);
}

function drawBar(container) {
  const body = cardFrame(container, chartTitles.bar);
  const { width, height } = chartSize(body);
  const margin = { top: 14, right: 18, bottom: 32, left: 150 };
  const data = [...regions].sort((a, b) => b.fires - a.fires).slice(0, 8);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.fires)]).nice().range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(data.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(0.22);

  appendAxes(svg, d3.axisBottom(x).ticks(5), d3.axisLeft(y).tickSize(0), height, margin);
  svg.selectAll('rect').data(data).join('rect')
    .attr('x', margin.left)
    .attr('y', (d) => y(d.name))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', '#f97316')
    .on('mouseover', (event, d) => showTip(event, `${d.name}: ${d.fires.toLocaleString('pt-PT')} incêndios`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip)
    .transition()
    .duration(500)
    .attr('width', (d) => x(d.fires) - margin.left);
}

function drawDonut(container) {
  const body = cardFrame(container, chartTitles.donut);
  const { width, height } = chartSize(body);
  const data = d3.rollups(regions, (values) => d3.sum(values, (d) => d.fires), (d) => d.group)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const radius = Math.min(width, height) / 2 - 18;
  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
  const pie = d3.pie().value((d) => d.value);
  const g = svg.append('g').attr('transform', `translate(${width * 0.38},${height / 2})`);

  g.selectAll('path').data(pie(data)).join('path')
    .attr('d', arc)
    .attr('fill', (d) => color(d.data.label))
    .attr('stroke', '#111827')
    .attr('stroke-width', 3)
    .on('mouseover', (event, d) => showTip(event, `${d.data.label}: ${d.data.value.toLocaleString('pt-PT')} incêndios`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);

  svg.selectAll('text.legend').data(data).join('text')
    .attr('class', 'legend')
    .attr('x', width * 0.68)
    .attr('y', (_d, i) => 42 + i * 24)
    .text((d) => `${d.label}: ${d.value.toLocaleString('pt-PT')}`)
    .attr('font-size', 13);
}

function drawScatter(container) {
  const body = cardFrame(container, chartTitles.scatter);
  const { width, height } = chartSize(body);
  const margin = { top: 16, right: 18, bottom: 38, left: 54 };
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain([0, d3.max(regions, (d) => d.burnedShare)]).nice().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(regions, (d) => d.fires)]).nice().range([height - margin.bottom, margin.top]);
  const r = d3.scaleSqrt().domain(d3.extent(regions, (d) => d.fires)).range([5, 15]);

  appendAxes(svg, d3.axisBottom(x).ticks(5), d3.axisLeft(y).ticks(5), height, margin);
  svg.selectAll('circle').data(regions).join('circle')
    .attr('cx', (d) => x(d.burnedShare))
    .attr('cy', (d) => y(d.fires))
    .attr('r', (d) => r(d.fires))
    .attr('fill', (d) => selectedRegion === d.name ? '#f8fafc' : '#22c55e')
    .attr('opacity', 0.78)
    .on('mouseover', (event, d) => showTip(event, `${d.name}: ${d.fires.toLocaleString('pt-PT')} incêndios, ${d.burnedShare.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% ardida`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawMunicipalities(container) {
  const body = cardFrame(container, chartTitles.municipalities);
  const { width, height } = chartSize(body);
  const margin = { top: 14, right: 18, bottom: 32, left: 140 };
  const data = municipalities.slice(0, 8);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.fires)]).nice().range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(data.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(0.22);

  appendAxes(svg, d3.axisBottom(x).ticks(5), d3.axisLeft(y).tickSize(0), height, margin);
  svg.selectAll('rect').data(data).join('rect')
    .attr('x', margin.left)
    .attr('y', (d) => y(d.name))
    .attr('width', (d) => x(d.fires) - margin.left)
    .attr('height', y.bandwidth())
    .attr('fill', '#38bdf8')
    .on('mouseover', (event, d) => showTip(event, `${d.name}: ${d.fires.toLocaleString('pt-PT')} incêndios`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawLanduse(container) {
  const body = cardFrame(container, chartTitles.landuse);
  const { width, height } = chartSize(body);
  const margin = { top: 14, right: 18, bottom: 42, left: 54 };
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleBand().domain(burnedTypes.map((d) => d.name)).range([margin.left, width - margin.right]).padding(0.24);
  const y = d3.scaleLinear().domain([0, d3.max(burnedTypes, (d) => d.value)]).nice().range([height - margin.bottom, margin.top]);

  appendAxes(svg, d3.axisBottom(x), d3.axisLeft(y).ticks(4), height, margin);
  svg.selectAll('rect').data(burnedTypes).join('rect')
    .attr('x', (d) => x(d.name))
    .attr('y', (d) => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', (d) => height - margin.bottom - y(d.value))
    .attr('fill', '#a78bfa')
    .on('mouseover', (event, d) => showTip(event, `${d.name}: ${d.value.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawLine(container) {
  const body = cardFrame(container, chartTitles.line);
  const { width, height } = chartSize(body);
  const margin = { top: 18, right: 20, bottom: 36, left: 58 };
  const data = yearlyTotals.length > 1 ? yearlyTotals : yearlyTotals.map((d) => ({ ...d, year: d.year - 1 })).concat(yearlyTotals);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.fires)]).nice().range([height - margin.bottom, margin.top]);

  appendAxes(svg, d3.axisBottom(x).tickFormat(d3.format('d')).ticks(Math.min(6, data.length)), d3.axisLeft(y).ticks(5), height, margin);
  svg.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 3)
    .attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.fires)).curve(d3.curveMonotoneX));
  svg.selectAll('circle').data(data).join('circle')
    .attr('cx', (d) => x(d.year))
    .attr('cy', (d) => y(d.fires))
    .attr('r', 5)
    .attr('fill', '#f8fafc')
    .on('mouseover', (event, d) => showTip(event, `${d.year}: ${d.fires.toLocaleString('pt-PT')} incêndios`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawArea(container) {
  const body = cardFrame(container, chartTitles.area);
  const { width, height } = chartSize(body);
  const margin = { top: 18, right: 20, bottom: 36, left: 58 };
  let running = 0;
  const data = yearlyTotals.map((d) => {
    running += d.fires;
    return { year: d.year, fires: running };
  });
  const plotted = data.length > 1 ? data : data.map((d) => ({ ...d, year: d.year - 1 })).concat(data);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain(d3.extent(plotted, (d) => d.year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(plotted, (d) => d.fires)]).nice().range([height - margin.bottom, margin.top]);

  appendAxes(svg, d3.axisBottom(x).tickFormat(d3.format('d')).ticks(Math.min(6, plotted.length)), d3.axisLeft(y).ticks(5), height, margin);
  svg.append('path')
    .datum(plotted)
    .attr('fill', '#0ea5e955')
    .attr('d', d3.area().x((d) => x(d.year)).y0(height - margin.bottom).y1((d) => y(d.fires)).curve(d3.curveMonotoneX));
  svg.append('path')
    .datum(plotted)
    .attr('fill', 'none')
    .attr('stroke', '#0ea5e9')
    .attr('stroke-width', 3)
    .attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.fires)).curve(d3.curveMonotoneX));
}

function drawTreemap(container) {
  const body = cardFrame(container, chartTitles.treemap);
  const { width, height } = chartSize(body);
  const data = { name: 'Portugal', children: regions.map((region) => ({ name: region.name, value: region.fires, group: region.group })) };
  const root = d3.hierarchy(data).sum((d) => d.value).sort((a, b) => b.value - a.value);
  d3.treemap().size([width, height]).padding(3)(root);
  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);

  const cells = svg.selectAll('g').data(root.leaves()).join('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
  cells.append('rect')
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0))
    .attr('rx', 5)
    .attr('fill', (d) => color(d.data.group))
    .attr('opacity', .86)
    .on('mouseover', (event, d) => showTip(event, `${d.data.name}: ${d.value.toLocaleString('pt-PT')} incêndios`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
  cells.append('text')
    .attr('x', 7)
    .attr('y', 18)
    .attr('fill', '#f8fafc')
    .attr('font-size', 12)
    .text((d) => d.x1 - d.x0 > 76 && d.y1 - d.y0 > 28 ? d.data.name : '');
}

function drawHeatmap(container) {
  const body = cardFrame(container, chartTitles.heatmap);
  const { width, height } = chartSize(body);
  const groups = [...new Set(regions.map((d) => d.group))];
  const metrics = ['Incêndios', 'Superfície ardida'];
  const data = groups.flatMap((group) => {
    const rows = regions.filter((region) => region.group === group);
    return [
      { group, metric: metrics[0], value: d3.sum(rows, (d) => d.fires) },
      { group, metric: metrics[1], value: d3.mean(rows, (d) => d.burnedShare) || 0 }
    ];
  });
  const margin = { top: 18, right: 18, bottom: 44, left: 126 };
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleBand().domain(metrics).range([margin.left, width - margin.right]).padding(0.08);
  const y = d3.scaleBand().domain(groups).range([margin.top, height - margin.bottom]).padding(0.08);
  const color = d3.scaleSequential([0, d3.max(data, (d) => d.value)], d3.interpolateYlOrRd);

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickSize(0));
  svg.selectAll('rect').data(data).join('rect')
    .attr('x', (d) => x(d.metric))
    .attr('y', (d) => y(d.group))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', (d) => color(d.value))
    .on('mouseover', (event, d) => showTip(event, `${d.group} · ${d.metric}: ${d.value.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawLollipop(container) {
  const body = cardFrame(container, chartTitles.lollipop);
  const { width, height } = chartSize(body);
  const margin = { top: 14, right: 26, bottom: 34, left: 150 };
  const data = [...regions].sort((a, b) => b.burnedShare - a.burnedShare).slice(0, 8);
  const svg = d3.select(body).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.burnedShare)]).nice().range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(data.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(0.28);

  appendAxes(svg, d3.axisBottom(x).ticks(5), d3.axisLeft(y).tickSize(0), height, margin);
  svg.selectAll('line.lollipop').data(data).join('line')
    .attr('class', 'lollipop')
    .attr('x1', margin.left)
    .attr('x2', (d) => x(d.burnedShare))
    .attr('y1', (d) => y(d.name) + y.bandwidth() / 2)
    .attr('y2', (d) => y(d.name) + y.bandwidth() / 2)
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2);
  svg.selectAll('circle').data(data).join('circle')
    .attr('cx', (d) => x(d.burnedShare))
    .attr('cy', (d) => y(d.name) + y.bandwidth() / 2)
    .attr('r', 7)
    .attr('fill', '#f43f5e')
    .on('mouseover', (event, d) => showTip(event, `${d.name}: ${d.burnedShare.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% ardida`))
    .on('mousemove', moveTip)
    .on('mouseout', hideTip);
}

function drawCards(container) {
  const body = cardFrame(container, chartTitles.cards);
  const data = currentData();
  const totalFires = d3.sum(data, (d) => d.fires);
  const avgBurned = d3.mean(data, (d) => d.burnedShare) || 0;
  const maxRegion = [...data].sort((a, b) => b.fires - a.fires)[0];
  const highRegions = data.filter((d) => d.fires >= 300).length;

  body.innerHTML = `
    <div class="stat-grid">
      <div><span>Incêndios</span><strong>${totalFires.toLocaleString('pt-PT')}</strong></div>
      <div><span>Ardida média</span><strong>${avgBurned.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%</strong></div>
      <div><span>Região topo</span><strong>${maxRegion?.name || 'n/d'}</strong></div>
      <div><span>Regiões >=300</span><strong>${highRegions}</strong></div>
    </div>
  `;
}

const renderers = {
  bar: drawBar,
  donut: drawDonut,
  scatter: drawScatter,
  municipalities: drawMunicipalities,
  landuse: drawLanduse,
  line: drawLine,
  area: drawArea,
  treemap: drawTreemap,
  heatmap: drawHeatmap,
  lollipop: drawLollipop,
  cards: drawCards
};

function renderDashboard() {
  document.querySelectorAll('.drop-slot').forEach((slot) => {
    const chart = slot.dataset.chart;
    if (!chart || !renderers[chart]) {
      slot.innerHTML = '<div class="empty">Arraste um KPI para aqui</div>';
      return;
    }
    if (!regions.length) {
      slot.innerHTML = '<div class="loading-state">A carregar dados do INE.</div>';
      return;
    }
    renderers[chart](slot);
  });
}

function updateSummary() {
  const title = document.querySelector('#selectedDistrict');
  const risk = document.querySelector('#selectedRisk');
  const details = document.querySelector('#selectedDetails');
  const data = selectedRegion ? regions.find((item) => item.name === selectedRegion) : null;
  const current = data ? [data] : regions;

  if (!regions.length) {
    title.textContent = 'INE/dados.gov.pt';
    risk.textContent = 'A carregar...';
    details.textContent = 'Refresh tenta atualizar dados oficiais.';
    return;
  }

  const fireYear = regions[0]?.fireYear || 'n/d';
  const burnedYear = regions[0]?.burnedYear || 'n/d';
  title.textContent = data ? data.name : 'Portugal continental';
  risk.textContent = data
    ? `${data.fires.toLocaleString('pt-PT')} incêndios`
    : `${d3.sum(current, (d) => d.fires).toLocaleString('pt-PT')} incêndios`;
  details.textContent = data
    ? `${data.group}. Superfície ardida: ${data.burnedShare.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}%.`
    : `Incêndios rurais ${fireYear}; superfície ardida ${burnedYear}. Fonte: INE/ICNF via dados.gov.pt.`;
}

function updateAll() {
  drawMap();
  updateSummary();
  renderDashboard();
}

function saveState() {
  const layout = [...document.querySelectorAll('.drop-slot')].map((slot) => slot.dataset.chart || '');
  localStorage.setItem(CACHE_KEY, JSON.stringify({ layout, selectedMetric }));
}

function applyDefaultState() {
  selectedMetric = DEFAULT_METRIC;
  selectedRegion = null;
  clearDropTarget();
  hideTip();
  if (metricSelect) metricSelect.value = DEFAULT_METRIC;
  document.querySelectorAll('.drop-slot').forEach((slot, index) => {
    slot.dataset.chart = DEFAULT_LAYOUT[index] || '';
  });
}

function loadState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
  if (!saved) return;
  selectedMetric = saved.selectedMetric || selectedMetric;
  if (metricSelect) metricSelect.value = selectedMetric;
  document.querySelectorAll('.drop-slot').forEach((slot, index) => {
    if (saved.layout && index in saved.layout) {
      slot.dataset.chart = saved.layout[index];
    }
  });
}

async function resetDashboard() {
  localStorage.removeItem(CACHE_KEY);
  applyDefaultState();
  await refreshData();
}

function initDragDrop() {
  document.querySelectorAll('.kpi-source').forEach((button) => {
    button.addEventListener('dragstart', (event) => {
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer?.setData('text/plain', button.dataset.chart || '');
    });
  });

  document.querySelectorAll('.drop-slot').forEach((slot, index) => {
    slot.draggable = true;
    slot.addEventListener('dragstart', (event) => {
      const chart = slot.dataset.chart || '';
      if (!chart || !renderers[chart]) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer?.setData('application/x-pyrowatch-slot', String(index));
      event.dataTransfer?.setData('text/plain', chart);
      slot.classList.add('dragging');
    });
    slot.addEventListener('dragend', () => {
      slot.classList.remove('dragging');
      clearDropTarget();
    });
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        const types = Array.from(event.dataTransfer.types);
        event.dataTransfer.dropEffect = types.includes('application/x-pyrowatch-slot') ? 'move' : 'copy';
      }
      setDropTarget(slot);
    });
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      clearDropTarget();
      const sourceIndex = event.dataTransfer?.getData('application/x-pyrowatch-slot');
      const chart = event.dataTransfer?.getData('text/plain') || '';

      if (sourceIndex) {
        const slots = [...document.querySelectorAll('.drop-slot')];
        const source = slots[Number(sourceIndex)];
        if (source && source !== slot) {
          const targetChart = slot.dataset.chart || '';
          slot.dataset.chart = source.dataset.chart || '';
          source.dataset.chart = targetChart;
        }
      } else {
        if (!renderers[chart]) return;
        slot.dataset.chart = chart;
      }

      renderDashboard();
      saveState();
    });
  });
}

async function refreshData() {
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    setStatus('Erro ao carregar dados');
  }
  updateAll();
}

metricSelect?.addEventListener('change', (event) => {
  selectedMetric = event.target.value;
  updateAll();
  saveState();
});

document.querySelector('#refresh')?.addEventListener('click', refreshData);
document.querySelector('#reset')?.addEventListener('click', resetDashboard);
window.addEventListener('resize', () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(renderDashboard);
});

loadState();
initMap();
initDragDrop();
refreshData();
