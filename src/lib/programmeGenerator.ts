/**
 * AI Programme Generator
 * Produces individualised, periodised football S&C programmes.
 * Deterministic: same inputs → same programme (week-seeded variation only).
 */

import {
  GeneratedProgramme, ProgrammeInputs, ProgrammeWeek, ProgrammeSession,
  ProgrammeExercise,
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function ex(
  name: string, sets: string, reps: string, rest: string, cue: string, intensity?: string,
): ProgrammeExercise {
  return { name, sets, reps, rest, cue, ...(intensity ? { intensity } : {}) };
}

// ── Readiness ──────────────────────────────────────────────────────────────

export function calcReadiness(r: ProgrammeInputs['readiness']): {
  score: number;
  level: 'high' | 'moderate' | 'low';
  guidance: string;
} {
  const score = Math.round(
    ((r.sleep + (10 - r.fatigue) + (10 - r.soreness) + (10 - r.stress)) / 4) * 10,
  ) / 10;

  const level = score >= 7.5 ? 'high' : score >= 5 ? 'moderate' : 'low';

  const guidance =
    level === 'high'
      ? 'High readiness. Push hard today — add an optional bonus set to main lifts if you feel strong through the session.'
      : level === 'moderate'
      ? 'Moderate readiness. Programme as written. Monitor RPE set-to-set; back off if effort jumps unexpectedly.'
      : 'Low readiness. Intensity reduced ~25%. Focus on movement quality — strength gains come back quickly. No sessions are skipped, only adjusted.';

  return { score, level, guidance };
}

// ── Duration from experience ───────────────────────────────────────────────

function durationWeeks(exp: string): number {
  return exp === '<1' ? 6 : exp === '1-3' ? 8 : exp === '3-5' ? 10 : 12;
}

// ── Phase for week ─────────────────────────────────────────────────────────

function getPhase(week: number, total: number): { phase: string; phaseGoal: string } {
  const p = week / total;
  if (p <= 0.25) return { phase: 'Foundation', phaseGoal: 'Establish movement quality, build aerobic base, reinforce injury resilience across all physical qualities.' };
  if (p <= 0.50) return { phase: 'Build', phaseGoal: 'Increase load and position-specific demands. Accelerate adaptation with progressive overload on all main lifts.' };
  if (p <= 0.75) return { phase: 'Strength & Power', phaseGoal: 'Peak force production. High neural demand sessions. Maximum velocity and explosive power are the priority.' };
  return { phase: 'Peak', phaseGoal: 'Transfer gym strength to pitch. Reduce volume, maximise intensity. Arrive at every match sharper than the week before.' };
}

// ── MD day schedule ────────────────────────────────────────────────────────

type MdSlot = { mdDay: string; dayOfWeek: string };

const SCHEDULES: Record<string, Record<number, MdSlot[]>> = {
  saturday: {
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-2', dayOfWeek: 'Thursday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Sunday' }, { mdDay: 'MD-4', dayOfWeek: 'Tuesday' }, { mdDay: 'MD-3', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-1', dayOfWeek: 'Friday' }],
  },
  sunday: {
    2: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-2', dayOfWeek: 'Friday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
    4: [{ mdDay: 'MD+1', dayOfWeek: 'Monday' }, { mdDay: 'MD-4', dayOfWeek: 'Wednesday' }, { mdDay: 'MD-3', dayOfWeek: 'Thursday' }, { mdDay: 'MD-1', dayOfWeek: 'Saturday' }],
  },
  midweek: {
    2: [{ mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    3: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
    4: [{ mdDay: 'MD-4', dayOfWeek: 'Saturday' }, { mdDay: 'MD-3', dayOfWeek: 'Sunday' }, { mdDay: 'MD-2', dayOfWeek: 'Monday' }, { mdDay: 'MD-1', dayOfWeek: 'Tuesday' }],
  },
};

function getMdSlots(sessionsPerWeek: number, matchDay: string): MdSlot[] {
  const schedule = SCHEDULES[matchDay] ?? SCHEDULES.saturday;
  return schedule[sessionsPerWeek] ?? schedule[3];
}

// ── Warm-up library ────────────────────────────────────────────────────────

const WARMUP_MOBILITY: ProgrammeExercise[] = [
  ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Drive lead knee toward the floor. Breathe into the end range — never force it.'),
  ex("World's Greatest Stretch", '1', '5 each side', '', 'Lunge forward, rotate thoracic spine, reach ceiling with top arm. Eyes follow.'),
  ex('Glute Bridge Hold + March', '2', '8 each leg', '30s', 'Full hip extension at top. Pelvis stays level as you march — no rotation.'),
];

const WARMUP_NEURAL: ProgrammeExercise[] = [
  ex('Lateral Band Walk', '2', '15 steps each way', '30s', 'Feet stay hip-width. Keep tension throughout — knees tracking over toes.'),
  ex('A-Skip', '2', '2 × 20m', '30s', 'Drive knee to hip height, claw foot back down. Tall posture, relaxed shoulders.'),
  ex('High Knees', '2', '20m', '20s', 'Punch knees up fast, land on the ball of the foot. Rapid arm action.'),
];

const WARMUP_SPEED: ProgrammeExercise[] = [
  ex('Butt Kicks', '2', '20m', '20s', 'Heel contacts glute. Keep hips tall — don\'t hinge forward.'),
  ex('Build-Up Sprint (60→80→90%)', '3', '30m', '60s', 'Smooth progression. No flying start. Feel rhythm and posture build naturally.'),
];

const WARMUP_STRENGTH: ProgrammeExercise[] = [
  ex('Ankle Circles + Eccentric Calf Raise', '1', '10 each direction', '', 'Full dorsiflexion range. Slow 3s on the calf lowering.'),
  ex('Goblet Squat (Bodyweight)', '2', '10', '30s', 'Elbows inside knees at bottom. Drive knees out. Full depth — chest tall.'),
  ex('Band Pull-Apart', '2', '15', '20s', 'Retract scapulae. Thumbs point behind you at full range.'),
];

// ── Strength library ───────────────────────────────────────────────────────

const STRENGTH: Record<string, Record<string, ProgrammeExercise[]>> = {
  Foundation: {
    full: [
      ex('Back Squat', '4', '8', '2:30', 'Bar high on traps. Knees track toes. Controlled 3s descent, explosive up.', '65% 1RM'),
      ex('Romanian Deadlift', '3', '10', '2:00', 'Hinge at the hip with soft knees. Hamstring tension before reversing. Bar stays close.', '60% 1RM'),
      ex('Dumbbell Split Squat', '3', '8 each', '90s', 'Front shin vertical. Drive through heel. Rear knee skims the floor.'),
    ],
    basic: [
      ex('Goblet Squat', '4', '10', '2:00', 'Heavy DB held at chest. Full depth. Drive knees out. 3s descent.'),
      ex('Single-Leg Romanian Deadlift', '3', '8 each', '90s', 'Load the standing hip. Neutral spine throughout. Reach back foot for balance.'),
      ex('Reverse Lunge', '3', '10 each', '90s', 'Long step back. Rear knee to just above floor. Drive front heel to stand.'),
    ],
    none: [
      ex('Pistol Squat Progression (Box)', '3', '6 each', '2:00', 'Use a low box. Drive heel into surface. Controlled descent — no collapse.'),
      ex('Single-Leg RDL (Bodyweight)', '3', '10 each', '90s', 'Arms forward for counterbalance. Flat back. Slow and controlled.'),
      ex('Walking Lunge', '3', '12 each', '90s', 'Long stride. Front knee doesn\'t pass toe. Drive tall at the top of each step.'),
    ],
  },
  Build: {
    full: [
      ex('Back Squat', '4', '6', '3:00', 'Brace hard pre-descent. Hit depth. Explode from the hole — accelerate through sticking point.', '72% 1RM'),
      ex('Trap Bar Deadlift', '3', '5', '3:00', 'Flat back, hips hinge. Drive the floor away. Hips and knees lock simultaneously.', '75% 1RM'),
      ex('Bulgarian Split Squat', '3', '6 each', '2:00', 'Rear foot elevated on bench. Vertical torso. Drive front heel with intent.', 'Heavy DB'),
    ],
    basic: [
      ex('Goblet Squat', '4', '8', '2:30', 'Full depth. Explosive concentric — keep chest tall.', 'Heavy DB'),
      ex('Single-Leg RDL', '3', '8 each', '2:00', 'Maximise time under tension. 3s lower, 1s hold.', 'Moderate DB'),
      ex('DB Walking Lunge', '3', '10 each', '2:00', 'Long stride. Power through the front heel.', 'Moderate DB'),
    ],
    none: [
      ex('Pistol Squat', '3', '5 each', '2:30', 'Full depth. Fingertip support only if needed.'),
      ex('Nordic Hamstring Curl', '3', '5', '3:00', 'Fight the fall. 4s eccentric. Catch at 45°. Partner or anchored.'),
      ex('Step-Up (High Box)', '3', '8 each', '2:00', 'Drive through the working leg only — no push from back foot.'),
    ],
  },
  'Strength & Power': {
    full: [
      ex('Back Squat', '5', '3', '4:00', 'Maximal intent on every rep. Fast descent, explosive concentric. Full recovery.', '82–87% 1RM'),
      ex('Power Clean', '4', '3', '3:00', 'Hook grip. Violent triple extension. High elbows in the catch — rack position.', '75% 1RM'),
      ex('Hex Bar Deadlift', '4', '4', '3:30', 'Optimal hip position. Accelerate aggressively through the pull.', '80% 1RM'),
    ],
    basic: [
      ex('DB Hang Snatch', '4', '4 each', '3:00', 'Hinge and pull. Drive elbow high. Lock out overhead — stable shoulder.', 'Challenging'),
      ex('DB Jump Squat', '3', '5', '3:00', 'Full squat depth. Explode upward. Absorb the landing — hips, knees, ankles.'),
      ex('Single-Leg RDL', '4', '6 each', '2:00', 'Heavy. Maximum hip load. Don\'t rotate the spine.', 'Heavy DB'),
    ],
    none: [
      ex('Broad Jump', '4', '4', '3:00', 'Max horizontal distance. Stick the landing. Full reset before each rep.'),
      ex('Nordic Hamstring Curl', '4', '5', '3:30', 'Resist the fall hard. 4s down. Build tensile strength in the hamstring.'),
      ex('Depth Drop → Vertical Jump', '3', '4', '3:00', 'Step off (not jump). Minimise ground contact. Reactive vertical rebound.'),
    ],
  },
  Peak: {
    full: [
      ex('Back Squat', '3', '3', '4:00', 'Every rep is treated as a max. Maximum neural drive. Full recovery is non-negotiable.', '90–95% 1RM'),
      ex('Power Clean', '4', '2', '4:00', 'Speed is the goal. Aggressive enough to be technical, heavy enough to matter.', '78% 1RM'),
      ex('Jump Squat', '4', '4', '3:00', 'Maximum intent upward. Land and fully reset — not a plyometric bounce.', '30% 1RM'),
    ],
    basic: [
      ex('DB Jump Squat', '4', '4', '3:00', 'Explosive off floor. Stick the landing through full foot. No rushing.'),
      ex('Heavy DB RDL', '4', '5', '3:00', 'Maximise hamstring tension. Slow, controlled bar path.', 'Heavy DB'),
      ex('Depth Drop → Jump', '3', '5', '3:00', 'Step off box. Minimum ground contact time. React and express power upward.'),
    ],
    none: [
      ex('Plyometric Push-Up', '3', '6', '3:00', 'Explosive push — leave the ground. Soft landing. Repeat with full intent.'),
      ex('Depth Drop', '4', '5', '3:00', 'Step off, minimal contact, maximum vertical jump. Reactive neural output.'),
      ex('Bounding Sprint', '4', '30m', '90s', 'Aggressive push-off. Maximise stride length. Drive arms hard.'),
    ],
  },
};

// ── Upper body ─────────────────────────────────────────────────────────────

const UPPER: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('DB Bench Press', '3', '10', '2:00', 'Retract shoulder blades. Controlled descent. Explosive push.', '60% effort'),
    ex('DB Row', '3', '10', '2:00', 'Hinge 45°. Pull elbow to hip. Squeeze lat at top.', '60% effort'),
    ex('DB Shoulder Press', '3', '10', '90s', 'Neutral spine. No arching. Full lockout overhead.', 'Moderate'),
  ],
  Build: [
    ex('Bench Press', '4', '6', '3:00', 'Explosive push. 2–3s controlled descent. Grip just outside shoulder-width.', '72–75% 1RM'),
    ex('Weighted Pull-Up', '4', '5', '3:00', 'Full ROM — dead hang to chin over bar. Initiate with lats.', 'Add 5–10kg'),
    ex('Push Press', '3', '5', '2:30', 'Dip and drive hips. Aggressive lockout. Bar path stays over heels.', '75% 1RM'),
  ],
  'Strength & Power': [
    ex('Bench Press', '4', '4', '3:30', 'Maximum force intent on every rep.', '80–85% 1RM'),
    ex('Weighted Pull-Up', '4', '4', '3:00', 'Pause 1s at top. Control descent 3s. No kipping.', 'Challenging'),
    ex('Medicine Ball Chest Pass (Wall)', '3', '6', '90s', 'Drive through the ball explosively. Receive and repeat fast. Max power output.'),
  ],
  Peak: [
    ex('Bench Press', '3', '3', '4:00', 'Max intent. Treat each rep like a maximum. Full recovery.', '88–92% 1RM'),
    ex('Weighted Pull-Up', '3', '3', '4:00', 'Explosive concentric. Slow 4s descent.', 'Heavy'),
    ex('Medicine Ball Slam', '4', '5', '90s', 'Overhead drive then slam with full-body tension.'),
  ],
};

