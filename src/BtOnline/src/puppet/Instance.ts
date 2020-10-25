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
    index: number;
    broken: boolean = false;

    tptr: number = 0;
    safe: boolean = false;

    constructor(emu: IMemory, ptr_cmd: number, ptr_vis: number,
                core: API.IBTCore, player: API.IPlayer, index: number) {
        super(emu);
        this.ptr_cmd = ptr_cmd;
        this.ptr_vis = ptr_vis;
        this.animPtr = global.ModLoader[API.AddressType.ANIM_ARRAY];
        this.busyPtr = global.ModLoader[API.AddressType.CMD_BUFFER];
        this.core = core;
        this.player = player;
        this.index = index;
        this.copyFields.push('start');
        this.copyFields.push('anim');
        this.copyFields.push('pos');
        this.copyFields.push('rot');
        this.copyFields.push('model');
        this.copyFields.push('visible');
        this.copyFields.push('arbdata');
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
            console.info("Puppet shuffled, respawning...");
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

        this.emulator.rdramWrite32(animArr + 0x00, frame);
        this.emulator.rdramWrite32(animArr + 0x2c, id);
        this.emulator.rdramWrite16(animArr + 0x34, um);
    }

    get pos(): Buffer {
        return this.player.position;
    }
    set pos(val: Buffer) {
        if (!this.safe) return;
        this.emulator.rdramWriteBuffer(this.tptr + 0x4, val);
        
        let cmdSlots = this.ptr_cmd - 4;
        let cmd = this.emulator.rdramRead32(cmdSlots);
        cmd &= 0xFFFEFFFF;
        this.emulator.rdramWrite32(cmdSlots, cmd);
    }

    get rot(): Buffer {
        let rot = this.player.rotation;
        rot.writeFloatBE(this.player.rot_y_angle(), 4);
        return rot;
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

    get arbdata(): Buffer {
        // Ptrs
        let addr  = 0xF01800;
        let clear = addr - 4;

        // Data
        let len = this.emulator.rdramRead16(addr) + 4; // +4 for subheader
        let buf = this.emulator.rdramReadBuffer(addr, len);

        // Clear buffer
        this.emulator.rdramWrite8(clear, 1);

        return buf;
    }

    set arbdata(buf: Buffer) {
        if (!this.safe)
            return;

        // Ptrs
        let addr    = 0xF04800;
        let lenaddr = addr - 4;

        // Get curr arbdata buffer length
        let len = this.emulator.rdramRead32(lenaddr);
        addr += len;
        if (addr >= 0xFFFFFF)
            return;

        // Update current arbdata buffer length
        this.emulator.rdramWrite32(lenaddr, len + buf.byteLength + 4); // +4 for header

        // Data
        this.emulator.rdramWriteBuffer(addr + 4, buf); // +4 for header
        this.emulator.rdramWrite8(addr + 0, this.index);

        // Sig (read trigger)
        this.emulator.rdramWrite16(addr + 2, 0x15E7);
    }

    toJSON() {
        const jsonObj: any = {};

        for (let i = 0; i < this.copyFields.length; i++) {
            jsonObj[this.copyFields[i]] = (this as any)[this.copyFields[i]];
        }

        return jsonObj;
    }
}
