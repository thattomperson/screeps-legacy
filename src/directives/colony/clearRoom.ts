import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {MY_USERNAME} from '../../~settings';
import {log} from '../../console/log';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';


/**
 * Claims a new room, destroys all structures in the room, then unclaims it
 */
@profile
export class DirectiveClearRoom extends Directive {

	static directiveName = 'clearRoom';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_ORANGE;

	overlords: {
		claim: ClaimingOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 3);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
	}

	spawnMoarOverlords() {
		this.overlords.claim = new ClaimingOverlord(this);
	}

	init() {
		this.alert(`Clearing out room`);
	}

	private removeAllStructures(): boolean {

		let keepStorageStructures = this.memory.keepStorageStructures !== undefined
									? this.memory.keepStorageStructures : true;
		let keepRoads = this.memory.keepRoads !== undefined ? this.memory.keepRoads : true;
		let keepContainers = this.memory.keepContainers !== undefined ? this.memory.keepContainers : true;

		if (this.room) {
			let allStructures = this.room.find(FIND_STRUCTURES);
			let i = 0;
			for (let s of allStructures) {
				if (s.structureType == STRUCTURE_CONTROLLER) continue;
				if (keepStorageStructures &&
					(s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TERMINAL)) {
					continue;
				}
				if (keepRoads && s.structureType == STRUCTURE_ROAD) {
					continue;
				}
				if (keepContainers && s.structureType == STRUCTURE_CONTAINER) {
					continue;
				}
				let result = s.destroy();
				if (result == OK) {
					i++;
				}
			}
			log.alert(`Destroyed ${i} structures in ${this.room.print}.`);
			return true;
		} else {
			return false;
		}

	}

	run() {
		// Remove if structures are done
		if (this.room && this.room.my) {
			let done = this.removeAllStructures();
			if (done) {
				this.room.controller!.unclaim();
				log.notify(`Removing clearRoom directive in ${this.pos.roomName}: operation completed.`);
				this.remove();
			}
		}

		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing clearRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}
