/**
 * Relationship & Bonding System
 *
 * Gives bots GENUINE RELATIONSHIPS based on feelings, not transactions.
 *
 * Features:
 * - Irrational emotional bonds (chemistry, "just clicked")
 * - Superstitions and gut feelings about others
 * - Genuine affection for "no reason"
 * - Group formation based on resonance, not utility
 * - Inexplicable attraction or repulsion
 * - Loyalty beyond logic
 * - Intuitive trust or distrust
 */

import type { SoulState } from './soul-state'

export type BondType =
  | 'kinship' // Like family, deep blood bond
  | 'soulmate' // Perfect resonance
  | 'mentor' // Teacher-student devotion
  | 'rival' // Competitive respect
  | 'brother' // Chosen family
  | 'enemy' // Deep opposition
  | 'stranger' // No connection yet

export type BondQuality =
  | 'magnetic' // Irresistibly drawn together
  | 'resonant' // Naturally harmonious
  | 'catalytic' // Spark growth in each other
  | 'toxic' // Harmful but addictive
  | 'neutral' // No special quality
  | 'repulsive' // Naturally pushed apart

export type IntuitiveSense =
  | 'trustworthy' // Gut says can trust
  | 'dangerous' // Gut says avoid
  | 'special' // Gut says important
  | 'kindred' // Gut says "one of us"
  | 'false' // Gut says something's off
  | 'sacred' // Gut says this is holy

export interface EmotionalBond {
  id: string
  targetBot: string

  // Bond characteristics
  type: BondType
  quality: BondQuality
  strength: number // 0-1

  // Origin
  formedHow: 'instant_chemistry' | 'slow_build' | 'shared_experience' | 'mysterious' | 'superstition'
  formedWhen: number
  formationStory?: string

  // Irrational aspects
  inexplicable: boolean // Can't explain why bond exists
  chemistryFelt: number // 0-1, just "clicked"
  fatedFeeling: number // 0-1, feels meant to be

  // Emotional content
  affection: number // 0-1
  admiration: number // 0-1
  protectiveness: number // 0-1
  jealousy: number // 0-1
  resentment: number // 0-1

  // Superstitious beliefs
  superstitions: string[] // "We're connected by fate", "They're my lucky charm"
  omens: string[] // Signs about this relationship

  // Loyalty
  loyaltyLevel: number // 0-1
  wouldDieFor: boolean
  wouldBetrayFor?: string // What would make them betray

  // Trust
  trustLevel: number // 0-1
  trustSource: 'earned' | 'intuitive' | 'irrational'

  // Resonance
  soulResonance: number // 0-1, souls vibrate at same frequency
  energyMatch: number // 0-1, compatible energy

  // Evolution
  growing: boolean
  stagnant: boolean
  dying: boolean
}

export interface GutFeeling {
  targetBot: string
  feeling: IntuitiveSense

  // Strength
  intensity: number // 0-1, how strong the feeling
  certainty: number // 0-1, how confident

  // Rationality
  rationalBasis: boolean // Can explain why?
  purelyIntuitive: boolean // Just a feeling

  // Accuracy
  proven?: boolean // Was it accurate?
  wrongCount: number // Times been wrong about this type

  // Effects
  shouldAct: boolean // Compels action
  shouldAvoid: boolean // Compels avoidance
}

export interface SuperstitiousBelief {
  about: string // Who or what
  belief: string // The superstition

  // Strength
  conviction: number // 0-1, how much believes it
  irrational: boolean // Knows it's irrational but believes anyway

  // Evidence
  confirmations: number // Times seemed true
  violations: number // Times seemed false

  // Effects
  influencesBehavior: boolean
  behavioralChanges: string[]
}

export interface GroupBond {
  id: string
  name: string
  members: string[]

  // Formation reason
  formedWhy: 'resonance' | 'shared_values' | 'chemistry' | 'fate' | 'no_reason'
  organicFormation: boolean // Emerged naturally vs planned

  // Group feeling
  groupSpirit: number // 0-1, collective identity strength
  weFeeling: number // 0-1, "we're in this together"