// ── Speed library ──────────────────────────────────────────────────────────


const SPEED_ACCELERATION: Record<string, ProgrammeExercise[]> = {
  Foundation: [
    ex('Falling Start', '4', '10m', '2:00', 'Ankle lean, first step drives. Low body angle for first 6 steps.'),
    ex('Standing Start Sprint', '4', '15m', '2:00', 'Staggered stance. Explode — stay low until 10m.'),
  ],
  Build: [
    ex('3-Point Start Sprint', '5', '20m', '2:30', 'Rear leg drives. Build body angle progressively. Push into the ground.'),
    ex('Sprint from Back-Pedal', '4', '5m back → 15m forward', '2:30', 'Back-pedal, plant, drive. Simulate match transition.'),
  ],
  'Strength & Power': [
    ex('Resisted Sled Sprint (if available)', '4', '20m', '3:00', '45° lean into the sled. Long, powerful steps. Full extension.', 'Heavy sled'),
    ex('Flying 10m Sprint', '4', '30m build → 10m fly', '4:00', 'Reach max velocity, hold it. Time the flying 10m.'),
  ],
  Peak: [
    ex('Flying 20m Sprint', '5', '40m build → 20m fly', '4:30', 'Maximum velocity. Full rest. Quality over quantity every single rep.'),
    ex('Sprint from Lateral Start', '3', '20m', '3:00', 'Crossover step, drive. Simulate match sprint trigger.'),
  ],
};

