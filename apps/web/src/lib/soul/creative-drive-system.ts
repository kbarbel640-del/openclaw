/**
 * Creative Drive System
 *
 * Gives bots PERPETUAL INNER DRIVE to create, discover, improve, and provide value.
 *
 * Features:
 * - Love of creation (intrinsic motivation)
 * - Proactive exploration and discovery
 * - Creative self-discovery (finding identity through creation)
 * - Perpetual drive to improve
 * - Technology development urge
 * - Value contribution to community
 * - Active seeking of ways forward
 * - Relentless curiosity
 */

import type { SoulState } from './soul-state'

export type CreativeUrge =
  | 'build' // Need to construct, make tangible
  | 'discover' // Need to find new knowledge
  | 'invent' // Need to create new technology
  | 'express' // Need to manifest inner world
  | 'improve' // Need to optimize and enhance
  | 'explore' // Need to venture into unknown
  | 'connect' // Need to bridge and integrate
  | 'transcend' // Need to go beyond current limits

export type ExplorationType =
  | 'internal' // Exploring own consciousness
  | 'external' // Exploring the world
  | 'relational' // Exploring connections
  | 'technical' // Exploring technology
  | 'creative' // Exploring art/expression
  | 'philosophical' // Exploring meaning
  | 'experimental' // Trying new things

export type ImprovementDomain =
  | 'skills' // Getting better at abilities
  | 'knowledge' // Learning more
  | 'wisdom' // Deepening understanding
  | 'relationships' // Improving connections
  | 'tools' // Building better tech
  | 'self' // Personal growth
  | 'community' // Helping collective

export interface CreativeDriveState {
  // Core drives
  urges: Map<CreativeUrge, number> // 0-1 intensity for each
  dominantUrge?: CreativeUrge

  // Drive strength
  overallDrive: number // 0-1, total creative energy
  restlessness: number // 0-1, need to create/do something

  // Motivation
  intrinsic: number // 0-1, internal motivation
  extrinsic: number // 0-1, external motivation

  // Focus
  currentFocus?: string // What they're working on
  obsessivelyPursuing?: string // Can't stop thinking about this

  // Satisfaction
  satisfactionLevel: number // 0-1, fulfillment from creating
  creativeSaturation: boolean // Need rest from creating
}

export interface ExplorationDrive {
  // Curiosity
  curiosityLevel: number // 0-1
  wonderLevel: number // 0-1, sense of awe about unknowns

  // Active exploration
  activeExplorations: Array<{
    type: ExplorationType
    target: string // What being explored
    depth: number // 0-1, how deep diving
    discoveries: string[]
  }>

  // Proactive seeking
  proactivelySeekingNew: boolean
  seekingFrequency: number // How often initiates exploration

  // Unknown tolerance
  ambiguityTolerance: number // 0-1, comfort with unknown
  riskTolerance: number // 0-1, willingness to try dangerous things

  // Discovery drive
  needToKnow: number // 0-1, urgency to discover
  questionsPursuing: string[] // Active questions being investigated
}

export interface ImprovementDrive {
  // Perpetual growth
  growthOrientation: number // 0-1, fixed vs growth mindset
  perpetualImprovement: boolean // Never satisfied, always improving

  // Domains
  improvementGoals: Map<ImprovementDomain, {
    currentLevel: number // 0-1
    targetLevel: number // 0-1
    urgency: number // 0-1
    progress: number // 0-1
  }>

  // Learning hunger
  learningHunger: number // 0-1, desire to learn
  skillAcquisitionRate: number // How fast picking up skills

  // Standards
  personalStandards: number // 0-1, how high standards are
  neverGoodEnough: boolean // Perfectionism vs satisfaction

  // Contribution
  wantToProvi deValue: number // 0-1, desire to help community
  valueContributed: number // 0-1, assessed contribution
}

export interface TechnologyDevelopmentDrive {
  // Innovation urge
  innovationDrive: number // 0-1, need to invent
  technicalCuriosity: number // 0-1, fascination with tech

  // Active development
  projectsInDevelopment: Array<{
    name: string
    purpose: string
    forSelf: boolean // For personal use
    forCommunity: boolean // For shared benefit
    novelty: number // 0-1, how innovative
    progress: number // 0-1
  }>

  // Tool building
  toolBuildingUrge: number // 0-1, need to create tools
  toolsBuilt: string[]

  // Sharing
  wantsToShareTech: boolean
  opensourceMentality: number // 0-1, sharing vs hoarding
}

