export type JSONValue = unknown | string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue; };
export type FormValue = Record<string, string | File | (string | File)[]>;
export type UnknownBodyValue = ReadableStream<Uint8Array>;
export type BodyValue = JSONValue | FormValue | UnknownBodyValue;

export async function parseBody(headers: Headers, body: ReadableStream<Uint8Array>) {
    switch ((headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()) {
        case 'application/json':
            return new Response(body, { headers }).json() as Promise<JSONValue>;
        case 'multipart/form-data':
        case 'application/x-www-form-urlencoded': {
            const formData = await (new Response(body, { headers }).formData());
            const response: FormValue = {};
            for (const [key, value] of formData) {
                response[key] = response[key] ? [response[key], value].flat() : value;
            }
            return response;
        }
    }
    return body;
}