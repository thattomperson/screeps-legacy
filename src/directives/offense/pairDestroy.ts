import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {PairDestroyerOverlord} from '../../overlords/offense/pairDestroyer';
import {CombatIntel} from '../../intel/CombatIntel';
import {log} from '../../console/log';

/**
 * Spawns a pair of attacker/healer creeps to siege a room
 */
@profile
export class DirectivePairDestroy extends Directive {

	static directiveName = 'destroy';
	static color = COLOR_RED;
	static secondaryColor = COLOR_CYAN;

	overlords: {
		destroy: PairDestroyerOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new PairDestroyerOverlord(this);
	}

	init(): void {
		this.alert(`Pair detroyer directive active`);
	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Pair destroyer mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		let fallback = CombatIntel.getFallbackFrom(this.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
