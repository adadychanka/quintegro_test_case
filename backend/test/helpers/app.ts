import request from 'supertest';
import { App } from '../../src/app';
import { createContainer } from '../../src/container';

export async function createTestApp(env: Record<string, string | undefined> = {}) {
  const container = createContainer({ FAULT_INJECTION: 'off', ...env });
  const app = await App.create(container);
  return { app: app.app, container };
}

export async function login(app: any, login = 'john.doe', password = 'password123'): Promise<string> {
  const res = await request(app).post('/api/login').send({ login, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.body.token;
}

export function gql(app: any, query: string, variables: Record<string, unknown> = {}, token?: string, operationName?: string) {
  const req = request(app).post('/graphql').set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ query, variables, operationName });
}
