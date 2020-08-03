import {
	EventsClient,
	EventServerJoined,
	EventServerLeft,
	EventHandler,
	EventsServer,
} from 'modloader64_api/EventHandler';
import { IModLoaderAPI, IPlugin, IPluginServerConfig } from 'modloader64_api/IModLoaderAPI';
import {
	INetworkPlayer,
	LobbyData,
	NetworkHandler,
	ServerNetworkHandler,
} from 'modloader64_api/NetworkHandler';
import { InjectCore } from 'modloader64_api/CoreInjection';
import { Packet } from 'modloader64_api/ModLoaderDefaultImpls';
import * as API from 'BanjoTooie/API/Imports';
import * as Net from './network/Imports';

export class BtOnline implements IPlugin, IPluginServerConfig {
	ModLoader = {} as IModLoaderAPI;
	core_dependency = 'BanjoTooie';
	name = 'BtOnline';

	@InjectCore() core!: API.IBTCore;

	// Storage Variables
	cDB = new Net.DatabaseClient();

	// Puppet Handler
	// protected pMgr!: Puppet.PuppetManager;

	// Helpers
	/* None Yet! */
	
    getServerURL(): string { return "158.69.60.101:8010"; }

	get_bit(byte: number, bit: number): boolean {
		return (byte & (1 << bit)) !== 0
	}

	set_bit(byte: number, bit: number): number {
		let mask: number = (1 << bit);
		return byte |= mask;
	}

	clear_bit(byte: number, bit: number): number {
		let mask: number = (1 << bit);
		return byte &= ~mask;
	}

	toggle_bit(byte: number, bit: number): number {
		let mask: number = (1 << bit);
		return byte ^= mask;
	}

	LtoLevitate() {
		if (this.ModLoader.emulator.rdramRead16(0x081084) === 0x0020) {
			this.core.runtime.YPosition += 75.0;
		}
	}

	handle_jinjos() {
		// Initializers
		let i: number;
		let pData: Net.SyncBuffered;
		let needUpdate: boolean = false;

		for (i = 0; i < 45; i++) {
			if (this.core.runtime.get_jinjo(i) === this.cDB.jinjo[i]) continue;

			this.cDB.jinjo[i] = this.core.runtime.get_jinjo(i);
			needUpdate = true;
		}

		if (!needUpdate) return;
		pData = new Net.SyncBuffered(this.ModLoader.clientLobby, 'SyncJinjos', this.cDB.jinjo, false);
		this.ModLoader.clientSide.sendPacket(pData);
	}