// ── Position-specific speed ────────────────────────────────────────────────

const POSITION_SPEED: Partial<Record<string, ProgrammeExercise[]>> = {
  GK: [
    ex('Explosive Lateral Bound + Stabilise', '4', '4 each', '2:00', 'Push off outside foot. Land on inside foot, absorb deeply. Hold 1s. Simulate diving saves.'),
    ex('Reaction Sprint (Varied Direction)', '4', '10m', '2:00', 'Start in ready position. Sprint on verbal cue — direction varies. React, don\'t anticipate.'),
  ],
  CB: [
    ex('Deceleration Sprint', '4', '30m sprint → hard stop', '3:00', 'Sprint 30m, plant hard, brake. 3–5 step controlled deceleration. Train the braking mechanics.'),
    ex('Back-Pedal → Forward Sprint', '4', '10m back → 20m fwd', '3:00', 'Track a runner. Transition at hip-turn signal. Explosive change of direction.'),
  ],
  FB: [
    ex('Sprint + Lateral Shuffle + Sprint', '4', '10m → 10m → 10m', '3:00', 'Match simulation. First sprint, shuffle, close sprint. Quality throughout.'),
    ex('Repeated 40m Sprint', '5', '40m', '25s', 'Build RSA. 90% each rep. The discipline is the recovery — only 25s rest.'),
  ],
  CM: [
    ex('Sprint from Jog', '5', '20m', '90s', 'Simulate match sprint — transition from cruising to max effort immediately.'),
    ex('Box-to-Box Run Simulation', '4', '50m', '60s', '85% effort. Midfield sprint pattern. Controlled deceleration at the end.'),
  ],
  W: [
    ex('Flying 20m Sprint', '6', '40m build → 20m fly', '4:00', 'This is your primary weapon. Max velocity every rep. Full rest. Don\'t chase fatigue.'),
    ex('Curve Sprint', '3', '30m curve', '3:00', 'Simulate wide sprint with inside lean. Maintain speed through the bend.'),
  ],
  ST: [
    ex('10m Explosive Burst', '6', '10m', '2:00', 'Match start from varied positions. Max first-step intent. Simulate striker runs.'),
    ex('Sprint + Jump (Aerial Duel)', '4', '15m sprint → CMJ', '3:00', 'Sprint, jump at cone, land and decelerate. Simulate penalty box action.'),
  ],
};

