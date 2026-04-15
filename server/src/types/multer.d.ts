declare module "multer" {
  import { Request, RequestHandler } from "express";

  namespace multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
      destination: string;
      filename: string;
      path: string;
    }

    type FileFilterCallback = (
      error: Error | null,
      acceptFile: boolean,
    ) => void;

    interface StorageEngine {
      _handleFile(
        req: Request,
        file: File,
        callback: (error?: Error | null, info?: Partial<File>) => void,
      ): void;
      _removeFile(
        req: Request,
        file: File,
        callback: (error: Error | null) => void,
      ): void;
    }

    interface Options {
      storage?: StorageEngine;
      dest?: string;
      limits?: {
        fileSize?: number;
        files?: number;
        fields?: number;
        fieldSize?: number;
        fieldNameSize?: number;
        parts?: number;
        headerPairs?: number;
      };
      fileFilter?: (
        req: Request,
        file: File,
        callback: FileFilterCallback,
      ) => void;
    }

    function memoryStorage(): StorageEngine;
    function diskStorage(options: {
      destination?:
        | string
        | ((
            req: Request,
            file: File,
            cb: (error: Error | null, destination: string) => void,
          ) => void);
      filename?: (
        req: Request,
        file: File,
        cb: (error: Error | null, filename: string) => void,
      ) => void;
    }): StorageEngine;
  }

  function multer(options?: multer.Options): {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    fields(
      fields: Array<{ name: string; maxCount?: number }>,
    ): RequestHandler;
    none(): RequestHandler;
    any(): RequestHandler;
  };

  export = multer;
}

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
      destination: string;
      filename: string;
      path: string;
    }
  }
  interface Request {
    file?: Express.Multer.File;
  }
}
