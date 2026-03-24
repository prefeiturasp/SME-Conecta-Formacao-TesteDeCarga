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
const BASE_URL = __ENV.BASE_URL || 'https://hom-conectaformacao.sme.prefeitura.sp.gov.br';
const TOKEN = __ENV.TOKEN;

const PROPOSTA_TURMA_ID = Number(__ENV.PROPOSTA_TURMA_ID );
const CARGO_CODIGO = __ENV.CARGO_CODIGO;
const CARGO_DRE_CODIGO = __ENV.CARGO_DRE_CODIGO;
const CARGO_UE_CODIGO = __ENV.CARGO_UE_CODIGO;
const TIPO_VINCULO = Number(__ENV.TIPO_VINCULO || '1');

// ---------------- MÉTRICAS ----------------
const TrackDuration = new Trend('track_duration');
const TrackReqs = new Counter('track_requests');
const TrackFailRate = new Rate('track_fail_rate');
const TrackSuccessRate = new Rate('track_success_rate');
const TrackErrors = new Counter('track_errors');

// ----------------- FUNÇÕES AUXILIARES -----------------
function track(res, name) {
  if (res.status !== 200 && res.status !== 201) {
    console.log(`⚠️ [${name}] falhou. Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }

  TrackDuration.add(res.timings.duration);
  TrackReqs.add(1);
  TrackFailRate.add(res.status === 0 || res.status > 399);
  TrackSuccessRate.add(res.status > 0 && res.status < 400);

  check(res, {
    [`${name} - status ok`]: (r) => r.status === 200 || r.status === 201,
  }) || TrackErrors.add(1);
}

// ---------------- CONFIG ----------------
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {

  const usuario = usuarios[(__VU - 1) % usuarios.length];
  const index = (__VU - 1) % usuarios.length;
  console.log(`usuario cadastrado: ${usuario.login}, ${usuario.senha}`);
  // ---------------- INSCRIÇÃO ----------------
  const payloadInscricao = JSON.stringify({
    propostaTurmaId: PROPOSTA_TURMA_ID,
    cargoCodigo: CARGO_CODIGO,
    cargoDreCodigo: CARGO_DRE_CODIGO,
    cargoUeCodigo: CARGO_UE_CODIGO,
    tipoVinculo: TIPO_VINCULO,
    vagaRemanescente: false,
    usuarioLogin: usuario.login,
    usuarioAcessibilidade: {
      possuiDeficiencia: false,
      salvar: true,
    },
  });

  const inscricaoRes = http.post(
    `${BASE_URL}/api/v1/Inscricao`,
    payloadInscricao,
    {
      headers: {
        'Content-Type': 'application/json',
        'accept': 'text/plain',
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  track(inscricaoRes, 'inscricao');

  console.log(
    `[${index}] Inscrição: ${usuario.login} | Turma: ${PROPOSTA_TURMA_ID} | Status: ${inscricaoRes.status}`
  );

  sleep(1);
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  return {
    './scenarios/report/inscricao_conecta_local.json': JSON.stringify(data, null, 2),
    './scenarios/report/inscricao_conecta_local.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
