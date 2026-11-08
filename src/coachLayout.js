/*
 * How each class's seats sit in a real coach (same numbering as the backend's CoachLayout.java).
 *
 * A coach is a list of compartments (berth classes) or rows (chair cars). Each has a `left` part
 * and a `right` part with the aisle between them; each part is a list of rows of seat numbers.
 *
 *   Sleeper / AC 3 tier (6 + 2)      AC 2 tier (4 + 2)      AC chair car (3 + 2)
 *   [1 2 3]          [7]             [1 2]       [5]        [1 2 3]  aisle  [4 5]
 *   [4 5 6]  aisle   [8]             [3 4] aisle [6]
 */

const BERTH_CLASSES = ['SLEEPER_CLASS', 'AC3_TIER', 'AC3_ECONOMY', 'AC2_TIER', 'AC1_TIER'];

export const LAYOUT_NAMES = {
  SLEEPER_CLASS: '6 + 2 berths per compartment',
  AC3_TIER: '6 + 2 berths per compartment',
  AC3_ECONOMY: '6 + 3 berths per compartment',
  AC2_TIER: '4 + 2 berths per compartment',
  AC1_TIER: 'Cabins of 4 berths, corridor on one side',
  SECOND_CLASS: '3 + 3 seats per row',
  AC_CHAIR_CAR: '3 + 2 seats per row',
  EXECUTIVE_CHAIR_CAR: '2 + 2 seats per row',
};

const range = (from, n, max) => Array.from({ length: n }, (_, i) => from + i).filter((x) => x <= max);

/** One compartment / row starting after seat number `b` */
function unit(type, b, max) {
  switch (type) {
    case 'SLEEPER_CLASS':
    case 'AC3_TIER':
      return { left: [range(b + 1, 3, max), range(b + 4, 3, max)], right: [range(b + 7, 1, max), range(b + 8, 1, max)] };
    case 'AC3_ECONOMY':
      return {
        left: [range(b + 1, 3, max), range(b + 4, 3, max)],
        right: [range(b + 7, 1, max), range(b + 8, 1, max), range(b + 9, 1, max)],
      };
    case 'AC2_TIER':
      return { left: [range(b + 1, 2, max), range(b + 3, 2, max)], right: [range(b + 5, 1, max), range(b + 6, 1, max)] };
    case 'AC1_TIER':
      return { left: [range(b + 1, 2, max), range(b + 3, 2, max)], right: [], cabin: true };
    case 'SECOND_CLASS':
      return { left: [range(b + 1, 3, max)], right: [range(b + 4, 3, max)] };
    case 'AC_CHAIR_CAR':
      return { left: [range(b + 1, 3, max)], right: [range(b + 4, 2, max)] };
    case 'EXECUTIVE_CHAIR_CAR':
      return { left: [range(b + 1, 2, max)], right: [range(b + 3, 2, max)] };
    default:
      return { left: [range(b + 1, 8, max)], right: [] };
  }
}

const UNIT_SIZE = {
  SLEEPER_CLASS: 8,
  AC3_TIER: 8,
  AC3_ECONOMY: 9,
  AC2_TIER: 6,
  AC1_TIER: 4,
  SECOND_CLASS: 6,
  AC_CHAIR_CAR: 5,
  EXECUTIVE_CHAIR_CAR: 4,
};

/** Compartments (or rows) of a coach with `seats` seats, front to back */
export function coachUnits(type, seats) {
  const size = UNIT_SIZE[type] || 8;
  const out = [];
  for (let b = 0; b < seats; b += size) {
    const u = unit(type, b, seats);
    u.left = u.left.filter((r) => r.length);
    u.right = u.right.filter((r) => r.length);
    u.no = out.length + 1;
    out.push(u);
  }
  return out;
}

export const isBerthClass = (type) => BERTH_CLASSES.includes(type);

/** Short berth / seat label shown on a tile */
export const BERTH_SHORT = {
  LOWER: 'LB',
  MIDDLE: 'MB',
  UPPER: 'UB',
  SIDE_LOWER: 'SL',
  SIDE_MIDDLE: 'SM',
  SIDE_UPPER: 'SU',
  WINDOW: 'W',
  MIDDLE_SEAT: 'M',
  AISLE: 'A',
};

/** Berth type of a seat number (same rules as CoachLayout.berthType on the server) */
export function berthTypeOf(type, n) {
  switch (type) {
    case 'SLEEPER_CLASS':
    case 'AC3_TIER':
      return ['LOWER', 'MIDDLE', 'UPPER', 'LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'][(n - 1) % 8];
    case 'AC3_ECONOMY':
      return ['LOWER', 'MIDDLE', 'UPPER', 'LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_MIDDLE', 'SIDE_UPPER'][(n - 1) % 9];
    case 'AC2_TIER':
      return ['LOWER', 'UPPER', 'LOWER', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'][(n - 1) % 6];
    case 'AC1_TIER':
      return n % 2 === 1 ? 'LOWER' : 'UPPER';
    case 'SECOND_CLASS':
      return ['WINDOW', 'MIDDLE_SEAT', 'AISLE', 'AISLE', 'MIDDLE_SEAT', 'WINDOW'][(n - 1) % 6];
    case 'AC_CHAIR_CAR':
      return ['WINDOW', 'MIDDLE_SEAT', 'AISLE', 'AISLE', 'WINDOW'][(n - 1) % 5];
    case 'EXECUTIVE_CHAIR_CAR':
      return ['WINDOW', 'AISLE', 'AISLE', 'WINDOW'][(n - 1) % 4];
    default:
      return '';
  }
}
