import assert from 'node:assert';
import { describe, test } from 'node:test';
import { StatusError } from '../src/error.js';
import { ServerResponse } from '../src/response.js';
import { testServer } from './utils.js';

describe('Error Handling', () => {
    testServer('Standard Errors', server => {
        server.get('/status-error', () => {
            throw new StatusError(418, 'I\'m a teapot');
        });

        server.get('/default-error', () => {
            throw new Error('Something went wrong');
        });
    }, host => {
        test('should handle StatusError correctly', async () => {
            const res = await fetch(`${host}/status-error`);
            assert.strictEqual(res.status, 418);
            const text = await res.text();
            assert.ok(text.includes('<h1>Error 418</h1>'));
            assert.ok(text.includes('<p>I\'m a teapot</p>'));
        });

        test('should handle generic Errors as 500', async () => {
            const res = await fetch(`${host}/default-error`);
            assert.strictEqual(res.status, 500);
            const text = await res.text();
            assert.ok(text.includes('<h1>Error 500</h1>'));
            assert.ok(text.includes('<p>Internal Server Error</p>'));
        });
    });

    testServer('Custom Handler', server => {
        server.get('/error', () => { throw new Error('Custom Error'); });
    }, host => {
        test('should use custom error handler', async () => {
            const res = await fetch(`${host}/error`);
            assert.strictEqual(res.status, 500);
            assert.deepStrictEqual(await res.json(), { error: 'Custom Error' });
        });
    }, {
        errorHandler: error => {
            return ServerResponse.json({ error: (error as Error).message }, { status: 500 });
        }
    });
});