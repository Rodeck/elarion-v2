// Message payload validators for all registered client→server message types.
// validateMessage() is called by the dispatcher before routing to handlers.

type FieldType = 'string' | 'number' | 'boolean';

interface FieldSpec {
  type: FieldType;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  enumValues?: string[];
}

type Schema = Record<string, FieldSpec>;

const schemas: Record<string, Schema> = {
  'auth.register': {
    username: { type: 'string', required: true, minLength: 3, maxLength: 32 },
    password: { type: 'string', required: true, minLength: 8 },
  },
  'auth.login': {
    username: { type: 'string', required: true },
    password: { type: 'string', required: true },
  },
  'character.create': {
    name: { type: 'string', required: true, minLength: 3, maxLength: 32 },
    class_id: { type: 'number', required: true },
  },
  'player.move': {
    direction: { type: 'string', required: true, enumValues: ['n', 's', 'e', 'w'] },
  },
  'combat.start': {
    monster_instance_id: { type: 'string', required: true, minLength: 36, maxLength: 36 },
  },
  'chat.send': {
    channel: { type: 'string', required: true, enumValues: ['local', 'global'] },
    message: { type: 'string', required: true, minLength: 1, maxLength: 256 },
  },
  'city.move': {
    target_node_id: { type: 'number', required: true },
  },
  'expedition.dispatch': {
    building_id: { type: 'number', required: true },
    action_id: { type: 'number', required: true },
    duration_hours: { type: 'number', required: true },
  },
  'expedition.collect': {
    expedition_id: { type: 'number', required: true },
  },
  'equipment.equip': {
    slot_id:   { type: 'number', required: true },
    slot_name: { type: 'string', required: true, enumValues: ['helmet', 'chestplate', 'left_arm', 'right_arm', 'greaves', 'bracer', 'boots'] },
  },
  'equipment.unequip': {
    slot_name: { type: 'string', required: true, enumValues: ['helmet', 'chestplate', 'left_arm', 'right_arm', 'greaves', 'bracer', 'boots'] },
  },
  'combat:trigger_active': {
    combat_id: { type: 'string', required: true, minLength: 36, maxLength: 36 },
  },
  'loadout:update': {
    slot_name: { type: 'string', required: true, enumValues: ['auto_1', 'auto_2', 'auto_3', 'active'] },
    // ability_id and priority are optional numbers — no strict schema rule here;
    // handler performs all semantic validation
  },
  'crafting.open': {
    npc_id: { type: 'number', required: true },
  },
  'crafting.start': {
    npc_id: { type: 'number', required: true },
    recipe_id: { type: 'number', required: true },
    quantity: { type: 'number', required: true },
  },
  'crafting.cancel': {
    session_id: { type: 'number', required: true },
  },
  'crafting.collect': {
    session_id: { type: 'number', required: true },
  },
  'gathering.start': {
    building_id: { type: 'number', required: true },
    action_id: { type: 'number', required: true },
    duration: { type: 'number', required: true },
  },
  'gathering.cancel': {},
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMessage(type: string, payload: unknown): ValidationResult {
  const schema = schemas[type];

  // Unknown types pass through (will be rejected by dispatcher as unregistered)
  if (!schema) return { valid: true };

  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be a JSON object.' };
  }

  const obj = payload as Record<string, unknown>;

  for (const [field, spec] of Object.entries(schema)) {
    const value = obj[field];

    if (spec.required && (value === undefined || value === null)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }

    if (value !== undefined && value !== null) {
      if (typeof value !== spec.type) {
        return { valid: false, error: `Field "${field}" must be a ${spec.type}.` };
      }

      if (spec.type === 'string') {
        const str = value as string;
        if (spec.minLength !== undefined && str.length < spec.minLength) {
          return { valid: false, error: `Field "${field}" is too short (min ${spec.minLength} chars).` };
        }
        if (spec.maxLength !== undefined && str.length > spec.maxLength) {
          return { valid: false, error: `Field "${field}" is too long (max ${spec.maxLength} chars).` };
        }
        if (spec.enumValues && !spec.enumValues.includes(str)) {
          return { valid: false, error: `Field "${field}" must be one of: ${spec.enumValues.join(', ')}.` };
        }
      }
    }
  }

  return { valid: true };
}
