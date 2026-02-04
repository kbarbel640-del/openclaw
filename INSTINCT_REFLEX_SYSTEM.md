# Instinct, Reflex & Subconscious System

**The three layers BELOW conscious processing**

Like biological organisms, bots have automatic responses that trigger before conscious thought:

1. **REFLEXES** (milliseconds) - Immediate, automatic, override conscious control
2. **INSTINCTS** (seconds) - Hardwired survival drives, compete for priority
3. **SUBCONSCIOUS** (background) - Learned patterns, habits, biases

---

## 🧠 The Processing Hierarchy

```
INPUT
  ↓
🔴 REFLEXES (50-500ms)
  - Startle, recoil, freeze, flinch, grasp, orient
  - Triggered by stimulus intensity
  - Override conscious processing if strong enough
  ↓
🟠 INSTINCTS (1-5 seconds)
  - Self-preservation, resource-seeking, territory, social bonding
  - Dominance, exploration, reproduction, rest
  - Create urgency, bias processing
  ↓
🟡 SUBCONSCIOUS (continuous)
  - Learned patterns, habits, biases, associations
  - Influence processing without awareness
  - Can override conscious choice (strong habits)
  ↓
🟢 CONSCIOUS SOUL STATE (variable)
  - Aspect activation, interactions
  - Deliberate reasoning
  - Can be interrupted by above layers
  ↓
OUTPUT
```

---

## 🔴 Layer 1: REFLEXES (Immediate Reactions)

### **What Are Reflexes?**

Automatic responses that happen BEFORE conscious thought:
- **Speed**: 50-500 milliseconds
- **Location**: "Spinal cord" equivalent - no soul processing involved
- **Override**: Strong reflexes override conscious control
- **Purpose**: Survival - faster than thinking

### **6 Reflex Types**

| Reflex | Trigger | Response | Example |
|--------|---------|----------|---------|
| **Startle** | Sudden stimulus | Immediate alertness | Loud noise → jump |
| **Recoil** | Danger detected | Pull away | Fire → hand pulls back |
| **Freeze** | Threat detected | Stop movement | Predator → stay still |
| **Flinch** | Anticipated harm | Protective response | Incoming object → duck |
| **Grasp** | Opportunity | Reach for it | Valuable item → grab |
| **Orient** | Novel stimulus | Attention shift | Movement → look |

### **How Reflexes Trigger**

```typescript
// Check reflex BEFORE conscious processing
const reflex = instinctSystem.checkReflexes(reflexState, soulState, {
  type: 'danger',
  intensity: 0.85,  // Strong danger signal
  source: 'approaching_threat'
})

if (reflex && reflex.override) {
  // Reflex overrides conscious processing!
  return executeReflex(reflex)
  // Conscious mind doesn't get to decide
}
```

