import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { RequirePermissions } from "../access-control/decorators/require-permissions.decorator";
import { MapsService } from "./maps.service";
import { CreateFarmAreaDto, UpdateFarmAreaDto } from "./dto/area.dto";
import { CreateFarmMapDto, UpdateFarmMapDto } from "./dto/map.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync } from "fs";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("admin.maps.manage")
@Controller("admin/maps")
export class AdminMapsController {
  constructor(private readonly maps: MapsService) {}

  @Post(":id/image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          try {
            // Store under apps/api/data/maps (stable regardless of process.cwd()).
            // This must match the static assets dir mounted in `apps/api/src/main.ts`.
            const dir = join(__dirname, "..", "..", "..", "data", "maps");
            mkdirSync(dir, { recursive: true });
            cb(null, dir);
          } catch (e) {
            cb(e as any, join(__dirname, "..", "..", "..", "data", "maps"));
          }
        },
        filename: (req, file, cb) => {
          const safeExt = extname(file.originalname || "").toLowerCase();
          const ext = [".png", ".jpg", ".jpeg", ".webp", ".avif"].includes(safeExt) ? safeExt : ".png";
          const id = String((req as any)?.params?.id ?? "map").replace(/[^a-zA-Z0-9_-]/g, "");
          cb(null, `${id}_${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const t = String(file.mimetype || "").toLowerCase();
        if (t === "image/png" || t === "image/jpeg" || t === "image/webp" || t === "image/avif") cb(null, true);
        else cb(new BadRequestException("Unsupported file type") as any, false);
      },
    }),
  )
  async uploadMapImage(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("file is required");
    return this.maps.setMapImage(id, file.filename);
  }

  @Get()
  listMaps() {
    return this.maps.listMaps();
  }

  @Post()
  createMap(@Body() dto: CreateFarmMapDto) {
    return this.maps.createMap(dto);
  }

  @Put(":id")
  updateMap(@Param("id") id: string, @Body() dto: UpdateFarmMapDto) {
    return this.maps.updateMap(id, dto);
  }

  @Delete(":id")
  deleteMap(@Param("id") id: string) {
    return this.maps.deleteMap(id);
  }

  @Get(":slug/areas")
  listAreas(@Param("slug") slug: string) {
    return this.maps.listAreasBySlug(slug);
  }

  @Post(":mapId/areas")
  createArea(@Param("mapId") mapId: string, @Body() dto: CreateFarmAreaDto) {
    return this.maps.createArea(mapId, dto);
  }

  @Put("areas/:id")
  updateArea(@Param("id") id: string, @Body() dto: UpdateFarmAreaDto) {
    return this.maps.updateArea(id, dto);
  }

  @Delete("areas/:id")
  deleteArea(@Param("id") id: string) {
    return this.maps.deleteArea(id);
  }
}
