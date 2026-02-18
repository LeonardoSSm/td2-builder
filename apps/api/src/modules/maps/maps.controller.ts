import { Controller, Get, Param, Query } from "@nestjs/common";
import { MapsService } from "./maps.service";

@Controller("maps")
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Get()
  list() {
    return this.maps.listMaps();
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.maps.getMapBySlug(slug);
  }

  @Get(":slug/areas")
  areas(@Param("slug") slug: string, @Query("q") q?: string) {
    // q is handled in the frontend for now; keep the API simple.
    void q;
    return this.maps.listAreasBySlug(slug);
  }
}

