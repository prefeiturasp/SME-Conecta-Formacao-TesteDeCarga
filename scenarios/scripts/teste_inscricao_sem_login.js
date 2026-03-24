import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// ---------------- LOAD DATA ----------------
const usuarios = new SharedArray('usuarios', function () {
  const data = JSON.parse(open('../data/usuarios.json'));
  return data.cursistas;
});

// ---------------- ENV ----------------
const BASE_URL = __ENV.BASE_URL || 'https://hom-conectaformacao.sme.prefeitura.sp.gov.br';
const TOKEN = __ENV.TOKEN;

const PROPOSTA_TURMA_IDS = (__ENV.PROPOSTA_TURMA_ID || '')
  .split(',')
  .filter(Boolean)
  .map(Number);

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

// ---------------- FUNÇÃO TRACK ----------------
function track(res, name) {
  const success = res.status === 200 || res.status === 201;

  if (!success) {
    console.log(`⚠️ [${name}] falhou. Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }

  TrackDuration.add(res.timings.duration);
  TrackReqs.add(1);
  TrackFailRate.add(!success);
  TrackSuccessRate.add(success);

  check(res, {
    [`${name} - status ok`]: (r) => success,
  }) || TrackErrors.add(1);
}

// ---------------- CONFIG ----------------
export const options = {
  vus: 400,
  iterations: 400,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {
  const usuario = usuarios[(__VU - 1) % usuarios.length];
  const index = (__VU - 1) % usuarios.length;

  const PROPOSTA_TURMA_ID =
    PROPOSTA_TURMA_IDS[Math.floor(Math.random() * PROPOSTA_TURMA_IDS.length)];

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

  const res = http.post(`${BASE_URL}/api/v1/Inscricao`, payloadInscricao, {
    headers: {
      'Content-Type': 'application/json',
      accept: 'text/plain',
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  track(res, 'inscricao');

  console.log(
    `[${index}] ${usuario.login} | Turma: ${PROPOSTA_TURMA_ID} | Status: ${res.status}`
  );

  sleep(1);
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  try {
    return {
      './scenarios/report/teste_inscricao_sem_login.html': htmlReport(data),
    };
  } catch (e) {
    console.error('Erro ao gerar relatório HTML:', e);

    return {
      'teste_inscricao_sem_login.html': htmlReport(data),
      stdout: '⚠️ Relatório salvo na raiz pois a pasta scenarios/report não existe',
    };
  }
}