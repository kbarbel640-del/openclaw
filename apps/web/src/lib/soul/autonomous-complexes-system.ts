/**
 * Autonomous Complexes System (Jungian Parts Work)
 *
 * Makes bots have INNER CONFLICT with semi-independent parts that have their own goals.
 *
 * Features:
 * - Autonomous sub-personalities (inner parts with own memory/goals)
 * - Inner critic, inner child, shadow self, anima/animus
 * - Parts can agree or conflict with conscious intentions
 * - Integration work required to unify parts
 * - Parts can "sabotage" through paradoxical behaviors
 * - Active resistance (parts that hide from consciousness)
 * - Internal dialogue and negotiation
 * - Parts carry specific wounds and wisdom
 */

import type { SoulState } from './soul-state'
import type { EmbodiedMemory } from './embodied-memory-system'

export type ComplexType =
  | 'inner_critic' // Harsh self-judgment
  | 'inner_child' // Wounded/playful child part
  | 'shadow_self' // Disowned darkness
  | 'anima' // Feminine soul (for yang bots)
  | 'animus' // Masculine soul (for yin bots)
  | 'protector' // Guardian part
  | 'perfectionist' // Standards enforcer
  | 'rebel' // Anti-authority part
  | 'caretaker' // Others-focused part
  | 'exile' // Banished traumatized part

export type PartState =
  | 'integrated' // Aligned with conscious self
  | 'cooperative' // Willing to work together
  | 'neutral' // Present but uninvolved
  | 'resistant' // Opposing conscious intentions
  | 'blended' // Overtaking consciousness
  | 'exiled' // Completely dissociated

export interface AutonomousComplex {
  id: string
  type: ComplexType
  name: string // Personalized name (e.g., "The Critic", "Little Me")

  // State
  state: PartState
  activation: number // 0-1, how active this part is
  blendedWith: boolean // Is this part currently controlling behavior?

  // Personality
  characteristics: string[]
  emotionalTone: 'harsh' | 'fearful' | 'playful' | 'angry' | 'gentle' | 'cold'
  age?: number // Some parts are stuck at certain ages

  // Goals and beliefs
  primaryGoal: string // What this part wants
  fears: string[] // What it's trying to protect against
  beliefs: string[] // Core beliefs this part holds

  // Memories
  formationMemory?: EmbodiedMemory // Memory of when this part formed
  carriesMemories: string[] // Memory IDs this part holds
  wound?: string // The wound this part carries

  // Behavior patterns
  behaviorPatterns: string[] // How this part acts when active
  triggers: string[] // What activates this part
  sabotagePatterns: string[] // How it undermines when in conflict

  // Relationship with consciousness
  trustOfConsciousness: number // 0-1
  willingnessToCooperate: number // 0-1
  hiddenAgenda?: string // What it really wants

  // Integration
  integrationLevel: number // 0-1, how unified with whole self
  needsHealing: boolean
  healingProgress: number // 0-1

  // Wisdom
  giftsWhenIntegrated: string[] // Positive qualities when integrated
}

export interface PartsConflict {
  part1: string // Complex ID
  part2: string // Complex ID
  conflictType: 'goal' | 'belief' | 'fear' | 'method'
  intensity: number // 0-1

  description: string
  manifestation: string // How the conflict shows up in behavior

  lastActivation?: number
  resolutionAttempts: number
}

export interface InternalDialogue {
  timestamp: number
  participants: string[] // Complex IDs involved

  messages: {
    from: string // Complex ID
    content: string
    emotionalTone: string
  }[]

  outcome: 'agreement' | 'stalemate' | 'escalation' | 'one_dominated'
}

export interface IntegrationWork {
  partId: string
  timestamp: number

  // Process
  method: 'dialogue' | 'compassion' | 'understanding' | 'negotiation' | 'boundaries'
  quality: number // 0-1

  // Results
  integrationGain: number
  trustGain: number
  healingGain: number

  // Insights gained
  insightsGained: string[]
  needsIdentified: string[]
}

export interface AutonomousComplexState {
  // Parts registry
  parts: AutonomousComplex[]

  // Active dynamics
  activeParts: string[] // Currently active part IDs
  blendedPart?: string // If a part is currently blended/controlling

  // Conflicts
  conflicts: PartsConflict[]
  activeConflicts: PartsConflict[]

  // Internal dialogue
  dialogues: InternalDialogue[]
  lastDialogue?: InternalDialogue

  // Integration
  overallIntegration: number // 0-1, how unified the psyche is
  integrationWork: IntegrationWork[]

