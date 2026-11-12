const DATA_URL = 'https://sdmx.oecd.org/public/rest/data/OECD.WISE.INE,DSD_WISE_IDD@DF_IDD,1.0/.A.INC_DISP_GINI..._T.METH2012.D_CUR.?startPeriod=2010&dimensionAtObservation=AllDimensions&format=jsondata';
const GDP_DATA_URL = 'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=20000';

const FALLBACK_DATA = [
  { country: 'Australia', year: 2023, gini: 0.325 },
  { country: 'Canada', year: 2023, gini: 0.291 },
  { country: 'France', year: 2023, gini: 0.285 },
  { country: 'Germany', year: 2023, gini: 0.308 },
  { country: 'United Kingdom', year: 2023, gini: 0.351 },
  { country: 'United States', year: 2023, gini: 0.39 },
  { country: 'Sweden', year: 2023, gini: 0.276 },
  { country: 'Norway', year: 2023, gini: 0.267 },
  { country: 'Mexico', year: 2023, gini: 0.458 },
  { country: 'Brazil', year: 2023, gini: 0.53 },
  { country: 'South Africa', year: 2023, gini: 0.63 },
  { country: 'China (People’s Republic of)', year: 2023, gini: 0.37 }
];

const REGION_COLORS = {
  'Europe': '#1f77b4',
  'Eastern Europe': '#17becf',
  'North America': '#ff7f0e',
  'Latin America': '#2ca02c',
  'East Asia': '#d62728',
  'South Asia': '#9467bd',
  'Africa': '#8c564b',
  'Oceania': '#e377c2',
  'Middle East': '#7f7f7f',
  'Other': '#000000'
};

function parseSdmxData(payload) {
  const root = payload && payload.data ? payload.data : payload;
  const dataset = root && root.dataSets ? root.dataSets[0] : null;

  if (!dataset) {
    return [];
  }

  const observations = dataset.observations || {};
  const observationDims = (root.structure && root.structure.dimensions && root.structure.dimensions.observation) || [];
  const dimensionMap = {};

  observationDims.forEach((dim) => {
    dimensionMap[dim.id] = dim;
  });

  const rows = [];

  Object.entries(observations).forEach(([key, value]) => {
    const parts = key.split(':').filter((part) => part !== '');

    const refAreaDim = dimensionMap.REF_AREA || {};
    const refAreaIndex = Number(refAreaDim.keyPosition ?? 0);
    const timeDim = dimensionMap.TIME_PERIOD || {};
    const timeIndex = Number(timeDim.keyPosition ?? 0);

    const refAreaValues = Array.isArray(refAreaDim.values) ? refAreaDim.values : [];
    const timeValues = Array.isArray(timeDim.values) ? timeDim.values : [];

    const countryIndex = Number(parts[refAreaIndex] ?? -1);
    const yearIndex = Number(parts[timeIndex] ?? -1);

    const countryEntry = refAreaValues[countryIndex] || null;
    const yearEntry = timeValues[yearIndex] || null;
    const country = countryEntry ? (countryEntry.name || countryEntry.id || 'Unknown') : 'Unknown';
    const year = Number(yearEntry ? (yearEntry.id || yearEntry.name) : yearIndex);

    const obsValues = Array.isArray(value) ? value : Object.values(value || {});
    const giniValue = Number(obsValues[0]);

    if (country !== 'Unknown' && Number.isFinite(year) && Number.isFinite(giniValue)) {
      rows.push({ country, year, gini: giniValue });
    }
  });

  return rows;
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('Data request failed');
    }

    const payload = await response.json();
    const parsed = parseSdmxData(payload);

    if (!parsed.length) {
      throw new Error('No rows parsed from OECD dataset');
    }

    return parsed;
  } catch (error) {
    console.warn('Using fallback OECD-style sample data because the live dataset could not be loaded.', error);
    return FALLBACK_DATA;
  }
}

