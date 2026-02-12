# Crafting & Items

Creatures autonomously craft equipment and potions from gathered materials.

## Recipes

| Recipe | Slot | Materials | Stat Bonus | Duration | Energy Cost | Durability |
|--------|------|-----------|-----------|----------|-------------|------------|
| Stone Blade | weapon | 1 wood, 2 stone | +8 ATK | 15-20s | 15 | 50 |
| Wooden Shield | armor | 2 wood | +15 Max HP | 20-25s | 20 | 40 |
| Healing Potion | consumable | 2 herb | +40 HP | 10-12s | 8 | N/A |

## Crafting Constants

```
CRAFT_COOLDOWN = 4    // Seconds between crafts
EQUIP_DELAY    = 2    // Seconds after crafting before auto-equip
```

## Recipe Selection

`chooseCraftRecipe()` picks the best recipe based on context:

1. **Hurt (HP < 70%)**: Healing Potion highest priority
2. **No equipment**: Weapon > Armor
3. **Personality fierce/bold**: Weapon preference
4. **Personality timid/gentle**: Armor preference
5. **Missing materials**: Skip recipe

## Crafting Sequence

1. **Validation**:
   - Has all required materials
   - Has enough energy (>= 25)
   - Inventory has space (net: -materials + 1 result)
   - Not currently doing other activities (sleep, eat, gather, seek)
   - Cooldown expired

2. **Start Craft**:
   - Consume materials from inventory
   - Consume energy cost
   - Set `crafting = true`
   - Start craft timer (randomized within recipe range)
   - Creature cannot move, gather, or eat

3. **During Craft**:
   - Timer counts down
   - Can be interrupted by combat
   - Visual: crafting state shown in UI

4. **Completion**:
   - Add crafted item to inventory
   - Set `justCrafted = { recipe }` flag for visual feedback
   - Start equip delay (2 seconds)
   - Reset decision engine (`_gatherGoal = null`)

## Auto-Equip

Runs 2 seconds after crafting completes (so the crafted item icon is visible briefly):

- Scans inventory for equipment items
- Equips to empty weapon/armor slots
- Replaces equipped item only if:
  - New item has strictly higher stats, OR
  - Current item durability < 5% (nearly broken)
- Same-ID duplicates stay in inventory (no double-equip)

## Equipment Durability

- **Stone Blade**: 50 durability (decreases by 1 per combat hit dealt)
- **Wooden Shield**: 40 durability (decreases by 1 per combat hit received)
- When durability reaches 0: equipment breaks, removed from slot
- Low durability (< 30%): scoring system boosts replacement material value by 1.3x

## Healing Potion Auto-Use

Potions are used automatically when hurt:

- **Trigger**: HP < 50% of maxHp
- **Search**: Scan inventory backwards for healing potion
- **Duration**: 3-4 seconds to drink
- **Healing**: Gradual over drink duration (+40 HP total)
- **Interruption**: Combat interrupts drinking (potion wasted)
- **Blocking**: Cannot drink while sleeping
- **Flag**: `justUsedPotion = { healAmount }` for visual feedback
- **State**: `drinkingPotion = true` during drink animation

## Crafting Interruption

### By Combat
- Return 50% of energy cost
- Return ALL materials to inventory
- No item created
- Creature enters combat immediately

### By Sleep
- Same as combat interruption
- Materials returned, energy partially refunded

## Crafting Blockers

Cannot start a new craft when:
- Already crafting
- Sleeping, eating, gathering
- Seeking food or resources
- Energy < 25
- Inventory < 2 items
- Cooldown active (4 seconds)
- Scared state active
