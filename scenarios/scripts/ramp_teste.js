import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// ---------------- LOAD DATA ----------------
const usuarios = new SharedArray('usuarios', function () {
  const data = JSON.parse(open('../data/usuarios.json'));
  return data.cursistas;
});

// ---------------- ENV ----------------
const BASE_URL = __ENV.BASE_URL;

// ---------------- MÉTRICAS ----------------
const TrackDuration = new Trend('track_duration');
const TrackReqs = new Counter('track_requests');
const TrackFailRate = new Rate('track_fail_rate');
const TrackSuccessRate = new Rate('track_success_rate');
const TrackErrors = new Counter('track_errors');

// ---------------- FUNÇÃO TRACK ----------------
function track(res, name) {
  const success = res.status === 200;

  if (!success) {
    console.log(`⚠️ [${name}] falhou. Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }

  TrackDuration.add(res.timings.duration);
  TrackReqs.add(1);
  TrackFailRate.add(!success);
  TrackSuccessRate.add(success);

  check(res, {
    [`${name} - status 200`]: (r) => success,
  }) || TrackErrors.add(1);
}

// ---------------- CONFIG (RAMP) ----------------
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // inicia com 5 usuários
    { duration: '30s', target: 10 },  // sobe para 10
    { duration: '30s', target: 100 },  // mantém 100 (carga estável)
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {

  // Seleção aleatória evita conflito de usuário simultâneo
  const usuario = usuarios[Math.floor(Math.random() * usuarios.length)];

  const loginRes = http.post(
    `${BASE_URL}/api/v1/autenticacao/autenticar`,
    JSON.stringify(usuario),
    {
      headers: {
        'Content-Type': 'application/json',
        'accept': 'text/plain',
        'x-api-acessos-key': 'fe8c65abfac596a39c40b8d88302cb7341c8ec99',
      },
    }
  );

  track(loginRes, 'login');

  sleep(1); // think time (simula usuário real)
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`./scenarios/report/ramp_teste_${timestamp}.html`]: htmlReport(data),
    [`./scenarios/report/ramp_teste_${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}