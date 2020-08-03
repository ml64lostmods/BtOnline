import { Packet, UDPPacket } from 'modloader64_api/ModLoaderDefaultImpls';
import * as API from 'BanjoTooie/API/Imports';

export class SyncStorage extends Packet {
	game_flags: Buffer;
	global_flags: Buffer;
	jiggy_wiggy_challenge: number;
	health_upgrade: number;
	jinjo: Buffer;

	constructor(
		lobby: string,
		game_flags: Buffer,
		global_flags: Buffer,
		jiggy_wiggy_challenge: number,
		health_upgrade: number,
		jinjo: Buffer
	) {
		super('SyncStorage', 'BtOnline', lobby, false);
		this.game_flags = game_flags;
		this.global_flags = global_flags;
		this.jiggy_wiggy_challenge = jiggy_wiggy_challenge;
		this.health_upgrade = health_upgrade;
		this.jinjo = jinjo;
	}
}

export class SyncBuffered extends Packet {
	value: Buffer;
	constructor(lobby: string, header: string, value: Buffer, persist: boolean) {
		super(header, 'BtOnline', lobby, persist);
		this.value = value;
	}
}

export class SyncNumbered extends Packet {
	value: number;
	constructor(lobby: string, header: string, value: number, persist: boolean) {
		super(header, 'BtOnline', lobby, persist);
		this.value = value;
	}
}