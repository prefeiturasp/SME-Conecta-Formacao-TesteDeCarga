import http from 'k6/http';
import { check, sleep } from 'k6';
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
const PROPOSTA_TURMA_IDS = (__ENV.PROPOSTA_TURMA_ID || '').split(',').filter(Boolean).map(Number);

const CARGO_CODIGO = __ENV.CARGO_CODIGO;
const CARGO_DRE_CODIGO = __ENV.CARGO_DRE_CODIGO;
const CARGO_UE_CODIGO = __ENV.CARGO_UE_CODIGO;
const TIPO_VINCULO = Number(__ENV.TIPO_VINCULO || '1');

// ---------------- RAMP CONFIG ----------------
// Definido via ENV:
// STAGE_DURATION=30s
// STAGE_TARGETS=1,5,10,20
const STAGE_DURATION = __ENV.STAGE_DURATION || '30s';
const STAGE_TARGETS = (__ENV.STAGE_TARGETS || '1,2,3').split(',').map(Number);

// ---------------- MÉTRICAS ----------------
const TrackDuration = new Trend('track_duration');
const TrackReqs = new Counter('track_requests');
const TrackFailRate = new Rate('track_fail_rate');
const TrackSuccessRate = new Rate('track_success_rate');
const TrackErrors = new Counter('track_errors');

function track(res, name) {
  const success = res.status === 200 || res.status === 201;
  TrackDuration.add(res.timings.duration);
  TrackReqs.add(1);
  TrackFailRate.add(!success);
  TrackSuccessRate.add(success);
  check(res, { [`${name} - status ok`]: (r) => success }) || TrackErrors.add(1);
}

// ---------------- CONTROL DE INSCRIÇÕES ----------------
// Map para controlar turmas já inscritas por usuário (fora do SharedArray)
const inscricoesMap = {};
usuarios.forEach(u => inscricoesMap[u.login] = []);

// ---------------- CONFIG ----------------
const stages = STAGE_TARGETS.map(target => ({ duration: STAGE_DURATION, target }))
  .concat([{ duration: '30s', target: 0 }]); // ramp-down final

export const options = {
  stages,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

// ---------------- TEST ----------------
export default function () {
  const index = (__VU - 1) % usuarios.length;
  const usuario = usuarios[index];
  const inscricoes = inscricoesMap[usuario.login]; // pega lista de turmas já inscritas

  // filtra turmas disponíveis
  const turmasDisponiveis = PROPOSTA_TURMA_IDS.filter(id => !inscricoes.includes(id));
  if (turmasDisponiveis.length === 0) {
    console.log(`[VU${__VU}] ${usuario.login} não possui turmas disponíveis`);
    return;
  }

  // seleciona uma turma aleatória
  const PROPOSTA_TURMA_ID = turmasDisponiveis[Math.floor(Math.random() * turmasDisponiveis.length)];

  const payloadInscricao = JSON.stringify({
    propostaTurmaId: PROPOSTA_TURMA_ID,
    cargoCodigo: CARGO_CODIGO,
    cargoDreCodigo: CARGO_DRE_CODIGO,
    cargoUeCodigo: CARGO_UE_CODIGO,
    tipoVinculo: TIPO_VINCULO,
    vagaRemanescente: false,
    usuarioLogin: usuario.login,
    usuarioAcessibilidade: { possuiDeficiencia: false, salvar: true },
  });

  // retry simples em caso de falha de rede
  let res;
  let attempts = 0;
  const maxAttempts = 2;

  do {
    res = http.post(`${BASE_URL}/api/v1/Inscricao`, payloadInscricao, {
      headers: { 'Content-Type': 'application/json', accept: 'text/plain', Authorization: `Bearer ${TOKEN}` },
    });
    attempts++;
    if (res.status === 0) {
      console.log(`⚠️ [VU${__VU}] Conexão falhou na turma ${PROPOSTA_TURMA_ID}, tentando novamente (${attempts})`);
      sleep(1);
    } else break;
  } while (attempts < maxAttempts);

  // track e logs
  if (res.status === 200 || res.status === 201) {
    track(res, 'inscricao');
    console.log(`[VU${__VU}] ${usuario.login} | Turma: ${PROPOSTA_TURMA_ID} | Status: ${res.status}`);
    inscricoes.push(PROPOSTA_TURMA_ID);
  } else if (res.status === 400) {
    console.log(`⚠️ [VU${__VU}] ${usuario.login} já inscrito na turma ${PROPOSTA_TURMA_ID}`);
  } else {
    console.log(`⚠️ [VU${__VU}] ${usuario.login} | Erro inesperado: Status ${res.status}`);
  }

  sleep(1);
}

// ---------------- RELATÓRIO ----------------
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return { [`./scenarios/report/teste_inscricao_${timestamp}.html`]: htmlReport(data) };
}