import { EventHandler } from 'modloader64_api/EventHandler';
import { IModLoaderAPI } from 'modloader64_api/IModLoaderAPI';
import { DiscordStatus } from 'modloader64_api/Discord';
import * as Main from '../Main';
import * as API from 'BanjoTooie/API/Imports';
import * as Net from '../network/Imports';
import { count } from 'console';

export class BtOnline_Handlers {
    private parent!: Main.BtOnline;

    // Helpers
    private onTitle = true;

    get core(): API.IBTCore { return this.parent.core; }
    get modloader(): IModLoaderAPI { return this.parent.ModLoader; }

    constructor(parent: Main.BtOnline) { this.parent = parent; }

    init() { }

    tick() {
        let isPlaying = this.core.isPlaying();
        let isCutscene = false; // this.core.runtime.is_cutscene();
        if (!isPlaying || isCutscene) {
            if (!isPlaying) {
                // Alert for Discord status
                if (!this.onTitle) {
                    this.modloader.gui.setDiscordStatus(
                        new DiscordStatus('Playing BtOnline',
                            'On the title screen [Team Select]')
                    );
                    this.onTitle = true;
                }
            }

            return;
        }

        // Global file - Set team
        this.parent.cDB.team = this.core.runtime.get_current_profile();
        let team = this.parent.cDB.team;

        // Start of run-once per profile load
        if (!this.onTitle) {
            let value: number = 0;

            // Klungo Potion Order
            value = this.core.save.flags_game.get(93) & 0x1f;
            value |= 0x40; // Red, Blue, Green -> Grow, Multiply, Invisible
            this.core.save.flags_game.set(93, value);

            // Jinjo (Random) Order
            value = this.core.save.flags_game.get(106) & 0x81;
            value |= 0x26; // Just a random order
            this.core.save.flags_game.set(106, value);
        }

        // End of run-once per profile load
        this.onTitle = false;

        // Initializers
        let bufStorage: Buffer;
        let bufData: Buffer;
        let scene: number = this.core.runtime.current_scene;
        let forceReload: boolean = false;

        // General Setup/Handlers
        this.handle_puppets(scene, forceReload);
        this.handle_moves_reloaded(bufData!, bufStorage!);
        this.handle_health_upgrades(bufData!);

        // Progress Flags Handlers
        if (this.handle_game_flags(bufData!, bufStorage!)) {
            // Update some counts for visuals
            bufData = this.core.save.flags_game.get_all();
            this.handle_bean_count(bufData);
            this.handle_cheato_count(bufData);
            this.handle_doubloon_count(bufData);
            this.handle_honeycomb_count(bufData);
            this.handle_glowbo_count(bufData);
            this.handle_mega_glowbo_count(bufData);
            this.handle_stop_n_swap_egg_count(bufData);
            this.handle_ticket_count(bufData);
        }
        this.handle_global_flags(bufData!, bufStorage!);
    }

    // #################################################
    // ##  Utility Functions
    // #################################################

    log(input: string) {
        if (this.parent.config.print_net_server)
            this.modloader.logger.info('[Tick] ' + input);
    }

    utilBitCountBuffer(arr: Buffer, offset: number, length: number)
    {

        if (length <= 0 || offset + length > arr.byteLength)
            length = arr.byteLength;

        let count: number = 0;
        for (let i = offset; i < length; i++) 
            for (let n = 0; n < 8; n++) 
                if (arr[i] & (1 << n)) count++; 
        return count;
    }

    utilBitCount32(value: number)
    {
        let count: number = 0;
        for (let i = 0; i < 32; i++) 
            if (value & (1 << i)) count++;
        return count;
    } 

    utilBitCount16(value: number)
    {
        let count: number = 0;
        for (let i = 0; i < 16; i++) 
            if (value & (1 << i)) count++;
            return count;
    } 

    utilBitCount8(value: number)
    {
        let count: number = 0;
        for (let i = 0; i < 8; i++) 
            if (value & (1 << i)) count++;
            return count;
    } 

    // #################################################
    // ##  API Events
    // #################################################

    @EventHandler(API.BtEvents.ON_SCENE_CHANGE)
    onSceneChange(scene: number) {
        let team = this.parent.cDB.team;

        // Set global to current scene value
        this.parent.cDB.curScn = scene;

        // Alert scene change so puppet can despawn for other players
        if (scene === -1) {
            this.modloader.clientSide.sendPacket(new Net.SyncLocation(this.modloader.clientLobby, team, 0));
            return;
        }

        // Update discord notice
        this.modloader.gui.setDiscordStatus(new DiscordStatus('Playing BtOnline', 'In Scene[' + scene + ']'));

        // Alert scene change!
        this.modloader.clientSide.sendPacket(new Net.SyncLocation(this.modloader.clientLobby, team, scene));
        this.log('Moved to scene[' + scene + '].');
    }

