import type { RouterOptions } from '../src/router.js';
import { after, before, describe } from 'node:test';
import { Server } from '../src/server.js';

export function testServer(
    name: string,
    setupServer: (server: Server) => void,
    runTests: (host: string) => void,
    serverOptions?: RouterOptions
) {
    describe(name, async () => {
        const server = new Server(serverOptions);
        setupServer(server);
        await server.listen(0);
        after(() => server.close());
        runTests(`http://localhost:${server!.getPort()}`);
    });
}