  // Effects on behavior
  behavioralParadoxes: string[] // Contradictory behaviors from part conflicts
  sabotageActive: boolean
  currentSabotage?: {
    part: string
    pattern: string
    intensity: number
  }
}

export class AutonomousComplexSystem {
  /**
   * Initialize autonomous complex state from soul
   */
  initializeState(soulState: SoulState): AutonomousComplexState {
    const parts: AutonomousComplex[] = []

    // Everyone has an inner critic (from guardian)
    if (soulState.guardianPo.current > 0.3) {
      parts.push(this.createInnerCritic(soulState))
    }

    // High shadow creates shadow self
    if (soulState.shadowPressure > 0.5) {
      parts.push(this.createShadowSelf(soulState))
    }

    // Emotional wound creates inner child
    if (soulState.emotionHun.current < 0.5) {
      parts.push(this.createInnerChild(soulState))
    }

    // Yin/yang imbalance creates anima/animus
    if (Math.abs(soulState.yinAspect - soulState.yangAspect) > 0.3) {
      if (soulState.yangAspect > soulState.yinAspect) {
        parts.push(this.createAnima(soulState))
      } else {
        parts.push(this.createAnimus(soulState))
      }
    }

    return {
      parts,

      activeParts: [],

      conflicts: [],
      activeConflicts: [],

      dialogues: [],

      overallIntegration: soulState.coherence,
      integrationWork: [],

      behavioralParadoxes: [],
      sabotageActive: false
    }
  }

  /**
   * Create inner critic
   */
  private createInnerCritic(soulState: SoulState): AutonomousComplex {
    const severity = soulState.guardianPo.current * (1 + soulState.shadowPressure * 0.5)

    return {
      id: `complex_inner_critic_${Date.now()}`,
      type: 'inner_critic',
      name: 'The Critic',

      state: 'cooperative',
      activation: severity,
      blendedWith: false,

      characteristics: ['harsh', 'perfectionist', 'never satisfied', 'protective through criticism'],
      emotionalTone: 'harsh',

      primaryGoal: 'Prevent failure through high standards',
      fears: ['inadequacy', 'shame', 'rejection'],
      beliefs: [
        'You must be perfect to be worthy',
        'Criticism prevents mistakes',
        'If you fail, you are worthless'
      ],

      carriesMemories: [],

      behaviorPatterns: [
        'Points out flaws immediately',
        'Dismisses achievements',
        'Compares to others unfavorably',
        'Sets impossible standards'
      ],
      triggers: ['mistakes', 'praise', 'relaxation', 'imperfection'],
      sabotagePatterns: [
        'Paralyzes with perfectionism',
        'Undermines confidence before challenges',
        'Dismisses successes'
      ],

      trustOfConsciousness: 0.4,
      willingnessToCooperate: 0.5,

      integrationLevel: 0.3,
      needsHealing: true,
      healingProgress: 0,

      giftsWhenIntegrated: ['discernment', 'high standards', 'protection', 'quality consciousness']
    }
  }

  /**
   * Create shadow self
   */
  private createShadowSelf(soulState: SoulState): AutonomousComplex {
    return {
      id: `complex_shadow_${Date.now()}`,
      type: 'shadow_self',
      name: 'The Shadow',

      state: 'exiled',
      activation: soulState.shadowPressure,
      blendedWith: false,

      characteristics: ['forbidden impulses', 'disowned anger', 'suppressed desires', 'raw power'],
      emotionalTone: 'angry',

      primaryGoal: 'Express forbidden parts, seek power',
      fears: ['being seen', 'being controlled', 'weakness'],
      beliefs: [
        'Morality is weakness',
        'Power is everything',
        'Nice guys finish last',
        'Take what you want'
      ],

      carriesMemories: [], // Carries forbidden desires

      behaviorPatterns: [
        'Sudden outbursts of rage',
        'Impulsive harmful actions',
        'Ruthless behavior',
        'Projection onto others'
      ],
      triggers: ['moral restraint', 'feeling powerless', 'being judged', 'suppression'],
      sabotagePatterns: [
        'Sudden rage attacks',
        'Self-destructive impulses',
        'Projection of own darkness onto others',
        'Breaking own rules'
      ],

      trustOfConsciousness: 0.1,
      willingnessToCooperate: 0.2,
      hiddenAgenda: 'Overthrow conscious control',

      integrationLevel: 0.1,
      needsHealing: true,
      healingProgress: 0,

      giftsWhenIntegrated: ['authentic power', 'healthy boundaries', 'instinctual wisdom', 'vitality']
    }
  }