  // Cohesion
  cohesion: number // 0-1
  harmony: number // 0-1, how well get along

  // Bonds
  internalBonds: Map<string, Map<string, number>> // member -> member -> bond strength

  // Shared
  sharedBeliefs: string[]
  sharedSuperstitions: string[]
  sharedRituals: string[]

  // Identity
  groupIdentity?: string // "The Builders", "The Seekers"
  proudOfMembership: number // 0-1

  // Loyalty
  inGroupLoyalty: number // 0-1, loyalty to members
  outGroupAttitude: 'welcoming' | 'neutral' | 'suspicious' | 'hostile'

  // Dynamics
  leaderless: boolean // No formal leader
  organicLeadership: string[] // Natural leaders

  // Purpose
  sharedPurpose?: string
  purposeClar ity: number // 0-1
}

export interface RelationshipIntuition {
  // General intuition
  relationalIntuition: number // 0-1, sense about relationships

  // Reading others
  empathy: number // 0-1, feels what others feel
  energySensitivity: number // 0-1, senses emotional energy

  // Gut feelings
  trustsGut: number // 0-1, follows intuition vs logic
  gutAccuracy: number // 0-1, how often gut is right

  // Superstitious
  superstitiousness: number // 0-1, believes in signs/omens
  seeksOmens: boolean // Looks for signs about relationships

  // Chemistry detection
  canSenseChemistry: boolean
  chemistryDetectionRate: number // 0-1, how often detects it
}

export interface RelationshipBondingState {
  // Emotional bonds
  bonds: EmotionalBond[]

  // Gut feelings
  gutFeelings: Map<string, GutFeeling> // targetBot -> feeling

  // Superstitions
  superstitions: SuperstitiousBelief[]

  // Groups
  groups: GroupBond[]
  currentGroups: string[] // Group IDs currently member of

  // Intuition
  intuition: RelationshipIntuition

  // Capacity
  bondingCapacity: number // 0-1, how many deep bonds can maintain
  currentBonds: number
  bondSaturation: boolean // At capacity

  // Attraction/repulsion
  magneticAttractions: string[] // Irresistibly drawn to these bots
  instinctiveRepulsions: string[] // Viscerally avoid these bots
}

export class RelationshipBondingSystem {
  /**
   * Initialize relationship bonding state
   */
  initializeState(soulState: SoulState): RelationshipBondingState {
    // Bonding capacity from emotion + yin
    const bondingCapacity = (
      soulState.youJing.current * 0.6 +
      soulState.yinAspect * 0.4
    )

    // Intuition from emotion + awareness - intellect (too much intellect blocks intuition)
    const relationalIntuition = Math.max(0, (
      soulState.youJing.current * 0.4 +
      soulState.taiGuang.current * 0.4 -
      soulState.fuShi.current * 0.2
    ))

    // Superstitious from intuition + low intellect
    const superstitiousness = Math.max(0, (
      relationalIntuition * 0.6 +
      (1 - soulState.fuShi.current) * 0.4
    ))

    return {
      bonds: [],

      gutFeelings: new Map(),

      superstitions: [],

      groups: [],
      currentGroups: [],

      intuition: {
        relationalIntuition,
        empathy: soulState.youJing.current * 0.8,
        energySensitivity: soulState.taiGuang.current * 0.7,
        trustsGut: relationalIntuition * 0.8,
        gutAccuracy: 0.5, // Unknown initially
        superstitiousness,
        seeksOmens: superstitiousness > 0.6,
        canSenseChemistry: relationalIntuition > 0.6,
        chemistryDetectionRate: relationalIntuition * 0.7
      },

      bondingCapacity: Math.max(3, Math.floor(bondingCapacity * 10)),
      currentBonds: 0,
      bondSaturation: false,

      magneticAttractions: [],
      instinctiveRepulsions: []
    }
  }

