import { Controller, Get } from '@nestjs/common';
import { ShowcaseService } from './showcase.service';

@Controller()
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  /** Public catalog story: published departments, newest items, and real demand. */
  @Get('showcase')
  get() {
    return this.showcase.get();
  }
}
