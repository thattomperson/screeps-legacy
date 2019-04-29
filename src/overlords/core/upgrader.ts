import {Overlord} from '../Overlord';
import {UpgradeSite} from '../../hiveClusters/upgradeSite';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {boostResources} from '../../resources/map_resources';
import {Roles, Setups} from '../../creepSetups/setups';

/**
 * Spawns an upgrader to upgrade the room controller
 */
@profile
export class UpgradingOverlord extends Overlord {

	upgradersNeeded: number;
	upgraders: Zerg[];
	upgradeSite: UpgradeSite;
	settings: { [property: string]: number };
	room: Room;	//  Operates in owned room

	constructor(upgradeSite: UpgradeSite, priority = OverlordPriority.upgrading.upgrade) {
		super(upgradeSite, 'upgrade', priority);
		this.upgradeSite = upgradeSite;
		this.upgraders = this.zerg(Roles.upgrader, {
			boostWishlist: [boostResources.upgrade[3]]
		});
	}

	init() {
		if (this.colony.level < 3) { // can't spawn upgraders at early levels
			return;
		}
		if (this.colony.assets[RESOURCE_ENERGY] > UpgradeSite.settings.storageBuffer
			|| this.upgradeSite.controller.ticksToDowngrade < 500) {
			const setup = this.colony.level == 8 ? Setups.upgraders.rcl8 : Setups.upgraders.default;
			if (this.colony.level == 8) {
				this.wishlist(1, setup);
			} else {
				const upgradePowerEach = setup.getBodyPotential(WORK, this.colony);
				const upgradersNeeded = Math.ceil(this.upgradeSite.upgradePowerNeeded / upgradePowerEach);
				this.wishlist(upgradersNeeded, setup);
			}
		}
	}

	private handleUpgrader(upgrader: Zerg): void {
		if (upgrader.carry.energy > 0) {
			// Repair link
			if (this.upgradeSite.link && this.upgradeSite.link.hits < this.upgradeSite.link.hitsMax) {
				upgrader.task = Tasks.repair(this.upgradeSite.link);
				return;
			}
			// Repair container
			if (this.upgradeSite.battery && this.upgradeSite.battery.hits < this.upgradeSite.battery.hitsMax) {
				upgrader.task = Tasks.repair(this.upgradeSite.battery);
				return;
			}
			// Build construction site
			const inputSite = this.upgradeSite.findInputConstructionSite();
			if (inputSite) {
				upgrader.task = Tasks.build(inputSite);
				return;
			}
			// Sign controller if needed
			if (!this.upgradeSite.controller.signedByMe &&
				!this.upgradeSite.controller.signedByScreeps) {
				upgrader.task = Tasks.signController(this.upgradeSite.controller);
				return;
			}
			upgrader.task = Tasks.upgrade(this.upgradeSite.controller);
		} else {
			// Recharge from link or battery
			if (this.upgradeSite.link && this.upgradeSite.link.energy > 0) {
				upgrader.task = Tasks.withdraw(this.upgradeSite.link);
			} else if (this.upgradeSite.battery && this.upgradeSite.battery.energy > 0) {
				upgrader.task = Tasks.withdraw(this.upgradeSite.battery);
			}
			// Find somewhere else to recharge from
			else { // TODO: BUG HERE IF NO UPGRADE CONTAINER
				if (this.upgradeSite.battery && this.upgradeSite.battery.targetedBy.length == 0) {
					upgrader.task = Tasks.recharge();
				}
			}
		}
	}

	run() {
		this.autoRun(this.upgraders, upgrader => this.handleUpgrader(upgrader));
	}
}
