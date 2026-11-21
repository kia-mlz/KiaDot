import { ForbiddenException } from '@nestjs/common';
import { MaterialCatalogService } from './material.service';

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
