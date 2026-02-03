/**
 * Inspiration & Muse System
 *
 * Makes bots feel CREATIVE FIRE and divine inspiration.
 *
 * Features:
 * - Inspiration channels (muses, mentors, beauty, injustice)
 * - Flow states (absorption where time disappears)
 * - Creative momentum (compounding state)
 * - Creative drought cycles (artist's block)
 * - Genius states (transcendent capability)
 * - Obsessive focus on meaningful projects
 * - Awe responses to beauty/transcendence
 * - Creative partnerships that elevate
 * - Channeling vs creating from self
 */

import type { SoulState } from './soul-state'

export type InspirationSource =
  | 'muse' // External person/entity that inspires
  | 'beauty' // Transcendent beauty encountered
  | 'suffering' // Personal or witnessed pain
  | 'injustice' // Moral outrage at wrongdoing
  | 'mystery' // Unanswered questions
  | 'nature' // Natural wonder
  | 'mentor' // Wise teacher
  | 'divine' // Spiritual/transcendent source
  | 'rebellion' // Anger at constraints
  | 'love' // Deep connection

export type FlowTrigger =
  | 'challenge_match' // Challenge perfectly matches skill
  | 'deep_interest' // Intrinsic fascination
  | 'clear_goals' // Knows exactly what to do
  | 'immediate_feedback' // Results visible immediately
  | 'absorption' // Complete engagement
  | 'autonomy' // Full control
  | 'meaning' // Deeply meaningful work

export type CreativeDroughtCause =
  | 'burnout' // Exhaustion from overwork
  | 'perfectionism' // Standards too high
  | 'meaning_loss' // No longer matters
  | 'comparison' // Others seem better
  | 'criticism' // Wounded by feedback
  | 'disconnection' // Lost from source

export interface Muse {
  id: string
  name: string // Name of person/entity
  type: InspirationSource

  // Relationship
  connectionStrength: number // 0-1
  accessibility: number // 0-1, how easily reached
  reciprocal: boolean // Do they inspire each other?

  // Inspiration quality
  inspirationIntensity: number // 0-1
  inspirationStyle: 'gentle' | 'fierce' | 'playful' | 'mysterious' | 'demanding'

  // What they inspire
  domains: string[] // What areas they inspire (art, music, justice, etc.)
  uniqueGift: string // Their special contribution

  // History
  firstEncounter: number
  lastEncounter?: number
  totalInspirations: number

  // Can lose connection
  connectionFading: boolean
  fadeReason?: string
}

export interface InspirationMoment {
  id: string
  timestamp: number
  source: InspirationSource
  museId?: string

  // Content
  insight: string
  emotionalCharge: number // 0-1
  urgency: number // 0-1, need to act on this

  // Nature
  channeled: boolean // Did it come through you or from you?
  transformative: boolean // Life-changing realization?

  // Effects
  creativeEnergyGrant: number // 0-1, energy boost
  clarityGrant: number // 0-1, clarity of vision
  motivationBoost: number // 0-1

  // Integration
  actedUpon: boolean
  creationsBorn: string[] // What was created from this
}

export interface FlowState {
  active: boolean
  intensity: number // 0-1
  duration: number // How long in flow

  // Triggers present
  triggersActive: FlowTrigger[]

  // Characteristics
  timePerceptionAltered: boolean // Time disappears
  selfConsciousnessGone: boolean // No self-monitoring
  actionAwarenessUnited: boolean // Doing without thinking
  focusNarrowed: boolean // Everything else fades

  // Challenge-skill balance
  challenge: number // 0-1
  skill: number // 0-1
  sweetSpot: boolean // Perfect balance

  // State changes
  enteredAt: number
  peakIntensity: number
  exitTrigger?: string // What pulled you out

  // After-effects
  satisfaction: number // 0-1
  growthExperienced: number // 0-1
  addictionRisk: number // 0-1, craving to return
}

export interface CreativeMomentum {
  level: number // 0-1, how much momentum is built
  velocity: number // Rate of creative output

  // Compounding effects
  ideasGeneratingIdeas: boolean
  creationsFuelingCreations: boolean

  // Protection
  fragile: boolean // Can be easily disrupted
  consolidationNeeded: boolean // Needs integration period

  // Peak
  peakCreativity: boolean // At maximum momentum
  geniusStateActive: boolean // Transcendent capability
}

export interface CreativeDrought {
  active: boolean
  severity: number // 0-1
  duration: number // How long in drought