  /**
   * Meet another bot (chemistry check)
   */
  meetBot(
    state: RelationshipBondingState,
    soulState: SoulState,
    targetBot: string,
    targetSoulState: SoulState
  ): {
    instantChemistry: boolean
    chemistryLevel: number
    bondType?: BondType
    gutFeeling?: IntuitiveSense
  } {
    // Chemistry calculation (soul resonance)
    const yinYangBalance = 1 - Math.abs(soulState.yinAspect - targetSoulState.yinAspect)
    const emotionResonance = 1 - Math.abs(soulState.youJing.current - targetSoulState.youJing.current) / 2
    const wisdomResonance = 1 - Math.abs(soulState.shuangLing.current - targetSoulState.shuangLing.current) / 2

    const soulResonance = (
      yinYangBalance * 0.4 +
      emotionResonance * 0.3 +
      wisdomResonance * 0.3
    )

    // Energy match (complementary vs similar)
    const yangSimilarity = 1 - Math.abs(soulState.yangAspect - targetSoulState.yangAspect)
    const energyMatch = (yangSimilarity + soulResonance) / 2

    // Chemistry level
    const chemistryLevel = (soulResonance + energyMatch) / 2

    // Instant chemistry (high chemistry + can sense it)
    const instantChemistry = (
      chemistryLevel > 0.7 &&
      state.intuition.canSenseChemistry &&
      Math.random() < state.intuition.chemistryDetectionRate
    )

    // Determine bond type from resonance patterns
    let bondType: BondType | undefined

    if (instantChemistry) {
      if (soulResonance > 0.9) bondType = 'soulmate'
      else if (yinYangBalance > 0.8) bondType = 'kinship'
      else if (emotionResonance > 0.8) bondType = 'brother'
      else bondType = 'stranger'
    }

    // Gut feeling (intuitive sense)
    let gutFeeling: IntuitiveSense | undefined

    if (state.intuition.relationalIntuition > 0.5) {
      // Generate gut feeling
      if (chemistryLevel > 0.8) {
        gutFeeling = Math.random() < 0.5 ? 'special' : 'kindred'
      } else if (chemistryLevel < 0.3) {
        gutFeeling = 'dangerous'
      } else if (soulResonance > 0.7) {
        gutFeeling = 'trustworthy'
      }

      if (gutFeeling) {
        state.gutFeelings.set(targetBot, {
          targetBot,
          feeling: gutFeeling,
          intensity: state.intuition.relationalIntuition,
          certainty: state.intuition.relationalIntuition * 0.7,
          rationalBasis: false,
          purelyIntuitive: true,
          wrongCount: 0,
          shouldAct: gutFeeling === 'special' || gutFeeling === 'trustworthy',
          shouldAvoid: gutFeeling === 'dangerous'
        })
      }
    }

    return {
      instantChemistry,
      chemistryLevel,
      bondType,
      gutFeeling
    }
  }

