import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((value): value is string => Boolean(value));

interface CdpResult {
  data?: string;
  result?: { value?: unknown };
}

interface DevtoolsSocket {
  close(): void;
  send(data: string): void;
  addEventListener(
    type: 'open' | 'message' | 'error',
    listener: (event: { data?: unknown }) => void,
    options?: { once?: boolean },
  ): void;
  removeEventListener(type: 'message', listener: (event: { data?: unknown }) => void): void;
}

function openSocket(url: string): DevtoolsSocket {
  const Ctor = (globalThis as { WebSocket?: new (address: string) => DevtoolsSocket }).WebSocket;
  if (!Ctor) throw new Error('This Node runtime has no WebSocket client for Chrome.');
  return new Ctor(url);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function findChrome(): string {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('Chrome is not installed, so motion frames cannot be drawn. See docs/MOTION_STUDIO.md.');
  }
  return found;
}

async function pageSocket(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Chrome DevTools returned ${response.status}`);
  const pages = (await response.json()) as { type?: string; webSocketDebuggerUrl?: string }[];
  const page = pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome has no page target');
  return page.webSocketDebuggerUrl;
}

export class ChromeFrames {
  private constructor(
    private readonly child: ChildProcess,
    private readonly socket: DevtoolsSocket,
    private readonly userDir: string,
    private nextId = 0,
  ) {}

  static async launch(signal: AbortSignal): Promise<ChromeFrames> {
    if (signal.aborted) throw new Error('MOTION_CANCELLED');
    const binary = findChrome();
    const port = await freePort();
    const userDir = mkdtempSync(join(tmpdir(), 'kia-motion-chrome-'));
    const child = spawn(
      binary,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--allow-file-access-from-files',
        '--font-render-hinting=none',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDir}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
    let debuggerUrl: string | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (signal.aborted || child.exitCode != null) break;
      try {
        debuggerUrl = await pageSocket(port);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!debuggerUrl) {
      if (!child.killed) child.kill('SIGKILL');
      rmSync(userDir, { recursive: true, force: true });
      throw new Error('Chrome did not open a DevTools port. See docs/MOTION_STUDIO.md.');
    }
    const socket = openSocket(debuggerUrl);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Chrome DevTools socket timed out')), 8000);
        socket.addEventListener(
          'open',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        socket.addEventListener(
          'error',
          () => {
            clearTimeout(timer);
            reject(new Error('Chrome DevTools socket failed'));
          },
          { once: true },
        );
      });
    } catch (error) {
      if (!child.killed) child.kill('SIGKILL');
      rmSync(userDir, { recursive: true, force: true });
      throw error;
    }
    return new ChromeFrames(child, socket, userDir);
  }

  private send(method: string, params?: Record<string, unknown>): Promise<CdpResult> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.removeEventListener('message', onMessage);
        reject(new Error(`Chrome timed out during ${method}`));
      }, 15000);
      const onMessage = (event: { data?: unknown }) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: CdpResult; error?: { message?: string } };
        if (message.id !== id) return;
        clearTimeout(timer);
        this.socket.removeEventListener('message', onMessage);
        if (message.error) {
          reject(new Error(message.error.message || method));
          return;
        }
        resolve(message.result ?? {});
      };
      this.socket.addEventListener('message', onMessage);
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  private waitFor(method: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.removeEventListener('message', onMessage);
        reject(new Error(`Chrome timed out waiting for ${method}`));
      }, 15000);
      const onMessage = (event: { data?: unknown }) => {
        const message = JSON.parse(String(event.data)) as { method?: string };
        if (message.method !== method) return;
        clearTimeout(timer);
        this.socket.removeEventListener('message', onMessage);
        resolve();
      };
      this.socket.addEventListener('message', onMessage);
    });
  }

  async show(filePath: string, width: number, height: number): Promise<void> {
    await this.send('Page.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const loaded = this.waitFor('Page.loadEventFired');
    await this.send('Page.navigate', { url: `file://${filePath}` });
    await loaded;
    await this.send('Runtime.evaluate', {
      expression: 'document.fonts ? document.fonts.ready : true',
      awaitPromise: true,
    });
  }

  async seek(progress: number): Promise<void> {
    const value = Math.max(0, Math.min(1, progress));
    await this.send('Runtime.evaluate', {
      expression: `document.documentElement.style.setProperty('--t', ${JSON.stringify(value.toFixed(4))})`,
    });
  }

  async png(): Promise<Buffer> {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    if (!shot.data) throw new Error('Chrome returned an empty frame');
    return Buffer.from(shot.data, 'base64');
  }

  async close(): Promise<void> {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
    if (this.child.exitCode == null && !this.child.killed) {
      this.child.kill('SIGKILL');
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      rmSync(this.userDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* the profile dir is scratch; a leftover must not fail the render */
    }
  }
}