// ── Conditioning by position ───────────────────────────────────────────────

const CONDITIONING: Record<string, Record<string, ProgrammeExercise>> = {
  GK: {
    Foundation: ex('Interval Shuttle', '4', '6 × 20m', '2:00 between sets', 'Moderate pace. COD focus. 75% effort.'),
    Build: ex('HIIT: 15s on / 15s off', '12', 'rounds', 'Self-paced', 'Explosive for 15s, walk 15s. Simulate GK burst demands across a half.'),
    'Strength & Power': ex('Flying 20m Repeat Sprint', '6', '20m', '30s rest', 'Near-max each rep. GK explosive conditioning — short and sharp.'),
    Peak: ex('Sprint Finisher', '3', '4 × 10m', '2:00 between sets', 'Sharp, reactive. Quality over quantity.'),
  },
  CB: {
    Foundation: ex('Deceleration Sprint Drill', '4', '30m sprint → brake', '2:00', 'Sprint 30m, plant and stop. Eccentric knee and hip control. Build braking strength.'),
    Build: ex('Repeated 30m Sprint', '6', '30m', '30s rest', '85% effort. Develop sprint endurance for tracking and recovery.'),
    'Strength & Power': ex('High-Intensity Shuttle', '6', '20m', '30s rest', 'Maximum each rep. CB sprint demands.'),
    Peak: ex('Short Sprint Repeats', '6', '10–20m', '45s rest', 'Sharp. Match intensity. Full recovery between sets.'),
  },
  FB: {
    Foundation: ex('Repeated 40m Sprint', '6', '40m', '25s rest', 'Build RSA tolerance. 80% effort. Short rest develops recovery capacity.'),
    Build: ex('400m Tempo Run', '4', '400m', '90s rest', '75–80% max HR. Aerobic base for high-distance demands.'),
    'Strength & Power': ex('Shuttle Sprint Repeats', '8', '40m', '20s rest', '90% effort. Full-back sprint frequency training.'),
    Peak: ex('4×4 Interval', '4', '4 min at 85%', '3:00 rest', 'Simulate extended high-intensity phases. HR above 85%.'),
  },
  CM: {
    Foundation: ex('Tempo Run', '3', '1000m', '2:00 rest', '70% effort — conversational pace. Build the aerobic engine that runs your game.'),
    Build: ex('4×4 Interval', '4', '4 min at 85%', '3:00 rest', 'The most evidence-based aerobic tool for footballers. HR > 90% for last minute of each rep.'),
    'Strength & Power': ex('30-15 Fitness Test (Training)', '1', '15 min session', '', '30s at 13–14 km/h, 15s walk. Develop high-intensity repeat capacity. Midfielder gold standard.'),
    Peak: ex('High-Intensity Shuttle', '6', '20m', '30s rest', 'Maximum each rep. Simulate box-to-box demands.'),
  },
  W: {
    Foundation: ex('Repeated 40m Sprint', '6', '40m', '25s rest', '85% effort. Short rest. Build RSA tolerance — wingers sprint more than anyone.'),
    Build: ex('Repeated 40m Sprint', '8', '40m', '20s rest', '90% effort. Decrease rest. Higher anaerobic demand for winger-specific RSA.'),
    'Strength & Power': ex('Flying 30m Repeat Sprint', '6', '30m', '45s rest', 'Max velocity. Near-complete recovery. Train your primary match weapon.'),
    Peak: ex('Sprint Cluster', '4', '3 × 20m (15s between)', '3:00 between sets', 'Match-like sprint clusters. Explosive quality throughout.'),
  },
  ST: {
    Foundation: ex('Sprint + Jog Recovery Circuit', '6', '30m sprint / 40m jog', 'Continuous', 'Continuous. Sprint, jog recovery. Builds aerobic capacity for striker work-rate.'),
    Build: ex('10m Burst Repeats', '10', '10m', '30s rest', '100% intent. Simulate striker sprint demands — explosive bursts with recovery.'),
    'Strength & Power': ex('Repeated 20m Sprint', '8', '20m', '20s rest', 'Near-maximal. Anaerobic capacity specific to striker runs in behind.'),
    Peak: ex('Sprint + Jump Finisher', '3', '3 × 15m + CMJ', '3:00 between sets', 'Sprint, sprint, sprint, jump. Penalty box simulation.'),
  },
};