	handle_game_flags(bufData: Buffer, bufStorage: Buffer) {
		// Initializers
		let index: number;
		let pData: Net.SyncBuffered;
		let pData2: Net.SyncNumbered;
		let i: number;
		let count = 0;
		let needUpdate = false;

		bufData = this.core.save.game_flags.get_all();
		bufStorage = this.cDB.game_flags;
		count = bufData.byteLength;

		// Do refills if we learn new shit.
		this.handle_moves(bufData, bufStorage);

		// Check if we are in the Jiggywiggy's Temple. If so, do not sync ANYTHING
		if (this.core.runtime.current_map !== 0x151) {
			for (i = 0; i < count; i++) {
				if (i === 17) continue; // Klungo 3 Potion chosen
				if (i === 19) continue; // Klungo 1 Potion chosen
				if (i === 50) continue; // Klungo 2 Potion chosen
				if (i === 80) continue; // MT Snake Jiggy
				if (i === 94) continue; // Klungo 1-3 defeated
				if (i === 102) continue; // Jiggywiggy's Challenge
				if (i === 106) continue; // Jinjo Randomizer
				if (i === 152) continue; // Honey B Health Upgrades
				if (i === 170) continue; // Bottles Energy Restored
				if (bufData[i] === bufStorage[i]) continue;

				bufData[i] |= bufStorage[i];
				this.core.save.game_flags.set(i, bufData[i]);
				needUpdate = true;
			}

			// Klungo 1 Potion chosen
			if (bufData[19] !== bufStorage[19]) {
				bufData[19] |= bufStorage[19];
				this.core.save.game_flags.set(19, bufData[19]);

				bufData[19] &= 0xfd;
				bufStorage[19] &= 0xfd;
				if (bufData[19] !== bufStorage[19]) {
					needUpdate = true;
				}
			}

			// Klungo 2 Potion chosen
			if (bufData[50] !== bufStorage[50]) {
				bufData[50] |= bufStorage[50];
				this.core.save.game_flags.set(50, bufData[50]);

				bufData[50] &= 0xfb;
				bufStorage[50] &= 0xfb;
				if (bufData[50] !== bufStorage[50]) {
					needUpdate = true;
				}
			}

			// Klungo 3 Potion chosen
			if (bufData[17] !== bufStorage[17]) {
				bufData[17] |= bufStorage[17];
				this.core.save.game_flags.set(17, bufData[17]);

				bufData[17] &= 0x7f;
				bufStorage[17] &= 0x7f;
				if (bufData[17] !== bufStorage[17]) {
					needUpdate = true;
				}
			}

			// MT Snake Jiggy
			if (bufData[80] !== bufStorage[80]) {
				bufData[80] |= bufStorage[80];
				this.core.save.game_flags.set(80, bufData[80]);

				bufData[80] &= 0xef;
				bufStorage[80] &= 0xef;

				if (bufData[80] !== bufStorage[80]) {
					needUpdate = true;
				}
			}

			// Klungo 1-3 Defeated
			if (bufData[94] !== bufStorage[94]) {
				bufData[94] |= bufStorage[94];
				this.core.save.game_flags.set(94, bufData[94]);

				bufData[94] &= 0xf8;
				bufStorage[94] &= 0xf8;

				if (bufData[94] !== bufStorage[94]) {
					needUpdate = true;
				}
			}

			// Jiggywiggy Challenge
			index = bufData[102] >> 4;
			if (this.cDB.jiggy_wiggy_challenge > index) {
				index = this.cDB.jiggy_wiggy_challenge;
				bufData[102] &= 0x0f;
				bufData[102] |= (index << 4);
				this.core.save.game_flags.set(102, bufData[102]);
			} else if (this.cDB.jiggy_wiggy_challenge < index) {
				this.cDB.jiggy_wiggy_challenge = index;
				pData2 = new Net.SyncNumbered(this.ModLoader.clientLobby, 'SyncJWC', this.cDB.jiggy_wiggy_challenge, false);
				this.ModLoader.clientSide.sendPacket(pData2);
			}

			// Other values part of Jiggywiggy Challenge byte
			if (bufData[102] !== bufStorage[102]) {
				bufData[102] |= bufStorage[102];
				this.core.save.game_flags.set(102, bufData[102]);

				bufData[102] &= 0xf;
				bufStorage[102] &= 0xf;

				if (bufData[102] !== bufStorage[102]) {
					needUpdate = true;
				}
			}

			// Desync Jinjo Randomizer from game flags because its handled separately
			if (bufData[106] !== bufStorage[106]) {
				bufData[106] |= bufStorage[106];
				this.core.save.game_flags.set(106, bufData[106]);

				bufData[106] &= 0x81;
				bufStorage[106] &= 0x81;

				if (bufData[106] !== bufStorage[106]) {
					needUpdate = true;
				}
			}

			// Handle health upgrades.
			this.handle_health_upgrades(bufData);

			// Honey B Health Upgrades
			if (bufData[152] !== bufStorage[152]) {
				bufData[152] |= bufStorage[152];
				this.core.save.game_flags.set(152, bufData[152]);

				bufData[152] &= 0xe3;
				bufStorage[152] &= 0xe3;

				if (bufData[152] !== bufStorage[152]) {
					needUpdate = true;
				}
			}

			// Bottles Energy Restored
			if (bufData[170] !== bufStorage[170]) {
				bufData[170] |= bufStorage[170];
				this.core.save.game_flags.set(170, bufData[170]);

				bufData[170] &= 0xfe;
				bufStorage[170] &= 0xfe;

				if (bufData[170] !== bufStorage[170]) {
					needUpdate = true;
				}
			}
		} else {
			// Inside of Jiggywiggy Temple
			this.handle_jiggywiggy_temple(bufData, bufStorage);
		}

		if (!needUpdate) return;

		// Update DB and send to server
		this.cDB.game_flags = bufData;
		pData = new Net.SyncBuffered(this.ModLoader.clientLobby, 'SyncGameFlags', bufData, false);
		this.ModLoader.clientSide.sendPacket(pData);

		// Update empty honey combs totals.
		this.handle_HC_totals(bufData);

		// Update cheato page totals.
		this.handle_cheato_totals(bufData);

		// Update glowbo totals.
		this.handle_glowbo_totals(bufData);

		// Update mega glowbo totals.
		this.handle_mega_glowbo_totals(bufData);

		// Update Witchyworld ticket totals.
		this.handle_ticket_totals(bufData);

		// Update Jolly Roger's Lagoon Doubloon totals.
		this.handle_doubloon_totals(bufData);

		// Update Cloud Cuckooland bean totals.
		this.handle_bean_totals(bufData);

		// Update Stop n Swap Egg Totals.
		this.handle_sns_eggs_totals(bufData);
	}