function getRegion(country) {
  const regionMap = {
    'Australia': 'Oceania',
    'Austria': 'Europe',
    'Belgium': 'Europe',
    'Brazil': 'Latin America',
    'Bulgaria': 'Eastern Europe',
    'Canada': 'North America',
    'Chile': 'Latin America',
    'China (People’s Republic of)': 'East Asia',
    'Costa Rica': 'Latin America',
    'Croatia': 'Eastern Europe',
    'Czechia': 'Eastern Europe',
    'Denmark': 'Europe',
    'Estonia': 'Eastern Europe',
    'Finland': 'Europe',
    'France': 'Europe',
    'Germany': 'Europe',
    'Greece': 'Europe',
    'Hungary': 'Eastern Europe',
    'Iceland': 'Europe',
    'India': 'South Asia',
    'Ireland': 'Europe',
    'Israel': 'Middle East',
    'Italy': 'Europe',
    'Japan': 'East Asia',
    'Korea': 'East Asia',
    'Latvia': 'Eastern Europe',
    'Lithuania': 'Eastern Europe',
    'Luxembourg': 'Europe',
    'Mexico': 'North America',
    'Netherlands': 'Europe',
    'New Zealand': 'Oceania',
    'Norway': 'Europe',
    'Poland': 'Eastern Europe',
    'Portugal': 'Europe',
    'Romania': 'Eastern Europe',
    'Russia': 'Eastern Europe',
    'Slovak Republic': 'Eastern Europe',
    'Slovenia': 'Eastern Europe',
    'South Africa': 'Africa',
    'Spain': 'Europe',
    'Sweden': 'Europe',
    'Switzerland': 'Europe',
    'Türkiye': 'Middle East',
    'United Kingdom': 'Europe',
    'United States': 'North America'
  };

  return regionMap[country] || 'Other';
}

function renderBarChart(data) {
  const svg = d3.select('#barChart');
  svg.selectAll('*').remove();

  const latestByCountry = new Map();

  data.forEach((d) => {
    const current = latestByCountry.get(d.country);
    if (!current || d.year > current.year) {
      latestByCountry.set(d.country, d);
    }
  });

  const sorted = [...latestByCountry.values()].sort((a, b) => b.gini - a.gini).slice(0, 10);
  const margin = { top: 20, right: 20, bottom: 90, left: 60 };
  const width = 760;
  const height = 360;

  const x = d3.scaleBand()
    .domain(sorted.map((d) => d.country))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(sorted, (d) => d.gini) + 0.05])
    .range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call((g) => g.selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end'));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6));

  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', height - margin.bottom)
    .attr('y2', height - margin.bottom)
    .attr('stroke', '#000');

  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', margin.left)
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .attr('stroke', '#000');

  svg.selectAll('rect')
    .data(sorted)
    .enter()
    .append('rect')
    .attr('x', (d) => x(d.country))
    .attr('y', (d) => y(d.gini))
    .attr('width', x.bandwidth())
    .attr('height', (d) => height - margin.bottom - y(d.gini))
    .attr('fill', (d) => REGION_COLORS[getRegion(d.country)] || '#000000');

  svg.selectAll('.bar-year-label')
    .data(sorted)
    .enter()
    .append('text')
    .attr('class', 'bar-year-label')
    .attr('x', (d) => x(d.country) + x.bandwidth() / 2)
    .attr('y', (d) => y(d.gini) - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)
    .text((d) => d.year);

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height - 8)
    .attr('text-anchor', 'middle')
    .text('Country');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .text('Gini coefficient');

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .text('Top 10 countries by latest available Gini');
}

async function loadGDPData() {
  const fallback = [
    { country: 'Australia', gdp: 65000 },
    { country: 'Canada', gdp: 56000 },
    { country: 'France', gdp: 43000 },
    { country: 'Germany', gdp: 49000 },
    { country: 'Italy', gdp: 37000 },
    { country: 'Japan', gdp: 34000 },
    { country: 'Norway', gdp: 87000 },
    { country: 'Sweden', gdp: 55000 },
    { country: 'United Kingdom', gdp: 47000 },
    { country: 'United States', gdp: 76000 },
    { country: 'Brazil', gdp: 11500 },
    { country: 'Mexico', gdp: 19000 },
    { country: 'South Africa', gdp: 7000 },
    { country: 'China (People’s Republic of)', gdp: 13000 }
  ];

  try {
    const response = await fetch(GDP_DATA_URL);
    if (!response.ok) {
      throw new Error('GDP request failed');
    }

    const payload = await response.json();
    const rows = payload && payload[1] ? payload[1] : [];
    const gdpMap = new Map();

    rows.forEach((entry) => {
      if (!entry || !entry.country || !entry.country.value || entry.value == null) return;
      const country = entry.country.value;
      const date = Number(entry.date || 0);
      const value = Number(entry.value);
      const current = gdpMap.get(country);
      if (!current || date > current.date) {
        gdpMap.set(country, { country, date, value });
      }
    });

    if (!gdpMap.size) {
      throw new Error('No GDP data found');
    }

    return [...gdpMap.values()].map((entry) => ({ country: entry.country, gdp: entry.value }));
  } catch (error) {
    console.warn('Using GDP fallback data.', error);
    return fallback;
  }
}

