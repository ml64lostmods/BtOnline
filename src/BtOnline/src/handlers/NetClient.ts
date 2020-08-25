import { EventHandler, EventsClient } from 'modloader64_api/EventHandler';
import { IModLoaderAPI } from 'modloader64_api/IModLoaderAPI';
import { LobbyData, NetworkHandler, INetworkPlayer } from 'modloader64_api/NetworkHandler';
import { Packet } from 'modloader64_api/ModLoaderDefaultImpls';
import { BtOnline_Handlers } from './Handlers';
import * as Main from '../Main';
import * as API from 'BanjoTooie/API/Imports';
import * as Net from '../network/Imports';

export class BtOnline_Client {
    private parent!: Main.BtOnline;

    get core(): API.IBTCore { return this.parent.core; }
    get modloader(): IModLoaderAPI { return this.parent.ModLoader; }
    get handlers(): BtOnline_Handlers { return this.parent.Handle; }

    constructor(parent: Main.BtOnline) { this.parent = parent; }

    init() { }

    // #################################################
    // ##  Utility Functions
    // #################################################

    log(input: string) {
        if (this.parent.config.print_net_client)
            this.modloader.logger.info('[Client] ' + input);
    }

    // #################################################
    // ##  Primary Events
    // #################################################

    @EventHandler(EventsClient.ON_INJECT_FINISHED)
    onClient_InjectFinished(evt: any) {
        if (this.parent.config.skip_intro)
            this.core.runtime.goto_scene(0x0158);
    }

    @EventHandler(EventsClient.ON_LOBBY_JOIN)
    onClient_LobbyJoin(lobby: LobbyData): void {
        this.parent.cDB = new Net.DatabaseClient();
        let pData = new Packet('Request_Storage', 'BtOnline', this.modloader.clientLobby, false);
        this.modloader.clientSide.sendPacket(pData);
    }

    @EventHandler(EventsClient.ON_SERVER_CONNECTION)
    onClient_ServerConnection(evt: any) {
        this.parent.pMgr.reset();
        if (this.core.runtime === undefined || !this.core.isPlaying) return;
        let pData = new Net.SyncLocation(
            this.modloader.clientLobby,
            this.parent.cDB.team,
            this.parent.cDB.curScn
        );
        this.modloader.clientSide.sendPacket(pData);
    }

    @EventHandler(EventsClient.ON_PLAYER_JOIN)
    onClient_PlayerJoin(nplayer: INetworkPlayer) {
        this.parent.pMgr.registerPuppet(nplayer);
    }

    @EventHandler(EventsClient.ON_PLAYER_LEAVE)
    onClient_PlayerLeave(nplayer: INetworkPlayer) {
        this.parent.pMgr.unregisterPuppet(nplayer);
    }

    // #################################################
    // ##  Client Receive Packets
    // #################################################

    @NetworkHandler('SyncStorage')
    onClient_SyncStorage(packet: Net.SyncStorage): void {
        this.log('Received: {Lobby Storage}');
        this.parent.cDB.file = packet.file;
    }

    @NetworkHandler('SyncGameFlags')
    onClient_SyncGameFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Game Flags}');

        // Detect Changes
        if (!this.handlers.merge_bits(this.parent.cDB.file[packet.team].flagsGame, packet.value)) return;

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Game Flags}');
    }

    @NetworkHandler('SyncGlobalFlags')
    onClient_SyncGlobalFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Global Flags}');

        // Detect Changes
        if (!this.handlers.merge_bits(this.parent.cDB.file[packet.team].flagsGlobal, packet.value)) return;

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Global Flags}');
    }

    @NetworkHandler('SyncJiggyChallenge')
    onClient_SyncJiggyChallenge(packet: Net.SyncNumbered) {
        this.log('Received: {Jiggy Wiggy Challenge}');

        // Detect Changes
        if (this.parent.cDB.file[packet.team].curJiggyChallenge <= packet.value) return;
        this.parent.cDB.file[packet.team].curJiggyChallenge |= packet.value;

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Jiggy Wiggy Challenge}');
    }

    @NetworkHandler('SyncHealthUpgrades')
    onClient_SyncHealthUpgrades(packet: Net.SyncNumbered) {
        this.log('Received: {Health Upgrades}');

        // Detect Changes
        if (this.parent.cDB.file[packet.team].healthUpgrade <= packet.value) return;
        this.parent.cDB.file[packet.team].healthUpgrade |= packet.value;

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Health Upgrades}');
    }

    @NetworkHandler('SyncJinjoFlags')
    onClient_SyncJinjoFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Jinjo Flags}');

        // Mark jinjos as set for the rest of the game
        this.parent.cDB.file[packet.team].jinjosSet = true;

        // Detect Changes
        if (!this.handlers.merge_bits(this.parent.cDB.file[packet.team].flagsJinjos, packet.value)) return;

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Jinjo Flags}');
    }

    // Puppet Tracking

    @NetworkHandler('Request_Scene')
    onClient_RequestScene(packet: Packet) {
        let scene = -1;

        if (!(this.core.runtime === undefined || !this.core.isPlaying)) {
            scene = this.parent.cDB.curScn;
        }

        let pData = new Net.SyncLocation(packet.lobby, this.parent.cDB.team, scene);
        this.modloader.clientSide.sendPacketToSpecificPlayer(pData, packet.player);
    }

    @NetworkHandler('SyncLocation')
    onClient_SyncLocation(packet: Net.SyncLocation) {
        let pMsg = 'Player[' + packet.player.nickname + ']';
        let sMsg = 'Scene[' + packet.scene + ']';
        this.parent.pMgr.changePuppetScene(packet.player, packet.scene);
        this.log('Received: {Player Scene}');
        this.log('Updated: ' + pMsg + ' to ' + sMsg);
    }

    @NetworkHandler('SyncPuppet')
    onClient_SyncPuppet(packet: Net.SyncPuppet) {
        this.parent.pMgr.handlePuppet(packet);
    }
}