/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Cell } from "./types";
import { isCell, isCellArray } from "./utils";

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	CANVAS: DurableObjectNamespace
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		return new Response("Hello World!");
	},
};

// TODO: Store 20x20 canvas in DO, but let's store in memory primarily
export class Canvas {
	state: DurableObjectState;
	cells: Cell[] = []
	websockets: WebSocket[] = [];
	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.state.blockConcurrencyWhile(async () => {
			if (this.cells.length === 0) {
				// Check if there's any persisted data
				const storedCells = await this.state.storage.get<Cell[]>('cells')
				this.cells = storedCells || []
			}
		})
	}

	async fetch(request: Request): Promise<Response> {
		this.updateAlarm()
		const url = new URL(request.url);
		if (url.pathname.startsWith('/api/websocket')) {
			return this.handleWebsocket(request)
		}
		return new Response('hello from do!')
	}

	async updateAlarm() {
		// Save the current data every 10 seconds
		let currentAlarm = await this.state.storage.getAlarm();
		if (!currentAlarm) {
			this.state.storage.setAlarm(Date.now() + 10 * 1000);
		}
	}

	async alarm() {
		// Save the current data
		this.state.storage.put('cells', this.cells)
	}

	async handleWebsocket(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 })
		}
		const [client, server] = Object.values(new WebSocketPair())
		// Add listeners

		server.addEventListener('message', (msg) => {
			try {
				this.updateAlarm()
				const data = JSON.parse(msg.data.toString())
				if (isCellArray(data)) {
					this.cells = data
				} else if (isCell(data)) {
					const existing = this.cells.filter(cell => cell.x === data.x && cell.y === data.y)
					if (existing.length > 0) {
						existing[0].color = data.color
					} else {
						this.cells.push(data)
					}
				}
				// Send to all clients
				for (const client of this.websockets) {
					client.send(JSON.stringify(this.cells))
				}
			} catch {
				// Ignore invalid data for now
			}
		})

		server.accept()

		this.websockets.push(server)

		// Push existing data
		server.send(JSON.stringify(this.cells))

		return new Response(null, {
			status: 101,
			webSocket: client,
		})
	}
}
