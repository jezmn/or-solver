const API_BASE = '';

async function apiRequest(method, endpoint, body) {
  const url = API_BASE + endpoint;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = err.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function solve(method, input) {
  const endpoint = `/api/${method}`;
  return apiRequest('POST', endpoint, input);
}

async function healthCheck() {
  return apiRequest('GET', '/api/health');
}
