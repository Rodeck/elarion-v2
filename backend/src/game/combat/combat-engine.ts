export interface Combatant {
  name: string;
  hp: number;
  attackPower: number;
  defence: number;
}

export interface CombatRound {
  roundNumber: number;
  attacker: 'player' | 'monster';
  attackerName: string;
  action: 'attack' | 'critical' | 'miss';
  damage: number;
  playerHpAfter: number;
  monsterHpAfter: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function runSimulation(
  player: Combatant,
  monster: Combatant,
): CombatRound[] {
  const rounds: CombatRound[] = [];

  let playerHp = player.hp;
  let monsterHp = monster.hp;
  let roundNumber = 1;
  let playerTurn = true; // player attacks first

  while (playerHp > 0 && monsterHp > 0) {
    const attacker = playerTurn ? player : monster;
    const defenderName = playerTurn ? monster.name : player.name;
    const attackerRole: 'player' | 'monster' = playerTurn ? 'player' : 'monster';

    const roll = Math.random();
    let action: 'attack' | 'critical' | 'miss';
    let damage: number;

    if (roll < 0.05) {
      // 5% miss
      action = 'miss';
      damage = 0;
    } else {
      const base = Math.max(1, attacker.attackPower - (playerTurn ? monster.defence : player.defence) + randInt(-3, 3));
      if (roll > 0.95) {
        // 5% crit (top 5% of remaining 95%)
        action = 'critical';
        damage = Math.round(base * 1.5);
      } else {
        action = 'attack';
        damage = base;
      }
    }

    if (playerTurn) {
      monsterHp = Math.max(0, monsterHp - damage);
    } else {
      playerHp = Math.max(0, playerHp - damage);
    }

    rounds.push({
      roundNumber,
      attacker: attackerRole,
      attackerName: attacker.name,
      action,
      damage,
      playerHpAfter: playerHp,
      monsterHpAfter: monsterHp,
    });

    void defenderName;
    roundNumber++;
    playerTurn = !playerTurn;
  }

  return rounds;
}