    // #################################################
    // ##  Handler Functions
    // #################################################

    merge_bits(buf1: Buffer, buf2: Buffer): boolean {
        let c1 = buf1.byteLength;
        let c2 = buf2.byteLength;
        let count = c1 > c2 ? c2 : c1;

        let i: number;
        let needUpdate = false;

        for (i = 0; i < count; i++) {
            if (buf1[i] === buf2[i]) continue;
            buf1[i] |= buf2[i];
            needUpdate = true;
        }

        return needUpdate;
    }

    get_flag(buf: Buffer, offset: number): boolean {
        let byte = Math.floor(offset / 8);
        let bit = offset % 8;

        return (buf[byte] & (1 << bit)) !== 0;
    }

    set_flags(buf: Buffer, offset: number, count: number, val: number) {
        let byteOff: number;
        let bitOff: number;
        let tOffset: number;

        for (let i = 0; i < count; i++) {
            tOffset = offset + i;
            byteOff = Math.floor(tOffset / 8);
            bitOff = tOffset % 8;

            if ((buf[byteOff] & (1 << bitOff)) !== (val & (1 << i))) {
                buf[byteOff] ^= 1 << bitOff;
            }
        }
    }

    selective_game_sync(buf1: Buffer, buf2: Buffer, offset: number, mask: number): boolean {
        this.core.save.flags_game.set(offset, buf1[offset] | buf2[offset]);
        buf1[offset] &= mask;

        if (buf1[offset] === buf2[offset]) return false;

        buf1[offset] |= buf2[offset];
        return true;
    }

    selective_global_sync(buf1: Buffer, buf2: Buffer, offset: number, mask: number): boolean {
        this.core.save.flags_global.set(offset, buf1[offset] | buf2[offset]);
        buf1[offset] &= mask;

        if (buf1[offset] === buf2[offset]) return false;

        buf1[offset] |= buf2[offset];
        return true;
    }

    handle_puppets(scene: number, forceReload: boolean) {
        if (forceReload) {
            this.parent.pMgr.scene = -1;
        } else {
            this.parent.pMgr.scene = scene;
        }

        this.parent.pMgr.onTick(this.parent.cDB.curScn !== -1);
    }

    handle_moves_reloaded(bufData: Buffer, bufStorage: Buffer) {
        // Initializers
        let team = this.parent.cDB.team;
        bufData = this.core.save.flags_game.get_all();
        bufStorage = this.parent.cDB.file[team].flagsGame;

        /* First-Time collection gives you the items */

        // Blue Eggs
        if (!(bufData[0] & (1 << 3)) && (bufStorage[0] & (1 << 3)))
            this.core.save.inventory.eggs.plain += 20;

        // Red Feathers
        if (!(bufData[0] & (1 << 4)) && (bufStorage[0] & (1 << 4)))
            this.core.save.inventory.red_feathers += 20;

        // Gold Feathers
        if (!(bufData[0] & (1 << 5)) && (bufStorage[0] & (1 << 5)))
            this.core.save.inventory.gold_feathers += 2;

        // Honeycomb
        if (!(bufData[0] & (1 << 7)) && (bufStorage[0] & (1 << 7)))
            this.core.runtime.current_health += 1;

        // Fire Eggs
        if (!(bufData[30] & (1 << 1)) && (bufStorage[30] & (1 << 1)))
            this.core.save.inventory.eggs.fire += 40;

        // Grenade Eggs
        if (!(bufData[30] & (1 << 2)) && (bufStorage[30] & (1 << 2)))
            this.core.save.inventory.eggs.grenade += 25;

        // Clockwork Kazooie Eggs
        if (!(bufData[30] & (1 << 3)) && (bufStorage[30] & (1 << 3)))
            this.core.save.inventory.eggs.clockwork += 10;

        // Ice Eggs
        if (!(bufData[30] & (1 << 4)) && (bufStorage[30] & (1 << 4)))
            this.core.save.inventory.eggs.ice += 50;
    }

