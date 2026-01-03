import assert from 'node:assert';
import { join } from 'node:path';
import { test } from 'node:test';
import { ServerResponse } from '../src/response.js';
import { testServer } from './utils.js';

testServer('Static Files & Redirects', server => {
    server.get('/file', () => ServerResponse.file('test/static/test.txt'));

    server.get('/redirect', () => ServerResponse.redirect('/target'));
    server.get('/target', () => ServerResponse.text('target'));

    server.get('/file-404', () => ServerResponse.file('non-existent.txt'));
    server.get('/file-fallback', () => ServerResponse.file('test/static/test.customxml'));

    server.get('/static/:file', ({ url }) => {
        return ServerResponse.file(join('test/static', url.params.file!));
    });
}, host => {
    test('should serve static files with correct Content-Type', async () => {
        const res = await fetch(`${host}/file`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('Content-Type'), 'text/plain');
        assert.strictEqual(await res.text(), 'This is a test file.');
    });

    test('should handle redirects', async () => {
        const res = await fetch(`${host}/redirect`, { redirect: 'manual' });
        assert.strictEqual(res.status, 301);
        assert.strictEqual(res.headers.get('Location'), '/target');
    });

    test('should return 500 when file is not found', async () => {
        const res = await fetch(`${host}/file-404`);
        assert.strictEqual(res.status, 500);
    });

    test('should fallback to extension-based mime type if unknown', async () => {
        const res = await fetch(`${host}/file-fallback`);
        assert.strictEqual(res.headers.get('Content-Type'), 'text/xml');
    });

    test('should not allow path traversal', async () => {
        const res = await fetch(`${host}/static/../../package.json`);
        assert.strictEqual(res.status, 404);
    });
});