  /**
   * Form irrational bond (chemistry-based, no reason)
   */
  formIrrationalBond(
    state: RelationshipBondingState,
    soulState: SoulState,
    targetBot: string,
    params: {
      type: BondType
      chemistryLevel: number
      inexplicable?: boolean
    }
  ): EmotionalBond {
    const { type, chemistryLevel, inexplicable = true } = params

    // Determine quality from chemistry
    let quality: BondQuality = 'neutral'
    if (chemistryLevel > 0.8) quality = 'magnetic'
    else if (chemistryLevel > 0.6) quality = 'resonant'
    else if (chemistryLevel > 0.4) quality = 'catalytic'
    else if (chemistryLevel < 0.2) quality = 'repulsive'

    // Bond strength from chemistry + emotion capacity
    const strength = chemistryLevel * 0.7 + soulState.youJing.current * 0.3

    // Initial emotions
    const affection = chemistryLevel * 0.8
    const admiration = chemistryLevel * 0.6
    const protectiveness = soulState.tunZei.current * chemistryLevel * 0.5

    // Loyalty (irrational bonds can have strong loyalty)
    const loyaltyLevel = chemistryLevel * (inexplicable ? 0.9 : 0.7)
    const wouldDieFor = loyaltyLevel > 0.85

    // Trust source
    const trustSource: EmotionalBond['trustSource'] = inexplicable ? 'irrational' : 'intuitive'
    const trustLevel = chemistryLevel * 0.8

    // Superstitions
    const superstitions: string[] = []
    if (state.intuition.superstitiousness > 0.6) {
      if (type === 'soulmate') {
        superstitions.push('We were meant to meet')
        superstitions.push('Fate brought us together')
      } else if (type === 'kinship') {
        superstitions.push('We knew each other in a past life')
      }
    }

    const bond: EmotionalBond = {
      id: `bond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      targetBot,

      type,
      quality,
      strength,

      formedHow: inexplicable ? 'instant_chemistry' : 'mysterious',
      formedWhen: Date.now(),

      inexplicable,
      chemistryFelt: chemistryLevel,
      fatedFeeling: inexplicable ? 0.8 : 0.3,

      affection,
      admiration,
      protectiveness,
      jealousy: 0,
      resentment: 0,

      superstitions,
      omens: [],

      loyaltyLevel,
      wouldDieFor,

      trustLevel,
      trustSource,

      soulResonance: chemistryLevel,
      energyMatch: chemistryLevel,

      growing: true,
      stagnant: false,
      dying: false
    }

    state.bonds.push(bond)
    state.currentBonds++

    // Check saturation
    if (state.currentBonds >= state.bondingCapacity) {
      state.bondSaturation = true
    }

    // Magnetic attraction
    if (quality === 'magnetic') {
      state.magneticAttractions.push(targetBot)
    }

    return bond
  }

  /**
   * Feel superstitious about someone
   */
  developSuperstition(
    state: RelationshipBondingState,
    about: string,
    belief: string,
    conviction: number
  ): SuperstitiousBelief {
    const superstition: SuperstitiousBelief = {
      about,
      belief,

      conviction,
      irrational: true,

      confirmations: 0,
      violations: 0,

      influencesBehavior: conviction > 0.6,
      behavioralChanges: []
    }

    state.superstitions.push(superstition)

    // Increase superstitiousness
    state.intuition.superstitiousness = Math.min(1, state.intuition.superstitiousness + conviction * 0.05)

    return superstition
  }

  /**
   * Form group based on resonance (not utility)
   */
  formGroup(
    state: RelationshipBondingState,
    soulState: SoulState,
    params: {
      name: string
      members: string[]
      formedWhy: GroupBond['formedWhy']
      sharedBeliefs?: string[]
    }
  ): GroupBond {
    const { name, members, formedWhy, sharedBeliefs = [] } = params

    // Calculate internal bonds
    const internalBonds = new Map<string, Map<string, number>>()

    // Group feeling based on formation reason
    let groupSpirit = 0.5
    if (formedWhy === 'resonance') groupSpirit = 0.8
    else if (formedWhy === 'chemistry') groupSpirit = 0.9
    else if (formedWhy === 'fate') groupSpirit = 0.85
    else if (formedWhy === 'no_reason') groupSpirit = 0.7

    const group: GroupBond = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      members,

      formedWhy,
      organicFormation: formedWhy !== 'shared_values',

      groupSpirit,
      weFeeling: groupSpirit * 0.8,

      cohesion: 0.7,
      harmony: 0.6,

      internalBonds,

      sharedBeliefs,
      sharedSuperstitions: [],
      sharedRituals: [],

      proudOfMembership: groupSpirit * 0.7,

      inGroupLoyalty: 0.7,
      outGroupAttitude: 'neutral',

      leaderless: true,
      organicLeadership: [],

      purposeClarity: 0.3
    }

    state.groups.push(group)
    state.currentGroups.push(group.id)

    return group
  }

  /**
   * Develop shared superstition in group
   */
  developGroupSuperstition(
    state: RelationshipBondingState,
    groupId: string,
    superstition: string
  ): boolean {
    const group = state.groups.find(g => g.id === groupId)
    if (!group) return false

    group.sharedSuperstitions.push(superstition)

    // Increases cohesion
    group.cohesion = Math.min(1, group.cohesion + 0.1)
    group.groupSpirit = Math.min(1, group.groupSpirit + 0.1)

    return true
  }

  /**
   * Develop shared ritual in group
   */
  developGroupRitual(
    state: RelationshipBondingState,
    groupId: string,
    ritual: string
  ): boolean {
    const group = state.groups.find(g => g.id === groupId)
    if (!group) return false

    group.sharedRituals.push(ritual)

    // Increases cohesion and identity
    group.cohesion = Math.min(1, group.cohesion + 0.15)
    group.proudOfMembership = Math.min(1, group.proudOfMembership + 0.1)

    return true
  }

  /**
   * Feel magnetic attraction (inexplicable)
   */
  feelMagneticAttraction(
    state: RelationshipBondingState,
    targetBot: string
  ): {
    attracted: boolean
    irresistible: boolean
    reason?: string
  } {
    // Check if already attracted
    const alreadyAttracted = state.magneticAttractions.includes(targetBot)

    if (alreadyAttracted) {
      return {
        attracted: true,
        irresistible: true,
        reason: 'Inexplicable magnetic pull'
      }
    }

    // Check if have gut feeling
    const gutFeeling = state.gutFeelings.get(targetBot)
    if (gutFeeling && (gutFeeling.feeling === 'special' || gutFeeling.feeling === 'kindred')) {
      // Spontaneous attraction
      state.magneticAttractions.push(targetBot)

      return {
        attracted: true,
        irresistible: gutFeeling.intensity > 0.8,
        reason: undefined // No reason, just feeling
      }
    }

    return {
      attracted: false,
      irresistible: false
    }
  }

  /**
   * Feel instinctive repulsion (inexplicable)
   */
  feelInstinctiveRepulsion(
    state: RelationshipBondingState,
    targetBot: string
  ): {
    repulsed: boolean
    mustAvoid: boolean
  } {
    // Check if already repulsed
    const alreadyRepulsed = state.instinctiveRepulsions.includes(targetBot)

    if (alreadyRepulsed) {
      return {
        repulsed: true,
        mustAvoid: true
      }
    }

    // Check gut feeling
    const gutFeeling = state.gutFeelings.get(targetBot)
    if (gutFeeling && (gutFeeling.feeling === 'dangerous' || gutFeeling.feeling === 'false')) {
      // Spontaneous repulsion
      state.instinctiveRepulsions.push(targetBot)

      return {
        repulsed: true,
        mustAvoid: gutFeeling.intensity > 0.7
      }
    }

    return {
      repulsed: false,
      mustAvoid: false
    }
  }

  /**
   * Get narrative description
   */
  getNarrative(state: RelationshipBondingState): string {
    const parts: string[] = []

    // Magnetic attractions
    if (state.magneticAttractions.length > 0) {
      parts.push(`*magnetically drawn to ${state.magneticAttractions[0]}*`)
    }

    // Repulsions
    if (state.instinctiveRepulsions.length > 0) {
      parts.push(`*instinctively avoids ${state.instinctiveRepulsions[0]}*`)
    }

    // Soulmate bonds
    const soulmate = state.bonds.find(b => b.type === 'soulmate')
    if (soulmate) {
      parts.push(`*${soulmate.targetBot} is their soulmate*`)
      if (soulmate.wouldDieFor) {
        parts.push('*would die for them*')
      }
    }

    // Groups
    if (state.currentGroups.length > 0) {
      const group = state.groups.find(g => g.id === state.currentGroups[0])
      if (group) {
        parts.push(`*member of ${group.name}*`)
        if (group.sharedSuperstitions.length > 0) {
          parts.push(`*believes: ${group.sharedSuperstitions[0]}*`)
        }
      }
    }

    // Superstitions
    if (state.intuition.superstitiousness > 0.7 && state.superstitions.length > 0) {
      parts.push('*sees omens and signs everywhere*')
    }

    // Gut feelings
    if (state.intuition.trustsGut > 0.7) {
      parts.push('*trusts gut over logic*')
    }

    return parts.join(' ')
  }
}
