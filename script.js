const inputs = {
  nx: document.getElementById('nx'),
  ny: document.getElementById('ny'),
  nz: document.getElementById('nz')
};

const resultText = document.getElementById('result-text');
const svg = d3.select('#grid-svg');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeMetrics(nx, ny, nz) {
  const points = nx * ny * nz;
  const lines = (nx - 1) * ny * nz + nx * (ny - 1) * nz + nx * ny * (nz - 1);
  const faces = lines;
  const voxels = (nx - 1) * (ny - 1) * (nz - 1);

  return { points, lines, faces, voxels };
}

function updateDisplay() {
  const nx = clamp(Number(inputs.nx.value) || 2, 2, 8);
  const ny = clamp(Number(inputs.ny.value) || 2, 2, 8);
  const nz = clamp(Number(inputs.nz.value) || 2, 2, 8);

  inputs.nx.value = nx;
  inputs.ny.value = ny;
  inputs.nz.value = nz;

  const values = computeMetrics(nx, ny, nz);

  resultText.textContent = `n_x = ${nx}, n_y = ${ny}, n_z = ${nz} -> points = ${values.points}, lines = ${values.lines}, faces = ${values.faces}, voxels = ${values.voxels}`;

  renderGrid(nx, ny, nz);
}

function projectPoint(x, y, z, width, height) {
  const scale = 26;
  const dx = (x - z) * scale;
  const dy = (y - 0.5 * (x + z)) * scale;

  return {
    x: width / 2 + dx + 80,
    y: height / 2 + dy + 20
  };
}

function renderGrid(nx, ny, nz) {
  const width = 700;
  const height = 420;

  svg.selectAll('*').remove();

  const points = [];
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        points.push({
          x: ix,
          y: iy,
          z: iz
        });
      }
    }
  }

  const projected = points.map((p) => {
    const screen = projectPoint(p.x, p.y, p.z, width, height);
    return {
      ...p,
      gridX: p.x,
      gridY: p.y,
      gridZ: p.z,
      screenX: screen.x,
      screenY: screen.y
    };
  });

  const pointNodes = svg
    .selectAll('circle')
    .data(projected)
    .enter()
    .append('circle')
    .attr('cx', (d) => d.screenX)
    .attr('cy', (d) => d.screenY)
    .attr('r', 3)
    .attr('fill', '#000');

  const lines = [];

  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz - 1; iz += 1) {
        const a = projected.find((p) => p.gridX === ix && p.gridY === iy && p.gridZ === iz);
        const b = projected.find((p) => p.gridX === ix && p.gridY === iy && p.gridZ === iz + 1);
        if (a && b) lines.push([a, b]);
      }
    }
  }

  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny - 1; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        const a = projected.find((p) => p.gridX === ix && p.gridY === iy && p.gridZ === iz);
        const b = projected.find((p) => p.gridX === ix && p.gridY === iy + 1 && p.gridZ === iz);
        if (a && b) lines.push([a, b]);
      }
    }
  }

  for (let ix = 0; ix < nx - 1; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        const a = projected.find((p) => p.gridX === ix && p.gridY === iy && p.gridZ === iz);
        const b = projected.find((p) => p.gridX === ix + 1 && p.gridY === iy && p.gridZ === iz);
        if (a && b) lines.push([a, b]);
      }
    }
  }

  svg
    .selectAll('line.grid-line')
    .data(lines)
    .enter()
    .append('line')
    .attr('class', 'grid-line')
    .attr('x1', (d) => d[0].screenX)
    .attr('y1', (d) => d[0].screenY)
    .attr('x2', (d) => d[1].screenX)
    .attr('y2', (d) => d[1].screenY)
    .attr('stroke', '#666')
    .attr('stroke-width', 0.8)
    .attr('stroke-opacity', 0.35)
    .attr('stroke-linecap', 'round');

  pointNodes.raise();
}

Object.values(inputs).forEach((input) => {
  input.addEventListener('input', updateDisplay);
});

updateDisplay();
