export class FileData {
	flagsGame: Buffer = Buffer.alloc(0xb0);
	flagsGlobal: Buffer = Buffer.alloc(0x10);
	flagsJinjos: Buffer = Buffer.alloc(0x2d);
	curJiggyChallenge: number = 0;
	healthUpgrade: number = 0;
	jinjoRandomizer: number = 0;
	jinjosSet: boolean = false;
}

export class Database {
	file: FileData[] = Array<FileData>(3);
	constructor() {
		this.file[0] = new FileData();
		this.file[1] = new FileData();
		this.file[2] = new FileData();
		this.file[3] = new FileData();
	}
}

export class DatabaseClient extends Database {
	team: number = 3;
	curScn: number = 0;
}

export class DatabaseServer extends Database {
	// Puppets
	playerInstances: any = {};
	players: any = {};
}