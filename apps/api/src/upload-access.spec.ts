import type { NextFunction, Request, Response } from 'express';
import { blockPrivateUploads, privateUploadMessage } from './upload-access';

function respond(url: string): { status: number; body: unknown; continued: boolean } {
  let status = 200;
  let body: unknown;
  let continued = false;
  const req = { originalUrl: url, url } as Request;
  const res = {
    status(code: number) {
      status = code;
      return {
        json(payload: unknown) {
          body = payload;
        },
      };
    },
  } as Response;
  const next: NextFunction = () => {
    continued = true;
  };
  blockPrivateUploads(req, res, next);
  return { status, body, continued };
}

describe('private upload paths', () => {
  it('refuses motion frames, stage HTML, and the finished mp4 on the static uploads URL', () => {
    const frame = respond('/api/uploads/motion-private/clproject/frame-0-0001.png');
    expect(frame).toEqual({
      status: 401,
      body: { message: 'Use the authenticated motion media URL' },
      continued: false,
    });
    expect(privateUploadMessage('/api/uploads/motion-private/clproject/stage-0.html')).toBe(
      'Use the authenticated motion media URL',
    );
    expect(privateUploadMessage('/api/uploads/motion-private/clproject/video-v1.mp4')).toBe(
      'Use the authenticated motion media URL',
    );
  });

  it('refuses a path that reaches motion-private through .. or an encoded slash', () => {
    expect(privateUploadMessage('/api/uploads/avatars/../motion-private/clproject/frame-0-0001.png')).toBe(
      'Use the authenticated motion media URL',
    );
    expect(
      privateUploadMessage('/api/uploads/avatars/..%2Fmotion-private/clproject/frame-0-0001.png'),
    ).toBe('Use the authenticated motion media URL');
    expect(respond('/api/uploads/foo/../motion-private/clproject/narration.mp3').continued).toBe(false);
  });

  it('keeps the other private upload directories refused and lets avatars through', () => {
    expect(privateUploadMessage('/api/uploads/lessons/lesson/clip.mp4')).toBe(
      'Use authenticated media URLs for lesson videos',
    );
    expect(privateUploadMessage('/api/uploads/tickets/t/file.pdf')).toBe(
      'Use authenticated ticket attachment URLs',
    );
    expect(privateUploadMessage('/api/uploads/material/pack.zip')).toBe(
      'Use an authenticated download token for material files',
    );
    expect(respond('/api/uploads/avatars/user.png')).toEqual({
      status: 200,
      body: undefined,
      continued: true,
    });
  });

  it('refuses a mount-relative motion path when Express has stripped the prefix', () => {
    const req = { url: '/motion-private/clproject/frame-0-0001.png' } as Request;
    let status = 200;
    let continued = false;
    const res = {
      status(code: number) {
        status = code;
        return { json() {} };
      },
    } as Response;
    blockPrivateUploads(req, res, () => {
      continued = true;
    });
    expect(status).toBe(401);
    expect(continued).toBe(false);
  });

  it('refuses a broken percent-encoding instead of handing it to the static handler', () => {
    expect(respond('/api/uploads/motion-private/%').continued).toBe(false);
    expect(respond('/api/uploads/motion-private/%').status).toBe(401);
  });
});
