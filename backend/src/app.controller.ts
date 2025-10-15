import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('submit')
  @UseInterceptors(FileInterceptor('file'))
  submit(
    @UploadedFile() file: any | undefined,
    @Body() body: any,
  ) {
    const type = (body?.type as string | undefined)?.toLowerCase();

    if (type === 'text') {
      const text = (body?.text as string | undefined) ?? '';
      if (!text.trim()) {
        throw new BadRequestException('Missing text for text submission');
      }
      console.log('[submit] text:', text);
      return { ok: true, received: 'text' };
    }

    if (type === 'image') {
      if (!file) {
        throw new BadRequestException('Missing file for image submission');
      }
      const extension = extname((file?.originalname as string) || '').replace(/^\./, '');
      console.log('[submit] image extension:', extension);
      return { ok: true, received: 'image', extension };
    }

    throw new BadRequestException('Unsupported or missing payload.');
  }

}