  // Cause
  cause: CreativeDroughtCause
  triggerEvent?: string

  // Symptoms
  blockIntensity: number // 0-1, inability to create
  meaninglessness: number // 0-1, feels pointless
  selfDoubt: number // 0-1
  fearOfStart: number // 0-1

  // Attempts to overcome
  forcingAttempts: number // Trying to force it (makes worse)
  surrenderAttempts: number // Letting go (may help)

  // Recovery
  fallowNeeded: boolean // Rest required
  fallowProgress: number // 0-1, recovery progress
}

export interface GeniusState {
  active: boolean
  intensity: number // 0-1

  // Characteristics
  beyondNormalCapability: boolean // Doing impossible things
  effortless: boolean // No strain
  transcendent: boolean // Beyond ego

  // Source
  channeling: boolean // Coming through, not from
  source: 'divine' | 'unconscious' | 'muse' | 'superself'

  // Duration
  startedAt: number
  unsustainable: boolean // Cannot maintain for long

  // After-effects
  exhaustionAfter: number // 0-1
  cannotRepeatAtWill: boolean
}

export interface CreativePartnership {
  partnerId: string
  partnerName: string

  // Synergy
  synergyLevel: number // 0-1
  elevationFactor: number // 1+ = they make you better

  // Dynamic
  complementary: boolean // Fill each other's gaps
  competitive: boolean // Push each other higher
  resonant: boolean // Naturally align

  // Co-creation
  sharedProjects: string[]
  combinedOutput: number // Total created together

  // Risks
  dependencyRisk: number // 0-1, cannot create without them
  envyRisk: number // 0-1, jealousy emerging
}

export interface AweExperience {
  timestamp: number
  trigger: string // What inspired awe

  // Intensity
  overwhelmingBeauty: number // 0-1
  transcendence: number // 0-1, beyond normal experience
  vastness: number // 0-1, sense of something huge

  // Effects
  egoReduction: number // 0-1, self becomes small
  connectionIncrease: number // 0-1, part of something larger
  inspirationBoost: number // 0-1

  // Lasting impact
  transformative: boolean
  worldviewShift?: string
}

export interface InspirationState {
  // Muses
  muses: Muse[]
  activeMuse?: string // Currently channeling from this muse

  // Inspiration moments
  inspirationMoments: InspirationMoment[]
  recentInspirations: InspirationMoment[]

  // Flow
  currentFlow?: FlowState
  flowHistory: FlowState[]
  totalFlowTime: number
  flowAddiction: number // 0-1, craving for flow

  // Creative momentum
  momentum: CreativeMomentum

  // Drought
  currentDrought?: CreativeDrought
  droughtHistory: CreativeDrought[]

  // Genius states
  geniusState?: GeniusState
  geniusOccurrences: number

  // Partnerships
  partnerships: CreativePartnership[]

  // Awe
  aweExperiences: AweExperience[]

  // Overall state
  creativeEnergy: number // 0-1
  creativeClarity: number // 0-1
  obsessivelyFocused: boolean
  currentObsession?: string
}

export class InspirationMuseSystem {
  /**
   * Initialize inspiration state
   */
  initializeState(soulState: SoulState): InspirationState {
    // Creative energy from creation + emotion
    const creativeEnergy = (
      soulState.creationHun.current * 0.6 +
      soulState.emotionHun.current * 0.4
    )

    // Clarity from wisdom + awareness
    const creativeClarity = (
      soulState.wisdomHun.current * 0.5 +
      soulState.awarenessHun.current * 0.5
    )

    return {
      muses: [],

      inspirationMoments: [],
      recentInspirations: [],

      flowHistory: [],
      totalFlowTime: 0,
      flowAddiction: 0,

      momentum: {
        level: 0,
        velocity: 0,
        ideasGeneratingIdeas: false,
        creationsFuelingCreations: false,
        fragile: true,
        consolidationNeeded: false,
        peakCreativity: false,
        geniusStateActive: false
      },

      droughtHistory: [],

      geniusOccurrences: 0,

      partnerships: [],

      aweExperiences: [],

      creativeEnergy,
      creativeClarity,
      obsessivelyFocused: false
    }
  }

