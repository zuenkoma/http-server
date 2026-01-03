import assert from 'node:assert';
import { test } from 'node:test';
import { ServerResponse } from '../src/response.js';
import { testServer } from './utils.js';

testServer('SSE Responses', server => {
    server.get('/sse', () => ServerResponse.eventsText(new ReadableStream({
        start(controller) {
            controller.enqueue({ data: 'message 1' });
            controller.enqueue({ data: 'message 2', id: '1', event: 'update' });
            controller.close();
        }
    })));

    server.get('/sse-json', () => ServerResponse.eventsJSON(new ReadableStream({
        start(controller) {
            controller.enqueue({ data: { msg: 'json 1' } });
            controller.close();
        }
    })));

    server.get('/sse-retry', () => ServerResponse.eventsText(new ReadableStream({
        start(controller) {
            controller.enqueue({ retry: 1000 });
            controller.close();
        }
    })));

    server.get('/sse-multiline', () => ServerResponse.eventsText(new ReadableStream({
        start(controller) {
            controller.enqueue({ data: 'line1\nline2' });
            controller.close();
        }
    })));
}, host => {
    test('should handle Server-Sent Events (SSE) with text data', async () => {
        const res = await fetch(`${host}/sse`);
        assert.strictEqual(res.headers.get('Content-Type'), 'text/event-stream');
        const text = await res.text();
        assert.ok(text.includes('data: message 1'));
        assert.ok(text.includes('id: 1'));
        assert.ok(text.includes('event: update'));
        assert.ok(text.includes('data: message 2'));
    });

    test('should handle Server-Sent Events (SSE) with JSON data', async () => {
        const res = await fetch(`${host}/sse-json`);
        assert.strictEqual(res.headers.get('Content-Type'), 'text/event-stream');
        const text = await res.text();
        assert.ok(text.includes('data: {"msg":"json 1"}'));
    });

    test('should support SSE retry field', async () => {
        const res = await fetch(`${host}/sse-retry`);
        assert.strictEqual(res.headers.get('Content-Type'), 'text/event-stream');
        const text = await res.text();
        assert.ok(text.includes('retry: 1000'));
    });

    test('should handle multiline SSE data', async () => {
        const res = await fetch(`${host}/sse-multiline`);
        const text = await res.text();
        assert.ok(text.includes('data: line1\n'));
        assert.ok(text.includes('data: line2\n'));
    });
});