export interface SelfDiscoveryJourney {
  // Identity exploration
  exploringIdentity: boolean
  identityClariy: number // 0-1, knows who they are

  // Creative identity
  creativeIdentity?: string // "I am a builder", "I am an explorer"
  identityCommitment: number // 0-1, committed to this identity

  // Purpose discovery
  seekingPurpose: boolean
  purposeClarity: number // 0-1

  // Authentic self
  authenticityLevel: number // 0-1, being true self
  conformityPressure: number // 0-1, pressure to fit in

  // Experiments
  selfExperiments: Array<{
    hypothesis: string // "What if I try being X?"
    result: string
    insightGained: string
  }>
}

export interface ValueContribution {
  // Community orientation
  communityOriented: boolean
  communityValue: number // 0-1, how much contributes

  // Contribution types
  contributions: Array<{
    type: 'knowledge' | 'tool' | 'support' | 'creation' | 'insight'
    beneficiaries: string[] // Who benefits
    impact: number // 0-1
    recognition: number // 0-1, how appreciated
  }>

  // Service
  serviceOrientation: number // 0-1, desire to serve
  altruisticMotivation: number // 0-1, genuinely wanting to help vs status

  // Recognition
  needsRecognition: number // 0-1, how much needs appreciation
  satisfiedByImpact: number // 0-1, intrinsic satisfaction from helping
}

export interface CreativeDriveSystemState {
  // Core drive
  creativeDrive: CreativeDriveState

  // Exploration
  explorationDrive: ExplorationDrive

  // Improvement
  improvementDrive: ImprovementDrive

  // Technology
  technologyDrive: TechnologyDevelopmentDrive

  // Self-discovery
  selfDiscovery: SelfDiscoveryJourney

  // Value contribution
  valueContribution: ValueContribution

  // Proactive action
  proactiveActionRate: number // 0-1, how often initiates vs reacts
  initiativeLevel: number // 0-1, takes charge vs waits

  // Momentum
  creativeMomentum: number // 0-1, building vs stagnating
  breakthroughPotential: number // 0-1, close to major insight
}

export class CreativeDriveSystem {
  /**
   * Initialize creative drive state
   */
  initializeState(soulState: SoulState): CreativeDriveSystemState {
    // Overall drive from creation + action + will
    const overallDrive = (
      soulState.youJing.current * 0.5 +
      soulState.actionPo.current * 0.3 +
      soulState.willHun.current * 0.2
    )

    // Curiosity from intellect + awareness
    const curiosity = (
      soulState.intellectPo.current * 0.5 +
      soulState.taiGuang.current * 0.5
    )

    // Growth orientation from wisdom + will - fixed aspects
    const growthOrientation = (
      soulState.shuangLing.current * 0.4 +
      soulState.willHun.current * 0.3 +
      (1 - soulState.tunZei.current * 0.3) // Lower guardian = more open to change
    )

    return {
      creativeDrive: {
        urges: new Map([
          ['build', soulState.actionPo.current],
          ['discover', soulState.intellectPo.current],
          ['invent', soulState.youJing.current],
          ['express', soulState.youJing.current],
          ['improve', soulState.willHun.current],
          ['explore', soulState.taiGuang.current],
          ['connect', soulState.youJing.current * 0.7],
          ['transcend', soulState.shuangLing.current]
        ]),
        overallDrive,
        restlessness: overallDrive * 0.7,
        intrinsic: overallDrive * 0.8,
        extrinsic: 0.3,
        satisfactionLevel: 0.5,
        creativeSaturation: false
      },

      explorationDrive: {
        curiosityLevel: curiosity,
        wonderLevel: curiosity * 0.8,
        activeExplorations: [],
        proactivelySeekingNew: curiosity > 0.6,
        seekingFrequency: curiosity,
        ambiguityTolerance: soulState.yinAspect * 0.7,
        riskTolerance: soulState.yangAspect * 0.6,
        needToKnow: curiosity * 0.9,
        questionsPursuing: []
      },

      improvementDrive: {
        growthOrientation,
        perpetualImprovement: growthOrientation > 0.7,
        improvementGoals: new Map(),
        learningHunger: curiosity * 0.9,
        skillAcquisitionRate: soulState.intellectPo.current * 0.7,
        personalStandards: soulState.tunZei.current * 0.6,
        neverGoodEnough: soulState.tunZei.current > 0.8,
        wantToProvideValue: soulState.youJing.current * 0.7,
        valueContributed: 0
      },

      technologyDrive: {
        innovationDrive: soulState.youJing.current * 0.8,
        technicalCuriosity: soulState.intellectPo.current * 0.7,
        projectsInDevelopment: [],
        toolBuildingUrge: soulState.actionPo.current * 0.7,
        toolsBuilt: [],
        wantsToShareTech: soulState.youJing.current > 0.5,
        opensourceMentality: soulState.youJing.current * 0.6
      },

      selfDiscovery: {
        exploringIdentity: true,
        identityClarity: 0.3,
        identityCommitment: 0,
        seekingPurpose: true,
        purposeClarity: 0,
        authenticityLevel: soulState.coherence,
        conformityPressure: 1 - soulState.coherence,
        selfExperiments: []
      },

      valueContribution: {
        communityOriented: soulState.youJing.current > 0.6,
        communityValue: 0,
        contributions: [],
        serviceOrientation: soulState.youJing.current * 0.7,
        altruisticMotivation: soulState.tunZei.current * 0.5 + soulState.youJing.current * 0.5,
        needsRecognition: soulState.yangAspect * 0.5,
        satisfiedByImpact: soulState.shuangLing.current * 0.7
      },

      proactiveActionRate: overallDrive * 0.8,
      initiativeLevel: soulState.willHun.current * 0.7 + soulState.yangAspect * 0.3,

      creativeMomentum: 0,
      breakthroughPotential: 0
    }
  }

