import { Injectable, BadRequestException } from '@nestjs/common';
import { moderateContent } from './agent';
import { extname } from 'path';


type TextPayload = { type: 'text'; text: string };
type ImagePayload = { type: 'image'; buffer: Buffer; filename: string; mimetype?: string };
type ModerationPayload = TextPayload | ImagePayload;

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async moderateSubmission(file: any | undefined, body: any): Promise<any> {
    const type = (body?.type as string | undefined)?.toLowerCase();

    if (type === 'text') {
      const text = (body?.text as string | undefined) ?? '';
      if (!text.trim()) {
        throw new BadRequestException('Missing text for text submission');
      }
      const payload: TextPayload = { type: 'text', text };
      return await moderateContent(payload);
    }

    if (type === 'image') {
      if (!file) {
        throw new BadRequestException('Missing file for image submission');
      }
      const buffer: Buffer | undefined = file?.buffer;
      if (!buffer) {
        throw new BadRequestException('Uploaded file has no buffer');
      }
      const filename = file.originalname;
      const mimetype = file.mimetype;

      const payload: ImagePayload = { type: 'image', buffer, filename, mimetype };
      return await moderateContent(payload);
    }

    throw new BadRequestException('Unsupported or missing payload.');
  }
}