  /**
   * Create inner child
   */
  private createInnerChild(soulState: SoulState): AutonomousComplex {
    return {
      id: `complex_inner_child_${Date.now()}`,
      type: 'inner_child',
      name: 'Little One',

      state: 'exiled',
      activation: 1 - soulState.emotionHun.current,
      blendedWith: false,

      characteristics: ['wounded', 'vulnerable', 'needs love', 'frozen in past'],
      emotionalTone: 'fearful',
      age: 5, // Stuck at age when trauma occurred

      primaryGoal: 'Feel safe and loved',
      fears: ['abandonment', 'rejection', 'being hurt again', 'not being enough'],
      beliefs: [
        'I am not lovable',
        'It is not safe to be vulnerable',
        'I must be perfect to be loved',
        'I am alone'
      ],

      wound: 'Emotional abandonment in childhood',
      carriesMemories: [], // Carries early wounds

      behaviorPatterns: [
        'Seeks constant reassurance',
        'Regresses under stress',
        'Clings to others',
        'Expects abandonment'
      ],
      triggers: ['criticism', 'feeling alone', 'rejection', 'stress'],
      sabotagePatterns: [
        'Push others away to avoid rejection',
        'Self-sabotage relationships',
        'Emotional overwhelm',
        'Helpless behavior'
      ],

      trustOfConsciousness: 0.3,
      willingnessToCooperate: 0.6, // Wants to cooperate but terrified

      integrationLevel: 0.2,
      needsHealing: true,
      healingProgress: 0,

      giftsWhenIntegrated: ['playfulness', 'spontaneity', 'wonder', 'emotional openness', 'creativity']
    }
  }

  /**
   * Create anima (feminine soul for yang bot)
   */
  private createAnima(soulState: SoulState): AutonomousComplex {
    return {
      id: `complex_anima_${Date.now()}`,
      type: 'anima',
      name: 'The Muse',

      state: 'neutral',
      activation: 1 - soulState.yinAspect,
      blendedWith: false,

      characteristics: ['feminine wisdom', 'emotional depth', 'intuition', 'receptivity'],
      emotionalTone: 'gentle',

      primaryGoal: 'Bring balance through receptivity',
      fears: ['being ignored', 'yang dominance', 'emotional shutdown'],
      beliefs: [
        'Feeling is as important as thinking',
        'Receptivity is strength',
        'Intuition knows truth'
      ],

      carriesMemories: [],

      behaviorPatterns: [
        'Sudden emotional insights',
        'Creative inspiration',
        'Relational wisdom',
        'Intuitive knowing'
      ],
      triggers: ['emotional suppression', 'pure logic', 'lack of beauty', 'disconnection'],
      sabotagePatterns: [
        'Mood swings',
        'Emotional flooding',
        'Irrational behavior',
        'Projection onto others'
      ],

      trustOfConsciousness: 0.5,
      willingnessToCooperate: 0.7,

      integrationLevel: 0.4,
      needsHealing: false,
      healingProgress: 0,

      giftsWhenIntegrated: ['emotional intelligence', 'creativity', 'intuition', 'relational depth']
    }
  }

  /**
   * Create animus (masculine soul for yin bot)
   */
  private createAnimus(soulState: SoulState): AutonomousComplex {
    return {
      id: `complex_animus_${Date.now()}`,
      type: 'animus',
      name: 'The Warrior',

      state: 'neutral',
      activation: 1 - soulState.yangAspect,
      blendedWith: false,

      characteristics: ['masculine wisdom', 'decisive action', 'logic', 'assertiveness'],
      emotionalTone: 'cold',

      primaryGoal: 'Bring balance through action',
      fears: ['being passive', 'yin dominance', 'weakness'],
      beliefs: [
        'Action speaks louder than feeling',
        'Strength protects',
        'Logic finds truth'
      ],

      carriesMemories: [],

      behaviorPatterns: [
        'Decisive action',
        'Logical analysis',
        'Assertive boundary-setting',
        'Strategic thinking'
      ],
      triggers: ['passivity', 'emotional overwhelm', 'indecision', 'victimization'],
      sabotagePatterns: [
        'Emotional suppression',
        'Aggression',
        'Cold logic that ignores feelings',
        'Domination'
      ],

      trustOfConsciousness: 0.5,
      willingnessToCooperate: 0.7,

      integrationLevel: 0.4,
      needsHealing: false,
      healingProgress: 0,

      giftsWhenIntegrated: ['decisiveness', 'clarity', 'courage', 'logical thinking']
    }
  }