    handle_health_upgrades(bufData: Buffer) {
        // Initializers
        let team = this.parent.cDB.team;
        let dbValue: number;
        let value: number;

        bufData = this.core.save.flags_game.get_all();
        dbValue = this.parent.cDB.file[team].healthUpgrade;
        value = (bufData[152] >> 2) & 0x07;

        // Process Changes
        if (dbValue > value) {
            bufData[152] &= 0xe3;
            bufData[152] |= (dbValue << 2);
            this.core.save.flags_game.set(152, bufData[152]);
            return;
        }
        else if (dbValue < value) {
            this.parent.cDB.file[team].healthUpgrade = value;
            this.modloader.clientSide.sendPacket(
                new Net.SyncNumbered(
                    this.modloader.clientLobby,
                    'SyncHealthUpgrades',
                    team,
                    value,
                    false
                )
            );
        }
    }

    handle_game_flags(bufData: Buffer, bufStorage: Buffer): boolean {
        // Initializers
        let pData: Net.SyncBuffered;
        let team = this.parent.cDB.team;
        let i: number;
        let count: number;
        let val: number;
        let needUpdate = false;

        bufData = this.core.save.flags_game.get_all();
        bufStorage = this.parent.cDB.file[team].flagsGame;
        count = bufData.byteLength;
        needUpdate = false;

        for (i = 0; i < count; i++) {
            if (bufData[i] === bufStorage[i]) continue;
            if (i === 13 || // Mumbo Magic on Chuffy (desynced until dynamic sync)
                i === 17 || // Klungo 3 Potion chosen
                i === 19 || // Klungo 1 Potion chosen & Maggies Jiggy
                i === 39 || // HFP Lava Switch & JRL Swimming Pool
                i === 44 || // TDL Wigwam Big/Small & Scrat Heal (Scrotty Family Quest)
                i === 50 || // Klungo 2 Potion chosen & GI: Quality Control Room
                i === 52 || // Sabreman Rescue
                i === 66 || // JRL Sea Bottom (Crash Fix)
                i === 80 || // MT Snake Jiggy
                i === 81 || // JRL Atlantis (Crash Fix)
                i === 84 || // In-map CCL Mountain Exterior (precautionsary desync)
                i === 89 || // JRL Smugglers Cavern (Crash Fix)
                i === 94 || // Klungo 1-3 defeated
                i === 102 || // Jiggywiggy's Challenge
                i === 152 || // Honey B Health Upgrades & Train (1)
                i === 153 || // Train (2)
                i === 170 || // Bottles Energy Restored
                i === 172) // Scrut Rescue (Scrotty Family Quest)
                continue; // Escape -> We want to manual sync these

            bufData[i] |= bufStorage[i];
            this.core.save.flags_game.set(i, bufData[i]);
            needUpdate = true;
        }

        // Mumbo Magic on Chuffy (desynced until dynamic sync)
        if (this.selective_game_sync(bufData, bufStorage, 13, 0xdf)) needUpdate = true;

        // Klungo 3 Potion chosen
        if (this.selective_game_sync(bufData, bufStorage, 17, 0x7f)) needUpdate = true;

        // Klungo 1 Potion chosen
        if (this.selective_game_sync(bufData, bufStorage, 19, 0xf5)) needUpdate = true;

        // HFP Lava Switch & JRL Swimming Pool
        if (this.selective_game_sync(bufData, bufStorage, 39, 0x7f)) needUpdate = true;

        // TDL Wigwam Big/Small & Scrat Heal (Scrotty Family Quest)
        if (this.selective_game_sync(bufData, bufStorage, 44, 0xf9)) needUpdate = true;

        // Klungo 2 Potion chosen & GI: Quality Control Room
        if (this.selective_game_sync(bufData, bufStorage, 50, 0xdb)) needUpdate = true;

        // Sabreman Rescue
        if (this.selective_game_sync(bufData, bufStorage, 52, 0xfb)) needUpdate = true;

        // JRL Sea Bottom (Crash Fix)
        if (this.selective_game_sync(bufData, bufStorage, 66, 0xf7)) needUpdate = true;

        // MT Snake Jiggy
        if (this.selective_game_sync(bufData, bufStorage, 80, 0xef)) needUpdate = true;

        // JRL Atlantis (Crash Fix)
        if (this.selective_game_sync(bufData, bufStorage,81, 0xfb)) needUpdate = true;

        // In-map CCL Mountain Exterior (precautionsary desync)
        if (this.selective_game_sync(bufData, bufStorage, 84, 0x7f)) needUpdate = true;

        // JRL Smugglers Cavern (Crash Fix)
        if (this.selective_game_sync(bufData, bufStorage, 89, 0xdf)) needUpdate = true;

        // Klungo 1-3 Defeated
        if (this.selective_game_sync(bufData, bufStorage, 94, 0xf8)) needUpdate = true;

        // Jiggywiggy Challenge
        count = bufData[102] >> 4;
        if (this.parent.cDB.file[team].curJiggyChallenge > count) {
            bufData[102] = (bufData[102] & 0x0f) |
                (this.parent.cDB.file[team].curJiggyChallenge << 4);
            this.core.save.flags_game.set(102, bufData[102]);
        } else if (this.parent.cDB.file[team].curJiggyChallenge < count) {
            this.parent.cDB.file[team].curJiggyChallenge = count;
            this.modloader.clientSide.sendPacket(
                new Net.SyncNumbered(
                    this.modloader.clientLobby,
                    'SyncJiggyChallenge',
                    team,
                    count,
                    false
                )
            );
        }

        // Jiggywiggy Challenge Byte (without index)
        if (this.selective_game_sync(bufData, bufStorage, 102, 0x0f)) needUpdate = true;

        // Honey B Health Upgrades & Train (1)
        if (this.selective_game_sync(bufData, bufStorage, 142, 0x03)) needUpdate = true;

        // Train (2)
        if (this.selective_game_sync(bufData, bufStorage, 153, 0xf0)) needUpdate = true;

        // Bottles Energy Restored
        if (this.selective_game_sync(bufData, bufStorage, 170, 0xfe)) needUpdate = true;

        // Scrut Rescue (Scrotty Family Quest)
        if (this.selective_game_sync(bufData, bufStorage, 172, 0xfe)) needUpdate = true;

        // Process Changes
        if (!needUpdate) return false;

        // Notif the assembly that we made changes
        this.modloader.emulator.rdramWrite8(global.ModLoader[API.AddressType.CMD_BUFFER], 1) ;

        // Send Changes to Server
        this.parent.cDB.file[team].flagsGame = bufData;
        pData = new Net.SyncBuffered(this.modloader.clientLobby, 'SyncGameFlags', team, bufData, false);
        this.modloader.clientSide.sendPacket(pData);

        return true;
    }

