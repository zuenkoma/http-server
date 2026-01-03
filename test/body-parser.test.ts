import assert from 'node:assert';
import { test } from 'node:test';
import { z } from 'zod';
import { ServerResponse } from '../src/response.js';
import { testServer } from './utils.js';

testServer('Body Parsing', server => {
    server.post('/form', ({ body }) => ServerResponse.json(body), { schema: z.any() });

    const schema = z.object({ test: z.string() });
    server.post('/json', ({ body }) => ServerResponse.json(body), { schema });

    server.post('/stream', async ({ body }) => {
        if (body instanceof ReadableStream) {
            const reader = body.getReader();
            const { value } = await reader.read();
            return ServerResponse.bytes((value || new Uint8Array()).buffer);
        }
        return ServerResponse.text('not a stream');
    });

    server.post('/large', ({ body }) => ServerResponse.json({ size: (body as any).data.length }), { schema: z.any() });
}, host => {
    test('should parse FormData body', async () => {
        const formData = new FormData();
        formData.append('key', 'value');
        const res = await fetch(`${host}/form`, {
            method: 'POST',
            body: formData
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { key: 'value' });
    });

    test('should parse URLSearchParams body', async () => {
        const params = new URLSearchParams();
        params.append('key', 'value');
        const res = await fetch(`${host}/form`, {
            method: 'POST',
            body: params
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { key: 'value' });
    });

    test('should handle array values in form data', async () => {
        const res = await fetch(`${host}/form`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'id=1&id=2'
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { id: ['1', '2'] });
    });

    test('should validate request body against Zod schema (success)', async () => {
        const res = await fetch(`${host}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: 'test' })
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { test: 'test' });
    });

    test('should validate request body against Zod schema (failure)', async () => {
        const res = await fetch(`${host}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 123 })
        });
        assert.strictEqual(res.status, 400);
    });

    test('should return 400 for invalid JSON body', async () => {
        const res = await fetch(`${host}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ invalid json '
        });
        assert.strictEqual(res.status, 400);
    });

    test('should handle JSON body with charset in Content-Type', async () => {
        const res = await fetch(`${host}/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ test: 'charset' })
        });
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { test: 'charset' });
    });

    test('should handle request body as a stream', async () => {
        const res = await fetch(`${host}/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: 'stream content'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'stream content');
    });

    test('should handle large JSON body', async () => {
        const largeData = 'x'.repeat(1024 * 1024); // 1MB
        const res = await fetch(`${host}/large`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: largeData })
        });

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { size: 1024 * 1024 });
    });
});