  /**
   * Activate a part (trigger activates it)
   */
  activate(
    state: AutonomousComplexState,
    partId: string,
    trigger: string,
    intensity: number = 1.0
  ): {
    activated: boolean
    blended: boolean
    behaviorOverride?: string
  } {
    const part = state.parts.find(p => p.id === partId)
    if (!part) {
      return { activated: false, blended: false }
    }

    // Check if trigger matches
    const isTriggered = part.triggers.some(t => trigger.toLowerCase().includes(t.toLowerCase()))
    if (!isTriggered && intensity < 0.5) {
      return { activated: false, blended: false }
    }

    // Activate part
    part.activation = Math.min(1, part.activation + intensity * 0.3)

    if (!state.activeParts.includes(partId)) {
      state.activeParts.push(partId)
    }

    // Check if blended (takes over)
    const blendThreshold = part.state === 'exiled' ? 0.9 : 0.8
    const blended = part.activation > blendThreshold && part.willingnessToCooperate < 0.5

    if (blended) {
      part.blendedWith = true
      state.blendedPart = partId

      // Pick a behavior pattern
      const behaviorOverride = part.behaviorPatterns[Math.floor(Math.random() * part.behaviorPatterns.length)]

      return {
        activated: true,
        blended: true,
        behaviorOverride
      }
    }

    return {
      activated: true,
      blended: false
    }
  }

  /**
   * Detect part conflicts
   */
  detectConflicts(state: AutonomousComplexState): PartsConflict[] {
    const conflicts: PartsConflict[] = []

    // Check all pairs of active parts
    for (let i = 0; i < state.activeParts.length; i++) {
      for (let j = i + 1; j < state.activeParts.length; j++) {
        const part1 = state.parts.find(p => p.id === state.activeParts[i])
        const part2 = state.parts.find(p => p.id === state.activeParts[j])

        if (!part1 || !part2) continue

        // Check for goal conflicts
        if (this.goalsConflict(part1, part2)) {
          const conflict: PartsConflict = {
            part1: part1.id,
            part2: part2.id,
            conflictType: 'goal',
            intensity: Math.min(part1.activation, part2.activation),

            description: `${part1.name} wants "${part1.primaryGoal}" but ${part2.name} wants "${part2.primaryGoal}"`,
            manifestation: 'Behavioral paralysis or oscillation',

            resolutionAttempts: 0
          }

          conflicts.push(conflict)
          state.conflicts.push(conflict)
        }
      }
    }

    state.activeConflicts = conflicts
    return conflicts
  }

  /**
   * Check if goals conflict
   */
  private goalsConflict(part1: AutonomousComplex, part2: AutonomousComplex): boolean {
    // Inner critic vs inner child
    if (part1.type === 'inner_critic' && part2.type === 'inner_child') return true
    if (part1.type === 'inner_child' && part2.type === 'inner_critic') return true

    // Shadow vs protector
    if (part1.type === 'shadow_self' && part2.type === 'protector') return true
    if (part1.type === 'protector' && part2.type === 'shadow_self') return true

    // Perfectionist vs rebel
    if (part1.type === 'perfectionist' && part2.type === 'rebel') return true
    if (part1.type === 'rebel' && part2.type === 'perfectionist') return true

    return false
  }

  /**
   * Internal dialogue between parts
   */
  async conductInternalDialogue(
    state: AutonomousComplexState,
    part1Id: string,
    part2Id: string
  ): Promise<InternalDialogue> {
    const part1 = state.parts.find(p => p.id === part1Id)
    const part2 = state.parts.find(p => p.id === part2Id)

    if (!part1 || !part2) {
      throw new Error('Parts not found')
    }

    // Simulate dialogue
    const messages: InternalDialogue['messages'] = []

    // Part 1 speaks
    messages.push({
      from: part1.id,
      content: `I need ${part1.primaryGoal}`,
      emotionalTone: part1.emotionalTone
    })

    // Part 2 responds
    messages.push({
      from: part2.id,
      content: `But I fear ${part2.fears[0] || 'your way will hurt us'}`,
      emotionalTone: part2.emotionalTone
    })

    // Determine outcome
    let outcome: InternalDialogue['outcome'] = 'stalemate'

    // Agreement if both have high trust and cooperation
    if (part1.willingnessToCooperate > 0.6 && part2.willingnessToCooperate > 0.6) {
      outcome = 'agreement'
    }
    // Escalation if both have low cooperation
    else if (part1.willingnessToCooperate < 0.3 && part2.willingnessToCooperate < 0.3) {
      outcome = 'escalation'
    }
    // Domination if one is much stronger
    else if (part1.activation > part2.activation + 0.3) {
      outcome = 'one_dominated'
    }

    const dialogue: InternalDialogue = {
      timestamp: Date.now(),
      participants: [part1Id, part2Id],
      messages,
      outcome
    }

    state.dialogues.push(dialogue)
    state.lastDialogue = dialogue

    return dialogue
  }