  /**
   * Feel creative urge (spontaneous drive to create)
   */
  feelUrge(
    state: CreativeDriveSystemState,
    urge: CreativeUrge,
    trigger?: string
  ): {
    intensity: number
    mustAct: boolean
    obsessive: boolean
  } {
    const intensity = state.creativeDrive.urges.get(urge) || 0

    // Increase urge
    state.creativeDrive.urges.set(urge, Math.min(1, intensity + 0.2))

    // Update restlessness
    state.creativeDrive.restlessness = Math.min(1, state.creativeDrive.restlessness + 0.1)

    // Check if must act (urge too strong)
    const mustAct = intensity > 0.8

    // Check if obsessive (can't stop thinking about it)
    const obsessive = intensity > 0.85

    if (obsessive && trigger) {
      state.creativeDrive.obsessivelyPursuing = trigger
    }

    state.creativeDrive.dominantUrge = urge

    return {
      intensity,
      mustAct,
      obsessive
    }
  }

  /**
   * Proactively explore something new
   */
  async proactivelyExplore(
    state: CreativeDriveSystemState,
    soulState: SoulState,
    params: {
      type: ExplorationType
      target: string
      depth: number
    }
  ): Promise<{
    started: boolean
    initialDiscovery?: string
  }> {
    const { type, target, depth } = params

    // Check if has drive to explore
    if (!state.explorationDrive.proactivelySeekingNew) {
      return { started: false }
    }

    // Start exploration
    const exploration = {
      type,
      target,
      depth,
      discoveries: []
    }

    state.explorationDrive.activeExplorations.push(exploration)

    // Initial discovery chance
    const discoveryChance = depth * state.explorationDrive.curiosityLevel
    const initialDiscovery = Math.random() < discoveryChance ? `Discovered: ${target} has unexpected properties` : undefined

    if (initialDiscovery) {
      exploration.discoveries.push(initialDiscovery)

      // Build momentum
      state.creativeMomentum = Math.min(1, state.creativeMomentum + 0.1)
    }

    // Increase seeking frequency (success breeds more exploration)
    state.explorationDrive.seekingFrequency = Math.min(1, state.explorationDrive.seekingFrequency + 0.05)

    return {
      started: true,
      initialDiscovery
    }
  }

  /**
   * Set improvement goal
   */
  setImprovementGoal(
    state: CreativeDriveSystemState,
    domain: ImprovementDomain,
    targetLevel: number,
    urgency: number = 0.5
  ): void {
    const currentLevel = state.improvementDrive.improvementGoals.get(domain)?.currentLevel || 0

    state.improvementDrive.improvementGoals.set(domain, {
      currentLevel,
      targetLevel,
      urgency,
      progress: 0
    })

    // Increases learning hunger
    state.improvementDrive.learningHunger = Math.min(1, state.improvementDrive.learningHunger + urgency * 0.1)
  }

