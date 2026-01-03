import type { Buffer } from 'node:buffer';
import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getMimeType } from './mime.js';

export type ServerResponseHeaders = Headers | [string, string][] | Record<string, string | string[]>;

export function parseHeaders(headers: ServerResponseHeaders): Headers {
    if (headers instanceof Headers) return headers;
    else if (Array.isArray(headers)) return new Headers(headers);
    else return new Headers(Object.entries(headers).flatMap(([key, values]) => [values].flat().map<[string, string]>(value => [key, value])));
}

export interface ServerResponseOptions {
    status?: number;
    headers?: ServerResponseHeaders;
}

export type EventStreamItem<T> = {
    id?: string;
    event?: string;
    data: T;
    retry?: number;
} | {
    retry: number;
};
export type EventStream<T> = ReadableStream<EventStreamItem<T>>;

export class ServerResponse {
    status: number;
    headers: Headers;

    constructor(
        readonly body: ReadableStream<string | Buffer | Uint8Array>,
        { status = 200, headers = new Headers() }: ServerResponseOptions = {}
    ) {
        this.status = status;
        this.headers = parseHeaders(headers);
    }

    protected setOptionalHeader(key: string, value: string) {
        if (!this.headers.has(key)) this.headers.set(key, value);
    }

    static empty(options: ServerResponseOptions = {}) {
        return new ServerResponse(new ReadableStream({
            start(controller) {
                controller.close();
            }
        }), options);
    }

    static redirect(url: string, options: ServerResponseOptions = {}) {
        options.status ??= 301;
        const response = ServerResponse.empty(options);
        response.setOptionalHeader('Location', url);
        return response;
    }

    static text(body: string, options: ServerResponseOptions = {}) {
        const buffer = new TextEncoder().encode(body);
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(buffer);
                controller.close();
            }
        });
        const response = new ServerResponse(stream, options);
        response.setOptionalHeader('Content-Type', 'text/plain');
        response.setOptionalHeader('Content-Length', String(buffer.byteLength));
        return response;
    }

    static json(body: any, options: ServerResponseOptions = {}) {
        const buffer = new TextEncoder().encode(JSON.stringify(body));
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(buffer);
                controller.close();
            }
        });
        const response = new ServerResponse(stream, options);
        response.setOptionalHeader('Content-Type', 'application/json');
        response.setOptionalHeader('Content-Length', String(buffer.byteLength));
        return response;
    }

    static bytes(body: ArrayBufferLike, options: ServerResponseOptions = {}) {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(body));
                controller.close();
            }
        });
        const response = new ServerResponse(stream, options);
        response.setOptionalHeader('Content-Type', 'application/octet-stream');
        response.setOptionalHeader('Content-Length', String(body.byteLength));
        return response;
    }

    static blob(body: Blob, options: ServerResponseOptions = {}) {
        const response = new ServerResponse(body.stream(), options);
        response.setOptionalHeader('Content-Type', body.type || 'application/octet-stream');
        response.setOptionalHeader('Content-Length', String(body.size));
        return response;
    }

    static file(file: string, options: ServerResponseOptions = {}) {
        const { size } = statSync(file);
        const response = new ServerResponse(Readable.toWeb(createReadStream(file)), options);
        response.setOptionalHeader('Content-Type', getMimeType(file));
        response.setOptionalHeader('Content-Length', String(size));
        return response;
    }

    static eventsText(body: EventStream<string>, options: ServerResponseOptions = {}) {
        const stream = body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                let result = '';
                if ('data' in chunk) {
                    if (chunk.id) result += `id: ${chunk.id.replace(/\r\n|\r|\n/g, ' ')}\n`;
                    if (chunk.event) result += `event: ${chunk.event.replace(/\r\n|\r|\n/g, ' ')}\n`;
                    for (const line of chunk.data.split(/\r\n|\r|\n/)) {
                        result += `data: ${line}\n`;
                    }
                }
                if (typeof chunk.retry === 'number') result += `retry: ${chunk.retry}\n`;
                controller.enqueue(result + '\n');
            }
        }));
        const response = new ServerResponse(stream, options);
        if (!response.headers.has('Content-Type')) response.headers.set('Content-Type', 'text/event-stream');
        return response;
    }

    static eventsJSON(body: EventStream<any>, options: ServerResponseOptions = {}) {
        const stream = body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                if ('data' in chunk) chunk.data = JSON.stringify(chunk.data);
                controller.enqueue(chunk);
            }
        }));
        return ServerResponse.eventsText(stream, options);
    }
}