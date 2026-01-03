import assert from 'node:assert';
import { test } from 'node:test';
import { ServerResponse } from '../src/response.js';
import { testServer } from './utils.js';

testServer('Basic HTTP Methods', server => {
    server.get('/get-text', () => ServerResponse.text('get'));
    server.put('/put-text', () => ServerResponse.text('put'));
    server.delete('/delete-text', () => ServerResponse.text('delete'));
    server.patch('/patch-text', () => ServerResponse.text('patch'));

    server.get('/get-json', () => ServerResponse.json({ text: 'json' }));

    server.route(['GET', 'POST'], '/multi', ({ method }) => ServerResponse.text(`multi ${method}`));
    server.get('/custom-response', () => ServerResponse.text('custom', {
        status: 201,
        headers: { 'X-Custom': 'value' }
    }));
    server.all('/all', ({ method }) => ServerResponse.text(`all ${method}`));
    server.get('/no-response', () => { });
}, host => {
    test('should handle GET requests returning text', async () => {
        const res = await fetch(`${host}/get-text`, { method: 'GET' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'get');
    });

    test('should handle PUT requests returning text', async () => {
        const res = await fetch(`${host}/put-text`, { method: 'PUT' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'put');
    });

    test('should handle DELETE requests returning text', async () => {
        const res = await fetch(`${host}/delete-text`, { method: 'DELETE' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'delete');
    });

    test('should handle PATCH requests returning text', async () => {
        const res = await fetch(`${host}/patch-text`, { method: 'PATCH' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'patch');
    });

    test('should return 404 for incorrect method on existing route', async () => {
        const res = await fetch(`${host}/get-text`, { method: 'POST' });
        assert.strictEqual(res.status, 404);
    });

    test('should handle GET requests returning JSON with correct Content-Type', async () => {
        const res = await fetch(`${host}/get-json`, { method: 'GET' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('Content-Type'), 'application/json');
        assert.deepStrictEqual(await res.json(), { text: 'json' });
    });

    test('should handle multiple methods on the same route', async () => {
        const resGet = await fetch(`${host}/multi`, { method: 'GET' });
        assert.strictEqual(await resGet.text(), 'multi GET');
        const resPost = await fetch(`${host}/multi`, { method: 'POST' });
        assert.strictEqual(await resPost.text(), 'multi POST');
    });

    test('should allow custom status code and headers in response', async () => {
        const res = await fetch(`${host}/custom-response`);
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.headers.get('X-Custom'), 'value');
        assert.strictEqual(await res.text(), 'custom');
    });

    test('should handle "all" method for multiple HTTP methods', async () => {
        const res = await fetch(`${host}/all`, { method: 'POST' });
        assert.strictEqual(await res.text(), 'all POST');
        const res2 = await fetch(`${host}/all`, { method: 'PUT' });
        assert.strictEqual(await res2.text(), 'all PUT');
    });

    test('should return 404 when handler returns nothing', async () => {
        const res = await fetch(`${host}/no-response`);
        assert.strictEqual(res.status, 404);
        const text = await res.text();
        assert.ok(text.includes('<h1>Error 404</h1>'));
    });
});

testServer('CORS Handling', server => {
    server.get('/cors', () => ServerResponse.text('cors'), { allowCrossOrigin: true });
    server.get('/get-text', () => ServerResponse.text('get'));
}, host => {
    test('should handle CORS preflight requests', async () => {
        const res = await fetch(`${host}/cors`, { method: 'OPTIONS' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
    });

    test('should add CORS headers to simple requests', async () => {
        const res = await fetch(`${host}/cors`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
        assert.strictEqual(await res.text(), 'cors');
    });

    test('should return 404 for OPTIONS on non-existent route', async () => {
        const res = await fetch(`${host}/non-existent`, { method: 'OPTIONS' });
        assert.strictEqual(res.status, 404);
    });

    test('should return Allow header for OPTIONS on existing route', async () => {
        const res = await fetch(`${host}/get-text`, { method: 'OPTIONS' });
        assert.strictEqual(res.status, 200);
        assert.ok(res.headers.get('Allow')?.includes('GET'));
    });
});

testServer('Response Types & Headers', server => {
    server.get('/bytes', () => ServerResponse.bytes(new Uint8Array([1, 2, 3]).buffer));
    server.get('/blob', () => ServerResponse.blob(new Blob(['blob content'])));
    server.get('/empty', () => ServerResponse.empty());

    server.get('/headers-array', () => ServerResponse.text('headers', {
        headers: [['X-Array', 'first'], ['X-Array', 'second']]
    }));
    server.get('/empty-headers', () => ServerResponse.empty({ headers: { 'X-Empty': 'true' } }));
}, host => {
    test('should send raw bytes', async () => {
        const res = await fetch(`${host}/bytes`);
        const buffer = await res.arrayBuffer();
        assert.deepStrictEqual(new Uint8Array(buffer), new Uint8Array([1, 2, 3]));
    });

    test('should send Blob content', async () => {
        const res = await fetch(`${host}/blob`);
        assert.strictEqual(await res.text(), 'blob content');
    });

    test('should handle empty responses', async () => {
        const res = await fetch(`${host}/empty`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), '');
    });

    test('should handle array headers', async () => {
        const res = await fetch(`${host}/headers-array`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('X-Array'), 'first, second');
    });

    test('should allow empty response with headers', async () => {
        const res = await fetch(`${host}/empty-headers`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('X-Empty'), 'true');
        assert.strictEqual(await res.text(), '');
    });
});