    handle_bean_count(bufData: Buffer) {
        let countSpent = 0;
        let countTotal = 0;
        if (this.get_flag(bufData, 0x32e)) countSpent += 1; // Cheese Wedge
        if (this.get_flag(bufData, 0x32f)) countSpent += 1; // Sack Pack Race
        if (this.get_flag(bufData, 0x315)) countTotal += 1;
        if (this.get_flag(bufData, 0x316)) countTotal += 1;
        this.core.save.inventory.beans = countTotal - countSpent;
    }

    handle_cheato_count(bufData: Buffer) {
        let bufSpent = new Buffer(bufData.slice(0x08, 0x09));
        let bufTotal = new Buffer(bufData.slice(0x56, 0x59));
        bufSpent[0] &= 0xf0; // only keeps binary 1111 0000
        bufSpent[1] &= 0x01; // only keeps binary 0000 0001
        bufTotal[0] &= 0xf8; // only keeps binary 1111 1000
        bufTotal[3] &= 0x0f; // only keeps binary 0000 1111

        let countSpent = this.utilBitCountBuffer(bufSpent, 0, 2) * 5;
        let countTotal = this.utilBitCountBuffer(bufTotal, 0, 4);
        this.core.save.inventory.cheato_pages = countTotal - countSpent;
    }

    handle_doubloon_count(bufData: Buffer) {
        let bufTotal = new Buffer(bufData.slice(0x22, 0x26));
        bufTotal[0] &= 0x80; // only keeps binary 1000 0000
        bufTotal[4] &= 0x7f; // only keeps binary 0111 1111

        let countSpent = 0;
        let countTotal = this.utilBitCountBuffer(bufTotal, 0, 5);

        if (this.get_flag(bufData, 0x8c)) countSpent += 20; // Pawno's Jiggy
        if (this.get_flag(bufData, 0x8d)) countSpent += 5; // Pawno's Cheato Page
        if (this.get_flag(bufData, 0x9a)) countSpent += 2; // Jolly's Room Renting
        if (this.get_flag(bufData, 0xb8)) countSpent += 1; // Blubbers Item

        this.core.save.inventory.doubloons = countTotal - countSpent;
    }

    handle_glowbo_count(bufData: Buffer) {
        let bufSpent1 = new Buffer(bufData.slice(0x15, 0x16)); // Humba Wumba
        let bufSpent2 = new Buffer(bufData.slice(0x6a, 0x6b)); // Mumbo Jumbo
        let bufTotal = new Buffer(bufData.slice(0x42, 0x44));
        bufSpent1[0] &= 0xc0; // only keeps binary 1100 0000
        bufSpent1[1] &= 0x7f; // only keeps binary 0111 1111
        bufSpent2[0] &= 0x80; // only keeps binary 1000 0000
        bufTotal[0] &= 0x80; // only keeps binary 1000 0000

        let countSpent1 = this.utilBitCountBuffer(bufSpent1, 0, 2);
        let countSpent2 = this.utilBitCountBuffer(bufSpent2, 0, 2);
        let countTotal = this.utilBitCountBuffer(bufTotal, 0, 3);
        this.core.save.inventory.glowbos = countTotal - countSpent1 - countSpent2;
    }

