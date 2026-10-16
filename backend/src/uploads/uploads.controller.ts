import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { MESSAGES } from '../common/messages';

/** Local disk storage (dev/MVP). Swap this for R2/S3 in production — the
 * endpoint contract (multipart `file` → `{ url }`) stays the same. */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth('bearer')
@Controller('uploads')
export class UploadsController {
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.png';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(MESSAGES.UPLOADS.INVALID_TYPE), false);
        }
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(MESSAGES.UPLOADS.NO_FILE);
    }
    return { url: `/uploads/${file.filename}` };
  }
}