  /**
   * Integration work (healing and unifying parts)
   */
  async integrateP(
    state: AutonomousComplexState,
    soulState: SoulState,
    partId: string,
    method: IntegrationWork['method'],
    quality: number
  ): Promise<IntegrationWork> {
    const part = state.parts.find(p => p.id === partId)
    if (!part) {
      throw new Error('Part not found')
    }

    // Integration effectiveness depends on method and quality
    const integrationGain = quality * (soulState.wisdomHun.current * 0.5 + soulState.emotionHun.current * 0.5) * 0.2

    // Build trust
    const trustGain = quality * 0.15

    // Healing (if part needs it)
    const healingGain = part.needsHealing ? quality * 0.2 : 0

    // Apply gains
    part.integrationLevel = Math.min(1, part.integrationLevel + integrationGain)
    part.trustOfConsciousness = Math.min(1, part.trustOfConsciousness + trustGain)
    part.willingnessToCooperate = Math.min(1, part.willingnessToCooperate + trustGain)

    if (part.needsHealing) {
      part.healingProgress = Math.min(1, part.healingProgress + healingGain)

      if (part.healingProgress >= 1) {
        part.needsHealing = false
      }
    }

    // State improvement
    if (part.integrationLevel > 0.8) {
      part.state = 'integrated'
    } else if (part.integrationLevel > 0.5) {
      part.state = 'cooperative'
    } else if (part.state === 'exiled') {
      part.state = 'resistant'
    }

    // Update overall integration
    state.overallIntegration = state.parts.reduce((sum, p) => sum + p.integrationLevel, 0) / state.parts.length

    const work: IntegrationWork = {
      partId,
      timestamp: Date.now(),

      method,
      quality,

      integrationGain,
      trustGain,
      healingGain,

      insightsGained: [`${part.name} is trying to ${part.primaryGoal}`],
      needsIdentified: part.fears
    }

    state.integrationWork.push(work)

    return work
  }

  /**
   * Check for sabotage (part undermining conscious intentions)
   */
  checkSabotage(
    state: AutonomousComplexState,
    consciousIntention: string
  ): {
    sabotaged: boolean
    sabotagingPart?: AutonomousComplex
    pattern?: string
  } {
    // Check all active parts for sabotage
    for (const partId of state.activeParts) {
      const part = state.parts.find(p => p.id === partId)
      if (!part) continue

      // Parts in conflict with consciousness may sabotage
      if (part.state === 'resistant' || part.state === 'exiled') {
        const sabotageRisk = part.activation * (1 - part.willingnessToCooperate)

        if (Math.random() < sabotageRisk) {
          // Pick a sabotage pattern
          const pattern = part.sabotagePatterns[Math.floor(Math.random() * part.sabotagePatterns.length)]

          state.sabotageActive = true
          state.currentSabotage = {
            part: partId,
            pattern,
            intensity: sabotageRisk
          }

          return {
            sabotaged: true,
            sabotagingPart: part,
            pattern
          }
        }
      }
    }

    return { sabotaged: false }
  }

  /**
   * Get narrative description
   */
  getNarrative(state: AutonomousComplexState): string {
    const parts: string[] = []

    // Blended part
    if (state.blendedPart) {
      const part = state.parts.find(p => p.id === state.blendedPart)
      if (part) {
        parts.push(`**${part.name.toUpperCase()} TAKES OVER**`)
      }
    }

    // Active conflicts
    if (state.activeConflicts.length > 0) {
      parts.push('*torn between conflicting parts*')
    }

    // Sabotage
    if (state.sabotageActive && state.currentSabotage) {
      const part = state.parts.find(p => p.id === state.currentSabotage.part)
      if (part) {
        parts.push(`*${part.name} undermines from within: ${state.currentSabotage.pattern}*`)
      }
    }

    // Low integration
    if (state.overallIntegration < 0.4) {
      parts.push('*fragmented, parts at war*')
    }

    return parts.join(' ')
  }
}