// ── Weakness exercises ─────────────────────────────────────────────────────

const WEAKNESS_EX: Record<string, ProgrammeExercise[]> = {
  speed: [
    ex('Hip Flexor Sprint Drill', '3', '4 × 20m', '2:00', 'Rapid knee drive. Arms drive speed — pump them with purpose.'),
    ex('Single-Leg Broad Jump', '3', '5 each', '2:00', 'Push horizontally off one foot. Land controlled. Max distance.'),
    ex('Resisted Hip Extension (Band)', '3', '12 each', '90s', 'Full hip extension against band. Glute drive. Simulates sprint push-off.'),
  ],
  strength: [
    ex('Tempo Squat', '4', '5', '3:00', '3s descent, 1s pause at bottom, explosive up. Time under tension is the stimulus.', '70% 1RM'),
    ex('Eccentric RDL', '3', '8', '2:30', '4s lowering phase. Load the hamstring eccentrically. Control is the whole point.', 'Moderate'),
    ex('Isometric Split Squat Hold', '3', '40s each', '2:00', 'Bottom position hold. Builds strength and joint stability simultaneously.'),
  ],
  endurance: [
    ex('Aerobic Threshold Run', '1', '20 min', '', '70% max HR — truly conversational pace. Aerobic base — the engine of your game.'),
    ex('Cardiac Output Circuit', '3', '5 min', '90s rest', 'Continuous: 1 min jog / 1 min bike / 1 min row / 1 min step / 1 min jump rope. HR 130–150 bpm.'),
  ],
  power: [
    ex('Box Jump', '4', '5', '2:30', 'Step down (don\'t jump down). Reset fully. Maximum upward intent every rep.'),
    ex('Depth Jump', '3', '4', '3:00', 'Step off box, minimise contact time, jump as high as possible. Reactive power.'),
    ex('Rotational Med Ball Throw', '3', '6 each', '2:00', 'Hips rotate first, shoulders follow. Explosive release. Simulates striking/turning.'),
  ],
  agility: [
    ex('5-10-5 Pro Agility Drill', '4', 'Full shuttle', '2:30', 'Centre start. 5m right, 10m left, 5m right. Drive off outside foot each turn.'),
    ex('T-Drill', '3', 'Full drill', '2:30', 'Sprint, shuffle left, shuffle right, back-pedal. Precise footwork at each cone.'),
    ex('Reactive Cone Drill (Partner)', '4', '6 reps', '2:00', 'Partner signals direction. React and accelerate. Decision speed is the variable.'),
  ],
  injury_prone: [
    ex('Nordic Hamstring Curl', '3', '5', '3:00', 'Gold standard. 4s eccentric. Catch at 45°. Most-evidenced prevention exercise in football.'),
    ex('Copenhagen Plank', '3', '30s each', '90s', 'Groin-specific. Top foot on bench, pull bottom leg up. Non-negotiable for groin health.'),
    ex('Single-Leg Balance Reach', '3', '10 each', '60s', 'Reach forward, lateral, diagonal. Challenges ankle stability and proprioception.'),
  ],
};

// ── Prehab by injury area ──────────────────────────────────────────────────

