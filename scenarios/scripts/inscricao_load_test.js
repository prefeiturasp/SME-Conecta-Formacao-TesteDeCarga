import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// ----------------- MÉTRICAS -----------------
export let Duration = new Trend('duration_total');
export let FailRate = new Rate('fail_rate');
export let SuccessRate = new Rate('success_rate');
export let Reqs = new Counter('reqs_total');
export let Errors = new Counter('errors_total');

// ---------------- LOAD DATA ----------------
const usuarios = new SharedArray('usuarios', function () {
  const data = JSON.parse(open('../data/usuarios.json'));
  return data.cursistas;
});

const admin = JSON.parse(open('../data/usuarios.json')).admin;

// ---------------- ENV ----------------
const BASE_URL = __ENV.BASE_URL;
const FORMACAO_ID = Number(__ENV.FORMACAO_ID);

// lista de turmas vinda do ENV
const PROPOSTA_TURMA_IDS = (__ENV.PROPOSTA_TURMA_ID || "")
  .split(',')
  .map(id => Number(id.trim()))
  .filter(id => !isNaN(id));

// dados do cargo
const CARGO_CODIGO = __ENV.CARGO_CODIGO;
const CARGO_DRE_CODIGO = __ENV.CARGO_DRE_CODIGO;
const CARGO_UE_CODIGO = __ENV.CARGO_UE_CODIGO;
const TIPO_VINCULO = Number(__ENV.TIPO_VINCULO);

// ---------------- MÉTRICAS ----------------
const inscricaoTrend = new Trend('inscricao_duration');
const postInscricaoTrend = new Trend('post_inscricao_duration');

const Duration = new Trend('custom_duration');
const Reqs = new Counter('custom_requests');
const FailRate = new Rate('custom_fail_rate');
const SuccessRate = new Rate('custom_success_rate');
const Errors = new Counter('custom_errors');

// ----------------- FUNÇÕES AUXILIARES -----------------
function textoPlanejamento() {
  return '<p>' + 'Planejamento de aula automatizado. '.repeat(10) + '</p>';
}

function track(res, name) {
  if (res.status !== 200) {
    console.log(`⚠️ [${name}] falhou. Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }

  Duration.add(res.timings.duration);
  Reqs.add(1);
  FailRate.add(res.status === 0 || res.status > 399);
  SuccessRate.add(res.status > 0 && res.status < 399);

  check(res, {
    [`${name} - status 200`]: (r) => r.status === 200
  }) || Errors.add(1);
}

// ---------------- CONFIG ----------------
export const options = {
  stages: [
    { duration: '30s', target: 50 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {

  const usuario = usuarios[(__VU - 1) % usuarios.length];

  // ---------------- LOGIN ----------------
  const loginRes = http.post(
    `${BASE_URL}/api/v1/autenticacao`,
    JSON.stringify(usuario),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  track(loginRes, 'login');

  const token = loginRes.json('token');

  if (!token) {
    console.log(`Falha login: ${usuario.login}`);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // ---------------- INSCRIÇÃO ----------------

  const propostaTurmaId =
    PROPOSTA_TURMA_IDS[(__VU + __ITER) % PROPOSTA_TURMA_IDS.length];

  const payloadInscricao = JSON.stringify({
    propostaTurmaId: propostaTurmaId,
    cargoCodigo: CARGO_CODIGO,
    cargoDreCodigo: CARGO_DRE_CODIGO,
    cargoUeCodigo: CARGO_UE_CODIGO,
    tipoVinculo: TIPO_VINCULO,
    vagaRemanescente: false,
    usuarioAcessibilidade: {
      possuiDeficiencia: false,
      salvar: true
    }
  });

  const resInscricao = http.post(
    `${BASE_URL}/api/v1/Inscricao`,
    payloadInscricao,
    authHeaders
  );

  postInscricaoTrend.add(resInscricao.timings.duration);

  console.log(
    `VU ${__VU} | Usuario ${usuario.login} | Turma ${propostaTurmaId} | Status inscrição: ${resInscricao.status}`
  );

  track(resInscricao, 'inscricao');

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
      `/api/v1/Inscricao/dados-inscricao-proposta/${FORMACAO_ID}`,
    ];

    endpoints.forEach((url) => {

      const res = http.get(`${BASE_URL}${url}`, authHeaders);

      inscricaoTrend.add(res.timings.duration);

      track(res, url);

    });

  });

  sleep(1);
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  return {
    'scenarios/report/load_teste.json': JSON.stringify(data, null, 2),
    'scenarios/report/load_teste.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}