	handle_global_flags(bufData: Buffer, bufStorage: Buffer): void {
		// Initializers
		let pData: Net.SyncBuffered;
		let i: number;
		let val: number;
		let count = 0;
		let needUpdate = false;

		bufData = this.core.save.global_flags.get_all();
		bufStorage = this.cDB.global_flags;
		count = bufData.byteLength;
		needUpdate = false;

		for (i = 0; i < count; i++) {
			if (i > 11 && i < 14) continue; // ???
			if (bufData[i] === bufStorage[i]) continue;

			bufData[i] |= bufStorage[i];
			this.core.save.global_flags.set(i, bufData[i]);
			needUpdate = true;
		}

		// ???
		if (bufData[12] !== bufStorage[12]) {
			bufData[12] |= bufStorage[12];
			this.core.save.global_flags.set(12, bufData[12]);

			bufData[12] &= 0xbf;
			bufStorage[12] &= 0xbf;
			if (bufData[12] !== bufStorage[12])
				needUpdate = true;
		}

		// ???
		if (bufData[13] !== bufStorage[13]) {
			bufData[13] |= bufStorage[13];
			this.core.save.global_flags.set(13, bufData[13]);

			bufData[13] &= 0xef;
			bufStorage[13] &= 0xef;
			if (bufData[13] !== bufStorage[13])
				needUpdate = true;
		}

		if (needUpdate) {
			this.cDB.global_flags = bufData;
			pData = new Net.SyncBuffered(this.ModLoader.clientLobby, 'SyncGlobalFlags', bufData, false);
			this.ModLoader.clientSide.sendPacket(pData);
		}
	}

	handle_moves(bufData: Buffer, bufStorage: Buffer) {
		// Check for Restoring Health, Eggs, and Feathers.
		{
			// First Time Blue Eggs
			if (!(bufData[0] & (1 << 3)) && (bufStorage[0] & (1 << 3))) {
				this.core.player.blue_eggs += 20;
			}

			// First Time Red Feathers
			if (!(bufData[0] & (1 << 4)) && (bufStorage[0] & (1 << 4))) {
				this.core.player.red_feathers += 20;
			}

			// First Time Gold Feathers
			if (!(bufData[0] & (1 << 5)) && (bufStorage[0] & (1 << 5))) {
				this.core.player.gold_feathers += 2;
			}

			// First Time Honeycomb
			if (!(bufData[0] & (1 << 7)) && (bufStorage[0] & (1 << 7))) {
				this.core.runtime.current_health += 1;
			}

			// First Time Fire Eggs
			if (!(bufData[30] & (1 << 1)) && (bufStorage[30] & (1 << 1))) {
				this.core.player.fire_eggs += 40;
			}

			// First Time Grenade Eggs
			if (!(bufData[30] & (1 << 2)) && (bufStorage[30] & (1 << 2))) {
				this.core.player.grenade_eggs += 25;
			}

			// First Time Clockwork Kazooie Eggs
			if (!(bufData[30] & (1 << 3)) && (bufStorage[30] & (1 << 3))) {
				this.core.player.cw_eggs += 10;
			}

			// First Time Ice Eggs
			if (!(bufData[30] & (1 << 4)) && (bufStorage[30] & (1 << 4))) {
				this.core.player.ice_eggs += 50;
			}
		}
	}

	handle_health_upgrades(bufData: Buffer): void {
		let index = bufData[152] >> 2;
		index &= 0x07;
		let pData: Net.SyncNumbered;

		if (this.cDB.health_upgrade_level > index) { // We are greater than db
			index = this.cDB.health_upgrade_level;
			bufData[152] &= 0xe3;
			bufData[152] |= (index << 2);
			this.core.save.game_flags.set(152, bufData[152]);

			// Restore health.
			this.core.runtime.current_health = this.core.runtime.max_health;
			return; // We dont have changes that require passing over network.
		} else if (this.cDB.health_upgrade_level < index) {
			this.cDB.health_upgrade_level = index;
			pData = new Net.SyncNumbered(this.ModLoader.clientLobby, 'SyncHealthUpgrades', index, false);
			this.ModLoader.clientSide.sendPacket(pData);
		}
	}