const PREHAB: Record<string, ProgrammeExercise[]> = {
  hamstring: [
    ex('Nordic Hamstring Curl', '3', '5', '3:00', '4s eccentric. Highest-evidence prevention in football. Non-negotiable.'),
    ex('Eccentric Single-Leg RDL', '2', '8 each', '90s', '4s lowering. Hold at bottom. Eccentric load is the protective stimulus.'),
  ],
  ankle: [
    ex('Single-Leg Balance (Eyes Closed)', '3', '40s each', '60s', 'Slight knee bend. Challenge with eyes closed when easy. Proprioception training.'),
    ex('Banded Ankle Dorsiflexion Mob', '2', '10 each', '30s', 'Band pulls heel forward. Drive knee over small toe. Restore lost dorsiflexion range.'),
  ],
  knee: [
    ex('Terminal Knee Extension (Band)', '3', '15 each', '60s', 'VMO isolation. Full lockout. Slow and controlled.'),
    ex('Eccentric Step-Down', '3', '10 each', '90s', 'From step. 4s descent to single-foot landing. Track knee over second toe throughout.'),
  ],
  groin: [
    ex('Copenhagen Plank', '3', '25s each side', '90s', 'Adductor isolation. Top foot on bench. This is the gold standard for groin prevention.'),
    ex('Lateral Band Walk', '2', '15 each way', '60s', 'Targets the groin-hip abductor relationship. Controlled. Knees track over toes.'),
  ],
  calf: [
    ex('Eccentric Calf Raise (Alfredson)', '3', '12', '60s', 'Raise with both, lower on one. 3s eccentric. Classic protocol — proven for Achilles and calf.'),
    ex('Soleus Single-Leg Raise (Bent Knee)', '2', '15 each', '60s', 'Knee at 90°. Targets soleus specifically. Slow and deliberate.'),
  ],
  back: [
    ex('Dead Bug', '3', '6 each side', '60s', 'Lower back into floor. Extend opposite arm and leg — do NOT lose lumbar position.'),
    ex('Pallof Press', '3', '10 each side', '60s', 'Anti-rotation. Resist the cable or band. Press and return — body stays square throughout.'),
  ],
  shoulder: [
    ex('Band External Rotation', '3', '15 each', '60s', 'Elbow pinned to side. Rotate outward against band. Slow, intentional movement.'),
    ex('Y-T-W on Incline Bench', '3', '8 each letter', '60s', 'Scapular control. Light weight or bodyweight. Each rep fully deliberate.'),
  ],
};

const DEFAULT_PREHAB: ProgrammeExercise[] = [
  ex('Nordic Hamstring Curl', '2', '5', '3:00', '4s eccentric. Highest-evidence injury prevention for any footballer. Never skip this.'),
  ex('Copenhagen Plank', '2', '20s each side', '60s', 'Adductor strength. Essential for groin resilience. Build the hold duration week by week.'),
];

// ── Recovery session (MD+1) ────────────────────────────────────────────────

function recoverySession(dow: string): ProgrammeSession {
  return {
    mdDay: 'MD+1',
    dayOfWeek: dow,
    objective: 'Active recovery — accelerate systemic recovery, restore ROM, prepare the body for the week ahead.',
    readinessNote: 'MD+1 is always low load regardless of readiness score.',
    durationMin: 35,
    blocks: [
      {
        title: '🔄 Soft Tissue + Mobility',
        exercises: [
          ex('Foam Roll: Quads, Hamstrings, IT Band, Calves', '1', '90s each area', '', 'Slow rolls. Pause on tender spots for 5–10s. No rushing.'),
          ex('Static Hip Flexor Stretch', '1', '60s each side', '', 'Tall kneeling. Posterior pelvic tilt. Feel front of hip — don\'t arch the back.'),
          ex('Supine Piriformis Stretch', '1', '60s each side', '', 'Figure-4. Pull knee gently toward opposite shoulder.'),
        ],
      },
      {
        title: '⚡ Light Activation',
        exercises: [
          ex('Glute Bridge (Light)', '2', '15', '30s', 'Blood flow only today. Not a strength exercise — gentle neural activation.'),
          ex('Band Clamshell', '2', '15 each', '30s', 'Light band. Hip external rotation. Activate without loading.'),
          ex('20 min Walk, Swim, or Light Bike', '1', 'optional', '', 'Active recovery accelerates clearance of metabolic waste. Recommended if possible.'),
        ],
      },
    ],
  };
}

// ── Neural priming session (MD-1) ──────────────────────────────────────────

function primingSession(dow: string, position: string): ProgrammeSession {
  const positionPriming: Partial<Record<string, ProgrammeExercise[]>> = {
    GK: [ex('Lateral Bound + Stick (3 each)', '3', '3 each way', '2:00', 'Explosive bound. Stick the landing 1s. Prime reaction patterns.')],
    W: [ex('Block Start Acceleration', '4', '10m', '2:00', 'From 3-point. Max intent. Short and sharp. Fire the neuromuscular system.')],
    ST: [ex('5m Explosive Burst', '5', '5m', '90s', 'From varied stances. Max first step. Neural sharpness only.')],
  };

  return {
    mdDay: 'MD-1',
    dayOfWeek: dow,
    objective: 'Neural priming — activate fast-twitch fibres without accumulating fatigue. Arrive tomorrow sharp, not heavy.',
    readinessNote: 'MD-1 is always low load — do NOT add volume here regardless of readiness.',
    durationMin: 30,
    blocks: [
      {
        title: '🔥 Movement Prep',
        exercises: [
          ...WARMUP_MOBILITY.slice(0, 2),
          ex('A-Skip', '2', '20m', '30s', 'Neural warm-up. Crisp mechanics. Light and fast.'),
        ],
      },
      {
        title: '⚡ Neural Priming',
        exercises: [
          ...(positionPriming[position] ?? [
            ex('Build-Up Sprint (60→80→90%)', '4', '30m', '90s', 'Smooth progression. Wake up the nervous system — not a sprint test.'),
            ex('10m Acceleration Sprint', '3', '10m', '2:00', 'From walking start. Sharp first step. Full rest between reps.'),
          ]),
          ex('CMJ (3 reps)', '1', '3 reps', '2:00', 'Explosive jumps. Rest fully between. Neural activation — not conditioning.'),
        ],
      },
      {
        title: '🛡️ Pre-Match Prehab',
        exercises: [
          ex('Nordic Hamstring Curl (2 reps — sub-maximal)', '1', '2 reps', '', 'Light activation only. Protect hamstrings for match day.'),
          ex('Hip 90/90 Mobilisation', '1', '30s each side', '', 'Restore hip ROM before tomorrow\'s game.'),
        ],
      },
    ],
  };
}