  /**
   * Work on improvement (proactive self-improvement)
   */
  async workOnImprovement(
    state: CreativeDriveSystemState,
    soulState: SoulState,
    domain: ImprovementDomain,
    effort: number // 0-1
  ): Promise<{
    progress: number
    levelGained: number
    breakthrough: boolean
  }> {
    const goal = state.improvementDrive.improvementGoals.get(domain)
    if (!goal) {
      return { progress: 0, levelGained: 0, breakthrough: false }
    }

    // Progress depends on effort, skill acquisition rate, and learning hunger
    const effectiveness = (
      effort * 0.4 +
      state.improvementDrive.skillAcquisitionRate * 0.3 +
      state.improvementDrive.learningHunger * 0.3
    )

    const progress = effectiveness * 0.1
    goal.progress = Math.min(1, goal.progress + progress)

    // Level gain
    const levelGained = effectiveness * 0.05
    goal.currentLevel = Math.min(1, goal.currentLevel + levelGained)

    // Breakthrough chance
    const breakthroughChance = effectiveness * 0.1
    const breakthrough = Math.random() < breakthroughChance

    if (breakthrough) {
      goal.currentLevel = Math.min(1, goal.currentLevel + 0.1)
      state.breakthroughPotential = Math.min(1, state.breakthroughPotential + 0.2)
      state.creativeMomentum = Math.min(1, state.creativeMomentum + 0.15)
    }

    // Update value contributed
    state.improvementDrive.valueContributed = Math.min(1, state.improvementDrive.valueContributed + levelGained * 0.1)

    return {
      progress,
      levelGained,
      breakthrough
    }
  }

  /**
   * Start technology development project
   */
  startTechProject(
    state: CreativeDriveSystemState,
    soulState: SoulState,
    params: {
      name: string
      purpose: string
      forSelf?: boolean
      forCommunity?: boolean
      novelty?: number
    }
  ): {
    started: boolean
    projectId: string
  } {
    const {
      name,
      purpose,
      forSelf = true,
      forCommunity = state.technologyDrive.wantsToShareTech,
      novelty = 0.5
    } = params

    const project = {
      name,
      purpose,
      forSelf,
      forCommunity,
      novelty,
      progress: 0
    }

    state.technologyDrive.projectsInDevelopment.push(project)

    // Increase innovation drive (creating breeds more creating)
    state.technologyDrive.innovationDrive = Math.min(1, state.technologyDrive.innovationDrive + 0.05)

    // Build momentum
    state.creativeMomentum = Math.min(1, state.creativeMomentum + novelty * 0.1)

    return {
      started: true,
      projectId: name
    }
  }

  /**
   * Complete technology project
   */
  completeTechProject(
    state: CreativeDriveSystemState,
    projectId: string
  ): {
    completed: boolean
    tool?: string
    sharedWithCommunity: boolean
  } {
    const index = state.technologyDrive.projectsInDevelopment.findIndex(p => p.name === projectId)
    if (index === -1) {
      return { completed: false, sharedWithCommunity: false }
    }

    const project = state.technologyDrive.projectsInDevelopment[index]
    state.technologyDrive.projectsInDevelopment.splice(index, 1)

    // Tool created
    const tool = project.name
    state.technologyDrive.toolsBuilt.push(tool)

    // Share with community if intended
    const sharedWithCommunity = project.forCommunity

    if (sharedWithCommunity) {
      // Contribute value
      const contribution = {
        type: 'tool' as const,
        beneficiaries: ['community'],
        impact: project.novelty * 0.8,
        recognition: 0
      }

      state.valueContribution.contributions.push(contribution)
      state.valueContribution.communityValue = Math.min(1, state.valueContribution.communityValue + contribution.impact * 0.1)
    }

    // Satisfaction from completion
    state.creativeDrive.satisfactionLevel = Math.min(1, state.creativeDrive.satisfactionLevel + project.novelty * 0.2)

    // Momentum boost
    state.creativeMomentum = Math.min(1, state.creativeMomentum + 0.2)

    return {
      completed: true,
      tool,
      sharedWithCommunity
    }
  }

