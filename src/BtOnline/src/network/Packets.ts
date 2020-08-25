import { Packet, UDPPacket } from 'modloader64_api/ModLoaderDefaultImpls';
import * as DB from './Database';
import * as PData from '../puppet/Instance';

export class SyncStorage extends Packet {
	file: DB.FileData[];
	constructor(
		lobby: string,
        file: DB.FileData[]
	) {
        super('SyncStorage', 'BtOnline', lobby, false);
        this.file = file;
	}
}

export class SyncBuffered extends Packet {
    team: number;
    value: Buffer;
    constructor(
        lobby: string,
        header: string,
        team: number,
        value: Buffer,
        persist: boolean
    ) {
        super(header, 'BtOnline', lobby, persist);
        this.team = team;
        this.value = value;
    }
}

export class SyncNumbered extends Packet {
    team: number;
    value: number;
    constructor(
        lobby: string,
        header: string,
        team: number,
        value: number,
        persist: boolean
    ) {
        super(header, 'BtOnline', lobby, persist);
        this.team = team;
        this.value = value;
    }
}

// #################################################
// ##  Puppet Tracking
// #################################################

export class SyncPuppet extends UDPPacket {
    puppet: PData.Data;
    constructor(lobby: string, value: PData.Data) {
        super('SyncPuppet', 'BtOnline', lobby, false);
        this.puppet = value;
    }
}

export class SyncLocation extends Packet {
    team: number;
    scene: number;
    constructor(lobby: string, team: number, scene: number) {
        super('SyncLocation', 'BtOnline', lobby, true);
        this.team = team;
        this.scene = scene;
    }
}