	handle_jiggywiggy_temple(bufData: Buffer, bufStorage: Buffer) {
		let index = bufData[102] >> 4;
		let pData: Net.SyncBuffered;
		let pData2: Net.SyncNumbered;
		let needUpdate: boolean = false;

		// Jiggywiggy Challenge
		if (this.cDB.jiggy_wiggy_challenge > index) {
			index = this.cDB.jiggy_wiggy_challenge;
			bufData[102] &= 0x0f;
			bufData[102] |= (index << 4);
			this.core.save.game_flags.set(102, bufData[102]);
		} else if (this.cDB.jiggy_wiggy_challenge < index) {
			this.cDB.jiggy_wiggy_challenge = index;
			pData2 = new Net.SyncNumbered(this.ModLoader.clientLobby, 'SyncJWC', this.cDB.jiggy_wiggy_challenge, false);
			this.ModLoader.clientSide.sendPacket(pData2);
		}

		// First time signpost text. Yes, there are sign posts in the temple lol.
		if (bufData[2] !== bufStorage[2]) {
			bufData[2] |= bufStorage[2];
			this.core.save.game_flags.set(2, bufData[2]);
			needUpdate = true;
		}

		// Jiggywiggy Intro Cutscene. This shares the same byte as the challenge bits, so we have to desync those.
		if (bufData[102] !== bufStorage[102]) {
			bufData[102] |= bufStorage[102];
			this.core.save.game_flags.set(102, bufData[102]);

			bufData[102] &= 0xf;
			bufStorage[102] &= 0xf;

			if (bufData[102] !== bufStorage[102]) {
				needUpdate = true;
			}
		}

		// Opened Mayaham Temple through Grunty Industries
		if (bufData[109] !== bufStorage[109]) {
			bufData[109] |= bufStorage[109];
			this.core.save.game_flags.set(109, bufData[109]);
			needUpdate = true;
		}

		// Opened Hailfire Peaks through Hag 1
		if (bufData[110] !== bufStorage[110]) {
			bufData[110] |= bufStorage[110];
			this.core.save.game_flags.set(110, bufData[110]);
			needUpdate = true;
		}

		// This gets set for unlocking world 1, but its nameless...
		if (bufData[120] !== bufStorage[120]) {
			bufData[120] |= bufStorage[120];
			this.core.save.game_flags.set(120, bufData[120]);
			needUpdate = true;
		}

		// First time challenge instructions
		if (bufData[161] !== bufStorage[161]) {
			bufData[161] |= bufStorage[161];
			this.core.save.game_flags.set(161, bufData[161]);
			needUpdate = true;
		}

		// Unlock Jiggywiggy Temple song for Jukebox
		if (bufData[167] !== bufStorage[167]) {
			bufData[167] |= bufStorage[167];
			this.core.save.game_flags.set(167, bufData[167]);
			needUpdate = true;
		}

		// Puzzle complete??? Again, its nameless...
		if (bufData[172] !== bufStorage[172]) {
			bufData[172] |= bufStorage[172];
			this.core.save.game_flags.set(172, bufData[172]);
			needUpdate = true;
		}

		if (needUpdate) {
			this.cDB.game_flags = bufData;
			pData = new Net.SyncBuffered(this.ModLoader.clientLobby, 'SyncGameFlags', bufData, false);
			this.ModLoader.clientSide.sendPacket(pData);
		}
	}

