export type ItemType = "gear" | "weapon";
export type GearFormMode = "quick" | "advanced";

export type BrandOption = {
  id: string;
  name: string;
  bonus1?: string | null;
  bonus2?: string | null;
  bonus3?: string | null;
};

export type GearSetOption = {
  id: string;
  name: string;
  bonus2?: string | null;
  bonus3?: string | null;
  bonus4?: string | null;
};

export const SLOT_OPTIONS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"];
export const RARITY_OPTIONS = ["HighEnd", "Named", "Exotic", "GearSet"];
export const CORE_COLOR_OPTIONS = ["", "Red", "Blue", "Yellow"];
export const ATTRIBUTE_CATEGORY_OPTIONS = ["", "Offensive", "Defensive", "Utility"];
export const TALENT_TYPE_OPTIONS = ["", "Weapon", "Chest", "Backpack", "GearSet"];
export const WEAPON_CLASS_OPTIONS = ["AR", "SMG", "LMG", "Rifle", "MMR", "Shotgun", "Pistol"];
export const WEAPON_CORE_ATTRIBUTE_OPTIONS = [
  "",
  "Weapon Damage",
  "Damage to Armor",
  "Damage to Targets Out of Cover",
  "Critical Hit Chance",
  "Critical Hit Damage",
  "Headshot Damage",
];

// TD2 gear has 3 possible core attributes in the UI.
export const GEAR_CORE_ATTRIBUTE_OPTIONS = ["", "Weapon Damage", "Armor", "Skill Tier"] as const;

// Curated list for quick admin entry (not exhaustive; can be expanded later).
export const GEAR_MINOR_ATTRIBUTE_OPTIONS = [
  "",
  "Critical Hit Chance",
  "Critical Hit Damage",
  "Headshot Damage",
  "Weapon Handling",
  "Armor Regen",
  "Health",
  "Explosive Resistance",
  "Hazard Protection",
  "Skill Haste",
  "Skill Damage",
  "Skill Repair",
  "Status Effects",
  "Skill Duration",
  "Repair Skills",
  "Incoming Repairs",
  "Ammo Capacity",
] as const;

export const GEAR_MOD_SLOT_OPTIONS = ["0", "1", "2"] as const;