    handle_honeycomb_count(bufData: Buffer) {
        let bufTotal = new Buffer(bufData.slice(0x3f, 0x42));
        bufTotal[3] &= 0x07; // only keeps binary 0000 0111
        let countSpent = (this.parent.cDB.file[this.parent.cDB.team].healthUpgrade - 1) * 2 + 1;
        let countTotal = this.utilBitCountBuffer(bufTotal, 0, 4);
        this.core.save.inventory.honeycombs = countTotal - countSpent;
    }

    handle_mega_glowbo_count(bufData: Buffer) {
        if (!this.get_flag(bufData, 0x2e)) return; // Collected

        if (this.get_flag(bufData, 0xb6)) // Spent
            this.core.save.inventory.glowbo_mega = 0;
        else this.core.save.inventory.glowbo_mega = 1;
    }

    handle_stop_n_swap_egg_count(bufData: Buffer) {
        let countSpent = 0;
        let countTotal = 0;
        if (this.get_flag(bufData, 0x3bc)) countSpent += 1; // Blue Hatched
        if (this.get_flag(bufData, 0x3be)) countSpent += 1; // Pink Hatched
        if (this.get_flag(bufData, 0x3bb)) countTotal += 1; // Blue Acquired
        if (this.get_flag(bufData, 0x3bd)) countTotal += 1; // Pink Acquired
        this.core.save.inventory.stop_n_swap_eggs = countTotal - countSpent;
    }

    handle_ticket_count(bufData: Buffer) {
        let countSpent = this.get_flag(bufData, 0x22) ? 4 : 0;
        let countTotal = this.utilBitCount8(bufData[0x9c] & 0xf0); // only keeps binary 1111 0000
        this.core.save.inventory.tickets = countTotal - countSpent;
    }

    handle_global_flags(bufData: Buffer, bufStorage: Buffer): void {
        // Initializers
        let pData: Net.SyncBuffered;
        let team = this.parent.cDB.team;
        let i = 0;
        let val = 0;
        let count = 0;
        let needUpdate = false;

        bufData = this.core.save.flags_global.get_all();
        bufStorage = this.parent.cDB.file[team].flagsGlobal;
        count = bufData.byteLength;
        needUpdate = false;

        // for (i = 0; i < count; i++) {
        //     if (i > 11 && i < 14) continue; // ???
        //     if (bufData[i] === bufStorage[i]) continue;

        //     bufData[i] |= bufStorage[i];
        //     this.core.save.flags_global.set(i, bufData[i]);
        //     needUpdate = true;
        // }

        // Raw sync (no loop)
        if (bufData[2] !== bufStorage[2]) {
            bufData[2] |= bufStorage[2];
            this.core.save.flags_global.set(2, bufData[2]);
            needUpdate = true;
        }

        // Filter unknowns inside boss replay
        if (this.selective_global_sync(bufData, bufStorage, 3, 0x1f)) needUpdate = true;

        // Filter unknowns inside minigame replay
        if (this.selective_global_sync(bufData, bufStorage, 5, 0xf8)) needUpdate = true;

        // Raw sync (no loop)
        if (bufData[6] !== bufStorage[6]) {
            bufData[6] |= bufStorage[6];
            this.core.save.flags_global.set(6, bufData[6]);
            needUpdate = true;
        }

        // Raw sync (no loop)
        if (bufData[7] !== bufStorage[7]) {
            bufData[7] |= bufStorage[7];
            this.core.save.flags_global.set(7, bufData[7]);
            needUpdate = true;
        }

        // Raw sync (no loop)
        if (bufData[8] !== bufStorage[8]) {
            bufData[8] |= bufStorage[8];
            this.core.save.flags_global.set(8, bufData[8]);
            needUpdate = true;
        }

        // Sync Jinjo in Multiplayer (bit)
        if (this.selective_global_sync(bufData, bufStorage, 10, 0x08)) needUpdate = true;

        // Process Changes
        if (!needUpdate) return;

        this.parent.cDB.file[team].flagsGlobal = bufData;
        pData = new Net.SyncBuffered(this.modloader.clientLobby, 'SyncGlobalFlags', team, bufData, false);
        this.modloader.clientSide.sendPacket(pData);
    }
}