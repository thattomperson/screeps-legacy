import {Directive} from '../Directive';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {BootstrappingOverlord} from '../../overlords/situational/bootstrap';
import {Colony} from '../../Colony';
import {Roles} from '../../creepSetups/setups';
import {NotifierPriority} from '../Notifier';

/**
 * Bootstrapping directive: recover from a colony-wide crash or bootstrap from initial spawn-in
 */
@profile
export class DirectiveBootstrap extends Directive {

	static directiveName = 'bootstrap';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_ORANGE;

	colony: Colony; 					// Emergency flag definitely has a colony
	room: Room;							// Definitely has a room
	private needsMiner: boolean;		// Whether a miner needs to be spawned
	private needsManager: boolean;		// Whether a manager needs to be spawned
	private needsQueen: boolean;		// Whether a supplier needs to be spawned

	constructor(flag: Flag) {
		super(flag);
		this.refresh(); // data needs to be recomputed each tick
	}

	refresh() {
		super.refresh();
		this.colony.bootstrapping = true;
		this.needsMiner = (this.colony.getCreepsByRole(Roles.drone).length == 0);
		this.needsManager = (this.colony.commandCenter != undefined &&
							 this.colony.commandCenter.overlord != undefined &&
							 this.colony.getCreepsByRole(Roles.manager).length == 0);
		this.needsQueen = (this.colony.getCreepsByRole(Roles.queen).length == 0);
	}

	spawnMoarOverlords() {
		this.overlords.bootstrap = new BootstrappingOverlord(this);
	}

	init(): void {
		this.alert(`Colony in bootstrap mode!`, NotifierPriority.High);
		if (Game.time % 100 == 0) {
			log.alert(`Colony ${this.room.print} is in emergency recovery mode.`);
		}
	}

	run(): void {
		if (!this.needsQueen && !this.needsMiner && !this.needsManager) {
			log.alert(`Colony ${this.room.print} has recovered from crash; removing bootstrap directive.`);
			// Suicide any fillers so they don't get in the way
			let overlord = this.overlords.bootstrap as BootstrappingOverlord;
			for (let filler of overlord.fillers) {
				filler.suicide();
			}
			// Remove the directive
			this.remove();
		}
	}
}
