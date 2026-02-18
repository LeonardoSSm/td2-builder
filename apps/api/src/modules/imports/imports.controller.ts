import { Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImportsService } from "./imports.service";
import { RequirePermissions } from "../access-control/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("imports")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.import.run")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post("xlsx")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1,
      },
      fileFilter: (_req, file, cb) => {
        const isXlsxMime = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const isXlsxName = /\.xlsx$/i.test(file.originalname ?? "");
        cb(null, isXlsxMime || isXlsxName);
      },
    }),
  )
  async importXlsx(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: any) {
    if (!file) {
      return { ok: false, error: "Invalid or missing XLSX file. Use multipart field name 'file'." };
    }
    const requestedBy = String(req?.user?.userId ?? "").trim() || null;
    return this.imports.enqueueXlsx(file, requestedBy);
  }

  @Post("xlsx/queue")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1,
      },
      fileFilter: (_req, file, cb) => {
        const isXlsxMime = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const isXlsxName = /\.xlsx$/i.test(file.originalname ?? "");
        cb(null, isXlsxMime || isXlsxName);
      },
    }),
  )
  async enqueueXlsx(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: any) {
    if (!file) {
      return { ok: false, error: "Invalid or missing XLSX file. Use multipart field name 'file'." };
    }
    const requestedBy = String(req?.user?.userId ?? "").trim() || null;
    return this.imports.enqueueXlsx(file, requestedBy);
  }

  @Get("jobs")
  listJobs(@Query("limit") limit?: string) {
    const n = Number(String(limit ?? "").trim());
    const safe = Number.isFinite(n) ? n : undefined;
    return this.imports.listJobs(safe);
  }

  @Get("jobs/:id")
  getJob(@Param("id") id: string) {
    return this.imports.getJob(id);
  }

  @Post("jobs/:id/retry")
  retryJob(@Param("id") id: string) {
    return this.imports.retryJob(id);
  }
}