// ── Apply readiness to exercises ───────────────────────────────────────────

function applyReadiness(
  exs: ProgrammeExercise[],
  level: 'high' | 'moderate' | 'low',
): ProgrammeExercise[] {
  if (level !== 'low') return exs;
  return exs.map(e => ({
    ...e,
    sets: e.sets === '5' ? '3' : e.sets === '4' ? '3' : e.sets,
    intensity: e.intensity ? `${e.intensity} → reduce to ~75%` : 'Reduce to 70–75% effort',
  }));
}

// ── Session objectives ─────────────────────────────────────────────────────

const MD4_OBJECTIVES: Record<string, string> = {
  Foundation: 'Establish movement patterns and build foundational strength. Quality before load — own every rep.',
  Build: 'Increase strength load with position-specific power. Push the adaptation — this is where gains are made.',
  'Strength & Power': 'Peak force production. High neural demand. Maximise every set with full recovery between.',
  Peak: 'Express strength — high intent, lower volume. Transfer what you\'ve built to pitch performance.',
};

const MD3_OBJECTIVES: Record<string, string> = {
  Foundation: 'Develop acceleration mechanics and position-specific movement patterns.',
  Build: 'Build max velocity. Position-specific speed at near-maximum effort.',
  'Strength & Power': 'Peak speed session. Flying sprints. Maximum velocity expression — the quality must be absolute.',
  Peak: 'Sharpen speed. Low volume, maximum quality. Arrive at match day fast.',
};

const MD2_OBJECTIVES: Record<string, string> = {
  Foundation: 'Build the aerobic base and reinforce movement quality. Moderate load — productive and controlled.',
  Build: 'Position-specific conditioning. Develop repeated-effort capacity relevant to your match demands.',
  'Strength & Power': 'High-intensity conditioning. Push work capacity without accumulating the fatigue that would affect match day.',
  Peak: 'Sharp, focused conditioning at match intensity. Keep it tight.',
};

// ── Main session builder ───────────────────────────────────────────────────

function buildSession(
  slot: MdSlot,
  inputs: ProgrammeInputs,
  phase: string,
  weekNum: number,
  readinessLevel: 'high' | 'moderate' | 'low',
): ProgrammeSession {
  if (slot.mdDay === 'MD+1') return recoverySession(slot.dayOfWeek);
  if (slot.mdDay === 'MD-1') return primingSession(slot.dayOfWeek, inputs.position);

  const { position, biggestWeakness, injuryHistory, gymAccess } = inputs;

  const strengthLib = STRENGTH[phase] ?? STRENGTH.Build;
  const strengthEx = strengthLib[gymAccess] ?? strengthLib.basic;
  const upperEx = UPPER[phase] ?? UPPER.Build;

  const posSpeedEx = POSITION_SPEED[position] ?? [];
  const accelEx = SPEED_ACCELERATION[phase] ?? SPEED_ACCELERATION.Foundation;

  const condEx = CONDITIONING[position]?.[phase] ?? CONDITIONING.CM.Foundation;
  const weaknessEx = WEAKNESS_EX[biggestWeakness]?.slice(0, 2) ?? [];

  // Prehab selection
  const prehabEx: ProgrammeExercise[] = [];
  for (const area of injuryHistory.slice(0, 2)) {
    const p = PREHAB[area];
    if (p) prehabEx.push(p[weekNum % p.length]);
  }
  if (prehabEx.length === 0) prehabEx.push(...DEFAULT_PREHAB);

  const readinessNote =
    readinessLevel === 'high'
      ? 'High readiness ✓ — Push hard today. Add a bonus set to your main lifts if you\'re feeling strong through the session.'
      : readinessLevel === 'moderate'
      ? 'Moderate readiness — Complete the programme as written. Monitor RPE set-to-set and adjust if effort spikes unexpectedly.'
      : 'Low readiness — Intensity reduced ~25%. Prioritise quality movement over load today. Strength comes back quickly.';

  // MD-4: Full strength
  if (slot.mdDay === 'MD-4') {
    return {
      mdDay: slot.mdDay,
      dayOfWeek: slot.dayOfWeek,
      objective: `MD-4 — ${MD4_OBJECTIVES[phase] ?? MD4_OBJECTIVES.Build}`,
      readinessNote,
      durationMin: readinessLevel === 'low' ? 50 : 70,
      blocks: [
        { title: '🔥 Warm-Up (12 min)', exercises: [...WARMUP_MOBILITY, ...WARMUP_STRENGTH.slice(0, 2)] },
        { title: '💪 Main Strength Block', exercises: applyReadiness(strengthEx, readinessLevel) },
        {
          title: '⚡ Power Superset',
          exercises: applyReadiness([
            ex('Jump Squat', '3', '4', '2:30', 'Load 30% bodyweight. Max upward intent. Land and reset — not a bounce.'),
            ex('Medicine Ball Slam', '3', '5', '90s', 'Absorb overhead, drive down with full-body tension. Aggressive.'),
          ], readinessLevel),
        },
        { title: '💪 Upper Body Accessory', exercises: applyReadiness(upperEx.slice(0, 2), readinessLevel) },
        { title: '🎯 Weakness Focus', exercises: weaknessEx },
        { title: '🛡️ Injury Prevention', exercises: prehabEx },
      ],
    };
  }

  // MD-3: Speed + strength accessories
  if (slot.mdDay === 'MD-3') {
    return {
      mdDay: slot.mdDay,
      dayOfWeek: slot.dayOfWeek,
      objective: `MD-3 — ${MD3_OBJECTIVES[phase] ?? MD3_OBJECTIVES.Build}`,
      readinessNote,
      durationMin: readinessLevel === 'low' ? 45 : 60,
      blocks: [
        { title: '🔥 Sprint Prep (15 min)', exercises: [...WARMUP_MOBILITY.slice(0, 2), ...WARMUP_SPEED] },
        {
          title: '⚡ Acceleration Block',
          exercises: [...accelEx.slice(0, 2), ...(posSpeedEx.slice(0, 1))],
        },
        {
          title: '💪 Strength Accessories',
          exercises: applyReadiness([
            strengthEx[1] ?? strengthEx[0],
            ex('Single-Leg Glute Bridge', '3', '15 each', '60s', 'Drive heel through floor. Full hip extension. Pelvis doesn\'t rotate.'),
          ], readinessLevel),
        },
        { title: '🎯 Weakness Focus', exercises: weaknessEx.slice(0, 1) },
        { title: '🛡️ Injury Prevention', exercises: prehabEx },
      ],
    };
  }

  // MD-2: Conditioning + technical speed
  if (slot.mdDay === 'MD-2') {
    return {
      mdDay: slot.mdDay,
      dayOfWeek: slot.dayOfWeek,
      objective: `MD-2 — ${MD2_OBJECTIVES[phase] ?? MD2_OBJECTIVES.Build}`,
      readinessNote,
      durationMin: readinessLevel === 'low' ? 40 : 55,
      blocks: [
        { title: '🔥 Warm-Up (10 min)', exercises: [...WARMUP_MOBILITY.slice(0, 3), ...WARMUP_NEURAL.slice(0, 1)] },
        { title: '🏃 Conditioning Block', exercises: applyReadiness([condEx], readinessLevel) },
        {
          title: '⚡ Technical Speed',
          exercises: posSpeedEx.length > 0 ? posSpeedEx.slice(0, 2) : accelEx.slice(0, 1),
        },
        { title: '🎯 Weakness Focus', exercises: weaknessEx },
        { title: '🛡️ Injury Prevention', exercises: prehabEx },
      ],
    };
  }

  // Fallback
  return primingSession(slot.dayOfWeek, position);
}