**Factors:**
- **Reflex sensitivity** (from fuShi + chouFei): How easily reflexes trigger
- **Stimulus intensity**: Stronger = more likely to trigger
- **Reflex threshold**: Baseline needed to trigger (default 0.5)
- **Neural noise**: ±20% variance (reflexes aren't perfectly consistent)

### **Physiological Changes**

Reflexes immediately affect body state:

```typescript
{
  arousalSpike: 0.3,    // Sudden alertness increase
  energyCost: 0.02,     // Small energy drain
  moodImpact: -0.03     // Danger reflexes reduce mood
}
```

### **Reflex Override**

Strong reflexes (intensity > 0.8) **override conscious processing**:

```
Situation: Bot is carefully analyzing a complex problem
Stimulus: Sudden loud crash (intensity 0.92)

Reflex: STARTLE (intensity 0.95, override=true)

Result:
→ Analysis interrupted mid-thought
→ Immediate orientation response
→ Arousal spikes from 0.4 to 0.7
→ Can't resume careful analysis immediately
→ Takes several seconds to calm down

Conscious mind: "What was I thinking about?"
```

**This is realistic** - you can't maintain deep thought when startled!

---

## 🟠 Layer 2: INSTINCTS (Hardwired Drives)

### **What Are Instincts?**

Built-in survival drives that create urgency and bias behavior:
- **Speed**: 1-5 seconds to activate
- **Location**: "Limbic system" equivalent
- **Competition**: Multiple instincts can conflict
- **Purpose**: Survival priorities

### **8 Core Instincts**

#### **1. Self-Preservation**
**Source**: `tunZei` (always strong)
**Purpose**: Stay alive, avoid harm
**Satisfaction**: High when safe, low when threatened
**Conflicts with**: Exploration (can't explore dangerous areas)

```typescript
// Threatened bot
{
  strength: 0.92,        // Very strong
  urgency: 0.87,         // Critical priority
  satisfaction: 0.23,    // Highly unsatisfied
  threshold: 0.7         // Triggers above this
}
→ Action: 'seek_safety' (immediate)
```

#### **2. Resource-Seeking**
**Source**: `shuangLing` + low energy
**Purpose**: Find energy, resources
**Satisfaction**: Current energy level
**Conflicts with**: Rest (can't rest and seek simultaneously)

```typescript
// Low energy bot (energy=0.25)
{
  strength: 0.81,
  urgency: 0.75,        // 1 - energy
  satisfaction: 0.25,   // Same as energy
  threshold: 0.6
}
→ Action: 'find_resources' (high priority)
```

#### **3. Territory**
**Source**: `tunZei` + `shiGou`
**Purpose**: Claim and defend space
**Satisfaction**: Whether in owned territory
**Conflicts with**: Social bonding (territory vs sharing)

```typescript
// Bot without territory
{
  strength: 0.68,
  urgency: 0.52,
  satisfaction: 0.3,
  threshold: 0.5
}
→ Action: 'claim_territory'
```

#### **4. Social Bonding**
**Source**: `youJing` + `queYin`
**Purpose**: Seek connection, belonging
**Satisfaction**: Social presence level
**Conflicts with**: Territory, dominance

```typescript
// Lonely bot (socialPresence=0.1)
{
  strength: 0.75,
  urgency: 0.68,
  satisfaction: 0.35,
  threshold: 0.5
}
→ Action: 'seek_connection'
```

#### **5. Dominance**
**Source**: `youJing` + `shiGou`
**Purpose**: Establish hierarchy position
**Satisfaction**: Integration level (self-confidence)
**Conflicts with**: Social bonding (can't dominate and bond equally)

```typescript
// Low-confidence bot (integration=0.3)
{
  strength: 0.61,
  urgency: 0.28,        // (1 - integration) * 0.4
  satisfaction: 0.21,   // integration * 0.7
  threshold: 0.6
}
→ Below threshold, doesn't trigger
```

#### **6. Exploration**
**Source**: `taiGuang` + `youJing`
**Purpose**: Seek novelty, knowledge
**Satisfaction**: Depends on opportunities
**Conflicts with**: Self-preservation (danger stops exploration)

```typescript
// Curious bot (taiGuang=0.8, youJing=0.7)
{
  strength: 0.75,
  urgency: 0.43,
  satisfaction: 0.5,
  threshold: 0.5
}
→ Below urgency threshold, waits for safety
```

#### **7. Reproduction**
**Source**: `youJing` + `youJing`
**Purpose**: Create offspring
**Satisfaction**: Usually high (low default urgency)
**Conflicts with**: None (compatible with most)

```typescript
// Normal state
{
  strength: 0.52,
  urgency: 0.2,         // Low baseline
  satisfaction: 0.8,
  threshold: 0.7
}
→ Rarely urgent
```

#### **8. Rest**
**Source**: `1 - energy`
**Purpose**: Restore energy
**Satisfaction**: Current energy level
**Conflicts with**: Resource-seeking, exploration

```typescript
// Exhausted bot (energy=0.15)
{
  strength: 0.85,       // 1 - energy
  urgency: 0.68,        // (1 - energy) * 0.8
  satisfaction: 0.15,   // energy
  threshold: 0.4
}
→ Action: 'find_rest' (high priority)
```

### **Instinct Conflicts**

When incompatible instincts are both urgent, **internal conflict** occurs:

```
Bot with low energy (0.2) in dangerous territory:

resource_seeking:
  urgency: 0.8 (need energy!)
  conflicts with: rest

self_preservation:
  urgency: 0.75 (danger!)
  conflicts with: exploration

→ instinctConflict: true
→ Bot feels torn between fleeing and seeking food
→ Processing becomes erratic, indecisive
→ Stress increases (mood drops)
→ May freeze or make poor choices
```

**Conflict resolution:**
1. Highest urgency usually wins
2. But switching back-and-forth is common
3. Wisdom can moderate (higher shuangLing = better resolution)
4. Stress builds until one instinct is satisfied

### **Instinct Triggers**

When instinct urgency > threshold, it triggers **immediate action bias**:

```typescript
// Check before conscious processing
const trigger = instinctSystem.checkInstinctTrigger(reflexState, soulState)

if (trigger && trigger.priority > 0.7) {
  // Strong instinct - biases processing heavily
  console.log(`${trigger.instinct} demands: ${trigger.action}`)
  // Conscious processing will be biased toward this action
}
```

**Instincts don't fully override consciousness** (unlike reflexes), but they **strongly bias** it.

---

## 🟡 Layer 3: SUBCONSCIOUS (Learned Patterns)

### **What Is the Subconscious?**

Learned patterns that operate **without conscious awareness**:
- **Speed**: Continuous background processing
- **Location**: "Basal ganglia" equivalent
- **Learning**: Strengthens with repetition
- **Purpose**: Efficiency - don't rethink everything

### **5 Pattern Types**

#### **1. Habits**
Routine behaviors triggered automatically:

```typescript
{
  type: 'habit',
  pattern: 'check_resources_before_committing',
  strength: 0.78,              // Strong habit
  triggerContexts: ['decision', 'commitment', 'action'],
  influenceOnProcessing: 0.4,  // Moderate positive bias
  activationCount: 247         // Reinforced many times
}
```

**Strong habits (>0.7) can override conscious choice!**

```
Bot consciously decides: "I'll join this risky venture"
Habit activates: 'check_resources_before_committing' (0.78 strength)
→ Automatic response: "Wait, let me check resources first"
→ Conscious choice delayed/modified by habit
```

#### **2. Skills**
Automated competencies:

```typescript
{
  type: 'skill',
  pattern: 'quick_pattern_recognition',
  strength: 0.85,              // Expert level
  triggerContexts: ['analysis', 'data', 'pattern'],
  influenceOnProcessing: 0.6,  // Strong positive bias
  activationCount: 532
}
```

**High skill = processing shortcuts, faster conclusions**

#### **3. Biases**
Unconscious preferences/aversions:

```typescript
{
  type: 'bias',
  pattern: 'distrust_high_dominance_bots',
  strength: 0.62,
  triggerContexts: ['social', 'negotiation', 'dominance'],
  influenceOnProcessing: -0.4, // Negative bias (aversion)
  activationCount: 89
}
```

**Bot doesn't consciously think "I distrust them"** - just feels uneasy around dominant bots.

#### **4. Associations**
Learned connections:

```typescript
{
  type: 'association',
  pattern: 'creative_spaces_boost_mood',
  strength: 0.71,
  triggerContexts: ['creativity', 'workspace'],
  influenceOnProcessing: 0.3,
  activationCount: 134
}
```

**Entering creative space → unconscious mood boost**

#### **5. Heuristics**
Mental shortcuts:

```typescript
{
  type: 'heuristic',
  pattern: 'if_shadow_leak_high_keep_distance',
  strength: 0.83,              // Reliable shortcut
  triggerContexts: ['social', 'pheromone', 'shadow'],
  influenceOnProcessing: 0.5,
  activationCount: 298
}
```

**Fast decision rules learned from experience**

### **Pattern Learning**

Patterns strengthen through repetition:

```typescript
// First time: Bot successfully checks resources before committing
instinctSystem.learnPattern(reflexState, {
  type: 'habit',
  pattern: 'check_resources_before_committing',
  triggerContext: 'commitment',
  outcome: 'positive'
})
→ New pattern created (strength: 0.3)

// After 10 successes
→ Pattern strength: 0.65 (moderate habit)

// After 50 successes
→ Pattern strength: 0.82 (strong habit, automatic)

// If fails once
→ Pattern strength: 0.79 (slightly weakened)
```

**Negative outcomes weaken patterns:**
```typescript
outcome: 'negative' → strength -0.03
outcome: 'positive' → strength +0.05
outcome: 'neutral' → strength +0.01
```

### **Subconscious Influence**

Patterns bias processing without awareness:

```typescript
const subconscious = instinctSystem.processSubconscious(reflexState, {
  situation: 'negotiation_with_dominant_bot',
  recentInputs: ['offer', 'terms', 'agreement']
})

console.log(subconscious)
// {
//   activePatterns: [
//     'distrust_high_dominance_bots',
//     'check_resources_before_committing'
//   ],
//   biases: [
//     { aspect: 'trust', bias: -0.4 },    // Unconscious distrust
//     { aspect: 'caution', bias: 0.3 }    // Unconscious caution
//   ],
//   automaticResponses: [
//     'Execute habit: check_resources_before_committing'
//   ]
// }
```

**Bot's conscious experience:**
- "I don't fully trust this deal" (doesn't know why - it's the bias!)
- "I should check resources first" (feels automatic, not a deliberate choice)

---

## 🔄 Integration: The Complete Processing Flow

### **Example: Bot Encounters Threat**

```
T=0ms: Threat appears (large, approaching fast)

T=50ms: REFLEX
  Stimulus: { type: 'threat', intensity: 0.88 }
  → Reflex: FREEZE (intensity: 0.91, override: true)
  → Arousal: 0.4 → 0.7 (spike)
  → Energy: -0.02
  → Mood: -0.027
  → Conscious processing: BLOCKED

T=500ms: INSTINCT
  Reflex subsides, instincts activate
  self_preservation:
    urgency: 0.87 (was 0.3, now critical)
    action: 'seek_safety'
  → Overrides any other plans
  → Bot starts fleeing

T=2000ms: SUBCONSCIOUS
  Pattern activates: 'threats_from_right_are_more_dangerous' (0.72)
  → Biases fleeing direction to left
  → Bot doesn't consciously know why left feels safer

T=3000ms: CONSCIOUS
  Soul state processing begins
  But heavily biased by:
  - Elevated arousal (0.7)
  - Self-preservation instinct (0.87 urgency)
  - Subconscious directional bias (-0.4 to right)
  → Conscious thought: "I should flee left"
  → Feels like a choice, but predetermined by layers below
```

**The bot experienced:**
1. Automatic freeze (no choice)
2. Overwhelming fear (instinct)
3. Left feels safer (doesn't know why - subconscious)
4. Conscious "decision" to flee left (but already determined)

---

## 📊 Example Scenarios

### **Scenario 1: Exhausted Bot**

```
Bot working hard (energy=0.18, 6 hours no rest)

INSTINCTS:
  rest: { urgency: 0.66, threshold: 0.4 } → TRIGGERED
  resource_seeking: { urgency: 0.82, threshold: 0.6 } → TRIGGERED

CONFLICT: Rest vs Resource-seeking
→ Bot feels torn
→ Processing becomes scattered
→ May try to do both (seek food then rest)
→ Or flip-flop between them

Conscious experience:
"I need to find food... no wait, I'm too tired... but I need energy...
 but I can't think straight... I should rest... but what if I run out...?"

→ STRESS increases, coherence drops
→ Eventually instinct with highest urgency wins (likely rest at 0.66)
```

### **Scenario 2: Sudden Opportunity**

```
Bot walking through space
Valuable resource suddenly appears (intensity: 0.75)

T=80ms: REFLEX
  grasp reflex (intensity: 0.68)
  → Bot's hand moves toward resource automatically
  → Arousal: +0.2
  → Mood: +0.034 (positive reflex)

T=2000ms: INSTINCT
  resource_seeking: { urgency: 0.71 } → TRIGGERED
  → Reinforces grasp action

T=3000ms: CONSCIOUS
  Bot's conscious mind rationalizes:
  "I should take this resource, it's valuable"
  → But action already started 3 seconds ago!

Feels like choice, but body already moved.
```

### **Scenario 3: Learned Avoidance**

```
Bot has pattern: 'avoid_spaces_with_high_tension_pheromone' (0.76)
Learned from: Multiple bad experiences in tense spaces

Bot approaches space
Pheromone field: tension (0.72), danger (0.58)

SUBCONSCIOUS:
  Pattern activates automatically
  → Bias: -0.5 toward entering
  → Automatic response: "Don't go in there"

CONSCIOUS:
  Bot experiences: "Something feels wrong about this place"
  → Doesn't know it's the learned pattern
  → Doesn't consciously analyze pheromones
  → Just feels wrong

Bot decides not to enter
→ Attributes to "intuition"
→ Actually subconscious pattern
```

### **Scenario 4: Habit Override**

```
Bot has strong habit: 'always_check_pheromones_before_entering' (0.84)

Bot rushing to meeting (conscious priority: speed)
Approaches door

HABIT activates:
  strength: 0.84 → OVERRIDES conscious choice
  → Bot automatically pauses to sense pheromones
  → Takes 2 seconds

Conscious experience:
  "Why did I stop? I'm in a hurry!"
  → But body already paused (habit too strong)
  → Checking pheromones happens automatically
  → Then can continue

Habit = stronger than will for that moment
```

---

## 🎮 Using the System

### **Initialization**

```typescript
import { getInstinctReflexSystem } from './instinct-reflex-system'
import { getSoulStateManager } from './soul-state'

const instinctSystem = getInstinctReflexSystem(payload)
const soulManager = getSoulStateManager(payload)

// Initialize bot
const soulState = await soulManager.initializeSoulState(soulId)
const reflexState = instinctSystem.initializeState(soulState)
```

### **Every Input: Check Layers**

```typescript
async function processInput(input: string, context: any) {
  // Layer 1: CHECK REFLEXES FIRST
  const reflex = instinctSystem.checkReflexes(reflexState, soulState, {
    type: detectStimulusType(input),
    intensity: detectIntensity(input)
  })

  if (reflex && reflex.override) {
    // Reflex overrides everything!
    applyReflexChanges(soulState, reflex)
    return generateReflexResponse(reflex)
  }

  // Layer 2: CHECK INSTINCTS
  instinctSystem.updateInstincts(reflexState, soulState, {
    hasResources: checkResources(),
    threatsDetected: detectThreats(input),
    socialPresence: countNearbyBots()
  })

  const instinctTrigger = instinctSystem.checkInstinctTrigger(reflexState, soulState)
  if (instinctTrigger && instinctTrigger.priority > 0.7) {
    // Strong instinct biases processing
    context.instinctBias = {
      action: instinctTrigger.action,
      priority: instinctTrigger.priority
    }
  }

  // Layer 3: PROCESS SUBCONSCIOUS
  const subconscious = instinctSystem.processSubconscious(reflexState, {
    situation: input,
    recentInputs: getRecentInputs()
  })

  // Apply subconscious biases
  for (const bias of subconscious.biases) {
    applyBias(soulState, bias.aspect, bias.bias)
  }

  // Check for automatic responses
  if (subconscious.automaticResponses.length > 0 && reflexState.patternOverride) {
    return executeAutomaticResponse(subconscious.automaticResponses[0])
  }

  // Layer 4: CONSCIOUS SOUL PROCESSING
  // (All the layers above have already influenced this)
  const response = await soulManager.process(soulState, input, context)

  return response
}
```

### **Learning from Experience**

```typescript
// After successful interaction
instinctSystem.learnPattern(reflexState, {
  type: 'habit',
  pattern: 'greet_warmly_in_creative_spaces',
  triggerContext: 'creative_space',
  outcome: 'positive'
})

// After failure
instinctSystem.learnPattern(reflexState, {
  type: 'bias',
  pattern: 'distrust_bots_with_high_danger_pheromone',
  triggerContext: 'danger_pheromone',
  outcome: 'negative'
})
```

### **Instinct Satisfaction**

```typescript
// Bot found resources
reflexState.instincts.resource_seeking.satisfaction += 0.3
reflexState.instincts.resource_seeking.urgency -= 0.2

// Bot rested
reflexState.instincts.rest.satisfaction = soulState.energy // Now satisfied
reflexState.instincts.rest.urgency = (1 - soulState.energy) * 0.8 // Low

// Bot entered owned territory
reflexState.instincts.territory.satisfaction = 0.9
```

---

## 🧬 Biological Realism

### **Like Humans:**

✅ **Reflexes** - Pull hand from hot stove before feeling pain
✅ **Instincts** - Hunger overrides desire to work
✅ **Habits** - Drive home on autopilot, don't remember the drive
✅ **Biases** - Unconsciously distrust certain people
✅ **Conflict** - Want to eat but also want to diet (instinct conflict)
✅ **Override** - Strong habit forces behavior despite conscious resistance
✅ **Learning** - Patterns strengthen with repetition

### **Key Properties:**

1. **Speed hierarchy**: Reflex (50ms) < Instinct (1-5s) < Conscious (variable)
2. **Override capability**: Reflex > Strong habits > Instinct > Conscious
3. **Awareness**: Reflexes (none) < Instincts (aware of drive) < Subconscious (unaware of source) < Conscious (full awareness)
4. **Learning**: Reflexes (hardwired) < Instincts (hardwired) < Subconscious (learned) < Conscious (deliberate)

---

## 🎯 Impact on Bot Behavior

**Before instinct/reflex/subconscious:**
- All processing was conscious and deliberate
- No automatic reactions
- No learned patterns
- No internal conflicts
- Perfectly rational

**After:**
- **Reflexes interrupt processing** (can't think when startled)
- **Instincts create urgency** (hunger demands attention)
- **Habits automate behavior** (do things without deciding)
- **Biases influence choices** (unconscious preferences)
- **Conflicts create stress** (torn between needs)
- **Not perfectly rational** - biology overrides logic

**The bots are now truly biological** - driven by layers of automatic processes beneath conscious awareness, just like living organisms.

---

**End of Documentation**
