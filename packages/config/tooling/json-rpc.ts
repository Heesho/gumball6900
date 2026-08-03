export interface EvmJsonRpcClient {
  request<T>(method: string, params?: readonly unknown[]): Promise<T>;
}

interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

interface JsonRpcResponse<T> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: T;
  readonly error?: JsonRpcErrorBody;
}

export interface HttpJsonRpcClientOptions {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMilliseconds?: number;
}

export class HttpJsonRpcClient implements EvmJsonRpcClient {
  readonly #fetchImplementation: typeof fetch;
  readonly #timeoutMilliseconds: number;
  readonly #url: URL;
  #nextRequestId = 1;

  constructor(url: string, options: HttpJsonRpcClientOptions = {}) {
    this.#url = new URL(url);
    if (this.#url.protocol !== 'https:' && this.#url.hostname !== '127.0.0.1' && this.#url.hostname !== 'localhost') {
      throw new Error('JSON-RPC URL must use HTTPS unless it targets localhost');
    }
    this.#fetchImplementation = options.fetchImplementation ?? fetch;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? 20_000;
  }

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    if (!/^[a-z][a-zA-Z0-9_]+$/.test(method)) {
      throw new Error(`Invalid JSON-RPC method: ${method}`);
    }

    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMilliseconds);

    try {
      const response = await this.#fetchImplementation(this.#url, {
        body: JSON.stringify({ id, jsonrpc: '2.0', method, params }),
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`JSON-RPC HTTP request failed with status ${response.status}`);
      }

      const body = (await response.json()) as JsonRpcResponse<T>;
      if (body.jsonrpc !== '2.0' || body.id !== id) {
        throw new Error('JSON-RPC response envelope does not match the request');
      }
      if (body.error !== undefined) {
        throw new Error(`JSON-RPC ${method} failed (${body.error.code}): ${body.error.message}`);
      }
      if (!Object.hasOwn(body, 'result')) {
        throw new Error(`JSON-RPC ${method} returned no result`);
      }
      return body.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
