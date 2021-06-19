import { IModLoaderAPI, IPlugin, IPluginServerConfig } from 'modloader64_api/IModLoaderAPI';
import { InjectCore } from 'modloader64_api/CoreInjection';
import { DiscordStatus } from 'modloader64_api/Discord';
import * as API from 'BanjoTooie/API/Imports';
import * as Hnd from './handlers/Imports';
import * as Net from './network/Imports';
import * as Puppet from './puppet/Imports';

export interface IConfig {
	print_events_level: boolean;
	print_events_scene: boolean;
	print_net_client: boolean;
	print_net_server: boolean;
	show_tracker: boolean;
	skip_intro: boolean;
}

export class BtOnline implements IPlugin, IPluginServerConfig {
	@InjectCore() core!: API.IBTCore;
	ModLoader = {} as IModLoaderAPI;
	name = 'BtOnline';

	cDB!: Net.DatabaseClient;
	pMgr!: Puppet.PuppetManager;

	Handle!: Hnd.BtOnline_Handlers;
	Client!: Hnd.BtOnline_Client
	Server!: Hnd.BtOnline_Server

	config!: IConfig;

	constructor() {
		// Construct sub-modules
		this.Handle = new Hnd.BtOnline_Handlers(this);
		this.Client = new Hnd.BtOnline_Client(this);
		this.Server = new Hnd.BtOnline_Server(this);
	}

	preinit(): void { this.pMgr = new Puppet.PuppetManager(); }

	init(): void {
		// Init config
		this.config = this.ModLoader.config.registerConfigCategory('BtOnline') as IConfig;
		this.ModLoader.config.setData('BtOnline', 'print_events_level', 'false');
		this.ModLoader.config.setData('BtOnline', 'print_events_scene', 'false');
		this.ModLoader.config.setData('BtOnline', 'print_net_client', 'false');
		this.ModLoader.config.setData('BtOnline', 'print_net_server', 'false');
		this.ModLoader.config.setData('BtOnline', 'show_tracker', 'true');
		this.ModLoader.config.setData('BtOnline', 'skip_intro', 'true');

		// Init sub-modules
		this.Handle.init();
		this.Client.init();
		this.Server.init();
	}

	postinit(): void {
		// Puppet Manager Inject
		this.pMgr.postinit(
			this.ModLoader.emulator,
			this.core,
			this.ModLoader.me,
			this.ModLoader
		);

		this.ModLoader.logger.info('Puppet manager activated.');

		// Show tracker
		//if (this.config.show_tracker) this.ModLoader.gui.openWindow(698, 795, __dirname + '/gui/Tracker.html');

		// Update discord
		let status: DiscordStatus = new DiscordStatus('Playing BtOnline', 'On the title screen [Team Select]');
		status.smallImageKey = 'bto';
		status.partyId = this.ModLoader.clientLobby;
		status.partyMax = 15;
		status.partySize = 1;
		this.ModLoader.gui.setDiscordStatus(status);
	}

	onTick(): void { this.Handle.tick(); }

	getServerURL(): string { return '158.69.60.101:8010'; }
}