import { createServer, type Server as HttpServer, type ServerResponse as HttpServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { StatusError } from './error.js';
import { ServerResponse } from './response.js';
import { Router, type RouterOptions, type ServerRequest } from './router.js';

export class Server extends Router {
    protected server: HttpServer;

    constructor(options: RouterOptions = {}) {
        super(options);

        this.server = createServer(async (req, res) => {
            const url = new URL('/!' + (req.url || ''), `http://localhost`);
            const request: ServerRequest<any> = {
                method: (req.method || '').toUpperCase(),
                url: {
                    path: url.pathname.slice(2),
                    params: {},
                    search: url.searchParams,
                    hash: url.hash
                },
                headers: new Headers(Object.entries(req.headersDistinct).flatMap(([key, values]) => values!.map<[string, string]>(value => [key, value]))),
                body: Readable.toWeb(req)
            };

            try {
                const response = await this.handleRequest(request);
                await this.writeBody(res, response);
            }
            catch (error: any) {
                if (!res.headersSent) {
                    let status = 500, message = 'Internal Server Error';
                    if (error instanceof StatusError) ({ status, message } = error);
                    await this.writeBody(res, ServerResponse.text(`<h1>Error ${status}</h1><p>${message}</p>`, {
                        status,
                        headers: { 'Content-Type': 'text/html' }
                    }));
                }
                res.destroy();
            }
        });
    }

    private writeHead(res: HttpServerResponse, response: ServerResponse) {
        for (const [key, value] of response.headers.entries()) {
            res.setHeader(key, value);
        }
        res.writeHead(response.status);
    }
    private async writeBody(res: HttpServerResponse, response: ServerResponse) {
        for await (const chunk of response.body) {
            if (!res.headersSent) this.writeHead(res, response);
            res.write(chunk);
        }
        if (!res.headersSent) this.writeHead(res, response);
        res.end();
    }

    listen(port: number, host = '0.0.0.0') {
        return new Promise<void>(resolve => {
            this.server.listen(port, host, resolve);
        });
    }

    getPort() {
        const address = this.server.address();
        return typeof address === 'object' && address ? address.port : null;
    }

    close() {
        return new Promise<void>((resolve, reject) => {
            this.server.close(error => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}