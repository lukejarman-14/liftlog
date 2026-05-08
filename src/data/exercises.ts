import { Exercise } from '../types';

export const DEFAULT_EXERCISES: Exercise[] = [
  // Chest
  { id: 'bench-press', suggestedRir: 2, name: 'Bench Press', category: 'Chest', defaultRestSeconds: 180, muscleGroups: ['Pectorals', 'Triceps', 'Front Delts'] },
  { id: 'incline-bench', suggestedRir: 2, name: 'Incline Bench Press', category: 'Chest', defaultRestSeconds: 180, muscleGroups: ['Upper Pectorals', 'Triceps'] },
  { id: 'decline-bench', suggestedRir: 2, name: 'Decline Bench Press', category: 'Chest', defaultRestSeconds: 180, muscleGroups: ['Lower Pectorals', 'Triceps'] },
  { id: 'db-fly', name: 'Dumbbell Fly', category: 'Chest', defaultRestSeconds: 90, muscleGroups: ['Pectorals'] },
  { id: 'cable-crossover', name: 'Cable Crossover', category: 'Chest', defaultRestSeconds: 60, muscleGroups: ['Pectorals'] },
  { id: 'push-up', name: 'Push Up', category: 'Chest', defaultRestSeconds: 60, muscleGroups: ['Pectorals', 'Triceps'] },
  { id: 'chest-dip', name: 'Chest Dip', category: 'Chest', defaultRestSeconds: 90, muscleGroups: ['Pectorals', 'Triceps'] },

  // Back
  { id: 'deadlift', suggestedRir: 1, name: 'Deadlift', category: 'Back', defaultRestSeconds: 240, muscleGroups: ['Erectors', 'Glutes', 'Hamstrings', 'Traps'] },
  { id: 'pull-up', suggestedRir: 2, name: 'Pull Up', category: 'Back', defaultRestSeconds: 120, muscleGroups: ['Lats', 'Biceps'] },
  { id: 'chin-up', suggestedRir: 2, name: 'Chin Up', category: 'Back', defaultRestSeconds: 120, muscleGroups: ['Lats', 'Biceps'] },
  { id: 'barbell-row', suggestedRir: 2, name: 'Barbell Row', category: 'Back', defaultRestSeconds: 180, muscleGroups: ['Lats', 'Rhomboids', 'Biceps'] },
  { id: 'cable-row', name: 'Seated Cable Row', category: 'Back', defaultRestSeconds: 90, muscleGroups: ['Lats', 'Rhomboids'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'Back', defaultRestSeconds: 90, muscleGroups: ['Lats', 'Biceps'] },
  { id: 'face-pull', name: 'Face Pull', category: 'Back', defaultRestSeconds: 60, muscleGroups: ['Rear Delts', 'Rhomboids', 'Rotator Cuff'] },
  { id: 'db-row', name: 'Dumbbell Row', category: 'Back', defaultRestSeconds: 90, muscleGroups: ['Lats', 'Rhomboids'] },

  // Shoulders
  { id: 'ohp', suggestedRir: 2, name: 'Overhead Press', category: 'Shoulders', defaultRestSeconds: 180, muscleGroups: ['Front Delts', 'Lateral Delts', 'Triceps'] },
  { id: 'db-ohp', suggestedRir: 2, name: 'Dumbbell Shoulder Press', category: 'Shoulders', defaultRestSeconds: 120, muscleGroups: ['Front Delts', 'Lateral Delts'] },
  { id: 'lateral-raise', name: 'Lateral Raise', category: 'Shoulders', defaultRestSeconds: 60, muscleGroups: ['Lateral Delts'] },
  { id: 'front-raise', name: 'Front Raise', category: 'Shoulders', defaultRestSeconds: 60, muscleGroups: ['Front Delts'] },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', category: 'Shoulders', defaultRestSeconds: 60, muscleGroups: ['Rear Delts'] },
  { id: 'shrug', name: 'Barbell Shrug', category: 'Shoulders', defaultRestSeconds: 90, muscleGroups: ['Traps'] },

  // Arms
  { id: 'barbell-curl', suggestedRir: 1, name: 'Barbell Curl', category: 'Arms', defaultRestSeconds: 90, muscleGroups: ['Biceps'] },
  { id: 'db-curl', suggestedRir: 1, name: 'Dumbbell Curl', category: 'Arms', defaultRestSeconds: 90, muscleGroups: ['Biceps'] },
  { id: 'hammer-curl', name: 'Hammer Curl', category: 'Arms', defaultRestSeconds: 90, muscleGroups: ['Biceps', 'Brachialis'] },
  { id: 'preacher-curl', name: 'Preacher Curl', category: 'Arms', defaultRestSeconds: 90, muscleGroups: ['Biceps'] },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'Arms', defaultRestSeconds: 60, muscleGroups: ['Triceps'] },
  { id: 'skull-crusher', name: 'Skull Crusher', category: 'Arms', defaultRestSeconds: 90, muscleGroups: ['Triceps'] },
  { id: 'overhead-tri-ext', name: 'Overhead Tricep Extension', category: 'Arms', defaultRestSeconds: 60, muscleGroups: ['Triceps'] },
  { id: 'close-grip-bench', name: 'Close Grip Bench Press', category: 'Arms', defaultRestSeconds: 120, muscleGroups: ['Triceps', 'Pectorals'] },

  // Legs
  { id: 'squat', suggestedRir: 1, name: 'Back Squat', category: 'Legs', defaultRestSeconds: 240, muscleGroups: ['Quads', 'Glutes', 'Hamstrings'] },
  { id: 'front-squat', suggestedRir: 1, name: 'Front Squat', category: 'Legs', defaultRestSeconds: 240, muscleGroups: ['Quads', 'Core'] },
  { id: 'leg-press', suggestedRir: 2, name: 'Leg Press', category: 'Legs', defaultRestSeconds: 180, muscleGroups: ['Quads', 'Glutes'] },
  { id: 'rdl', suggestedRir: 2, name: 'Romanian Deadlift', category: 'Legs', defaultRestSeconds: 180, muscleGroups: ['Hamstrings', 'Glutes'] },
  { id: 'leg-curl', suggestedRir: 1, name: 'Leg Curl', category: 'Legs', defaultRestSeconds: 90, muscleGroups: ['Hamstrings'] },
  { id: 'leg-extension', name: 'Leg Extension', category: 'Legs', defaultRestSeconds: 90, muscleGroups: ['Quads'] },
  { id: 'lunge', suggestedRir: 2, name: 'Lunge', category: 'Legs', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Glutes'] },
  { id: 'hip-thrust', suggestedRir: 2, name: 'Hip Thrust', category: 'Legs', defaultRestSeconds: 120, muscleGroups: ['Glutes'] },
  { id: 'calf-raise', name: 'Calf Raise', category: 'Legs', defaultRestSeconds: 60, muscleGroups: ['Calves'] },

  // Core
  { id: 'plank', name: 'Plank', category: 'Core', defaultRestSeconds: 60, muscleGroups: ['Abs', 'Obliques'] },
  { id: 'crunch', name: 'Crunch', category: 'Core', defaultRestSeconds: 60, muscleGroups: ['Abs'] },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', category: 'Core', defaultRestSeconds: 90, muscleGroups: ['Abs', 'Obliques'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', category: 'Core', defaultRestSeconds: 60, muscleGroups: ['Abs', 'Hip Flexors'] },
  { id: 'russian-twist', name: 'Russian Twist', category: 'Core', defaultRestSeconds: 60, muscleGroups: ['Obliques'] },
  { id: 'cable-crunch', name: 'Cable Crunch', category: 'Core', defaultRestSeconds: 60, muscleGroups: ['Abs'] },

  // Cardio
  { id: 'treadmill', name: 'Treadmill', category: 'Cardio', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular'] },
  { id: 'rowing-machine', name: 'Rowing Machine', category: 'Cardio', defaultRestSeconds: 60, muscleGroups: ['Full Body', 'Cardiovascular'] },
  { id: 'bike', name: 'Stationary Bike', category: 'Cardio', defaultRestSeconds: 60, muscleGroups: ['Legs', 'Cardiovascular'] },
  { id: 'jump-rope', name: 'Jump Rope', category: 'Cardio', defaultRestSeconds: 60, muscleGroups: ['Cardiovascular'] },

  // Full Body
  { id: 'thruster', name: 'Thruster', category: 'Full Body', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Shoulders'] },
  { id: 'burpee', name: 'Burpee', category: 'Full Body', defaultRestSeconds: 60, muscleGroups: ['Full Body'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', category: 'Full Body', defaultRestSeconds: 90, muscleGroups: ['Glutes', 'Hamstrings', 'Core'] },


  // Legs — Nordic Curl
  { id: 'nordic-curl', suggestedRir: 2, name: 'Nordic Curl', category: 'Legs', defaultRestSeconds: 120, muscleGroups: ['Hamstrings', 'Glutes'] },

  // ── FOOTBALL SPECIFIC ────────────────────────────────────────────────────

  // Eccentric — injury prevention fundamentals
  { id: 'eccentric-nordic', name: 'Eccentric Nordic Curl', category: 'Eccentric', defaultRestSeconds: 120, muscleGroups: ['Hamstrings'], measureType: 'reps' },
  { id: 'eccentric-calf-raise', name: 'Eccentric Calf Raise', category: 'Eccentric', defaultRestSeconds: 90, muscleGroups: ['Gastrocnemius'], measureType: 'reps' },
  { id: 'eccentric-sl-rdl', name: 'Eccentric Single Leg RDL', category: 'Eccentric', defaultRestSeconds: 90, muscleGroups: ['Hamstrings', 'Glutes'], measureType: 'reps' },
  { id: 'copenhagen-adductor', name: 'Copenhagen Adductor', category: 'Eccentric', defaultRestSeconds: 90, muscleGroups: ['Adductors', 'Core'] },
  { id: 'reverse-nordic', name: 'Reverse Nordic Curl', category: 'Eccentric', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Hip Flexors'], measureType: 'reps' },

  // Speed
  { id: 'pogo-jump', name: 'Pogo Jump', category: 'Speed', defaultRestSeconds: 60, muscleGroups: ['Calves', 'Achilles'], measureType: 'reps' },
  { id: 'ankle-hop', name: 'Ankle Hop', category: 'Speed', defaultRestSeconds: 60, muscleGroups: ['Calves', 'Achilles'], measureType: 'reps' },
  { id: 'reactive-drop-jump', name: 'Reactive Drop Jump', category: 'Speed', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Calves', 'Glutes'], measureType: 'reps' },
  { id: 'approach-jump', name: 'Approach Jump', category: 'Speed', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Calves', 'Glutes'], measureType: 'reps' },

  // Agility
  { id: 'deceleration-drill', name: 'Deceleration Drill', category: 'Agility', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Hamstrings', 'Glutes'], measureType: 'reps' },
  { id: 'lateral-shuffle', name: 'Lateral Shuffle', category: 'Agility', defaultRestSeconds: 60, muscleGroups: ['Glutes', 'Adductors'], measureType: 'reps' },
  { id: 'reactive-45-cut', name: '45° Reactive Cut', category: 'Agility', defaultRestSeconds: 90, muscleGroups: ['Glutes', 'Quads', 'Ankles'], measureType: 'reps' },
  { id: 'pro-agility', name: 'Pro Agility (5-10-5)', category: 'Agility', defaultRestSeconds: 120, muscleGroups: ['Full Body'], measureType: 'time', unit: 's' },

  // Speed + Agility
  { id: 'lateral-bound', name: 'Lateral Bound', category: 'Speed', secondaryCategory: 'Agility', defaultRestSeconds: 90, muscleGroups: ['Glutes', 'Adductors', 'Calves'], measureType: 'reps' },

  // Conditioning
  { id: 'aerobic-threshold-run', name: 'Aerobic Threshold Run', category: 'Conditioning', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular'], measureType: 'time', unit: 'min' },
  { id: 'tempo-run', name: 'Tempo Run', category: 'Conditioning', defaultRestSeconds: 120, muscleGroups: ['Cardiovascular'], measureType: 'time', unit: 's' },
  { id: 'hiit-run', name: 'HIIT Run Interval', category: 'Conditioning', defaultRestSeconds: 60, muscleGroups: ['Cardiovascular'], measureType: 'time', unit: 's' },
  { id: 'repeated-sprint', name: 'Repeated Sprint (30m)', category: 'Conditioning', defaultRestSeconds: 30, muscleGroups: ['Hamstrings', 'Glutes', 'Cardiovascular'], measureType: 'time', unit: 's' },
  { id: 'shuttle-run', name: 'Shuttle Run (5-10-5m)', category: 'Conditioning', defaultRestSeconds: 45, muscleGroups: ['Full Body', 'Cardiovascular'], measureType: 'time', unit: 's' },
  { id: 'ssg-simulation', name: 'SSG Simulation Run', category: 'Conditioning', defaultRestSeconds: 180, muscleGroups: ['Cardiovascular', 'Full Body'], measureType: 'time', unit: 'min' },
  { id: 'lactate-threshold-run', name: 'Lactate Threshold Run', category: 'Conditioning', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular'], measureType: 'time', unit: 'min' },

  // Testing — Sprint (also Speed)
  { id: 'test-5m-sprint', name: '5m Sprint', category: 'Testing', secondaryCategory: 'Speed', defaultRestSeconds: 180, muscleGroups: ['Acceleration'], measureType: 'time', unit: 's' },
  { id: 'test-10m-sprint', name: '10m Sprint', category: 'Testing', secondaryCategory: 'Speed', defaultRestSeconds: 180, muscleGroups: ['Acceleration'], measureType: 'time', unit: 's' },
  { id: 'test-20m-sprint', name: '20m Sprint', category: 'Testing', secondaryCategory: 'Speed', defaultRestSeconds: 180, muscleGroups: ['Max Velocity'], measureType: 'time', unit: 's' },
  { id: 'test-30m-sprint', name: '30m Sprint', category: 'Testing', secondaryCategory: 'Speed', defaultRestSeconds: 180, muscleGroups: ['Max Velocity'], measureType: 'time', unit: 's' },
  { id: 'test-40m-sprint', name: '40m Sprint', category: 'Testing', secondaryCategory: 'Speed', defaultRestSeconds: 240, muscleGroups: ['Max Velocity'], measureType: 'time', unit: 's' },

  // Testing — Jump
  { id: 'test-cmj', name: 'Countermovement Jump (CMJ)', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Glutes', 'Calves'], measureType: 'height', unit: 'cm' },
  { id: 'test-sqj', name: 'Squat Jump (SQJ)', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Glutes'], measureType: 'height', unit: 'cm' },
  { id: 'test-drop-jump', name: 'Drop Jump', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Calves', 'Quads'], measureType: 'height', unit: 'cm' },
  { id: 'test-sl-cmj', name: 'Single Leg CMJ', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Glutes'], measureType: 'height', unit: 'cm' },
  { id: 'test-broad-jump', name: 'Standing Broad Jump', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Glutes', 'Hamstrings'], measureType: 'distance', unit: 'm' },
  { id: 'test-triple-broad', name: 'Triple Broad Jump', category: 'Testing', defaultRestSeconds: 180, muscleGroups: ['Full Body'], measureType: 'distance', unit: 'm' },
  { id: 'test-lateral-jump', name: 'Lateral Jump (5 hops)', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Adductors', 'Glutes'], measureType: 'distance', unit: 'm' },

  // Testing — Agility / COD (also Agility)
  { id: 'test-505', name: '505 COD Test', category: 'Testing', secondaryCategory: 'Agility', defaultRestSeconds: 180, muscleGroups: ['Quads', 'Glutes', 'Ankles'], measureType: 'time', unit: 's' },
  { id: 'test-t-test', name: 'T-Test (Agility)', category: 'Testing', secondaryCategory: 'Agility', defaultRestSeconds: 180, muscleGroups: ['Full Body'], measureType: 'time', unit: 's' },
  { id: 'test-illinois', name: 'Illinois Agility Test', category: 'Testing', secondaryCategory: 'Agility', defaultRestSeconds: 180, muscleGroups: ['Full Body'], measureType: 'time', unit: 's' },

  // Testing — Fitness
  { id: 'test-yoyo-ir1', name: 'Yo-Yo IR1', category: 'Testing', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular', 'Aerobic Capacity'], measureType: 'score', unit: 'level' },
  { id: 'test-yoyo-ir2', name: 'Yo-Yo IR2', category: 'Testing', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular', 'Anaerobic Capacity'], measureType: 'score', unit: 'level' },
  { id: 'test-3015-ift', name: '30-15 IFT', category: 'Testing', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular'], measureType: 'score', unit: 'km/h' },
  { id: 'test-beep-test', name: 'Beep Test (MSFT)', category: 'Testing', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular', 'VO2max'], measureType: 'score', unit: 'level' },
  { id: 'test-cooper', name: 'Cooper Test (12min)', category: 'Testing', defaultRestSeconds: 0, muscleGroups: ['Cardiovascular', 'VO2max'], measureType: 'distance', unit: 'm' },

  // Testing — Strength
  { id: 'test-1rm-squat', name: '1RM Back Squat', category: 'Testing', defaultRestSeconds: 300, muscleGroups: ['Quads', 'Glutes', 'Hamstrings'], measureType: 'strength' },
  { id: 'test-1rm-deadlift', name: '1RM Deadlift', category: 'Testing', defaultRestSeconds: 300, muscleGroups: ['Posterior Chain'], measureType: 'strength' },
  { id: 'test-1rm-bench', name: '1RM Bench Press', category: 'Testing', defaultRestSeconds: 300, muscleGroups: ['Chest', 'Triceps'], measureType: 'strength' },
  { id: 'test-3rm-squat', name: '3RM Back Squat', category: 'Testing', defaultRestSeconds: 240, muscleGroups: ['Quads', 'Glutes'], measureType: 'strength' },
  { id: 'test-imtp', name: 'Isometric Mid-Thigh Pull', category: 'Testing', defaultRestSeconds: 180, muscleGroups: ['Full Body'], measureType: 'score', unit: 'N' },
  { id: 'test-rsi', name: 'Reactive Strength Index (RSI)', category: 'Testing', defaultRestSeconds: 120, muscleGroups: ['Calves', 'Quads'], measureType: 'score', unit: 'RSI' },

  // Isometric
  { id: 'wall-sit', name: 'Wall Sit', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Quads', 'Glutes'] },
  { id: 'side-plank', name: 'Side Plank', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Obliques', 'Core'] },
  { id: 'superman-hold', name: 'Superman Hold', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Erectors', 'Glutes'] },
  { id: 'dead-hang', name: 'Dead Hang', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Lats', 'Grip', 'Shoulders'] },
  { id: 'copenhagen-plank', name: 'Copenhagen Plank', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Adductors', 'Obliques', 'Core'] },
  { id: 'iso-squat-hold', name: 'Isometric Squat Hold', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Quads', 'Glutes'] },
  { id: 'iso-lunge-hold', name: 'Isometric Lunge Hold', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Quads', 'Glutes'] },
  { id: 'iso-row', name: 'Isometric Row Hold', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Lats', 'Rhomboids'] },
  { id: 'glute-bridge-hold', name: 'Glute Bridge Hold', category: 'Isometric', defaultRestSeconds: 60, muscleGroups: ['Glutes', 'Hamstrings'] },
  { id: 'calf-raise-hold', name: 'Calf Raise Hold', category: 'Isometric', defaultRestSeconds: 45, muscleGroups: ['Calves'] },

  // Plyometrics
  { id: 'box-jump', name: 'Box Jump', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Glutes', 'Calves'] },
  { id: 'depth-jump', name: 'Drop Jump', category: 'Plyometrics', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Glutes', 'Calves'] },
  { id: 'broad-jump', name: 'Broad Jump', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Glutes', 'Hamstrings'] },
  { id: 'lateral-box-jump', name: 'Lateral Box Jump', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Glutes', 'Adductors', 'Calves'] },
  { id: 'single-leg-hop', name: 'Single Leg Hop', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Glutes', 'Calves'] },
  { id: 'hurdle-hop', name: 'Hurdle Hop', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Quads', 'Glutes', 'Calves'] },
  { id: 'skater-jump', name: 'Skater Jump', category: 'Plyometrics', defaultRestSeconds: 60, muscleGroups: ['Glutes', 'Adductors', 'Calves'] },
  { id: 'bounding', name: 'Bounding', category: 'Plyometrics', defaultRestSeconds: 90, muscleGroups: ['Hamstrings', 'Glutes', 'Calves'] },
  { id: 'sprint', name: 'Sprint', category: 'Plyometrics', defaultRestSeconds: 120, muscleGroups: ['Quads', 'Hamstrings', 'Calves'] },

  // ── Warm-Up / Mobility (programme warm-up blocks) ─────────────────────────
  { id: 'hip-90-90', name: 'Hip 90/90 Mobilisation', category: 'Full Body', defaultRestSeconds: 0, muscleGroups: ['Hip Flexors', 'Glutes', 'Hip Rotators'], measureType: 'reps' },
  { id: 'worlds-greatest-stretch', name: "World's Greatest Stretch", category: 'Full Body', defaultRestSeconds: 0, muscleGroups: ['Hip Flexors', 'Thoracic Spine', 'Hamstrings'], measureType: 'reps' },
  { id: 'glute-bridge-march', name: 'Glute Bridge March', category: 'Core', defaultRestSeconds: 30, muscleGroups: ['Glutes', 'Core', 'Hamstrings'], measureType: 'reps' },
  { id: 'ankle-circles-calf', name: 'Ankle Circles + Calf Raise', category: 'Legs', defaultRestSeconds: 0, muscleGroups: ['Calves', 'Ankle'], measureType: 'reps' },
  { id: 'air-squat', name: 'Air Squat', category: 'Legs', defaultRestSeconds: 30, muscleGroups: ['Quads', 'Glutes'], measureType: 'reps' },
  { id: 'prone-tyi', name: 'Prone T-Y-I', category: 'Shoulders', defaultRestSeconds: 20, muscleGroups: ['Rhomboids', 'Lower Traps', 'Rear Delts'], measureType: 'reps' },
  { id: 'lateral-shuffle', name: 'Lateral Shuffle', category: 'Agility', defaultRestSeconds: 30, muscleGroups: ['Adductors', 'Abductors', 'Glutes'], measureType: 'reps' },
  { id: 'a-skip', name: 'A-Skip', category: 'Speed', defaultRestSeconds: 30, muscleGroups: ['Hip Flexors', 'Calves', 'Coordination'], measureType: 'reps' },
  { id: 'high-knees', name: 'High Knees', category: 'Speed', defaultRestSeconds: 20, muscleGroups: ['Hip Flexors', 'Quads', 'Cardiovascular'], measureType: 'reps' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  Chest:       'bg-red-100 text-red-700',
  Back:        'bg-blue-100 text-blue-700',
  Shoulders:   'bg-purple-100 text-purple-700',
  Arms:        'bg-yellow-100 text-yellow-700',
  Legs:        'bg-green-100 text-green-700',
  Core:        'bg-orange-100 text-orange-700',
  Cardio:      'bg-pink-100 text-pink-700',
  'Full Body': 'bg-teal-100 text-teal-700',
  Isometric:        'bg-cyan-100 text-cyan-700',
  Plyometrics:      'bg-lime-100 text-lime-700',
  Speed:            'bg-emerald-100 text-emerald-700',
  Agility:          'bg-teal-100 text-teal-800',
  Eccentric:        'bg-violet-100 text-violet-700',
  Conditioning:     'bg-rose-100 text-rose-700',
  Testing:          'bg-sky-100 text-sky-700',
};
