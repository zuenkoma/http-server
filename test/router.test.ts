import assert from 'node:assert';
import { test } from 'node:test';
import { ServerResponse } from '../src/response.js';
import { Router } from '../src/router.js';
import { testServer } from './utils.js';

testServer('Routing & Parameters', server => {
    server.get('/users/:id', ({ url }) => ServerResponse.json({ id: url.params.id }));
    server.get('/search', ({ url }) => ServerResponse.json({ q: url.search.get('q') }));

    const apiRouter = new Router();
    apiRouter.get('/test', () => ServerResponse.text('api test'));
    server.use('/api', apiRouter);

    const nestedRouter = new Router();
    nestedRouter.get('/:subId', ({ url }) => ServerResponse.json({ subId: url.params.subId }));
    server.use('/nested', nestedRouter);

    server.get('/users/:userId/posts/:postId', ({ url }) => {
        return ServerResponse.json({ userId: url.params.userId, postId: url.params.postId });
    });

    server.get('/override', () => ServerResponse.text('original'));
    server.get('/override', () => ServerResponse.text('overridden'));

    server.route(['GET', 'POST'], '/partial-override', () => ServerResponse.text('original'));
    server.get('/partial-override', () => ServerResponse.text('new'));

    const routerA = new Router();
    const routerB = new Router();
    routerB.get('/deep', () => ServerResponse.text('deep'));
    routerA.use('/b', routerB);
    server.use('/a', routerA);

    server.get('/tasks/search', () => ServerResponse.text('search'));
    server.get('/tasks/:id', () => ServerResponse.text('id'));

    server.get('/slash', () => ServerResponse.text('no-slash'));
    server.get('/slash/', () => ServerResponse.text('with-slash'));

    server.get('/case', () => ServerResponse.text('lower'));
}, host => {
    test('should parse URL parameters', async () => {
        const res = await fetch(`${host}/users/123`);
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { id: '123' });
    });

    test('should parse query string parameters', async () => {
        const res = await fetch(`${host}/search?q=hello`);
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { q: 'hello' });
    });

    test('should handle nested routers', async () => {
        const res = await fetch(`${host}/api/test`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'api test');
    });

    test('should handle nested router with parameters', async () => {
        const res = await fetch(`${host}/nested/123`);
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { subId: '123' });
    });

    test('should handle multiple URL parameters', async () => {
        const res = await fetch(`${host}/users/1/posts/2`);
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { userId: '1', postId: '2' });
    });

    test('should allow overriding routes', async () => {
        const res = await fetch(`${host}/override`);
        assert.strictEqual(await res.text(), 'overridden');
    });

    test('should allow partial overriding of routes (different methods)', async () => {
        const resGet = await fetch(`${host}/partial-override`);
        assert.strictEqual(await resGet.text(), 'new');
        const resPost = await fetch(`${host}/partial-override`, { method: 'POST' });
        assert.strictEqual(await resPost.text(), 'original');
    });

    test('should handle deep nesting of routers', async () => {
        const res = await fetch(`${host}/a/b/deep`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'deep');
    });

    test('should respect route priority (first match wins if not overridden)', async () => {
        const resSearch = await fetch(`${host}/tasks/search`);
        assert.strictEqual(await resSearch.text(), 'search');

        const resId = await fetch(`${host}/tasks/123`);
        assert.strictEqual(await resId.text(), 'id');
    });

    test('should handle trailing slashes correctly', async () => {
        const resNoSlash = await fetch(`${host}/slash`);
        assert.strictEqual(await resNoSlash.text(), 'no-slash');

        const resWithSlash = await fetch(`${host}/slash/`);
        assert.strictEqual(await resWithSlash.text(), 'with-slash');
    });

    test('should be case sensitive by default', async () => {
        const res = await fetch(`${host}/CASE`);
        assert.strictEqual(res.status, 404);
    });
});