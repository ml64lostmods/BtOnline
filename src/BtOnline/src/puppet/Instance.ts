import IMemory from 'modloader64_api/IMemory';
import * as API from 'BanjoTooie/API/Imports';

export class Data extends API.BaseObj implements Data {
    private readonly copyFields: string[] = new Array<string>();
    private readonly myVisiblePtr: number;
    private readonly visibleSize: number;
    private bufFloat: Buffer;
    core: API.IBTCore;
    player: API.IPlayer;
    ptr_cmd: number;
    ptr_vis: number;
    animPtr: number;
    busyPtr: number;
    broken: boolean = false;

    tptr: number = 0;
    safe: boolean = false;

    constructor(emu: IMemory, ptr_cmd: number, ptr_vis: number,
                core: API.IBTCore, player: API.IPlayer) {
        super(emu);
        this.ptr_cmd = ptr_cmd;
        this.ptr_vis = ptr_vis;
        this.animPtr = global.ModLoader[API.AddressType.ANIM_ARRAY];
        this.busyPtr = global.ModLoader[API.AddressType.CMD_BUFFER];
        this.core = core;
        this.player = player;
        this.copyFields.push('start');
        this.copyFields.push('anim');
        this.copyFields.push('pos');
        this.copyFields.push('rot');
        this.copyFields.push('model');
        this.copyFields.push('visible');
        this.copyFields.push('y_flip');
        this.copyFields.push('end');

        this.myVisiblePtr = global.ModLoader[API.AddressType.PUPPET_INFO] + 0x04;
        this.visibleSize = global.ModLoader[API.AddressType.PINFO_SIZE];
        this.bufFloat = Buffer.alloc(4);
    }

    safetyCheck(): number {
        let ret = 0x000000;
        if (this.broken) return ret;
        if (this.emulator.rdramRead8(this.busyPtr) !== 0) return ret;

        let ptr: number = this.emulator.dereferencePointer(this.ptr_cmd);
        if (ptr === 0x000000) {
            this.broken = true;
            return ret;
        }

        if (this.emulator.rdramRead16(ptr + 0x6e) !== 0x9F6A) {
            this.broken = true;
            return ret;
        }

        return ptr;
    }

    get start(): number {
		let ptr: number = this.safetyCheck();
		if (ptr === 0x000000) {
            this.tptr = 0;
            this.safe = false;
        } else {
            this.tptr = ptr;
            this.safe = true;
        }

        return 0;
    }
    set start(val: number) {
		let ptr: number = this.safetyCheck();
		if (ptr === 0x000000) {
            this.tptr = 0;
            this.safe = false;
        } else {
            this.tptr = ptr;
            this.safe = true;
        }
    }

    get end(): number {
        this.tptr = 0;
        this.safe = false;
        return 0;
    }
    set end(val: number) {
        this.tptr = 0;
        this.safe = false;
    }

	subInstance(index: number): number {
		let ptr: number = this.tptr;
		if (ptr === 0x000000) return 0x000000;
		return this.emulator.dereferencePointer(ptr + index);
	}

    get anim(): Buffer {
        return this.player.animation;
    }
    set anim(val: Buffer) {
        if (!this.safe) return;
        let animIndex = this.emulator.rdramRead16(this.tptr + 0x8c);
        if (animIndex === 0) return;

        let animArr = this.emulator.dereferencePointer(this.animPtr);
        animArr += 4 + (0x3c * animIndex);

        let frame: number = val.readUInt32BE(0);
        let id: number = val.readUInt32BE(4);
        let um: number = val.readUInt16BE(8);

        this.emulator.memoryDebugLogger(true);
        this.emulator.rdramWrite32(animArr + 0x00, frame);
        this.emulator.rdramWrite32(animArr + 0x2c, id);
        this.emulator.rdramWrite16(animArr + 0x34, um);
        this.emulator.memoryDebugLogger(false);
    }

    get pos(): Buffer {
        return this.player.position;
    }
    set pos(val: Buffer) {
        if (!this.safe) return;
        this.emulator.rdramWriteBuffer(this.tptr + 0x4, val);
    }

    get rot(): Buffer {
        return this.player.rotation;
    }
    set rot(val: Buffer) {   
        if (!this.safe) return;     
        this.emulator.rdramWriteBuffer(this.tptr + 0x44, val);
    }

    get model(): number {
        return this.player.model_index;
    }
    set model(val: number) {
        if (!this.safe) return;
        let ptr: number = this.subInstance(0x00);
		if (ptr === 0) return;

        if (val === 0x0607) this.emulator.rdramWrite16(ptr + 0x14, 0x062b);
        else this.emulator.rdramWrite16(ptr + 0x14, val);
    }

    get visible(): Buffer {
        return this.emulator.rdramReadBuffer(this.myVisiblePtr, this.visibleSize);
    }
    set visible(val: Buffer) {
        if (!this.safe) return;
        this.emulator.rdramWriteBuffer(this.ptr_vis, val);
    }

    get y_flip(): boolean {
        return this.player.flip_facing;
    }
    set y_flip(val: boolean) {
        if (!this.safe) return;
        if (!val) return;
        
        let ptr: number = this.safetyCheck();
        if (ptr === 0x000000) return;
        
        let y = this.emulator.rdramReadF32(ptr + 0x48);
        y = (y + 180.0) % 360.0
        this.bufFloat.writeFloatBE(y, 0);
        this.emulator.rdramWriteBuffer(ptr + 0x48, this.bufFloat);
    }

    toJSON() {
        const jsonObj: any = {};

        for (let i = 0; i < this.copyFields.length; i++) {
            jsonObj[this.copyFields[i]] = (this as any)[this.copyFields[i]];
        }

        return jsonObj;
    }
}
