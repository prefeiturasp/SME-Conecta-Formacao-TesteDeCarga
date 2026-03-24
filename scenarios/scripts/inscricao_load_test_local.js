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

// ---------------- MÉTRICAS ----------------
const TrackDuration = new Trend('track_duration');
const TrackReqs = new Counter('track_requests');
const TrackFailRate = new Rate('track_fail_rate');
const TrackSuccessRate = new Rate('track_success_rate');
const TrackErrors = new Counter('track_errors');

// ----------------- FUNÇÕES AUXILIARES -----------------
function track(res, name) {
  if (res.status !== 200) {
    console.log(`⚠️ [${name}] falhou. Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }

  TrackDuration.add(res.timings.duration);
  TrackReqs.add(1);
  TrackFailRate.add(res.status === 0 || res.status > 399);
  TrackSuccessRate.add(res.status > 0 && res.status < 399);

  check(res, {
    [`${name} - status 200`]: (r) => r.status === 200
  }) || TrackErrors.add(1);
}

// ---------------- CONFIG ----------------
export const options = {
  vus: 1,
  iterations: 1,
  //stages: [
    //{ duration: '5', target: 150 },
  //],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {

  const BASE_URL = __ENV.BASE_URL;
  //console.log(`****${BASE_URL}***`)
  const usuario = usuarios[(__VU - 1) % usuarios.length];

  // ---------------- LOGIN ----------------

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

  const index = (__VU - 1) % usuarios.length;
  if (loginRes.status !== 200) {
    console.log(`[${index}] ***FALHA: ${usuario.login} Senha: ${usuario.senha} | Status: ${loginRes.status}`);
  } else {
    console.log(`[${index}] OK: ${usuario.login} | Status: ${loginRes.status}`);
  }

  sleep(1)
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  return {
    './scenarios/report/load_teste_local.json': JSON.stringify(data, null, 2),
    './scenarios/report/load_teste_local.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
