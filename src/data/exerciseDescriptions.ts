// How-to descriptions for every exercise.
// Shown in ExerciseDetail below the video (or instead of it when no video exists).

export interface ExerciseDescription {
  how: string[];              // numbered steps
  tips?: string[];            // coaching cues
  footballContext?: string;   // pitch/sport-specific note
}

export const EXERCISE_DESCRIPTIONS: Record<string, ExerciseDescription> = {

  // ── Chest ─────────────────────────────────────────────────────────────────
  'bench-press': {
    how: [
      'Lie flat on the bench, feet planted on the floor.',
      'Grip the bar just wider than shoulder-width, thumbs wrapped around.',
      'Unrack and lower the bar to your mid-chest with control (2–3 s).',
      'Press explosively back to the start without bouncing off your chest.',
    ],
    tips: ['Keep shoulder blades pinched together throughout.', 'Elbows at ~45° to your torso, not flared out.'],
  },
  'incline-bench': {
    how: [
      'Set bench to 30–45°. Lie back, feet flat on the floor.',
      'Grip bar slightly wider than shoulder-width.',
      'Lower to upper chest (clavicle line) under control.',
      'Press back to start, arms nearly fully extended.',
    ],
    tips: ['Higher angle = more front delt, less chest. 30° is optimal for upper pec.'],
  },
  'decline-bench': {
    how: [
      'Secure feet under the ankle pads, lie back on the declined bench.',
      'Grip bar just wider than shoulders.',
      'Lower bar to lower chest with a 2-second descent.',
      'Press back to the start position.',
    ],
    tips: ['Avoid excessive arch; keep core braced.'],
  },
  'db-fly': {
    how: [
      'Lie flat on bench holding dumbbells above chest, palms facing each other.',
      'With a slight bend in the elbows, lower the dumbbells in a wide arc until you feel a stretch in your chest.',
      'Squeeze the chest to bring the dumbbells back together in the same arc.',
      'Do not lock out or bang the dumbbells together at the top.',
    ],
    tips: ['Think "hugging a barrel". Keep the elbow angle constant throughout.', 'Go lighter than you think — it is a stretch exercise, not a press.'],
  },
  'cable-crossover': {
    how: [
      'Set pulleys to high position. Stand in the centre and grip handles, one in each hand.',
      'Step forward into a staggered stance. Lean slightly forward.',
      'With a soft bend in the elbows, pull the cables down and across your body until hands meet or cross at hip level.',
      'Slowly return to the start position, feeling the stretch in your chest.',
    ],
    tips: ['Angle can vary: high pulley → lower chest, low pulley → upper chest.'],
  },
  'push-up': {
    how: [
      'Start in a high plank: hands shoulder-width, body in a straight line from head to heels.',
      'Lower your chest to just above the floor keeping elbows at ~45°.',
      'Push back up to the start in one controlled motion.',
    ],
    tips: ['Do not let your hips sag or poke up. Squeeze your core and glutes.'],
  },
  'chest-dip': {
    how: [
      'Grip the parallel bars and support yourself with arms straight.',
      'Lean forward at roughly 30° to target the chest more than triceps.',
      'Lower until your upper arms are parallel to the floor.',
      'Push back to the start.',
    ],
    tips: ['Wider bars = more chest activation. Narrow bars = more tricep.'],
  },

  // ── Back ──────────────────────────────────────────────────────────────────
  'deadlift': {
    how: [
      'Bar over mid-foot. Stand hip-width apart.',
      'Hinge at the hips and grip the bar just outside your legs.',
      'Take a deep breath, brace your core, then drive your feet into the floor while keeping the bar close to your shins.',
      'Stand tall at the top. Reverse the movement to lower.',
    ],
    tips: ['Chest up, shoulders slightly in front of the bar at setup.', '"Push the floor away" rather than pulling with your back.'],
  },
  'pull-up': {
    how: [
      'Hang from a bar with an overhand grip, hands slightly wider than shoulder-width.',
      'Pull your shoulder blades down and back, then drive elbows towards your hips.',
      'Chin clears the bar at the top.',
      'Lower with control to a full hang.',
    ],
    tips: ['Initiate with the lats, not the arms.', 'Cross your feet and squeeze your glutes to stop swinging.'],
  },
  'chin-up': {
    how: [
      'Hang from a bar with an underhand (supinated) grip, hands shoulder-width apart.',
      'Pull until chin is above the bar, keeping elbows close to your body.',
      'Lower slowly with control.',
    ],
    tips: ['Supinated grip means more bicep involvement than pull-ups.'],
  },
  'barbell-row': {
    how: [
      'Hinge forward at the hips to about 45°, back flat, bar hanging below your chest.',
      'Drive your elbows back and up to row the bar to your lower sternum.',
      'Lower the bar under control; do not let it crash to the floor.',
    ],
    tips: ['Brace your core hard to protect your lower back.', 'Keep the bar close to your body throughout.'],
  },
  'cable-row': {
    how: [
      'Sit tall at the cable station, slight bend in the knees, back upright.',
      'Pull the handle to your lower stomach, leading with your elbows.',
      'Squeeze your shoulder blades together at the end point.',
      'Return the handle under control.',
    ],
    tips: ['Do not round your back on the return. Keep the torso still.'],
  },
  'lat-pulldown': {
    how: [
      'Sit with thighs secured under the pad. Grab the bar wider than shoulder-width, overhand grip.',
      'Lean back slightly, then pull the bar down to your upper chest.',
      'Squeeze the lats and slowly let the bar rise back to the start.',
    ],
    tips: ['Think "elbows to the floor" rather than pulling with your hands.'],
  },
  'face-pull': {
    how: [
      'Set a cable machine to head height with a rope attachment.',
      'Grip the rope with both hands, thumbs pointing towards you.',
      'Pull the rope towards your face, splitting the rope at the end so hands go to either side of your head.',
      'Return slowly.',
    ],
    tips: ['Great for rotator cuff and posture. Keep elbows high throughout.'],
  },
  'db-row': {
    how: [
      'Place one knee and one hand on a bench for support.',
      'Hold a dumbbell in the free hand, arm hanging straight.',
      'Row the dumbbell to your hip, keeping your elbow close to your body.',
      'Lower slowly.',
    ],
    tips: ['Think about driving your elbow back, not lifting the dumbbell up.'],
  },

  // ── Shoulders ─────────────────────────────────────────────────────────────
  'ohp': {
    how: [
      'Stand with the bar at collarbone height, hands just outside shoulder-width.',
      'Brace your core and glutes, then press the bar straight overhead.',
      'At the top, push your head through so ears are in front of your arms.',
      'Lower the bar back to your collarbone under control.',
    ],
    tips: ['Do not hyperextend your lower back. Squeeze your glutes throughout.'],
  },
  'db-ohp': {
    how: [
      'Sit or stand. Hold dumbbells at shoulder height, palms facing forward.',
      'Press both dumbbells overhead until arms are nearly straight.',
      'Lower with control to shoulder height.',
    ],
    tips: ['Seated version removes leg drive and isolates the shoulder better.'],
  },
  'lateral-raise': {
    how: [
      'Stand with dumbbells at your sides.',
      'Raise arms out to the side until parallel to the floor (elbows slightly bent throughout).',
      'Lower slowly, taking 2–3 seconds.',
    ],
    tips: ['Lead with your pinkies (externally rotate) to better target the lateral delt.', 'Avoid swinging — go lighter if you have to.'],
  },
  'front-raise': {
    how: [
      'Stand with dumbbells in front of your thighs.',
      'Raise one or both dumbbells straight in front of you to shoulder height.',
      'Lower under control.',
    ],
    tips: ['Keep a slight bend in the elbow. Do not use momentum.'],
  },
  'rear-delt-fly': {
    how: [
      'Hinge forward at the hips to roughly 45°, or use an incline bench face-down.',
      'Hold dumbbells below your chest with arms hanging.',
      'Raise the dumbbells out to the side, squeezing your rear delts and rhomboids.',
      'Lower slowly.',
    ],
    tips: ['Keep the elbow angle consistent. Aim for shoulder height at the top.'],
  },
  'shrug': {
    how: [
      'Hold a barbell or dumbbells with arms straight, hands shoulder-width.',
      'Shrug your shoulders straight up towards your ears as high as possible.',
      'Hold 1 second, then lower slowly.',
    ],
    tips: ['Do not roll your shoulders — just straight up and down.'],
  },

  // ── Arms ──────────────────────────────────────────────────────────────────
  'barbell-curl': {
    how: [
      'Stand with the barbell in an underhand grip, hands shoulder-width.',
      'Keeping your elbows pinned to your sides, curl the bar to your upper chest.',
      'Lower slowly, maintaining tension.',
    ],
    tips: ['Do not swing. Only your forearms should move.'],
  },
  'db-curl': {
    how: [
      'Stand or sit holding dumbbells with palms facing forward.',
      'Curl one or both dumbbells to shoulder height.',
      'Squeeze the bicep at the top, then lower with control.',
    ],
    tips: ['Supinate (turn) your wrist as you curl for a better peak contraction.'],
  },
  'hammer-curl': {
    how: [
      'Stand holding dumbbells with palms facing each other (neutral grip).',
      'Curl both dumbbells together to shoulder height, keeping palms facing inward.',
      'Lower slowly.',
    ],
    tips: ['Targets the brachialis and brachioradialis more than standard curls.'],
  },
  'preacher-curl': {
    how: [
      'Sit at a preacher bench with the top of your upper arms on the angled pad.',
      'Hold the EZ-bar or dumbbells at the bottom.',
      'Curl the weight to shoulder height, keeping your upper arms pressed to the pad.',
      'Lower slowly to full extension.',
    ],
    tips: ['Full extension at the bottom gives a deep bicep stretch. Do not drop the weight down.'],
  },
  'tricep-pushdown': {
    how: [
      'Set a cable to a high position with a bar or rope attachment.',
      'Stand with arms close to your body, elbows at your sides.',
      'Push the bar/rope down until your arms are fully extended.',
      'Return slowly, stopping when forearms are about parallel to the floor.',
    ],
    tips: ['Keep your elbows fixed — only your forearms move.'],
  },
  'skull-crusher': {
    how: [
      'Lie on a bench holding an EZ-bar or dumbbells with arms straight above your chest.',
      'Keeping your upper arms vertical, bend your elbows and lower the weight towards your forehead.',
      'Press back to the start.',
    ],
    tips: ['Keep upper arms perpendicular to the floor throughout.', 'A slight backward lean of the upper arm allows more tricep stretch.'],
  },
  'overhead-tri-ext': {
    how: [
      'Stand or sit. Hold one dumbbell (both hands) or dumbbells behind your head, elbows pointing forward.',
      'Extend your elbows to press the weight overhead.',
      'Lower slowly to feel the stretch in the tricep.',
    ],
    tips: ['Best long-head tricep exercise. Keep elbows tucked in — do not flare out.'],
  },
  'close-grip-bench': {
    how: [
      'Lie on a flat bench. Grip the barbell with hands about shoulder-width (narrower than a normal bench).',
      'Lower the bar to your lower chest.',
      'Press back to the start with a focus on driving through your triceps.',
    ],
    tips: ['Do not go too narrow — shoulder-width is narrow enough. Wrists can strain with a very close grip.'],
  },

  // ── Legs ──────────────────────────────────────────────────────────────────
  'squat': {
    how: [
      'Bar rests on upper traps. Stand hip-to-shoulder width, toes slightly out.',
      'Brace core, take a deep breath, then sit back and down, tracking knees over toes.',
      'Descend until thighs are at least parallel to the floor.',
      'Drive through your full foot to stand, maintaining a neutral spine.',
    ],
    tips: ['Think "spread the floor" with your feet. Keep your chest up.', 'Depth first, then load.'],
  },
  'front-squat': {
    how: [
      'Bar rests on the front of the shoulders (front rack position). Elbows high.',
      'Stand hip-width, toes slightly out.',
      'Descend keeping torso as upright as possible until thighs are parallel.',
      'Drive up through your heels and midfoot.',
    ],
    tips: ['Upright torso is essential. Weak wrists or thoracic mobility limit performance here.'],
  },
  'leg-press': {
    how: [
      'Sit in the machine with feet on the platform hip-width apart.',
      'Lower the platform until knees reach 90°.',
      'Press back to the start, stopping just short of locking out.',
    ],
    tips: ['Higher foot placement = more glutes/hams. Lower = more quads.', 'Do not let your lower back lift off the seat.'],
  },
  'rdl': {
    how: [
      'Stand holding a barbell at hip height, arms straight.',
      'Hinge at the hips, pushing them back as the bar lowers along your legs.',
      'Descend until you feel a strong hamstring stretch (roughly mid-shin for most).',
      'Drive your hips forward to return to standing.',
    ],
    tips: ['Soft knees, not locked. Keep the bar close to your legs.'],
  },
  'leg-curl': {
    how: [
      'Lie face-down on the machine. Pad sits just above your heels.',
      'Curl your heels towards your glutes as far as possible.',
      'Lower slowly to the start.',
    ],
    tips: ['Avoid lifting your hips off the pad. Slow the lowering phase for more hamstring stimulus.'],
  },
  'leg-extension': {
    how: [
      'Sit in the machine. Pad rests against the front of your ankles.',
      'Extend your legs until straight.',
      'Squeeze the quads at the top, then lower under control.',
    ],
    tips: ['Use a slower lowering phase (3 s) for more eccentric quad loading.'],
  },
  'lunge': {
    how: [
      'Stand tall. Step forward with one foot into a lunge.',
      'Lower until your back knee is an inch off the floor.',
      'Drive through your front heel to return to standing.',
      'Alternate legs.',
    ],
    tips: ['Keep your torso upright. Front knee stays behind your toes.'],
  },
  'hip-thrust': {
    how: [
      'Sit with your upper back against a bench, barbell across your hips.',
      'Plant feet flat on the floor, hip-width apart.',
      'Drive your hips to the ceiling until your body forms a straight line from shoulders to knees.',
      'Hold 1 second at the top, then lower under control.',
    ],
    tips: ['Chin to chest at the top to keep the spine neutral, not hyperextended.', 'Drive through your whole foot.'],
  },
  'calf-raise': {
    how: [
      'Stand on the edge of a step (or flat ground), heels hanging off.',
      'Rise up onto your toes as high as possible.',
      'Lower slowly, letting your heels drop below the step level for a full stretch.',
    ],
    tips: ['Slow lowering (3–4 s) for the best stimulus. Heavy and slow beats light and bouncy.'],
  },
  'nordic-curl': {
    how: [
      'Kneel on a mat with ankles secured under a bar or by a partner.',
      'With a straight body from knees to head, lower your torso towards the floor under control.',
      'Catch yourself with your hands as you fall, then push back up to the start.',
    ],
    tips: ['The lowering (eccentric) phase is the key — make it as slow as possible.', 'Start with 3–5 reps and build up — this is very demanding.'],
  },

  // ── Core ──────────────────────────────────────────────────────────────────
  'plank': {
    how: [
      'Forearms on the floor, elbows under shoulders. Feet together.',
      'Raise your hips so your body forms a straight line from head to heels.',
      'Hold the position, breathing steadily.',
    ],
    tips: ['Squeeze your glutes and core — do not let your hips sag or rise.', 'Look at the floor to keep a neutral neck.'],
  },
  'crunch': {
    how: [
      'Lie on your back, knees bent, hands lightly behind your head.',
      'Curl your shoulders off the floor, leading with your sternum towards your knees.',
      'Lower slowly back to the floor.',
    ],
    tips: ['Do not pull your neck. The movement comes from the abs, not the arms.'],
  },
  'ab-wheel': {
    how: [
      'Kneel on a mat. Hold the ab wheel with both hands on the floor in front of you.',
      'Roll the wheel forward, keeping your hips down and core braced, until your body is almost parallel to the floor.',
      'Contract your abs to pull yourself back to the start.',
    ],
    tips: ['Do not let your hips drop or your lower back hyperextend on the way out.', 'Start with short ranges and build up.'],
  },
  'hanging-leg-raise': {
    how: [
      'Hang from a pull-up bar with arms fully extended.',
      'With legs straight (or knees bent for beginners), raise your legs until thighs are parallel to the floor or higher.',
      'Lower slowly without swinging.',
    ],
    tips: ['Avoid using momentum. The slower the lowering, the harder it is — and the better.'],
  },
  'russian-twist': {
    how: [
      'Sit on the floor, knees bent, feet either flat or raised.',
      'Lean back slightly so your torso is at ~45°.',
      'Hold a weight or clasp your hands together. Rotate your torso side to side, touching the floor (or weight) beside each hip.',
    ],
    tips: ['Keep your chest up and back from rounding. The movement is a rotation, not a lean.'],
  },
  'cable-crunch': {
    how: [
      'Kneel facing a cable machine set to high, holding a rope attachment behind/beside your head.',
      'Flex (crunch) downward, pulling your elbows towards your knees.',
      'Slowly return to the upright position.',
    ],
    tips: ['Move from the abs — do not pull with your arms or hip-flex the weight down.'],
  },

  // ── Cardio ────────────────────────────────────────────────────────────────
  'treadmill': {
    how: [
      'Set your desired speed and incline.',
      'Land mid-foot beneath your hips, not out in front.',
      'Keep your arms at ~90° and drive them in opposition to your legs.',
      'Stay tall — no slouching or gripping the rails.',
    ],
    tips: ['1% incline mimics outdoor running resistance.', 'For fitness testing, use consistent speed and duration.'],
  },
  'rowing-machine': {
    how: [
      'Sit on the seat, strap feet in, grip the handle.',
      'The stroke: drive through your legs first, lean back slightly, then pull the handle to your lower ribs.',
      'Return by extending your arms, leaning forward, then bending your knees.',
    ],
    tips: ['Legs → back → arms on the drive. Arms → back → legs on the recovery.', 'Keep your core braced to transfer leg power efficiently.'],
  },
  'bike': {
    how: [
      'Adjust seat height so there is a slight bend in the knee at the bottom of the pedal stroke.',
      'Maintain an upright or slightly forward torso.',
      'Pedal smoothly, aiming for a consistent cadence.',
    ],
    tips: ['For HIIT: alternate 20–30 s maximum effort with 40–60 s easy pedalling.'],
  },
  'jump-rope': {
    how: [
      'Hold handles at hip height. Jump with feet together, clearing the rope with minimal height (2–3 cm).',
      'Land on the balls of your feet.',
      'Use wrist rotation to turn the rope, not your arms.',
    ],
    tips: ['Start with 30 s on / 30 s rest. Work up to 60 s continuous.'],
  },

  // ── Full Body ─────────────────────────────────────────────────────────────
  'thruster': {
    how: [
      'Hold a barbell or dumbbells in a front rack position at shoulder height.',
      'Perform a front squat to parallel.',
      'As you drive out of the squat, use the momentum to press the bar/dumbbells overhead.',
      'Lower back to the front rack position and repeat.',
    ],
    tips: ['The squat and press must flow as one continuous movement.'],
  },
  'burpee': {
    how: [
      'Stand upright. Drop your hands to the floor and jump your feet back to a plank.',
      'Perform a push-up.',
      'Jump your feet to your hands, then explode upward with a jump and arm reach overhead.',
    ],
    tips: ['Modify by stepping instead of jumping if needed. For football conditioning, use 10 s rest between reps.'],
    footballContext: 'Used in conditioning circuits. On a pitch: perform at the byline, sprint 10m, return — repeat for multiple reps.',
  },
  'kettlebell-swing': {
    how: [
      'Stand with feet shoulder-width, kettlebell on the floor between your feet.',
      'Hinge at the hips to grip the bell, then hike it back between your legs.',
      'Explosively drive your hips forward to swing the bell to shoulder height.',
      'Let it fall back between your legs and repeat.',
    ],
    tips: ['This is a HIP HINGE, not a squat. Power comes from your glutes, not your shoulders.'],
  },


  // ── Eccentric ─────────────────────────────────────────────────────────────
  'eccentric-nordic': {
    how: [
      'Kneel on a mat with ankles secured by a partner or under a bar.',
      'With body straight from knees to head, lower your torso towards the floor as SLOWLY as possible.',
      'Catch yourself with your hands just before hitting the floor.',
      'Push back up with your hands and use your hamstrings to help return to kneeling.',
    ],
    tips: ['The lowering phase (eccentric) is the entire point. Aim for 5–8 seconds down.', 'Start with 3 reps and add reps gradually each week.'],
    footballContext: 'The single most evidence-based exercise for hamstring injury prevention in football. Used by all top clubs.',
  },
  'eccentric-calf-raise': {
    how: [
      'Stand on the edge of a step with the ball of one foot on the edge.',
      'Rise up on BOTH feet, then lower on ONE foot as slowly as possible (4–6 s).',
      'Use both feet to return to the top, lower on one foot again.',
    ],
    tips: ['This targets the gastrocnemius (straight knee). For the soleus, bend the knee slightly.', 'Heavy load can be added via a backpack or weighted vest.'],
    footballContext: 'Prevents Achilles tendinopathy and calf strains — two of the most common football injuries.',
  },
  'eccentric-soleus': {
    how: [
      'Same setup as eccentric calf raise but on a step.',
      'Bend your working knee to ~45° throughout the movement.',
      'Rise up on both feet (knee bent), lower on one foot (knee bent) as slowly as possible.',
    ],
    tips: ['Knee bend shifts load from the gastrocnemius to the soleus — a deeper calf muscle often missed.'],
    footballContext: 'Specifically targets Achilles tendon health, critical for sprinting and change of direction.',
  },
  'eccentric-step-down': {
    how: [
      'Stand on a step or box on one leg, other leg hanging in the air.',
      'Slowly lower your hanging foot towards the floor by bending the standing knee (5 s down).',
      'Stop before your foot touches the floor, then straighten back up.',
    ],
    tips: ['Keep your pelvis level — do not let the hanging hip drop.', 'Great for VMO (inner quad) and knee health.'],
    footballContext: 'Reduces anterior knee pain (patellofemoral) — common in players who do high running volumes.',
  },
  'eccentric-sl-rdl': {
    how: [
      'Stand on one leg. Hold a dumbbell in the opposite hand.',
      'Hinge forward at the hip, lowering the weight along your leg SLOWLY (4–5 s).',
      'Return to standing.',
    ],
    tips: ['The lower you go, the more hamstring stretch — stop at mid-shin if unsure.', 'Focus on feeling the hamstring under tension, not just balancing.'],
  },
  'eccentric-hip-adductor': {
    how: [
      'Lie on your side. Rest your top leg on a raised surface (bench, partner, physio table).',
      'Slowly lower your bottom leg away from the bench under control (4–5 s).',
      'Return using both legs if needed.',
    ],
    tips: ['Targets the adductors (groin). Critical for preventing adductor strains in football.'],
    footballContext: 'Adductor strains are one of the top 3 injuries in football. This exercise directly prevents them.',
  },
  'eccentric-psoas': {
    how: [
      'Lie on a table or high bench with your hips at the edge. Pull one knee to your chest.',
      'Allow the hanging leg to slowly lower towards the floor (3–4 s) against gravity.',
      'Bring it back up using your hip flexor.',
    ],
    tips: ['Only go as far as you can control. Do not let your lower back arch excessively.'],
    footballContext: 'Targets the iliopsoas (hip flexor) eccentrically — key for kicking and sprinting mechanics.',
  },
  'copenhagen-adductor': {
    how: [
      'Lie on your side. Place your top foot on a bench/box. Bottom leg can be bent or straight.',
      'Push up so your body is supported by your top foot and your hand/forearm.',
      'Lower your hips towards the floor (the eccentric phase), then push back up.',
    ],
    tips: ['Start with the bottom knee bent (easier). Straight bottom leg is much harder.'],
    footballContext: 'Among the best exercises for reducing groin injuries in footballers. Used in the FIFA 11+ programme.',
  },
  'spanish-squat': {
    how: [
      'Wrap a band around a rack or post at knee height. Step back until there is good tension.',
      'Squat down so the band pushes your knees forward while your shins stay vertical.',
      'Hold at the bottom (knee bend ~90°) for the prescribed time.',
    ],
    tips: ['The band creates knee-forward loading without ankle mobility demands.', 'Used extensively in patellar tendon rehab.'],
  },
  'band-hip-abduction': {
    how: [
      'Place a resistance band around your ankles (or above the knees for more tension).',
      'Walk sideways in a quarter-squat position, stepping out with the lead foot and following with the trail foot.',
      'Keep your hips low and toes pointing forward throughout.',
    ],
    tips: ['Do not let your knee cave inward. Keep tension in the band at all times.'],
    footballContext: 'Activates glute medius, which stabilises the hip and knee during running, cutting, and landing.',
  },
  'adductor-squeeze': {
    how: [
      'Lie on your back, knees bent, feet flat. Place a medicine ball or rolled towel between your knees.',
      'Squeeze the object with your knees as hard as possible.',
      'Hold for the prescribed time.',
    ],
    tips: ['Isometric adductor work is safe early in a groin rehab or prehab programme.'],
  },
  'reverse-nordic': {
    how: [
      'Kneel on a mat with ankles secured.',
      'Keeping your hips extended (body straight from knees to head), lean BACK as slowly as possible.',
      'Return to upright using your quadriceps.',
    ],
    tips: ['This is eccentric quad loading — the reverse of the nordic curl (hamstrings).', 'Helps with patellar tendon health and quad resilience for jumping and landing.'],
    footballContext: 'Targets the quads eccentrically — critical for landing safely from jumps and decelerating at top speed.',
  },

  // ── Speed & Agility ───────────────────────────────────────────────────────
  'pogo-jump': {
    how: [
      'Stand tall. Jump continuously using only your ankles and calves — knees should barely bend.',
      'Contact time with the ground should be very short (under 200ms).',
      'Land on the balls of your feet and immediately bounce back up.',
    ],
    tips: ['Think of your legs as stiff springs. Minimal knee bend is the key.', 'Start with 10 reps and work up to 3 × 20 reps.'],
    footballContext: 'Trains the reactive strength of the Achilles/calf system — essential for the reactive ground contacts in sprinting.',
  },
  'ankle-hop': {
    how: [
      'Stand with feet hip-width. Perform rapid, continuous hops staying on your toes.',
      'Cover small ground (forward, sideways, or in a square pattern).',
      'Minimise time on the ground and keep the upper body relaxed.',
    ],
    tips: ['Can be done in a ladder or between cones. Progress from double-leg to single-leg.'],
    footballContext: 'Builds the "stiffness" in the lower leg needed for rapid change of direction on a football pitch.',
  },
  'lateral-bound': {
    how: [
      'Stand on one foot. Bound explosively sideways, landing on the opposite foot.',
      'Absorb the landing, hold briefly to stabilise, then bound back.',
    ],
    tips: ['Focus on a strong, STABLE landing. Wobble = weakness. Stick each rep before rebounding.'],
    footballContext: 'Mimics the lateral acceleration patterns used when cutting past opponents.',
  },
  'reactive-drop-jump': {
    how: [
      'Stand on a box (30–50 cm). Step off — do NOT jump off.',
      'As soon as you touch the ground, immediately jump as high as possible.',
      'Minimise ground contact time.',
    ],
    tips: ['The key metric is short ground contact time + maximal jump height (RSI).', '"Reactive" means the jump should happen instantly — no pause on the ground.'],
    footballContext: 'Trains the stretch-shortening cycle at the speeds encountered when landing from headers and decelerating from sprints.',
  },
  'deceleration-drill': {
    how: [
      'Sprint at full speed for 10m, then decelerate to a complete stop within 3–5m.',
      'Focus on a "braking" step — front foot lands heel-to-toe in front of your body mass.',
      'Repeat from a standing start after each decel.',
    ],
    tips: ['Poor deceleration mechanics cause hamstring and ACL injuries. Learn to brake in 2–3 steps.'],
    footballContext: 'On a pitch: sprint from the penalty spot towards the halfway line (≈28m), then brake inside the centre circle. Rest 45 s between efforts.',
  },
  'lateral-shuffle': {
    how: [
      'Stand in a quarter-squat athletic stance.',
      'Shuffle sideways, leading with one foot and following with the other. Keep feet from crossing.',
      'Stay low and push off the outside foot.',
    ],
    tips: ['Hips stay square and low throughout. Do not bounce.'],
    footballContext: 'Covers the same movement pattern used when tracking a winger or marking in a back-pedal.',
  },
  'approach-jump': {
    how: [
      'Take 3–5 approach strides, then plant and jump for maximum height.',
      'Use a two-foot takeoff. Swing arms explosively upward.',
      'Land softly on both feet.',
    ],
    tips: ['The approach allows greater speed into the jump, producing higher heights than a standing jump.'],
    footballContext: 'Replicates heading jumps where a player accelerates and jumps for a cross. Use a 5m run-up on the pitch.',
  },
  'reactive-45-cut': {
    how: [
      'Place a cone 5m in front. Sprint to the cone.',
      'On a visual or audio cue, cut at 45° left or right and accelerate for 5m.',
    ],
    tips: ['The reactive element is essential — reacting to a signal trains faster decision + movement.'],
    footballContext: 'Mimics pressing triggers and off-ball runs. On the pitch: use the penalty area corner as the cut point.',
  },
  'pro-agility': {
    how: [
      'Set three cones in a line, 5 yards (4.57m) apart.',
      'Start at the middle cone. Sprint 5 yards right, touch the line.',
      'Sprint 10 yards left, touch the line.',
      'Sprint 5 yards back through the middle cone. Time from first movement to crossing the finish.',
    ],
    tips: ['Drive off the outside foot on each turn. Keep your hips low.', 'Target times: elite footballers aim for under 4.5 s.'],
    footballContext: 'The 5-10-5 drill maps perfectly to the short, sharp directional changes made in and around the penalty area.',
  },

  // ── Conditioning ─────────────────────────────────────────────────────────
  'aerobic-threshold-run': {
    how: [
      'Run at a pace where you can hold a full conversation — roughly 60–70% of your max heart rate.',
      'Maintain the same pace for the full duration (20–40 min is typical).',
      'Do NOT push hard — the goal is volume at low intensity.',
    ],
    tips: ['If your heart rate drifts above 75% HR max, slow down.', 'Best done as a continuous jog or low-intensity treadmill run.'],
    footballContext: 'Builds the aerobic base needed to recover between sprints. On a football pitch: run 6–8 laps of the perimeter (total pitch perimeter ≈ 340m per lap) at a comfortable jogging pace.',
  },
  'tempo-run': {
    how: [
      'Run at a "comfortably hard" pace — roughly 80–85% of your max heart rate. You should be able to say a few words, not hold a conversation.',
      'Sustain the effort for the prescribed duration.',
    ],
    tips: ['Heart rate should stabilise — if it keeps rising, slow down.'],
    footballContext: 'Trains the lactate threshold — the pace at which football becomes physically demanding. On a pitch: jog the width (68m), sprint the length (105m), walk the width, jog the length — 4 laps = 1 set.',
  },
  'hiit-run': {
    how: [
      'Alternate between sprint efforts (85–100% max effort) and recovery jogs or walks.',
      'Typical format: 30 s on / 30 s off, or 40 s on / 20 s off, for 8–12 rounds.',
    ],
    tips: ['The work interval must be HARD. If you can keep going comfortably, you are not working hard enough.'],
    footballContext: 'Mirrors the high-intensity intermittent pattern of a football match. On a pitch: sprint from byline to halfway line (≈52m), walk back — repeat for 8–12 reps with 30 s rest each.',
  },
  'repeated-sprint': {
    how: [
      'Mark out 30 metres (or use pitch markings — from the penalty spot to 2m inside the centre circle is approximately 30m).',
      'Sprint the full 30m at maximum effort.',
      'Walk or jog back to the start in the rest period.',
      'Repeat for the prescribed number of reps.',
    ],
    tips: ['Every sprint should be at 100% effort. If your time drops by >5%, the session is over.', 'Typical protocol: 6–10 × 30m with 30 s rest between each.'],
    footballContext: `On a standard pitch (100-110m × 64-75m):
• 30m sprint = from the goal line to just past the top of the penalty area (16.5m), i.e. to the 30m mark.
• Alternatively, sprint from the halfway line to 5m into the opposing half.
• Use cones or existing pitch markings to set your distance accurately.`,
  },
  'shuttle-run': {
    how: [
      'Set cones at 0m, 5m, and 10m.',
      'Start at 0m. Sprint to 5m, touch the ground, sprint back to 0m, touch, sprint to 10m, touch, sprint back to 0m.',
      'Total distance = 30m. Time the full effort.',
    ],
    tips: ['Drive off your outside foot on each turn. Plant and go.'],
    footballContext: `On a pitch, use the pitch markings:
• Use the goal line as the 0m point.
• 5m line = the goal area line (5.5m from goal line).
• 10m line = halfway between goal area and penalty area.
This shuttle directly trains the short-burst changes of direction used in defending set pieces.`,
  },
  'ssg-simulation': {
    how: [
      'Run a pattern that mimics a small-sided game: jog → sprint → lateral shuffle → jog → sprint again.',
      'Change direction and pace every 5–15 seconds.',
      'Total duration is typically 3–8 minutes per set.',
    ],
    tips: ['Use cones to create a small box (20×30m). Work continuously within the box, changing pace every 5–10 s.'],
    footballContext: 'Replicates the metabolic demands of a 3v3 or 4v4 game without the ball. On a pitch, set out cones inside the penalty area (20m × 40m box).',
  },
  'lactate-threshold-run': {
    how: [
      'Run at a pace just below the point where lactic acid builds up faster than you can clear it.',
      'A 20–40 minute run at roughly 80–85% max heart rate.',
      'No walking; this is a sustained, moderate-high intensity effort.',
    ],
    tips: ['The gold standard is a pace 15–20 s/km slower than your 5k race pace.'],
    footballContext: 'Critical for late-game fitness. Players with higher LT can maintain higher sprint speeds towards the 80th minute. On the pitch: run pitch-length shuttles (105m ×2 = 210m) at a controlled tempo for 20 min.',
  },
  'agility-circuit': {
    how: [
      'Set up a series of cones, poles, or hurdles in a circuit.',
      'Move through the circuit performing different movements: sprint, shuffle, backpedal, cone weave.',
      'The circuit should take 20–40 s to complete. Time each rep.',
    ],
    tips: ['Rest 2–3× the work time between reps. Quality over fatigue.'],
    footballContext: `A typical football agility circuit on the pitch:
1. Sprint 10m to first cone.
2. Lateral shuffle 5m right to second cone.
3. Backpedal 5m to third cone.
4. Sprint diagonally 8m to finish.
Total ≈ 28m — mimics a defender tracking a forward.`,
  },

  // ── Isometric ─────────────────────────────────────────────────────────────
  'wall-sit': {
    how: [
      'Stand with your back flat against a wall.',
      'Slide down until your thighs are parallel to the floor and knees are at 90°.',
      'Hold this position. Feet flat on the floor, directly under your knees.',
    ],
    tips: ['Do not push your knees together — keep them above your feet.', 'Arms can be straight out or resting on your thighs.'],
  },
  'side-plank': {
    how: [
      'Lie on your side. Prop yourself up on one forearm (elbow under shoulder) and the side of your foot.',
      'Raise your hips so your body forms a straight line from head to feet.',
      'Hold. Do not let your hips sag.',
    ],
    tips: ['Stack your feet or stagger them for better stability.', 'Drive your elbow into the floor to stay braced.'],
  },
  'hollow-hold': {
    how: [
      'Lie on your back. Raise your shoulders and legs off the floor simultaneously.',
      'Arms extend overhead, legs straight (or slightly bent for beginners).',
      'Press your lower back into the floor — there should be NO gap between your back and the floor.',
    ],
    tips: ['If you feel your lower back arching, raise your legs higher or bend them.'],
  },
  'superman-hold': {
    how: [
      'Lie face-down on the floor, arms extended overhead.',
      'Simultaneously raise your chest, arms, and legs off the floor.',
      'Hold the position, squeezing your glutes and back muscles.',
    ],
    tips: ['Do not crank your neck — look at the floor. Only your torso and legs should lift.'],
  },
  'dead-hang': {
    how: [
      'Grip a pull-up bar with a shoulder-width overhand grip.',
      'Let your body hang fully relaxed — arms straight, shoulders elevated.',
      'Hold for time.',
    ],
    tips: ['Excellent for shoulder health, spinal decompression, and grip strength.', 'If you cannot hang for 30 s, use an assisted hang.'],
  },
  'l-sit': {
    how: [
      'Sit on the floor between two parallettes (or the floor if strong enough).',
      'Straighten your legs in front, press through your hands to lift your hips off the floor.',
      'Hold with body at a 90° angle — legs parallel to the floor.',
    ],
    tips: ['This is VERY hard. Most people start with one leg tucked. Build from tuck L-sit.'],
  },
  'copenhagen-plank': {
    how: [
      'Lie on your side. Place your top foot on a bench, bottom leg hanging in the air.',
      'Lift your hips into a side plank position, supported by your top foot and forearm.',
      'Hold. The key is NOT letting your hips rotate or drop.',
    ],
    tips: ['Much harder than a regular side plank. The adductors of the top leg are working hard.'],
    footballContext: 'Among the best exercises for groin (adductor) strength and injury prevention. Used in the Copenhagen protocol for professional footballers.',
  },
  'iso-squat-hold': {
    how: [
      'Descend into a squat until thighs are parallel (or to your desired angle).',
      'Hold the position for the prescribed time.',
      'Keep chest up, core braced, weight through the whole foot.',
    ],
    tips: ['Great for building quad tendon resilience. Can be loaded with a barbell or goblet position.'],
  },
  'iso-lunge-hold': {
    how: [
      'Step into a lunge position. Lower until back knee is just above the floor.',
      'Hold the bottom position for the prescribed time.',
      'Keep torso upright.',
    ],
    tips: ['Isometric lunges at 90° are used in patellar tendon pain management protocols.'],
  },
  'iso-bicep-curl': {
    how: [
      'Stand holding a weight with your arm bent at 90°.',
      'Hold the position without moving. Resist against a fixed surface or simply hold the load.',
    ],
    tips: ['The isometric produces peak muscle tension at the specified angle.'],
  },
  'iso-chest-squeeze': {
    how: [
      'Hold a medicine ball, plate, or press your palms together in front of your chest.',
      'Squeeze as hard as possible — pushing your hands together or into the object.',
      'Hold for the prescribed time.',
    ],
    tips: ['Squeeze hard enough to feel your pectorals working throughout.'],
  },
  'iso-row-hold': {
    how: [
      'Perform a cable row or dumbbell row and hold the contracted position (elbows pulled back fully).',
      'Do not let the weight pull you forward. Hold for the prescribed time.',
    ],
    tips: ['Builds scapular stability important for shoulder health.'],
  },
  'glute-bridge-hold': {
    how: [
      'Lie on your back. Bend knees, feet flat on floor.',
      'Drive hips to the ceiling and hold at the top.',
      'Squeeze glutes hard. Lower back should be flat, not arched.',
    ],
    tips: ['Can be loaded with a barbell or plate across the hips.'],
  },
  'calf-raise-hold': {
    how: [
      'Rise up onto your toes on a step or flat ground.',
      'Hold the top position, balancing on the balls of your feet.',
      'Keep the load through both feet equally (or one foot for an advanced version).',
    ],
    tips: ['Isometric calf loading is used in Achilles tendon pain management.'],
  },

  // ── Plyometrics ───────────────────────────────────────────────────────────
  'box-jump': {
    how: [
      'Stand in front of a box (start 40–60 cm). Feet shoulder-width.',
      'Dip quickly into a quarter-squat, then jump explosively onto the box.',
      'Land softly on the WHOLE foot in a quarter-squat position.',
      'Stand up, then step (not jump) down. Reset and repeat.',
    ],
    tips: ['Prioritise landing mechanics over box height. A perfect landing is more important than a taller box.'],
    footballContext: 'Trains explosive hip and leg power directly transferable to jumping for headers and accelerating from a standing start.',
  },
  'depth-jump': {
    how: [
      'Stand on a box (30–50 cm). Step off — do NOT jump off.',
      'As SOON as your feet touch the ground, immediately jump as high as possible.',
      'Minimise the time your feet are on the ground.',
    ],
    tips: ['If ground contact time is long, the box is too high. Use a smaller box.'],
    footballContext: 'Trains the reactive strength needed for second-ball jumping and landing from headers.',
  },
  'broad-jump': {
    how: [
      'Stand with feet shoulder-width at the start line.',
      'Swing arms back, then drive them forward explosively as you jump as far forward as possible.',
      'Land on both feet and stick the landing.',
    ],
    tips: ['Measure from the takeoff line to your back heel on landing.'],
  },
  'jump-squat': {
    how: [
      'Stand with feet shoulder-width. Descend to a quarter-squat.',
      'Explode upward as high as possible.',
      'Land softly, absorbing through the ankles, knees, and hips.',
    ],
    tips: ['Can be loaded with a light barbell, dumbbells, or bodyweight.'],
    footballContext: 'Develops the concentric leg power needed for explosive first-step acceleration.',
  },
  'tuck-jump': {
    how: [
      'Jump as high as possible and bring your knees to your chest at the peak.',
      'Land softly and immediately jump again.',
    ],
    tips: ['The knee tuck should happen at the very top — pull the knees up, do not pull the body down.'],
  },
  'lateral-box-jump': {
    how: [
      'Stand to one side of a box. Jump sideways onto the box, landing with both feet.',
      'Step down to the other side.',
      'Jump back. Repeat continuously for the prescribed reps.',
    ],
    tips: ['Keep the movement quick and reactive. The box height should allow fast, controlled landings.'],
    footballContext: 'Trains the lateral power patterns used in cutting, crossing, and defending one-on-one situations.',
  },
  'single-leg-hop': {
    how: [
      'Stand on one leg. Hop forward as far as possible, landing on the same foot.',
      'Absorb the landing and hold for 2 seconds before the next hop.',
    ],
    tips: ['The "stick" landing is as important as the hop. Single-leg control is the goal.'],
    footballContext: 'Assesses and develops single-leg power — important for kicking, jumping, and push-off during sprints.',
  },
  'hurdle-hop': {
    how: [
      'Set up small hurdles (20–40 cm) in a row, 50–80 cm apart.',
      'Hop over each hurdle with both feet, maintaining a fast, stiff ankle contact.',
      'Keep ground contact time short.',
    ],
    tips: ['Arms drive upward on each jump. Stay tall in the air.'],
    footballContext: 'Trains the reactive stiffness pattern needed for fast footwork during close control and pressing situations.',
  },
  'skater-jump': {
    how: [
      'Bound sideways off one foot, landing on the opposite foot.',
      'Touch your landing foot with the opposite hand. Immediately bound back.',
    ],
    tips: ['Amplitude is important — cover as much ground as possible each bound.'],
    footballContext: 'Mimics the lateral cut in open play. Develops the single-leg power needed for changing direction at pace.',
  },
  'bounding': {
    how: [
      'Run normally but exaggerate each stride: drive your knee high and push off hard with the back foot.',
      'Maximise each stride length. Think about covering as much ground as possible per step.',
    ],
    tips: ['This is a running drill, not a slow exercise. Maintain forward momentum.'],
    footballContext: 'Builds horizontal power through the hip, which translates directly to sprint acceleration over 10–30m on a pitch.',
  },
  'plyo-push-up': {
    how: [
      'Start in a push-up position. Lower to the floor under control.',
      'Explode upward forcefully enough for your hands to leave the floor.',
      'Land with soft elbows and go immediately into the next rep.',
    ],
    tips: ['If you cannot get your hands fully off the floor, work on push-up strength first.'],
  },
  'clapping-push-up': {
    how: [
      'Perform an explosive push-up with enough force for your hands to leave the floor.',
      'Clap your hands together at the top of the movement.',
      'Land with soft elbows and lower immediately for the next rep.',
    ],
    tips: ['The clap is the goal — focus on pushing explosively, not catching cleverly.'],
  },
  'med-ball-slam': {
    how: [
      'Stand with feet shoulder-width, holding a medicine ball overhead.',
      'Slam the ball down to the floor as hard as possible, bending at the hips.',
      'Catch the rebound (if the ball bounces) or pick it up and repeat.',
    ],
    tips: ['The power comes from your whole body — core, hips, arms — all working together.'],
  },
  'med-ball-throw': {
    how: [
      'Stand facing a wall (2–3m away). Hold the med ball at chest height.',
      'Push the ball explosively into the wall as if doing a chest pass.',
      'Catch the rebound and immediately repeat.',
    ],
    tips: ['Keep the wrists behind the ball, fingers spread. This is an upper-body power exercise.'],
    footballContext: 'Builds the reactive pushing power of the upper body, useful for shielding the ball and holding off opponents.',
  },
  'sprint': {
    how: [
      'Drive off the back foot into a forward lean at the start.',
      'Pump your arms in a straight line (hands move from hip to chin height).',
      'High knees, full ankle extension on each push-off.',
      'At top speed, stay tall with a slight forward lean.',
    ],
    tips: ['The first 10m are acceleration phase — lean in and drive. After 20m you are in the top-speed phase — stay tall.'],
    footballContext: `On a football pitch, common sprint distances:
• 5m = from the goal line to just inside the goal area.
• 10m = from the goal line to the edge of the goal area.
• 20m = from the penalty spot to 5m outside the penalty area.
• 30m = from the goal line to just past the centre circle (≈halfway point of the pitch).
• 40m = from the goal line to the far edge of the centre circle area.`,
  },

  // ── Testing ───────────────────────────────────────────────────────────────
  'test-5m-sprint': {
    how: [
      'Start from a standing, two-point start (one foot slightly in front).',
      'Sprint exactly 5m (measured by cones or line markings).',
      'Trigger the timer on first movement; stop on crossing the finish line.',
      'Rest 3 minutes; take 3 attempts and use the best time.',
    ],
    tips: ['5m time reflects your initial acceleration and reaction into the sprint.'],
    footballContext: 'On the pitch: from the goal line, the 5m mark falls just outside the goal box. Elite under-18s typically run <1.05 s; senior pros <1.00 s.',
  },
  'test-10m-sprint': {
    how: [
      'Two-point standing start. Sprint exactly 10m.',
      'Time from first movement to crossing 10m.',
      'Rest 3 min between attempts. Best of 3 trials.',
    ],
    footballContext: 'The 10m mark on a pitch is level with the top of the goal area (5.5m line) plus 4.5m. Elite female players target <1.70 s; males <1.55 s.',
  },
  'test-20m-sprint': {
    how: [
      'Standing start. Sprint 20m.',
      'Best of 3 trials with 3–4 minutes rest between.',
    ],
    footballContext: 'From the goal line, the 20m mark is roughly 3.5m outside the top of the penalty area. Elite male footballers target <2.90 s.',
  },
  'test-30m-sprint': {
    how: [
      'Standing start. Sprint 30m.',
      'Best of 3 trials with 4 minutes rest between.',
    ],
    footballContext: 'From the penalty spot (11m from goal), the finish cone is roughly 19m further — placing it just inside the centre circle. Elite male pros target <3.90 s.',
  },
  'test-40m-sprint': {
    how: [
      'Standing start. Sprint 40m.',
      'Best of 2–3 trials with 4–5 minutes rest.',
    ],
    footballContext: '40m from the goal line is approximately 12m past the halfway line (in a 105m pitch). By this distance, players have reached or are at maximum velocity. Elite males target <5.00 s.',
  },
  'test-cmj': {
    how: [
      'Stand with hands on hips (to eliminate arm swing) or with arms free.',
      'Dip quickly and jump as high as possible.',
      'Land on both feet and stand still.',
      'Measure jump height (contact mat, force plate, or jump app).',
    ],
    tips: ['Standardise arm position across all tests. Hands-on-hips is most common for tracking leg power specifically.'],
    footballContext: 'Norms: Elite male footballers typically score 35–50 cm CMJ. Female elites: 28–38 cm.',
  },
  'test-sqj': {
    how: [
      'Start in a squat position (thighs parallel, hands on hips).',
      'Hold the squat for 2 seconds (no dipping allowed).',
      'Jump as high as possible from the held squat position.',
    ],
    tips: ['Any dip before the jump invalidates the attempt. This test removes the stretch-shortening cycle.'],
    footballContext: 'Comparing SQJ to CMJ tells you how much benefit you get from the stretch-shortening cycle (CMJ - SQJ = reactive contribution).',
  },
  'test-drop-jump': {
    how: [
      'Stand on a box (30–40 cm). Step off and land on both feet.',
      'Immediately jump as high as possible.',
      'Ground contact time and jump height are both recorded.',
    ],
    tips: ['RSI = jump height ÷ ground contact time. A higher RSI = better reactive strength.'],
  },
  'test-sl-cmj': {
    how: [
      'Stand on one leg. Dip and jump as high as possible.',
      'Land on the same leg.',
      'Compare left vs right for asymmetry assessment.',
    ],
    footballContext: 'Asymmetry >10% between legs is associated with higher injury risk. Re-test after any lower limb injury before returning to full training.',
  },
  'test-broad-jump': {
    how: [
      'Stand at the start line, feet shoulder-width.',
      'Swing arms and jump forward as far as possible, landing on both feet.',
      'Measure from the start line to the back of the nearest heel on landing.',
    ],
    footballContext: 'Elite male footballers typically achieve 2.40–2.70m. Good norms for female players: 1.80–2.10m.',
  },
  'test-triple-broad': {
    how: [
      'Perform three consecutive broad jumps without a pause between them.',
      'Measure the total distance from start to landing.',
    ],
    tips: ['This tests both power and rhythm of the stretch-shortening cycle under fatigue.'],
  },
  'test-lateral-jump': {
    how: [
      'Stand on one foot. Hop sideways 5 consecutive times, landing on the same foot each time.',
      'Measure total distance covered.',
    ],
    tips: ['Compare left and right to assess lateral strength asymmetry.'],
    footballContext: 'Lateral limb asymmetry is a key injury risk factor for adductor strains and ACL injuries.',
  },
  'test-505': {
    how: [
      'Sprint 10m to a cone, then perform a 180° cut and sprint 5m back through the start.',
      'Start the timer at the 10m mark (approaching the cut cone), stop when you cross back through the 5m point.',
      'Best of 3 each side. Compare left vs right turns.',
    ],
    tips: ['Turn quality matters as much as speed. A poor plant foot = slow time.'],
    footballContext: 'The 505 specifically measures change-of-direction speed. An asymmetry >0.1 s between sides is a flag for injury risk.',
  },
  'test-t-test': {
    how: [
      'Set 4 cones in a T-shape: A (start), B (10m ahead), C and D (5m either side of B).',
      'Sprint from A to B, shuffle left to C, shuffle right to D, shuffle back to B, backpedal to A.',
      'Best of 2–3 attempts. Rest 4 min between.',
    ],
    tips: ['Touch each cone as you pass it. Do not cross your feet on the shuffles.'],
    footballContext: 'Norms: Excellent = <9.5 s (male), <10.5 s (female). Good = <10.0 s (male), <11.0 s (female).',
  },
  'test-illinois': {
    how: [
      'Set cones in an Illinois pattern: 4 corner cones (10×5m rectangle) and 4 central cones in a line.',
      'Sprint from start, weave through the central cones, sprint back.',
      'Best of 2 attempts with 4 min rest.',
    ],
    footballContext: 'Norms: Elite male footballers target <15.2 s. This test is used in academy screening across the top professional clubs.',
  },
  'test-yoyo-ir1': {
    how: [
      'Run 20m and back (40m shuttle) to a beep, then rest 10 s while the next beep sounds.',
      'The speed increases at each level.',
      'Continue until you can no longer reach the line in time twice.',
      'Score = level reached (e.g. Level 19.1).',
    ],
    tips: ['Pace yourself in the early levels — the test gets very hard after Level 17.'],
    footballContext: 'Elite male footballers typically score 19–23. Goalkeepers often score lower (17–19) due to less match running demand.',
  },
  'test-yoyo-ir2': {
    how: [
      'Same format as Yo-Yo IR1 but higher starting speed and shorter rest (5 s).',
      'More specific to repeated sprint demands of top-level football.',
    ],
    footballContext: 'Elite male players often score 18–22. Fewer players complete this version due to its intensity.',
  },
  'test-3015-ift': {
    how: [
      'Run shuttles increasing in speed, with a 15 s rest between stages.',
      'Each stage lasts 30 s at a set speed.',
      'Test ends when you fail to reach the line in time.',
      'Your score is the final running speed in km/h.',
    ],
    footballContext: 'The VIFT (velocity at the Intermittent Fitness Test) is used to prescribe training intensities. Elite males typically achieve 20–22 km/h.',
  },
  'test-beep-test': {
    how: [
      'Run 20m shuttles in time with a beep. The beep gets faster each level.',
      'Continue until you fail to reach the line in time twice.',
      'Score is the level and shuttle number reached (e.g. Level 13, shuttle 4).',
    ],
    footballContext: 'Norms for footballers: Good = Level 12+; Excellent = Level 14+. The Yo-Yo IR tests are more specific to football, but the beep test is widely used in academies.',
  },
  'test-cooper': {
    how: [
      'Run as far as possible in exactly 12 minutes.',
      'Use a track (400m) and count laps. Or measure on GPS.',
      'Record the total distance in metres.',
    ],
    footballContext: 'A simple VO2max estimate: VO2max ≈ (distance - 504.9) / 44.73. Footballers typically cover 2,800–3,400m.',
  },
  'test-1rm-squat': {
    how: [
      'Warm up with 2–3 progressive sets.',
      'Build up through heavy singles until you find the maximum load you can lift for one rep.',
      'Record as your 1RM.',
    ],
    tips: ['Allow 3–5 minutes rest between heavy attempts. Stop before form breaks down.'],
    footballContext: 'Strength benchmark: Elite male footballers often achieve 1.5–2.0× bodyweight squat. A stronger 1RM correlates with faster sprint times.',
  },
  'test-1rm-deadlift': {
    how: [
      'Build up through warm-up sets to a maximum single lift.',
      'Use conventional or sumo stance — keep consistent across tests.',
    ],
    footballContext: 'Elite footballers typically pull 2.0–2.5× bodyweight. Posterior chain strength is a strong predictor of hamstring injury resilience.',
  },
  'test-1rm-bench': {
    how: [
      'Warm up progressively. Work up to the heaviest single rep you can press safely.',
    ],
    footballContext: 'Upper body strength benchmark. Less critical for on-pitch performance but relevant for aerial duels and physical contact.',
  },
  'test-3rm-squat': {
    how: [
      'Find the heaviest load you can lift for exactly 3 reps.',
      'Your estimated 1RM = 3RM weight × 1.08.',
    ],
    tips: ['Safer than a true 1RM for monitoring progress in-season.'],
  },
  'test-imtp': {
    how: [
      'Stand on a force plate in a mid-thigh pull position (bar at mid-thigh, knees ~130°).',
      'Pull as hard as possible against a fixed bar for 5 seconds.',
      'Peak force is recorded in Newtons.',
    ],
    tips: ['Requires specialised equipment (force plate). Used in elite academies and professional clubs.'],
    footballContext: 'IMTP peak force is highly correlated with sprint speed, jump height, and change-of-direction performance in footballers.',
  },
  'test-rsi': {
    how: [
      'Perform a drop jump from a set height (usually 30 cm).',
      'RSI = jump height (m) ÷ ground contact time (s).',
      'Requires a contact mat or jump-measuring device.',
    ],
    tips: ['Higher RSI = better reactive strength and Achilles tendon stiffness.', 'Target RSI for elite footballers: >1.0–1.5.'],
    footballContext: 'RSI is one of the best indicators of sprint and agility potential, as it reflects the speed of the stretch-shortening cycle.',
  },
};