function renderGDPScatterPlot(giniData, gdpData, selectedYear) {
  const svg = d3.select('#gdpScatterChart');
  svg.selectAll('*').remove();

  const regionScale = d3.scaleOrdinal()
    .domain(Object.keys(REGION_COLORS))
    .range(Object.values(REGION_COLORS));

  const aliasMap = {
    'Czechia': 'Czech Republic',
    'Korea': 'Korea, Rep.',
    'Russia': 'Russian Federation',
    'Slovak Republic': 'Slovakia',
    'Türkiye': 'Turkiye',
    'United States': 'United States',
    'United Kingdom': 'United Kingdom',
    'China (People’s Republic of)': 'China',
    'South Africa': 'South Africa'
  };

  const gdpMap = new Map();
  gdpData.forEach((entry) => {
    const key = aliasMap[entry.country] || entry.country;
    gdpMap.set(key, entry.gdp);
  });

  const points = giniData
    .filter((d) => d.year === selectedYear && d.gini != null)
    .map((entry) => {
      const countryKey = aliasMap[entry.country] || entry.country;
      const gdp = gdpMap.get(countryKey);
      if (gdp == null || Number.isNaN(gdp)) return null;
      return {
        country: entry.country,
        region: getRegion(entry.country),
        gini: Number(entry.gini),
        gdp: Number(gdp)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.gdp - b.gdp);

  const margin = { top: 20, right: 150, bottom: 40, left: 60 };
  const width = 760;
  const height = 360;

  const x = d3.scaleLinear()
    .domain([0, d3.max(points, (d) => d.gdp) * 1.1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(points, (d) => d.gini) + 0.08])
    .range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `$${d / 1000}k`));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6));

  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', height - margin.bottom)
    .attr('y2', height - margin.bottom)
    .attr('stroke', '#000');

  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', margin.left)
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .attr('stroke', '#000');

  svg.selectAll('circle')
    .data(points)
    .enter()
    .append('circle')
    .attr('cx', (d) => x(d.gdp))
    .attr('cy', (d) => y(d.gini))
    .attr('r', 6)
    .attr('fill', (d) => regionScale(getRegion(d.country)));

  const legend = svg.append('g')
    .attr('transform', `translate(${width - margin.right + 20}, ${margin.top + 10})`);

  const legendRegions = Object.keys(REGION_COLORS);

  legendRegions.forEach((region, index) => {
    const rowY = index * 18;

    legend.append('rect')
      .attr('x', 0)
      .attr('y', rowY)
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', regionScale(region));

    legend.append('text')
      .attr('x', 16)
      .attr('y', rowY + 9)
      .attr('font-size', 11)
      .text(region);
  });

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height - 8)
    .attr('text-anchor', 'middle')
    .text('GDP per capita (current US$)');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .text('Gini coefficient');

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .text(`${selectedYear} GDP vs Gini, colored by region`);
}

function getMostCompleteYear(data) {
  const counts = new Map();

  data.forEach((d) => {
    if (d && d.year != null && d.gini != null) {
      counts.set(d.year, (counts.get(d.year) || 0) + 1);
    }
  });

  let bestYear = null;
  let bestCount = -1;

  counts.forEach((count, year) => {
    if (count > bestCount) {
      bestYear = year;
      bestCount = count;
    }
  });

  return bestYear;
}

async function init() {
  const data = await loadData();
  const gdpData = await loadGDPData();
  const selectedYear = getMostCompleteYear(data) || 2023;

  renderGDPScatterPlot(data, gdpData, selectedYear);
  renderBarChart(data);
}

init();