	handle_HC_totals(bufData: Buffer) {
		let countBuf = Buffer.alloc(0x04);
		let i = 0;
		let count = 0;

		for (i = 0; i < 4; i++) { // 0x3f is starting flag byte for HC
			countBuf[i] = bufData[0x3f + i];
		}

		countBuf[3] &= 0x07; // only keeps binary 0000 0111
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 4);
		this.core.player.empty_honeycombs = count - this.honeycomb_spent();
	}

	honeycomb_spent(): number {
		if (this.cDB.health_upgrade_level > 0) {
			return ((this.cDB.health_upgrade_level - 1) * 2) + 1;
		} else {
			return 0;
		}
	}

	handle_cheato_totals(bufData: Buffer) {
		let countBuf = Buffer.alloc(0x04);
		let i = 0;
		let count = 0;

		for (i = 0; i < 4; i++) { // 0x56 is starting flag byte for cheato pages
			countBuf[i] = bufData[0x56 + i];
		}

		countBuf[0] &= 0xf8; // only keeps binary 1111 1000
		countBuf[3] &= 0xf; // only keeps binary 0000 1111
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 4);
		this.core.player.cheato_pages = count - this.cheato_spent(bufData);
	}

	cheato_spent(bufData: Buffer): number {
		let countBuf = Buffer.alloc(0x02);
		let i = 0;
		let count = 0;

		for (i = 0; i < 2; i++) { // 0x08 is starting flag byte for cheato spent
			countBuf[i] = bufData[0x08 + i];
		}

		countBuf[0] &= 0xf0; // only keeps binary 1111 0000
		countBuf[1] &= 0x01; // only keeps binary 0000 0001
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 2);
		count *= 5; // 5 pages get spent per cheat unlocked
		return count;
	}

	handle_glowbo_totals(bufData: Buffer) {
		let countBuf = Buffer.alloc(0x03);
		let i = 0;
		let count = 0;

		for (i = 0; i < 3; i++) { // 0x42 is starting flag byte for glowbos
			countBuf[i] = bufData[0x42 + i];
		}

		countBuf[0] &= 0x80; // only keeps binary 1000 0000
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 3);
		this.core.player.glowbos = count - (this.glowbo_spent_hubba(bufData) + this.glowbo_spent_mumbo(bufData));
	}

	glowbo_spent_hubba(bufData: Buffer): number {
		let countBuf = Buffer.alloc(0x02);
		let i = 0;
		let count = 0;

		for (i = 0; i < 2; i++) { // 0x15 is starting flag byte for hubba glowbo paid
			countBuf[i] = bufData[0x15 + i];
		}

		countBuf[0] &= 0xc0; // only keeps binary 1100 0000
		countBuf[1] &= 0x7f; // only keeps binary 0111 1111
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 2);
		return count;
	}

	glowbo_spent_mumbo(bufData: Buffer): number {
		let countBuf = Buffer.alloc(0x02);
		let i = 0;
		let count = 0;

		for (i = 0; i < 2; i++) { // 0x6a is starting flag byte for mumbo glowbo paid
			countBuf[i] = bufData[0x6a + i];
		}

		countBuf[0] &= 0x80; // only keeps binary 1000 0000
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 2);
		return count;
	}

	handle_mega_glowbo_totals(bufData: Buffer) {
		let count = 0;

		if (this.get_bit(bufData[0x05], 6)) count += 1;
		this.core.player.mega_glowbos = count - this.mega_glowbo_spent(bufData);
	}

	mega_glowbo_spent(bufData: Buffer): number {
		let count = 0;

		// 1 mega glowbo spent at Humba Wumba at Isle o Hags
		if (this.get_bit(bufData[0x16], 6)) count += 1;
		return count;
	}

	handle_ticket_totals(bufData: Buffer) {
		let countBuf = Buffer.alloc(0x01);
		let count = 0;

		countBuf[0] = bufData[0x9c]; // 0x9c is starting flag byte for tickets collected
		countBuf[0] &= 0xf0; // only keeps binary 1111 0000
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 1);
		this.core.player.tickets = count - this.tickets_spent(bufData);
	}

	tickets_spent(bufData: Buffer): number {
		let count = 0;

		// 4 tickets needed to fight Mr. Patch
		if (this.get_bit(bufData[0x04], 2)) count += 4;
		return count;
	}

	handle_doubloon_totals(bufData: Buffer) {
		let countBuf = Buffer.alloc(0x05);
		let i = 0;
		let count = 0;

		for (i = 0; i < 5; i++) { // 0x22 is starting flag byte for doubloons
			countBuf[i] = bufData[0x22 + i];
		}

		countBuf[0] &= 0x80; // only keeps binary 1000 0000
		countBuf[4] &= 0x7f; // only keeps binary 0111 1111
		count = this.ModLoader.utils.utilBitCountBuffer(countBuf, 0, 5);
		this.core.player.doubloons = count - this.doubloons_spent(bufData);
	}

	doubloons_spent(bufData: Buffer): number {
		let count = 0;

		// 20 doubloons needed for Pawno's Jiggy
		if (this.get_bit(bufData[0x11], 4)) count += 20;

		// 5 doubloons needed for Pawno's Cheato Page
		if (this.get_bit(bufData[0x11], 5)) count += 5;

		// 2 doubloons needed for renting Jolly's Room
		if (this.get_bit(bufData[0x13], 2)) count += 2;

		// 1 doubloon needed for Blubbers item
		if (this.get_bit(bufData[0x17], 0)) count += 1;
		return count;
	}

	handle_bean_totals(bufData: Buffer) {
		let count = 0;

		if (this.get_bit(bufData[0x62], 5)) count += 1;
		if (this.get_bit(bufData[0x62], 6)) count += 1;
		this.core.player.beans = count - this.beans_planted(bufData);
	}

	beans_planted(bufData: Buffer): number {
		let count = 0;

		// 1 bean planted for CCL Cheese Wedge
		if (this.get_bit(bufData[0x65], 6)) count += 1;

		// 1 bean planted for CCL Sack Pack race
		if (this.get_bit(bufData[0x65], 7)) count += 1;
		return count;
	}

	handle_sns_eggs_totals(bufData: Buffer) {
		let count = 0;

		// 1 blue egg acquired
		if (this.get_bit(bufData[0x77], 3)) count += 1;

		// 1 pink egg acquired
		if (this.get_bit(bufData[0x77], 5)) count += 1;
		this.core.player.eggs = count - this.sns_eggs_hatched(bufData);
	}

	sns_eggs_hatched(bufData: Buffer): number {
		let count = 0;

		// 1 blue egg hatched
		if (this.get_bit(bufData[0x77], 4)) count += 1;

		// 1 pink egg hatched
		if (this.get_bit(bufData[0x77], 6)) count += 1;
		return count;
	}

	constructor() { }

	preinit(): void {
		// this.pMgr = new Puppet.PuppetManager();
	}

	init(): void {

	}

	postinit(): void {
		// Puppet Manager Inject
		// this.pMgr.postinit(
		//   this.ModLoader.emulator,
		//   this.core,
		//   this.ModLoader.me,
		//   this.ModLoader
		// );

		// this.ModLoader.logger.info('Puppet manager activated.');
	}

	onTick(): void {
		if (!this.core.isPlaying() /*|| this.core.runtime.is_cutscene()*/) return;

		// Initializers
		let bufStorage: Buffer;
		let bufData: Buffer;

		// L to levitate
		this.LtoLevitate();

		// Update Jinjos one time.
		if (this.cDB.ft_jinjo_sync) {
			this.handle_jinjos();
			this.cDB.ft_jinjo_sync = false;
		}

		// Process flag changes.
		this.handle_game_flags(bufData!, bufStorage!);
		this.handle_global_flags(bufData!, bufStorage!);
	}

	@EventHandler(EventsClient.ON_INJECT_FINISHED)
	onClient_InjectFinished(evt: any): void {
	}

	@EventHandler(EventsServer.ON_LOBBY_CREATE)
	onServer_LobbyCreate(lobby: string): void {
		this.ModLoader.lobbyManager.createLobbyStorage(lobby, this, new Net.DatabaseServer());
	}

	@EventHandler(EventsClient.ON_LOBBY_JOIN)
	onClient_LobbyJoin(lobby: LobbyData): void {
		this.cDB = new Net.DatabaseClient();

		// Send our storage request to the server
		let pData = new Packet('Request_Storage', 'BtOnline', this.ModLoader.clientLobby, false);
		this.ModLoader.clientSide.sendPacket(pData);
	}

	@EventHandler(EventsServer.ON_LOBBY_JOIN)
	onServer_LobbyJoin(evt: EventServerJoined): void {
		let storage: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(evt.lobby, this) as Net.DatabaseServer;

	}

	@EventHandler(EventsServer.ON_LOBBY_LEAVE)
	onServer_LobbyLeave(evt: EventServerLeft): void {
		let storage: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(evt.lobby, this) as Net.DatabaseServer;

	}

	@EventHandler(EventsClient.ON_SERVER_CONNECTION)
	onClient_ServerConnection(evt: any): void {

	}

	@EventHandler(EventsClient.ON_PLAYER_JOIN)
	onClient_PlayerJoin(player: INetworkPlayer): void {

	}

	@EventHandler(EventsClient.ON_PLAYER_LEAVE)
	onClient_PlayerLeave(player: INetworkPlayer): void {

	}

	// #################################################
	// ##  Server Receive Packets
	// #################################################

	@ServerNetworkHandler('SyncStorage')
	onServer_SyncStorage(packet: Net.SyncStorage): void {
		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		this.ModLoader.logger.info('[Server] Received: {Lobby Storage}');
		sDB.game_flags = packet.game_flags;
		sDB.global_flags = packet.global_flags;
		sDB.jiggy_wiggy_challenge = packet.jiggy_wiggy_challenge;
		sDB.health_upgrade_level = packet.health_upgrade;
		sDB.jinjo = packet.jinjo;
	}

	@ServerNetworkHandler('Request_Storage')
	onServer_RequestStorage(packet: Packet): void {
		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		this.ModLoader.logger.info('[Server] Sending: {Lobby Storage}');
		let pData = new Net.SyncStorage(packet.lobby, sDB.game_flags, sDB.global_flags, sDB.jiggy_wiggy_challenge, sDB.health_upgrade_level, sDB.jinjo);
		this.ModLoader.serverSide.sendPacketToSpecificPlayer(pData, packet.player);
	}

	@ServerNetworkHandler('SyncGameFlags')
	onServer_SyncGameFlags(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Server] Received: {Game Flags}');

		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		let data: Buffer = sDB.game_flags;
		let count: number = data.byteLength;
		let i = 0;
		let needUpdate = false;

		for (i = 0; i < count; i++) {
			if (data[i] === packet.value[i]) continue;

			data[i] |= packet.value[i];
			needUpdate = true;
		}

		if (!needUpdate) return;
		sDB.game_flags = data;
		let pData = new Net.SyncBuffered(packet.lobby, 'SyncGameFlags', data, true);
		this.ModLoader.serverSide.sendPacket(pData);
		this.ModLoader.logger.info('[Server] Updated: {Game Flags}');
	}

	@ServerNetworkHandler('SyncGlobalFlags')
	onServer_SyncGlobalFlags(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Server] Received: {Global Flags}');

		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		let data: Buffer = sDB.global_flags;
		let count: number = data.byteLength;
		let i = 0;
		let needUpdate = false;

		for (i = 0; i < count; i++) {
			if (data[i] === packet.value[i]) continue;
			data[i] |= packet.value[i];
			needUpdate = true;
		}

		if (!needUpdate) return;

		sDB.global_flags = data;
		let pData = new Net.SyncBuffered(packet.lobby, 'SyncGlobalFlags', data, true);
		this.ModLoader.serverSide.sendPacket(pData);
		this.ModLoader.logger.info('[Server] Updated: {Global Flags}');
	}

	@ServerNetworkHandler('SyncJWC')
	onServer_SyncJWC(packet: Net.SyncNumbered): void {
		this.ModLoader.logger.info('[Server] Received: {Jiggywiggy Challenge}');

		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		let data: number = sDB.jiggy_wiggy_challenge;
		let needUpdate = false;

		if (data < packet.value) {
			data = packet.value;
			needUpdate = true;
		}

		if (!needUpdate) return;
		sDB.jiggy_wiggy_challenge = data;
		let pData = new Net.SyncNumbered(packet.lobby, 'SyncJWC', data, true);
		this.ModLoader.serverSide.sendPacket(pData);
		this.ModLoader.logger.info('[Server] Updated: {Jiggywiggy Challenge}');
	}

	@ServerNetworkHandler('SyncHealthUpgrades')
	onServer_SyncHealthUpgrades(packet: Net.SyncNumbered): void {
		this.ModLoader.logger.info('[Server] Received: {Health Upgrades}');

		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		let data: number = sDB.health_upgrade_level;
		let needUpdate = false;

		if (data < packet.value) {
			data = packet.value;
			needUpdate = true;
		}

		if (!needUpdate) return;
		sDB.health_upgrade_level = data;
		let pData = new Net.SyncNumbered(packet.lobby, 'SyncHealthUpgrades', data, true);
		this.ModLoader.serverSide.sendPacket(pData);
		this.ModLoader.logger.info('[Server] Updated: {Health Upgrades}');
	}

	@ServerNetworkHandler('SyncJinjos')
	onServer_SyncJinjos(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Server] Received: {Jinjos}');

		let sDB: Net.DatabaseServer = this.ModLoader.lobbyManager.getLobbyStorage(packet.lobby, this) as Net.DatabaseServer;

		// Safety check
		if (sDB === null) return;

		let data: Buffer = sDB.jinjo;
		let count: number = data.byteLength;
		let i = 0;
		let needUpdate = false;

		for (i = 0; i < count; i++) {
			if (data[i] === packet.value[i]) continue;
			sDB.jinjo[i] = packet.value[i];
			needUpdate = true;
		}

		if (!needUpdate) return;

		let pData = new Net.SyncBuffered(packet.lobby, 'SyncJinjos', sDB.jinjo, true);
		this.ModLoader.serverSide.sendPacket(pData);
		this.ModLoader.logger.info('[Server] Updated: {Jinjos}');
	}

	// #################################################
	// ##  Client Receive Packets
	// #################################################

	@NetworkHandler('SyncStorage')
	onClient_SyncStorage(packet: Net.SyncStorage): void {
		let i: number;
		this.ModLoader.logger.info('[Client] Received: {Lobby Storage}');
		this.cDB.game_flags = packet.game_flags;
		this.cDB.global_flags = packet.global_flags;
		this.cDB.jiggy_wiggy_challenge = packet.jiggy_wiggy_challenge;
		this.cDB.health_upgrade_level = packet.health_upgrade;
		this.cDB.jinjo = packet.jinjo;
		this.core.save.game_flags.set_all(this.cDB.game_flags);
		this.core.save.global_flags.set_all(this.cDB.global_flags);

		// Get Jinjos.
		for (i = 0; i < 45; i++) {
			this.core.runtime.set_jinjo(i, this.cDB.jinjo[i]);
		}

		// Title Screen skip enabled.
		i = this.core.save.global_flags.get(0x0d);
		i |= (1 << 6);
		this.core.save.global_flags.set(0x0d, i);
	}

	@NetworkHandler('SyncGameFlags')
	onClient_SyncGameFlags(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Client] Received: {Game Flags}');

		let data: Buffer = this.cDB.game_flags;
		let count: number = data.byteLength;
		let i = 0;
		let needUpdate = false;

		for (i = 0; i < count; i++) {
			if (data[i] === packet.value[i]) continue;
			data[i] |= packet.value[i];
			needUpdate = true;
		}

		if (!needUpdate) return;
		this.cDB.game_flags = data;
		this.ModLoader.logger.info('[Client] Updated: {Game Flags}');
	}

	@NetworkHandler('SyncGlobalFlags')
	onClient_SyncGlobalFlags(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Client] Received: {Global Flags}');

		let data: Buffer = this.cDB.global_flags;
		let count: number = data.byteLength;
		let i = 0;
		let needUpdate = false;

		for (i = 0; i < count; i++) {
			if (data[i] === packet.value[i]) continue;
			data[i] |= packet.value[i];
			needUpdate = true;
		}

		if (!needUpdate) return;
		this.cDB.global_flags = data;
		this.ModLoader.logger.info('[Client] Updated: {Global Flags}');
	}

	@NetworkHandler('SyncJWC')
	onClient_SyncJWC(packet: Net.SyncNumbered): void {
		this.ModLoader.logger.info('[Client] Received: {Jiggywiggy Challenge}');

		let data: number = this.cDB.jiggy_wiggy_challenge;
		let needUpdate = false;

		if (data < packet.value) {
			data = packet.value;
			needUpdate = true;
		}

		if (!needUpdate) return;

		this.cDB.jiggy_wiggy_challenge = data;
		this.ModLoader.logger.info('[Client] Updated: {Jiggywiggy Challenge}');
	}

	@NetworkHandler('SyncHealthUpgrades')
	onClient_SyncHealthUpgrades(packet: Net.SyncNumbered): void {
		this.ModLoader.logger.info('[Client] Received: {Health Upgrades}');

		let data: number = this.cDB.health_upgrade_level;
		let needUpdate = false;

		if (data < packet.value) {
			data = packet.value;
			needUpdate = true;
		}

		if (!needUpdate) return;
		this.cDB.health_upgrade_level = data;
		this.ModLoader.logger.info('[Client] Updated: {Health Upgrades}');
	}

	@NetworkHandler('SyncJinjos')
	onClient_SyncJinjos(packet: Net.SyncBuffered): void {
		this.ModLoader.logger.info('[Client] Received: {Jinjos}');

		let count: number = this.cDB.jinjo.byteLength;
		let i = 0;

		for (i = 0; i < count; i++) {
			this.cDB.jinjo[i] = packet.value[i];
			this.core.runtime.set_jinjo(i, this.cDB.jinjo[i]);
		}

		this.ModLoader.logger.info('[Client] Updated: {Jinjos}');
	}
}