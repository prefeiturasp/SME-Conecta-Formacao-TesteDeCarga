import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// -------------------- CONFIGURAÇÃO --------------------

// 🔹 ALTERE AQUI A QUANTIDADE DE USUÁRIOS POR REQUISIÇÃO
const QUANTIDADE_USUARIOS = 1;

export const options = {
  stages: [
    { duration: '1s', target: 1 },
    //{ duration: '1m', target: 20 },
    //{ duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000'],
  },
};

// -------------------- CONSTANTES --------------------
const BASE_URL = 'https://hom-acessos.sme.prefeitura.sp.gov.br';
const API_KEY = 'fe8c65abfac596a39c40b8d88302cb7341c8ec99';

// -------------------- MÉTRICAS --------------------
const cadastroTrend = new Trend('cadastro_em_massa_duration');

// -------------------- TESTE --------------------
export default function () {

  group(`Cadastro em Massa - ${QUANTIDADE_USUARIOS} usuarios`, () => {

    const res = http.post(
      `${BASE_URL}/api/v1/UsuariosTeste/cadastrar-em-massa?quantidade=${QUANTIDADE_USUARIOS}`,
      null,
      {
        headers: {
          'accept': 'text/plain',
          'x-api-acessos-key': API_KEY,
        },
        tags: { name: 'POST cadastrar-em-massa' },
      }
    );

    cadastroTrend.add(res.timings.duration);

    // 🔎 LOG DO RETORNO
    console.log('--------------------------------------');
    console.log(`Status: ${res.status}`);
    console.log(`Tempo: ${res.timings.duration} ms`);
    console.log(`Body: ${res.body}`);
    console.log('--------------------------------------');

    check(res, {
      'status 200 ou 201': r => r.status === 200 || r.status === 201,
      'tempo resposta < 5s': r => r.timings.duration < 5000,
    });
  });

  sleep(1);
}

// -------------------- RELATÓRIO --------------------
export function handleSummary(data) {
  return {
    'report/cadastro_em_massa.json': JSON.stringify(data, null, 2),
    'report/cadastro_em_massa.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}