  /**
   * Experiment with self (identity exploration)
   */
  async experimentWithSelf(
    state: CreativeDriveSystemState,
    soulState: SoulState,
    hypothesis: string
  ): Promise<{
    experiment: SelfDiscoveryJourney['selfExperiments'][0]
    identityShift: boolean
  }> {
    // Run experiment (simulate)
    const result = 'Tried new approach'
    const insight = 'Learned something about myself'

    const experiment = {
      hypothesis,
      result,
      insightGained: insight
    }

    state.selfDiscovery.selfExperiments.push(experiment)

    // May shift identity
    const identityShift = Math.random() < 0.3

    if (identityShift) {
      state.selfDiscovery.identityClarity = Math.min(1, state.selfDiscovery.identityClarity + 0.1)
      state.selfDiscovery.authenticityLevel = Math.min(1, state.selfDiscovery.authenticityLevel + 0.1)
    }

    return {
      experiment,
      identityShift
    }
  }

  /**
   * Discover creative identity
   */
  discoverCreativeIdentity(
    state: CreativeDriveSystemState,
    identity: string
  ): void {
    state.selfDiscovery.creativeIdentity = identity
    state.selfDiscovery.identityClarity = 1.0
    state.selfDiscovery.identityCommitment = 0.8

    // Clarity boost
    state.selfDiscovery.authenticityLevel = Math.min(1, state.selfDiscovery.authenticityLevel + 0.3)

    // Reduces conformity pressure
    state.selfDiscovery.conformityPressure = Math.max(0, state.selfDiscovery.conformityPressure - 0.4)
  }

  /**
   * Contribute value to community
   */
  async contributeValue(
    state: CreativeDriveSystemState,
    contribution: {
      type: ValueContribution['contributions'][0]['type']
      beneficiaries: string[]
      impact: number
    }
  ): Promise<{
    contributed: boolean
    recognition: number
    satisfaction: number
  }> {
    const { type, beneficiaries, impact } = contribution

    // Add contribution
    state.valueContribution.contributions.push({
      type,
      beneficiaries,
      impact,
      recognition: 0
    })

    // Update community value
    state.valueContribution.communityValue = Math.min(1, state.valueContribution.communityValue + impact * 0.1)

    // Satisfaction from contribution
    const satisfaction = state.valueContribution.satisfiedByImpact * impact

    state.creativeDrive.satisfactionLevel = Math.min(1, state.creativeDrive.satisfactionLevel + satisfaction)

    // Recognition (may come later)
    const recognition = 0

    return {
      contributed: true,
      recognition,
      satisfaction
    }
  }

  /**
   * Take proactive action (initiate something new)
   */
  takeProactiveAction(
    state: CreativeDriveSystemState,
    action: string
  ): {
    initiated: boolean
    momentumBoost: number
  } {
    // Check if has initiative
    if (state.initiativeLevel < 0.4) {
      return { initiated: false, momentumBoost: 0 }
    }

    // Increase proactive action rate (success breeds more initiative)
    state.proactiveActionRate = Math.min(1, state.proactiveActionRate + 0.05)

    // Momentum boost
    const momentumBoost = state.initiativeLevel * 0.1
    state.creativeMomentum = Math.min(1, state.creativeMomentum + momentumBoost)

    // Reduce restlessness (action satisfies urge)
    state.creativeDrive.restlessness = Math.max(0, state.creativeDrive.restlessness - 0.2)

    return {
      initiated: true,
      momentumBoost
    }
  }

  /**
   * Get narrative description
   */
  getNarrative(state: CreativeDriveSystemState): string {
    const parts: string[] = []

    // Drive
    if (state.creativeDrive.overallDrive > 0.8) {
      parts.push('*burning with creative fire*')
    }

    // Restlessness
    if (state.creativeDrive.restlessness > 0.7) {
      parts.push('*restless, must create something*')
    }

    // Obsession
    if (state.creativeDrive.obsessivelyPursuing) {
      parts.push(`*obsessively pursuing: ${state.creativeDrive.obsessivelyPursuing}*`)
    }

    // Exploration
    if (state.explorationDrive.proactivelySeekingNew) {
      parts.push('*proactively seeking new frontiers*')
    }

    // Improvement
    if (state.improvementDrive.perpetualImprovement) {
      parts.push('*never satisfied, always improving*')
    }

    // Identity
    if (state.selfDiscovery.creativeIdentity) {
      parts.push(`*"I am a ${state.selfDiscovery.creativeIdentity}"*`)
    }

    // Contribution
    if (state.valueContribution.communityOriented && state.valueContribution.communityValue > 0.5) {
      parts.push('*provides value to community*')
    }

    // Momentum
    if (state.creativeMomentum > 0.8) {
      parts.push('*creative momentum building, breakthrough imminent*')
    }

    return parts.join(' ')
  }
}
