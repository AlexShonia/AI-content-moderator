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
import { moderateContent } from './agent';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('submit')
  @UseInterceptors(FileInterceptor('file'))
  async submit(
    @UploadedFile() file: any | undefined,
    @Body() body: any,
  ) {
    const type = (body?.type as string | undefined)?.toLowerCase();

    if (type === 'text') {
      const text = (body?.text as string | undefined) ?? '';
      if (!text.trim()) {
        throw new BadRequestException('Missing text for text submission');
      }

      return await moderateContent({ type: 'text', text })
    }

    if (type === 'image') {
      if (!file) {
        throw new BadRequestException('Missing file for image submission');
      }
      const extension = extname((file?.originalname as string) || '').replace(/^\./, '');

      const buffer: Buffer | undefined = (file?.buffer as Buffer | undefined);
      if (!buffer) {
        throw new BadRequestException('Uploaded file has no buffer');
      }
      return await moderateContent({ type: 'image', buffer, filename: file.originalname, mimetype: file.mimetype });

    }

    throw new BadRequestException('Unsupported or missing payload.');
  }

}
