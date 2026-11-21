import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { inspectMaterialUpload, MaterialCatalogService } from './material.service';

describe('inspectMaterialUpload', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it('keeps the client filename out of the stored name', () => {
    const accepted = inspectMaterialUpload({
      buffer: png,
      mimetype: 'image/png',
      size: png.length,
    });
    expect(accepted.filename).toBe('material.png');
    expect(accepted.mime).toBe('image/png');
    expect(accepted.bytes.equals(png)).toBe(true);
  });

  it('rejects a MIME that does not match the leading bytes', () => {
    expect(() =>
      inspectMaterialUpload({ buffer: png, mimetype: 'application/pdf', size: png.length }),
    ).toThrow(BadRequestException);
  });

  it('rejects a type that is not on the allowlist', () => {
    expect(() =>
      inspectMaterialUpload({ buffer: Buffer.from('<html></html>'), mimetype: 'text/html', size: 13 }),
    ).toThrow(BadRequestException);
  });
});

describe('MaterialCatalogService private files', () => {
  it('denies a download token when the file was not purchased', async () => {
    const service = new MaterialCatalogService({
      departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      materialFile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'file-1',
          resource: { id: 'res-1', authorId: 'author', access: 'paid', published: true },
        }),
      },
      departmentInvoice: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);
    await expect(service.createDownload('stranger', 'file-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
