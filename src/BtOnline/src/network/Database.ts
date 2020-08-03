export class Database {
  game_flags: Buffer = Buffer.alloc(0xb0);
  global_flags: Buffer = Buffer.alloc(0x10);

  // Jiggywiggy challenge for unlocking levels.
  jiggy_wiggy_challenge: number = 0;

  // Health Upgrades
  health_upgrade_level: number = 0;

  // Jinjos
  jinjo: Buffer = Buffer.alloc(0x2d);
}
  
export class DatabaseClient extends Database {
  ft_jinjo_sync: boolean = true;
}
export class DatabaseServer extends Database {
  need_jinjos: boolean = true;
}