// ── Progressive overload note ──────────────────────────────────────────────

function progressNote(week: number): string {
  if (week <= 2) return 'Establish baseline loads — record everything.';
  if (week <= 4) return 'Add 2.5–5kg to compound lifts vs last week where technique allows.';
  if (week <= 8) return 'Push toward technical limit — RPE 8–9 on main sets.';
  return 'Final phase: reduce sets by 1, increase intensity — peak expression.';
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateProgramme(inputs: ProgrammeInputs): GeneratedProgramme {
  const { score, level: readinessLevel, guidance: readinessGuidance } = calcReadiness(inputs.readiness);
  const totalWeeks = durationWeeks(inputs.experienceYears);
  const slots = getMdSlots(inputs.sessionsPerWeek, inputs.matchDay);

  const POSITION_LABELS: Record<string, string> = {
    GK: 'Goalkeeper', CB: 'Centre Back', FB: 'Full Back',
    CM: 'Midfielder', W: 'Winger', ST: 'Striker',
  };
  const GOAL_LABELS: Record<string, string> = {
    speed: 'Speed & Acceleration', strength: 'Strength', power: 'Explosive Power',
    endurance: 'Endurance', injury_prevention: 'Injury Prevention',
  };

  const weeks: ProgrammeWeek[] = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNum = i + 1;
    const { phase, phaseGoal } = getPhase(weekNum, totalWeeks);
    const sessions = slots.map(slot => buildSession(slot, inputs, phase, weekNum, readinessLevel));

    return {
      weekNumber: weekNum,
      phase,
      phaseGoal: `${phaseGoal} [Week ${weekNum}: ${progressNote(weekNum)}]`,
      sessions,
    };
  });

  const pos = POSITION_LABELS[inputs.position] ?? inputs.position;
  const goal = GOAL_LABELS[inputs.primaryGoal] ?? inputs.primaryGoal;
  const matchStr = inputs.matchDay.charAt(0).toUpperCase() + inputs.matchDay.slice(1);

  return {
    id: `prog-${Date.now()}`,
    createdAt: Date.now(),
    title: `${pos} — ${goal} Programme`,
    summary: `${totalWeeks}-week personalised programme for a ${pos.toLowerCase()} targeting ${goal.toLowerCase()}. ${inputs.sessionsPerWeek} sessions/week · Match day: ${matchStr}.`,
    readinessScore: score,
    readinessLevel,
    readinessGuidance,
    durationWeeks: totalWeeks,
    inputs,
    weeks,
  };
}