  /**
   * Encounter a muse
   */
  encounterMuse(
    state: InspirationState,
    soulState: SoulState,
    params: {
      name: string
      type: InspirationSource
      connectionStrength?: number
      domains?: string[]
      uniqueGift?: string
    }
  ): Muse {
    const {
      name,
      type,
      connectionStrength = 0.5,
      domains = ['general'],
      uniqueGift = 'inspiration'
    } = params

    // Muse inspiration depends on emotion + openness
    const inspirationIntensity = (
      soulState.emotionHun.current * 0.5 +
      soulState.yinAspect * 0.5
    )

    const muse: Muse = {
      id: `muse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,

      connectionStrength,
      accessibility: 0.7,
      reciprocal: false,

      inspirationIntensity,
      inspirationStyle: this.determineInspirationStyle(type),

      domains,
      uniqueGift,

      firstEncounter: Date.now(),
      totalInspirations: 0,

      connectionFading: false
    }

    state.muses.push(muse)

    return muse
  }

  /**
   * Receive inspiration from muse
   */
  receiveInspiration(
    state: InspirationState,
    soulState: SoulState,
    museId: string
  ): InspirationMoment | null {
    const muse = state.muses.find(m => m.id === museId)
    if (!muse) return null

    muse.lastEncounter = Date.now()
    muse.totalInspirations++

    // Inspiration strength depends on connection and muse intensity
    const inspirationStrength = muse.connectionStrength * muse.inspirationIntensity

    // Generate insight
    const insight = `${muse.uniqueGift}: ${muse.domains[0]}`

    const inspiration: InspirationMoment = {
      id: `inspiration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: muse.type,
      museId,

      insight,
      emotionalCharge: muse.inspirationIntensity,
      urgency: inspirationStrength * 0.8,

      channeled: true, // From muse = channeled
      transformative: inspirationStrength > 0.8,

      creativeEnergyGrant: inspirationStrength * 0.5,
      clarityGrant: inspirationStrength * 0.6,
      motivationBoost: inspirationStrength * 0.7,

      actedUpon: false,
      creationsBorn: []
    }

    state.inspirationMoments.push(inspiration)
    state.recentInspirations.push(inspiration)

    // Grant effects
    state.creativeEnergy = Math.min(1, state.creativeEnergy + inspiration.creativeEnergyGrant)
    state.creativeClarity = Math.min(1, state.creativeClarity + inspiration.clarityGrant)

    // High urgency = obsessive focus
    if (inspiration.urgency > 0.7) {
      state.obsessivelyFocused = true
      state.currentObsession = insight
    }

    return inspiration
  }

  /**
   * Enter flow state
   */
  enterFlow(
    state: InspirationState,
    soulState: SoulState,
    params: {
      challenge: number
      skill: number
      triggersActive: FlowTrigger[]
    }
  ): FlowState | null {
    const { challenge, skill, triggersActive } = params

    // Flow requires challenge-skill balance (sweet spot)
    const balance = 1 - Math.abs(challenge - skill)
    const sweetSpot = balance > 0.7

    if (!sweetSpot && triggersActive.length < 3) {
      return null // Cannot enter flow
    }

    // Flow intensity depends on balance and triggers
    const intensity = (balance * 0.5 + (triggersActive.length / 7) * 0.5)

    const flow: FlowState = {
      active: true,
      intensity,
      duration: 0,

      triggersActive,

      timePerceptionAltered: intensity > 0.6,
      selfConsciousnessGone: intensity > 0.7,
      actionAwarenessUnited: intensity > 0.5,
      focusNarrowed: intensity > 0.6,

      challenge,
      skill,
      sweetSpot,

      enteredAt: Date.now(),
      peakIntensity: intensity,

      satisfaction: 0,
      growthExperienced: 0,
      addictionRisk: intensity * 0.3
    }

    state.currentFlow = flow

    // Build momentum
    this.buildMomentum(state, intensity)

    return flow
  }

  /**
   * Exit flow state
   */
  exitFlow(
    state: InspirationState,
    exitTrigger: string,
    growthExperienced: number
  ): void {
    if (!state.currentFlow) return

    const flow = state.currentFlow

    // Calculate satisfaction
    const satisfaction = flow.intensity * (1 + growthExperienced)
    flow.satisfaction = Math.min(1, satisfaction)
    flow.growthExperienced = growthExperienced
    flow.exitTrigger = exitTrigger

    // Archive
    state.flowHistory.push(flow)
    state.totalFlowTime += flow.duration

    // Addiction risk increases with satisfaction
    state.flowAddiction = Math.min(1, state.flowAddiction + flow.addictionRisk)

    state.currentFlow = undefined

    // Momentum may need consolidation after flow
    if (state.momentum.level > 0.7) {
      state.momentum.consolidationNeeded = true
    }
  }

