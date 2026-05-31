<div align="center">

# PyroWatch

[![Astro](https://img.shields.io/badge/Astro-6.x-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![D3.js](https://img.shields.io/badge/D3.js-7.x-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.x-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)

<p>
  <a href="#objetivo-do-projeto">Objetivo do Projeto</a>
  ·
  <a href="#funcionalidades">Funcionalidades</a>
  ·
  <a href="#arquitetura">Arquitetura</a>
  ·
  <a href="#instalação">Instalação</a>
  ·
  <a href="#desenvolvimento">Desenvolvimento</a>
  ·
  <a href="#build">Build</a>
</p>

Versão Inglesa: [README.pt.md](README.pt.md)

</div>

---

PyroWatch é um dashboard geográfico sobre incêndios rurais em Portugal. Junta um mapa interativo em Leaflet com visualizações D3.js construídas a partir de dados oficiais do INE/ICNF.

O projeto foi criado para um trabalho prático de visualização de dados / informação geográfica. É uma aplicação Astro estática, por isso pode ser publicada no GitHub Pages sem backend.

## Objetivo do Projeto

O PyroWatch permite explorar a atividade de incêndios rurais por regiões NUTS-3 portuguesas. O foco está em:

- distribuição geográfica de ocorrências de incêndios rurais;
- proporção de superfície ardida;
- comparação entre Norte, Centro, Lisboa, Alentejo e Algarve;
- municípios com mais ocorrências;
- composição interativa do dashboard através de cartões KPI com drag-and-drop.

## Fontes de Dados

O dashboard usa dados públicos oficiais:

| Conjunto de dados | Indicador | Descrição                                                                                     | Snapshot mais recente |
| ----------------- | --------: | --------------------------------------------------------------------------------------------- | --------------------: |
| INE / ICNF        | `0008386` | Incêndios rurais, por localização geográfica, anual                                           |                  2023 |
| INE / ICNF        | `0013537` | Proporção de superfície ardida, por localização geográfica e tipo de superfície ardida, anual |                  2024 |

Funcionamento:

1. A aplicação carrega snapshots JSON locais guardados em `public/data/`.
2. Estes snapshots são respostas oficiais do INE guardadas no projeto.
3. O botão Refresh redesenha o dashboard a partir da mesma camada de dados.
4. Os endpoints remotos do INE continuam definidos no código, mas os snapshots locais tornam a versão GitHub Pages fiável mesmo quando a API está lenta, bloqueada ou limitada.

Ficheiros locais:

- `public/data/incendios-rurais-ine.json`
- `public/data/superficie-ardida-ine.json`

## Funcionalidades

- Interface em dark mode.
- Sidebar fixa com altura total.
- Lista de KPIs com scroll próprio dentro da sidebar.
- Área principal com scroll independente.
- Mapa Leaflet centrado em Portugal continental.
- Marcadores circulares para regiões NUTS-3.
- Seletor de métrica: incêndios rurais ou superfície ardida.
- Clique num marcador filtra o dashboard por região.
- Tooltips D3 nos gráficos.
- Drag-and-drop de KPIs da sidebar para a grelha.
- Reorganização de gráficos dentro da grelha por drag-and-drop.
- Remoção de gráfico através do botão `x`.
- Slots vazios continuam vazios após refresh e reload.
- Layout e métrica selecionada guardados em `localStorage`.

## Visualizações D3

Tipos de gráficos disponíveis:

| Gráfico                 | Técnica D3         | Objetivo                                                                      |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Top regiões             | Barras horizontais | Comparar regiões NUTS-3 por número de incêndios rurais                        |
| Distribuição regional   | Donut chart        | Comparar ocorrências por grupo regional                                       |
| Ocorrências vs ardida   | Scatter plot       | Relacionar ocorrências com proporção de superfície ardida                     |
| Top municípios          | Barras horizontais | Mostrar municípios com mais incêndios rurais                                  |
| Tipo de área ardida     | Barras verticais   | Comparar tipos de superfície ardida                                           |
| Evolução anual          | Linha              | Mostrar evolução anual nacional quando há histórico disponível                |
| Tendência acumulada     | Área               | Mostrar tendência acumulada de incêndios                                      |
| Peso regional           | Treemap            | Mostrar contribuição proporcional de cada região                              |
| Matriz região/indicador | Heatmap            | Comparar ocorrências e superfície ardida por grupo regional                   |
| Ranking área ardida     | Lollipop chart     | Ordenar regiões por proporção de área ardida                                  |
| Resumo nacional         | Cartões KPI        | Totais, médias, região principal e contagem de regiões com muitas ocorrências |

## Modelo de Interação

A página divide-se em duas áreas:

- sidebar esquerda: seletor de métrica, lista de KPIs, informação da fonte e botão de refresh;
- workspace direito: mapa, resumo da região selecionada e grelha de gráficos.

Drag-and-drop:

- arrastar KPI da sidebar para um slot cria ou substitui um gráfico;
- arrastar um cartão da grelha para outro slot troca os dois gráficos;
- eliminar um gráfico deixa o slot vazio;
- slots vazios são guardados explicitamente e não voltam a ser preenchidos automaticamente.

## Arquitetura

```text
src/
  pages/
    index.astro            Composição principal da página
  layouts/
    Layout.astro           Estrutura HTML base
  components/
    Sidebar.astro          Controlos, lista de KPIs, fonte dos dados
    MapPanel.astro         Container do mapa e resumo da região
    ChartGrid.astro        Grelha de slots para gráficos
  scripts/
    dashboard.js           D3, Leaflet, parsing dos dados, estado e interações
  styles/
    dashboard.css          Dark mode, layout e responsividade
public/
  data/
    incendios-rurais-ine.json
    superficie-ardida-ine.json
```

## Escolhas Técnicas

- **Astro**: build estático, deploy simples para GitHub Pages e baixo overhead.
- **D3.js**: gráficos SVG customizados, escalas, eixos, transições, treemap, heatmap, donut e tooltips.
- **Leaflet**: mapa geográfico leve, marcadores, zoom e seleção de região.
- **LocalStorage**: persistência do layout e da métrica selecionada.
- **CSS Grid/Flexbox**: sidebar fixa e workspace principal com scroll.

## Limitações

- As posições das regiões NUTS-3 são centróides aproximados, não polígonos administrativos.
- O dashboard usa snapshots oficiais locais para fiabilidade; o refresh não garante dados mais recentes sem atualizar os snapshots.
- Alguns indicadores do INE devolvem apenas o período mais recente na resposta JSON atual, por isso os gráficos temporais dependem da disponibilidade histórica do endpoint.
- O mapa é de marcadores proporcionais, não um coroplético com fronteiras.

## Trabalho Futuro

- Adicionar GeoJSON NUTS-3 para um verdadeiro mapa coroplético.
- Adicionar seletor de ano se houver histórico completo nos snapshots.
- Criar script para atualizar automaticamente os snapshots locais.
- Exportar gráficos para PNG/PDF para relatório.
- Adicionar modo de comparação entre duas regiões.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

Rota local:

```text
http://127.0.0.1:4321/pyrowatch
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

O base path do Astro está configurado em `astro.config.mjs`:

```js
export default defineConfig({
  base: "/pyrowatch/",
});
```

Isto corresponde a um deploy do repositório em:

```text
https://<username>.github.io/pyrowatch/
```
