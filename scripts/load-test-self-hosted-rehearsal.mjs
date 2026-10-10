import { performance } from 'node:perf_hooks';

import { parseEnvironment } from './lib/self-hosted-rehearsal.mjs';

const durationSeconds = Number.parseInt(
  process.env.SELFHOST_LOAD_DURATION_SECONDS ?? '15',
  10,
);
const concurrency = Number.parseInt(
  process.env.SELFHOST_LOAD_CONCURRENCY ?? '20',
  10,
);
const maximumP95Milliseconds = Number.parseInt(
  process.env.SELFHOST_LOAD_MAXIMUM_P95_MS ?? '1000',
  10,
);

if (
  !Number.isSafeInteger(durationSeconds) ||
  durationSeconds < 1 ||
  !Number.isSafeInteger(concurrency) ||
  concurrency < 1 ||
  !Number.isSafeInteger(maximumP95Milliseconds) ||
  maximumP95Milliseconds < 1
) {
  throw new Error('Load-test settings must be positive integers.');
}

const environment = parseEnvironment();
const targets = [
  {
    name: 'Admin login',
    url: 'http://127.0.0.1:3200/login',
    headers: {},
  },
  {
    name: 'Catalog REST through Envoy and RLS',
    url: 'http://127.0.0.1:58000/rest/v1/service_categories?select=id&limit=1',
    headers: {
      apikey: environment.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${environment.SUPABASE_PUBLISHABLE_KEY}`,
    },
  },
];

function percentile(sorted, ratio) {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  ];
}

async function exercise(target) {
  const deadline = performance.now() + durationSeconds * 1_000;
  const latencies = [];
  const failures = [];

  async function worker() {
    while (performance.now() < deadline) {
      const startedAt = performance.now();
      try {
        const response = await fetch(target.url, {
          headers: target.headers,
          signal: AbortSignal.timeout(5_000),
        });
        await response.arrayBuffer();
        latencies.push(performance.now() - startedAt);
        if (!response.ok) failures.push(`HTTP ${response.status}`);
      } catch (error) {
        failures.push(error instanceof Error ? error.name : 'unknown error');
      }
    }
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = (performance.now() - startedAt) / 1_000;
  const sorted = latencies.toSorted((left, right) => left - right);
  const result = {
    name: target.name,
    requests: latencies.length,
    failures: failures.length,
    requestsPerSecond: latencies.length / elapsedSeconds,
    p50Milliseconds: percentile(sorted, 0.5),
    p95Milliseconds: percentile(sorted, 0.95),
    p99Milliseconds: percentile(sorted, 0.99),
  };

  if (!result.requests || result.failures) {
    throw new Error(
      `${target.name} failed: requests=${result.requests}, failures=${result.failures}, examples=${failures.slice(0, 3).join(', ')}`,
    );
  }
  if (result.p95Milliseconds > maximumP95Milliseconds) {
    throw new Error(
      `${target.name} p95 ${result.p95Milliseconds.toFixed(1)}ms exceeds ${maximumP95Milliseconds}ms.`,
    );
  }
  return result;
}

for (const target of targets) {
  const result = await exercise(target);
  process.stdout.write(
    `${result.name}: ${result.requests} requests, ${result.failures} failures, ${result.requestsPerSecond.toFixed(1)} req/s, p50=${result.p50Milliseconds.toFixed(1)}ms, p95=${result.p95Milliseconds.toFixed(1)}ms, p99=${result.p99Milliseconds.toFixed(1)}ms\n`,
  );
}
