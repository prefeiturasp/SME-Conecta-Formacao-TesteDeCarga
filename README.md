
# 🧪 Testes de Carga com K6

Este projeto utiliza o [K6](https://k6.io/) para realizar testes de performance em APIs, simulando diferentes cenários de uso com usuários virtuais (VUs).

## ✅ Requisitos

- Node.js instalado
- K6 instalado: [Guia de instalação oficial](https://k6.io/docs/getting-started/installation/)

---

## 🧰 Estrutura de Diretórios

```
projeto/
├── cenarios/
│   └── testes/
│       ├── load_test.js
│       ├── ramp_test.js
│       ├── soak_test.js
│       ├── spike_test.js
│       └── stress_test.js
└── report/
    └── summary.html
```

---

## 📌 Tipos de Testes

### 1. Load Test (Teste de Carga)
- Simula um número fixo de usuários simultâneos acessando a aplicação.
```javascript
stages: [
  { duration: '1m', target: 100 },
]
```

### 2. Ramp Test
- Aumenta gradualmente o número de usuários.
```javascript
stages: [
  { duration: '1m', target: 50 },
  { duration: '2m', target: 100 },
  { duration: '2m', target: 200 },
]
```

### 3. Soak Test (Teste de Encharcamento)
- Mantém muitos usuários conectados por longos períodos.
```javascript
stages: [
  { duration: '5m', target: 500 },
]
```

### 4. Spike Test
- Simula um pico repentino de usuários.
```javascript
stages: [
  { duration: '1m', target: 50 },
  { duration: '10s', target: 500 },
  { duration: '3m', target: 50 },
]
```

### 5. Stress Test
- Vai além da capacidade esperada, para identificar falhas.
```javascript
stages: [
  { duration: '1m', target: 100 },
  { duration: '1m', target: 200 },
  { duration: '1m', target: 400 },
  { duration: '1m', target: 800 },
]
```

---

## 🧪 Executando os Testes

### Comando base no terminal:
```bash
k6 run -o experimental-prometheus-rw --tag testid=teste_log "C:\Users\seu-usuario\caminho\para\projeto\cenarios\testes\load_test.js"
```

### ✅ Exemplo genérico:
```bash
k6 run -o experimental-prometheus-rw --tag testid=teste_log "./cenarios/testes/load_test.js"
```

---

## 📄 Relatórios

```js
export function handleSummary(data) {
  return {
    "report/summary.html": htmlReport(data),
  };
}
```

---

## 🧠 Dicas

- Use `console.log("Checkpoint")` para verificar fluxos no terminal.
- Use `sleep(1)` entre requisições para simular comportamento realista.
- Use `--vus` e `--duration` como alternativa a stages.

---

## 📬 Referências

- [Documentação K6](https://k6.io/docs/)
- [Tipos de Teste de Carga](https://k6.io/docs/testing-guides/load-testing-best-practices/)
- [Plugin Prometheus (experimental)](https://k6.io/docs/results-visualization/prometheus-remote-write/)
