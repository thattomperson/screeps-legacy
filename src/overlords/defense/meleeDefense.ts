import {OverlordPriority} from '../../priorities/priorities_overlords';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/CombatIntel';
import {CreepSetup} from '../../creepSetups/CreepSetup';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord} from '../CombatOverlord';
import {CombatSetups, Roles} from '../../creepSetups/setups';

/**
 * Spawns melee defenders to defend against incoming player invasions in an owned room
 */
@profile
export class MeleeDefenseOverlord extends CombatOverlord {

	zerglings: CombatZerg[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.75,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		super(directive, 'meleeDefense', priority, 1);
		this.zerglings = this.combatZerg(Roles.melee, {
			boostWishlist: boosted ? [boostResources.tough[3], boostResources.attack[3], boostResources.move[3]]
								   : undefined
		});
	}

	private handleDefender(zergling: CombatZerg): void {
		if (zergling.room.hostiles.length > 0) {
			zergling.autoCombat(zergling.room.name);
		}
	}

	private computeNeededZerglingAmount(setup: CreepSetup, boostMultiplier: number): number {
		let healAmount = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		let zerglingDamage = ATTACK_POWER * boostMultiplier * setup.getBodyPotential(ATTACK, this.colony);
		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		let worstDamageMultiplier = _.min(_.map(this.room.hostiles,
												creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
		return Math.ceil(.5 + 1.5 * healAmount / (worstDamageMultiplier * (zerglingDamage + towerDamage + 1)));
	}

	init() {
		this.reassignIdleCreeps(Roles.melee);
		if (this.canBoostSetup(CombatSetups.zerglings.boosted_T3_defense)) {
			let setup = CombatSetups.zerglings.boosted_T3_defense;
			this.wishlist(this.computeNeededZerglingAmount(setup, BOOSTS.attack.XUH2O.attack), setup);
		} else {
			let setup = CombatSetups.zerglings.default;
			this.wishlist(this.computeNeededZerglingAmount(setup, 1), setup);
		}
	}

	run() {
		this.autoRun(this.zerglings, zergling => this.handleDefender(zergling));
	}
}
