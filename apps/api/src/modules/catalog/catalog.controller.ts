import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CatalogGearQueryDto, CatalogTalentQueryDto, CatalogWeaponQueryDto } from "./dto/catalog-query.dto";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("brands")
  brands() {
    return this.catalog.listBrands();
  }

  @Get("gear-sets")
  gearSets() {
    return this.catalog.listGearSets();
  }

  @Get("talents")
  talents(@Query() q: CatalogTalentQueryDto) {
    const safeTake = q.take ? Math.max(1, Math.min(200, Math.trunc(q.take))) : undefined;
    return this.catalog.listTalents(q.type, q.q, safeTake);
  }

  @Get("gear-items")
  gearItems(@Query() q: CatalogGearQueryDto) {
    return this.catalog.listGearItems(q);
  }

  @Get("gear-items/:id")
  async gearItem(@Param("id") id: string) {
    const item = await this.catalog.getGearItem(id);
    if (!item) throw new NotFoundException("Gear item not found");
    return item;
  }

  @Get("weapons")
  weapons(@Query() q: CatalogWeaponQueryDto) {
    return this.catalog.listWeapons(q);
  }

  @Get("weapons/:id")
  async weapon(@Param("id") id: string) {
    const item = await this.catalog.getWeapon(id);
    if (!item) throw new NotFoundException("Weapon not found");
    return item;
  }
}
