import { EventHandler, EventsServer, EventServerJoined, EventServerLeft } from 'modloader64_api/EventHandler';
import { IModLoaderAPI } from 'modloader64_api/IModLoaderAPI';
import { ServerNetworkHandler } from 'modloader64_api/NetworkHandler';
import { Packet } from 'modloader64_api/ModLoaderDefaultImpls';
import { BtOnline_Handlers } from './Handlers';
import * as Main from '../Main';
import * as API from 'BanjoTooie/API/Imports';
import * as Net from '../network/Imports';

export class BtOnline_Server {
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
        if (this.parent.config.print_net_server)
            this.modloader.logger.info('[Server] ' + input);
    }

    sDB(lobby: string): Net.DatabaseServer {
        return this.modloader.lobbyManager.getLobbyStorage(lobby, this.parent);
    }

    // #################################################
    // ##  Primary Events
    // #################################################

    @EventHandler(EventsServer.ON_LOBBY_CREATE)
    onServer_LobbyCreate(lobby: string) {
        this.modloader.lobbyManager.createLobbyStorage(
            lobby,
            this.parent,
            new Net.DatabaseServer()
        );
    }

    @EventHandler(EventsServer.ON_LOBBY_JOIN)
    onServer_LobbyJoin(evt: EventServerJoined) {
        let sDB = this.sDB(evt.lobby);
        sDB.players[evt.player.uuid] = -1;
        sDB.playerInstances[evt.player.uuid] = evt.player;
    }

    @EventHandler(EventsServer.ON_LOBBY_LEAVE)
    onServer_LobbyLeave(evt: EventServerLeft) {
        let sDB = this.sDB(evt.lobby);
        delete sDB.players[evt.player.uuid];
        delete sDB.playerInstances[evt.player.uuid];
    }

    // #################################################
    // ##  Server Receive Packets
    // #################################################

    @ServerNetworkHandler('Request_Storage')
    onServer_RequestStorage(packet: Packet): void {
        this.log('Sending: {Lobby Storage}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        let pData = new Net.SyncStorage(
            packet.lobby,
            sDB.file
        );
        this.modloader.serverSide.sendPacketToSpecificPlayer(pData, packet.player);
    }

    @ServerNetworkHandler('SyncGameFlags')
    onServer_SyncGameFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Game Flags}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        // Detect Changes
        if (!this.handlers.merge_bits(sDB.file[packet.team].flagsGame, packet.value)) return;

        let pData = new Net.SyncBuffered(packet.lobby, 'SyncGameFlags', packet.team, sDB.file[packet.team].flagsGame, true);
        this.modloader.serverSide.sendPacket(pData);

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Game Flags}');
    }

    @ServerNetworkHandler('SyncGlobalFlags')
    onServer_SyncGlobalFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Global Flags}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        // Detect Changes
        if (!this.handlers.merge_bits(sDB.file[packet.team].flagsGame, packet.value)) return;

        let pData = new Net.SyncBuffered(packet.lobby, 'SyncGlobalFlags', packet.team, sDB.file[packet.team].flagsGame, true);
        this.modloader.serverSide.sendPacket(pData);

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Global Flags}');
    }

    @ServerNetworkHandler('SyncJiggyChallenge')
    onServer_SyncJiggyChallenge(packet: Net.SyncNumbered) {
        this.log('Received: {Jiggy Wiggy Challenge}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        if (sDB.file[packet.team].curJiggyChallenge <= packet.value) return;
        sDB.file[packet.team].curJiggyChallenge |= packet.value;

        let pData = new Net.SyncNumbered(
            packet.lobby,
            'SyncJiggyChallenge',
            packet.team,
            sDB.file[packet.team].curJiggyChallenge,
            true
        );
        this.modloader.serverSide.sendPacket(pData);

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Jiggy Wiggy Challenge}');
    }

    @ServerNetworkHandler('SyncHealthUpgrades')
    onServer_SyncHealthUpgrades(packet: Net.SyncNumbered) {
        this.log('Received: {Health Upgrades}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        if (sDB.file[packet.team].healthUpgrade <= packet.value) return;
        sDB.file[packet.team].healthUpgrade |= packet.value;

        let pData = new Net.SyncNumbered(
            packet.lobby,
            'SyncHealthUpgrades',
            packet.team,
            sDB.file[packet.team].healthUpgrade,
            true
        );
        this.modloader.serverSide.sendPacket(pData);

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Health Upgrades}');
    }

    @ServerNetworkHandler('SyncJinjoFlags')
    onServer_SyncJinjoFlags(packet: Net.SyncBuffered) {
        this.log('Received: {Jinjo Flags}');
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        // Mark jinjos as set for the rest of the game
        sDB.file[packet.team].jinjosSet = true;

        // Detect Changes
        if (!this.handlers.merge_bits(sDB.file[packet.team].flagsJinjos, packet.value)) return;

        let pData = new Net.SyncBuffered(packet.lobby, 'SyncJinjoFlags', packet.team, sDB.file[packet.team].flagsJinjos, true);
        this.modloader.serverSide.sendPacket(pData);

        this.log('Updated Team[' + API.ProfileType[packet.team] + ']: {Jinjo Flags}');
    }

    // Puppet Tracking

    @ServerNetworkHandler('SyncLocation')
    onServer_SyncLocation(packet: Net.SyncLocation) {
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        let pMsg = 'Player[' + packet.player.nickname + ']';
        let sMsg = 'Scene[' +packet.scene + ']';
        sDB.players[packet.player.uuid] = packet.scene;
        this.log('Received: {Player Scene}');
        this.log('Updated: ' + pMsg + ' to ' + sMsg);
    }

    @ServerNetworkHandler('SyncPuppet')
    onServer_SyncPuppet(packet: Net.SyncPuppet) {
        let sDB = this.sDB(packet.lobby);
        if (sDB === null) return;

        Object.keys(sDB.players).forEach((key: string) => {
            if (sDB.players[key] !== sDB.players[packet.player.uuid]) {
                return;
            }

            if (!sDB.playerInstances.hasOwnProperty(key)) return;
            if (sDB.playerInstances[key].uuid === packet.player.uuid) {
                return;
            }

            this.modloader.serverSide.sendPacketToSpecificPlayer(
                packet,
                sDB.playerInstances[key]
            );
        });
    }
}