import { parseHeaders, type ServerResponseHeaders } from './response.js';

export class StatusError extends Error {
    headers: Headers;

    constructor(
        public status: number,
        message: string,
        headers: ServerResponseHeaders = new Headers()
    ) {
        super(message);
        this.headers = parseHeaders(headers);
    }
}