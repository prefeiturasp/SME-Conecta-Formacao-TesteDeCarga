const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'scenarios', 'report', 'load_teste.json');
const HTML_PATH = path.join(__dirname, 'scenarios', 'report', 'load_teste_dynamic.html');

if (!fs.existsSync(JSON_PATH)) {
  console.error('❌ JSON não encontrado:', JSON_PATH);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
const metrics = data.metrics || {};

// === Render Resumo Geral ===
function renderSummary() {
  const http_reqs = metrics.http_reqs?.values?.count || 0;
  const http_req_failed = ((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const iterations = metrics.iterations?.values?.count || 0;

  return `
    <h2>Resumo Geral</h2>
    <ul>
      <li>Total de requisições: ${http_reqs}</li>
      <li>Erros: ${http_req_failed}%</li>
      <li>Iterações: ${iterations}</li>
    </ul>
  `;
}

// === Render Trends ===
function renderTrends() {
  const trendMetrics = Object.keys(metrics).filter(k => metrics[k].type === "trend");
  const rows = trendMetrics.map(trendName => {
    const t = metrics[trendName];
    const values = t.values || {};
    return `
      <tr>
        <td>${trendName}</td>
        <td>${(values.avg || 0).toFixed(2)} ms</td>
        <td>${(values.min || 0).toFixed(2)} ms</td>
        <td>${(values.med || 0).toFixed(2)} ms</td>
        <td>${(values.max || 0).toFixed(2)} ms</td>
        <td>${(values['p(90)'] || 0).toFixed(2)} ms</td>
        <td>${(values['p(95)'] || 0).toFixed(2)} ms</td>
      </tr>
    `;
  }).join('\n');

  return `
    <h2>Trends</h2>
    <table>
      <thead>
        <tr>
          <th>Trend</th>
          <th>Avg</th>
          <th>Min</th>
          <th>Med</th>
          <th>Max</th>
          <th>P90</th>
          <th>P95</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7">Nenhuma trend encontrada</td></tr>'}
      </tbody>
    </table>
  `;
}

// === Render Checks dinamicamente agrupados por groups ===
function renderChecksGrouped() {
  const checks = metrics.checks || {};
  const groups = {};

  // Detecta o grupo a partir do prefixo do check (se existir) ou coloca em 'Outros'
  for (const [checkName, metric] of Object.entries(checks)) {
    const parts = checkName.split(':');
    let groupName = 'Outros';
    let actualCheckName = checkName;

    if (parts.length === 2) {
      groupName = parts[0].trim();
      actualCheckName = parts[1].trim();
    }

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push({ name: actualCheckName, metric });
  }

  let html = '<h2>Checks por Grupo</h2>';

  if (Object.keys(groups).length === 0) {
    html += '<p>Nenhum check encontrado</p>';
    return html;
  }

  for (const [groupName, checkList] of Object.entries(groups)) {
    html += `<h3>█ ${groupName}</h3>`;
    html += `
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>✓ Pass</th>
            <th>✗ Fail</th>
            <th>Percentual</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const { name, metric } of checkList) {
      const passes = metric?.values?.passes ?? 0;
      const fails = metric?.values?.fails ?? 0;
      const total = passes + fails;
      const percent = total > 0 ? ((passes / total) * 100).toFixed(2) : '0.00';

      html += `
        <tr>
          <td>${name}</td>
          <td>${passes}</td>
          <td>${fails}</td>
          <td>${percent}%</td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    `;
  }

  return html;
}

// === Monta HTML final ===
const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório K6 Dinâmico</title>
<style>
body { font-family: Arial; margin: 20px; }
h2 { margin-top: 30px; }
h3 { margin-top: 20px; color: #333; }
table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
th { background-color: #f4f4f4; }
</style>
</head>
<body>

<h1>Relatório de Teste de Carga - Dinâmico</h1>

${renderSummary()}
${renderChecksGrouped()}
${renderTrends()}

</body>
</html>
`;

fs.writeFileSync(HTML_PATH, html, 'utf-8');
console.log('✅ Relatório HTML dinâmico gerado com sucesso!');
console.log('📄', HTML_PATH);
  