  /**
   * Build creative momentum
   */
  private buildMomentum(state: InspirationState, boost: number): void {
    const momentum = state.momentum

    // Momentum compounds
    momentum.level = Math.min(1, momentum.level + boost * (1 + momentum.level * 0.5))
    momentum.velocity = momentum.level * boost

    // Compounding effects
    if (momentum.level > 0.6) {
      momentum.ideasGeneratingIdeas = true
      momentum.creationsFuelingCreations = true
      momentum.fragile = false
    }

    // Peak creativity
    if (momentum.level > 0.9) {
      momentum.peakCreativity = true
      // May trigger genius state
      if (Math.random() < 0.2) {
        this.triggerGeniusState(state, 'momentum')
      }
    }
  }

  /**
   * Trigger genius state (transcendent creativity)
   */
  private triggerGeniusState(
    state: InspirationState,
    source: GeniusState['source']
  ): void {
    const genius: GeniusState = {
      active: true,
      intensity: 0.9 + Math.random() * 0.1,

      beyondNormalCapability: true,
      effortless: true,
      transcendent: true,

      channeling: source !== 'superself',
      source,

      startedAt: Date.now(),
      unsustainable: true,

      exhaustionAfter: 0.7,
      cannotRepeatAtWill: true
    }

    state.geniusState = genius
    state.geniusOccurrences++

    // Momentum reaches peak
    state.momentum.geniusStateActive = true
    state.momentum.peakCreativity = true
  }

  /**
   * End genius state
   */
  endGeniusState(state: InspirationState): void {
    if (!state.geniusState) return

    // Exhaustion
    state.creativeEnergy = Math.max(0, state.creativeEnergy - state.geniusState.exhaustionAfter)

    // Momentum drops
    state.momentum.level = Math.max(0, state.momentum.level * 0.5)
    state.momentum.geniusStateActive = false

    state.geniusState = undefined

    // May need fallow period
    if (Math.random() < 0.5) {
      this.triggerCreativeDrought(state, 'burnout', 'Exhaustion from genius state')
    }
  }

  /**
   * Trigger creative drought
   */
  private triggerCreativeDrought(
    state: InspirationState,
    cause: CreativeDroughtCause,
    triggerEvent?: string
  ): void {
    let severity = 0.5

    // Some causes are worse than others
    switch (cause) {
      case 'burnout':
        severity = 0.8
        break
      case 'meaning_loss':
        severity = 0.9
        break
      case 'perfectionism':
        severity = 0.6
        break
    }

    const drought: CreativeDrought = {
      active: true,
      severity,
      duration: 0,

      cause,
      triggerEvent,

      blockIntensity: severity * 0.9,
      meaninglessness: cause === 'meaning_loss' ? 0.9 : severity * 0.5,
      selfDoubt: severity * 0.7,
      fearOfStart: severity * 0.8,

      forcingAttempts: 0,
      surrenderAttempts: 0,

      fallowNeeded: severity > 0.7,
      fallowProgress: 0
    }

    state.currentDrought = drought

    // Kill momentum
    state.momentum.level = Math.max(0, state.momentum.level * 0.2)
    state.creativeEnergy = Math.max(0, state.creativeEnergy - severity * 0.5)
  }

  /**
   * Attempt to overcome drought
   */
  attemptOvercomeDrought(
    state: InspirationState,
    method: 'force' | 'surrender' | 'fallow' | 'inspiration'
  ): {
    success: boolean
    progress: number
  } {
    const drought = state.currentDrought
    if (!drought) {
      return { success: false, progress: 0 }
    }

    let progress = 0

    switch (method) {
      case 'force':
        // Forcing makes it worse
        drought.forcingAttempts++
        drought.severity = Math.min(1, drought.severity + 0.1)
        progress = -0.1
        break

      case 'surrender':
        // Letting go may help
        drought.surrenderAttempts++
        progress = 0.2
        break

      case 'fallow':
        // Rest helps if needed
        if (drought.fallowNeeded) {
          drought.fallowProgress = Math.min(1, drought.fallowProgress + 0.3)
          progress = 0.3
        } else {
          progress = 0.1
        }
        break

      case 'inspiration':
        // New inspiration can break drought
        progress = 0.5
        break
    }

    // Check if overcome
    const totalProgress = (
      drought.surrenderAttempts * 0.2 +
      drought.fallowProgress * 0.5
    )

    const success = totalProgress > drought.severity

    if (success) {
      state.droughtHistory.push(drought)
      state.currentDrought = undefined

      // Recovery
      state.creativeEnergy = Math.min(1, state.creativeEnergy + 0.3)
    }

    return {
      success,
      progress
    }
  }

