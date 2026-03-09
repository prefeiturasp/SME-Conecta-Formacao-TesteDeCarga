import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// ---------------- LOAD DATA ----------------
const usuarios = new SharedArray('usuarios', function () {
  const data = JSON.parse(open('../data/usuarios.json'));
  return data.cursistas;
});

const admin = JSON.parse(open('../data/usuarios.json')).admin;

// ---------------- ENV ----------------
const BASE_URL = __ENV.BASE_URL;
const FORMACAO_ID = Number(__ENV.FORMACAO_ID);

// ---------------- MÉTRICAS ----------------
const inscricaoTrend = new Trend('inscricao_duration');

// ---------------- CONFIG ----------------
export const options = {
  stages: [
    { duration: '30s', target: 17 },
    //{ duration: '1m', target: 17 },
    //{ duration: '10s', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000']
  }
};

// ---------------- TEST ----------------
export default function () {

  const usuario = usuarios[(__VU - 1) % usuarios.length];

  // LOGIN
  const loginRes = http.post(
    `${BASE_URL}/api/v1/autenticacao`,
    JSON.stringify(usuario),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'login ok': r => r.status === 200
  });

  const token = loginRes.json('token');

  if (!token) {
    console.log(`Falha login: ${usuario.login}`);
    return;
  }

  const headers = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  // ---------------- CONSULTAS ----------------
  group('Fluxo de consulta formação', () => {

    const endpoints = [
      `/api/v1/Inscricao`,
      `/api/v1/publico/cargo-funcao/tipo/1`,
      `/api/v1/publico/area-promotora`,
      `/api/v1/publico/formato`,
      `/api/v1/publico/palavra-chave`,
      `/api/v1/publico/formacao-listagem`,
      `/api/v1/publico/formacao-detalhada/${FORMACAO_ID}`,
      `/api/v1/Inscricao/turmas/${FORMACAO_ID}`,
      `/api/v1/Inscricao/dados-inscricao-proposta/${FORMACAO_ID}`
    ];

    endpoints.forEach((url) => {

      const res = http.get(`${BASE_URL}${url}`, headers);

      inscricaoTrend.add(res.timings.duration);

      check(res, {
        [`${url} 200`]: r => r.status === 200
      });

    });

  });

  sleep(1);
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  return {
    'report/load_teste.json': JSON.stringify(data, null, 2),
    'report/load_teste.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}