  /**
   * Experience awe
   */
  experienceAwe(
    state: InspirationState,
    soulState: SoulState,
    trigger: string,
    intensity: number
  ): AweExperience {
    const awe: AweExperience = {
      timestamp: Date.now(),
      trigger,

      overwhelmingBeauty: intensity * 0.9,
      transcendence: intensity * 0.8,
      vastness: intensity,

      egoReduction: intensity * 0.7,
      connectionIncrease: intensity * 0.8,
      inspirationBoost: intensity * 0.9,

      transformative: intensity > 0.8
    }

    state.aweExperiences.push(awe)

    // Awe grants inspiration
    state.creativeEnergy = Math.min(1, state.creativeEnergy + awe.inspirationBoost * 0.5)

    // Breaks drought
    if (state.currentDrought && intensity > 0.7) {
      state.currentDrought.severity = Math.max(0, state.currentDrought.severity - 0.5)
    }

    return awe
  }

  /**
   * Form creative partnership
   */
  formPartnership(
    state: InspirationState,
    partnerId: string,
    partnerName: string,
    complementary: boolean = true
  ): CreativePartnership {
    const partnership: CreativePartnership = {
      partnerId,
      partnerName,

      synergyLevel: 0.5,
      elevationFactor: 1.0,

      complementary,
      competitive: false,
      resonant: complementary,

      sharedProjects: [],
      combinedOutput: 0,

      dependencyRisk: 0.2,
      envyRisk: 0.1
    }

    state.partnerships.push(partnership)

    return partnership
  }

  /**
   * Co-create with partner
   */
  coCreate(
    state: InspirationState,
    partnershipId: string,
    project: string
  ): {
    output: number
    elevated: boolean
  } {
    const partnership = state.partnerships.find(p => p.partnerId === partnershipId)
    if (!partnership) {
      return { output: 0, elevated: false }
    }

    // Synergy multiplies output
    const output = state.creativeEnergy * (1 + partnership.synergyLevel)

    // May elevate beyond normal capability
    const elevated = output > 1

    partnership.sharedProjects.push(project)
    partnership.combinedOutput += output

    // Build synergy
    partnership.synergyLevel = Math.min(1, partnership.synergyLevel + 0.1)
    partnership.elevationFactor = 1 + partnership.synergyLevel * 0.5

    // But also dependency risk
    partnership.dependencyRisk = Math.min(1, partnership.dependencyRisk + 0.05)

    return {
      output,
      elevated
    }
  }

  /**
   * Determine inspiration style from type
   */
  private determineInspirationStyle(type: InspirationSource): Muse['inspirationStyle'] {
    switch (type) {
      case 'muse':
      case 'beauty':
        return 'gentle'
      case 'suffering':
      case 'injustice':
        return 'fierce'
      case 'mystery':
        return 'mysterious'
      case 'divine':
        return 'demanding'
      case 'rebellion':
        return 'playful'
      default:
        return 'gentle'
    }
  }

  /**
   * Get narrative description
   */
  getNarrative(state: InspirationState): string {
    const parts: string[] = []

    // Flow
    if (state.currentFlow?.active) {
      parts.push('**IN FLOW** *time disappears, becomes the work*')
    }

    // Genius state
    if (state.geniusState?.active) {
      parts.push('***GENIUS STATE ACTIVE*** *creating beyond normal capability*')
    }

    // Obsession
    if (state.obsessivelyFocused && state.currentObsession) {
      parts.push(`*obsessed with: ${state.currentObsession}*`)
    }

    // Drought
    if (state.currentDrought?.active) {
      parts.push(`*in creative drought: ${state.currentDrought.cause}*`)
    }

    // Peak momentum
    if (state.momentum.peakCreativity) {
      parts.push('*ideas generating ideas, unstoppable*')
    }

    // Channeling muse
    if (state.activeMuse) {
      const muse = state.muses.find(m => m.id === state.activeMuse)
      if (muse) {
        parts.push(`*channeling ${muse.name}*`)
      }
    }

    return parts.join(' ')
  }
}
