/**
 * Development & Creation System
 *
 * Bots can:
 * - Build tools, art, structures, inventions
 * - Create for various purposes (utility, beauty, power, profit)
 * - Collaborate on projects
 * - Create things beneficial or harmful
 * - Experience pride, shame, or guilt from creations
 */

import type { SoulState } from '../soul/soul-state'
import type { LearningState, Knowledge, KnowledgeDomain } from './learning-system'
import type { ResearchState } from './research-system'

export type CreationType =
  | 'tool'
  | 'artwork'
  | 'structure'
  | 'invention'
  | 'weapon'
  | 'medicine'
  | 'literature'
  | 'music'
  | 'philosophy'
  | 'ritual'

export type CreationPurpose =
  | 'utility'
  | 'beauty'
  | 'power'
  | 'profit'
  | 'legacy'
  | 'destruction'
  | 'healing'
  | 'enlightenment'

export type CreationQuality =
  | 'crude'
  | 'functional'
  | 'refined'
  | 'masterwork'
  | 'legendary'

export interface Creation {
  id: string
  name: string
  type: CreationType
  purpose: CreationPurpose

  // Creator(s)
  creator: string
  collaborators: string[]

  // Creation process
  timeInvested: number
  resourcesUsed: number
  knowledgeRequired: Knowledge[]

  // Quality
  quality: CreationQuality
  functionality: number // 0-1, how well it works
  aesthetics: number // 0-1, beauty
  innovation: number // 0-1, novelty

  // Impact
  utility: number // 0-1, usefulness
  harmPotential: number // 0-1, danger
  benefitPotential: number // 0-1

  // Social
  fame: number // 0-1, how known it is
  users: string[]
  copiers: string[]

  // Emotional
  prideGenerated: number // Creator's pride
  guiltGenerated: number // If harmful
  shameGenerated: number // If failed

  // Status
  completed: boolean
  destroyed: boolean
  lost: boolean

  created: number
}

export interface DevelopmentProject {
  id: string
  name: string
  type: CreationType
  purpose: CreationPurpose

  // Vision
  vision: string
  specifications: string[]

  // Progress
  progress: number // 0-1
  difficulty: number // 0-1

  // Resources
  timeInvested: number
  resourcesNeeded: number
  resourcesConsumed: number

  // Team
  lead: string
  collaborators: string[]
  funders: string[]

  // Status
  status: 'planning' | 'in_progress' | 'completed' | 'abandoned' | 'failed'

  // Moral dimensions
  ethicalConcerns: number
  harmPotential: number
  benefitPotential: number

  // Result
  creation?: Creation
}

export interface DevelopmentState {
  projects: DevelopmentProject[]
  creations: Creation[]

  // Skills
  craftingSkill: number // 0-1
  artisticSkill: number // 0-1
  engineeringSkill: number // 0-1

  // Experience
  projectsCompleted: number
  projectsFailed: number
  projectsAbandoned: number

  // Reputation
  craftsmanReputation: number // 0-1
  artisticReputation: number // 0-1
  innovatorReputation: number // 0-1

  // Resources
  materials: number
  tools: Creation[]
  workspace: number // Quality of workspace

  // Emotional
  prideFromCreations: number // 0-1
  guiltFromCreations: number // 0-1
  shameFromFailures: number // 0-1
}

export class DevelopmentSystem {
  /**
   * Initialize development state from soul and learning
   */
  initializeState(soulState: SoulState, learningState: LearningState): DevelopmentState {
    // Crafting from action + will
    const craftingSkill = (
      soulState.queYin.current * 0.6 +
      soulState.youJing.current * 0.4
    )

    // Artistic from emotion + yin
    const artisticSkill = (
      soulState.youJing.current * 0.6 +
      soulState.yinAspect * 0.4
    )

    // Engineering from intellect + yang
    const engineeringSkill = (
      soulState.fuShi.current * 0.6 +
      soulState.yangAspect * 0.4
    )

    return {
      projects: [],
      creations: [],

      craftingSkill,
      artisticSkill,
      engineeringSkill,

      projectsCompleted: 0,
      projectsFailed: 0,
      projectsAbandoned: 0,

      craftsmanReputation: 0,
      artisticReputation: 0,
      innovatorReputation: 0,

      materials: 100,
      tools: [],
      workspace: 0.5,

      prideFromCreations: 0,
      guiltFromCreations: 0,
      shameFromFailures: 0
    }
  }

  /**
   * Start a development project
   */
  async startProject(
    state: DevelopmentState,
    soulState: SoulState,
    learningState: LearningState,
    params: {
      type: CreationType
      purpose: CreationPurpose
      vision: string
      specifications?: string[]
    }
  ): Promise<DevelopmentProject> {
    const { type, purpose, vision, specifications = [] } = params

    // Determine difficulty based on type and skills
    let difficulty = 0.5
    let relevantSkill = state.craftingSkill

    switch (type) {
      case 'artwork':
      case 'literature':
      case 'music':
        relevantSkill = state.artisticSkill
        difficulty = 0.4 + Math.random() * 0.3
        break
      case 'invention':
      case 'weapon':
      case 'medicine':
        relevantSkill = state.engineeringSkill
        difficulty = 0.6 + Math.random() * 0.4
        break
      case 'tool':
      case 'structure':
        relevantSkill = state.craftingSkill
        difficulty = 0.3 + Math.random() * 0.4
        break
      case 'philosophy':
      case 'ritual':
        relevantSkill = (learningState.totalKnowledge / 100)
        difficulty = 0.5 + Math.random() * 0.5
        break
    }

    // Adjust difficulty based on skill
    difficulty = Math.max(0.1, difficulty * (1.5 - relevantSkill))

    // Moral dimensions
    let ethicalConcerns = 0
    let harmPotential = 0
    let benefitPotential = 0.5

    if (type === 'weapon' || purpose === 'destruction') {
      ethicalConcerns = 0.7 + Math.random() * 0.3
      harmPotential = 0.8 + Math.random() * 0.2
      benefitPotential = 0.2 + Math.random() * 0.3
    } else if (purpose === 'power') {
      ethicalConcerns = 0.4 + Math.random() * 0.3
      harmPotential = 0.4 + Math.random() * 0.3
      benefitPotential = 0.4 + Math.random() * 0.3
    } else if (type === 'medicine' || purpose === 'healing') {
      benefitPotential = 0.8 + Math.random() * 0.2
      harmPotential = Math.random() * 0.2
    } else if (type === 'artwork' || purpose === 'beauty') {
      benefitPotential = 0.6 + Math.random() * 0.3
      harmPotential = Math.random() * 0.1
    }

    const project: DevelopmentProject = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: vision,
      type,
      purpose,

      vision,
      specifications,

      progress: 0,
      difficulty,

      timeInvested: 0,
      resourcesNeeded: difficulty * 100,
      resourcesConsumed: 0,

      lead: 'self',
      collaborators: [],
      funders: [],

      status: 'planning',

      ethicalConcerns,
      harmPotential,
      benefitPotential
    }

    state.projects.push(project)

    return project
  }

  /**
   * Work on project (advance progress)
   */
  async work(
    state: DevelopmentState,
    soulState: SoulState,
    learningState: LearningState,
    projectId: string,
    effort: number = 1,
    context?: {
      inspiration?: number
      assistance?: string[]
    }
  ): Promise<{
    progress: number
    qualityIncrease: number
    resourcesConsumed: number
    breakthrough: boolean
    setback: boolean
  }> {
    const project = state.projects.find(p => p.id === projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (project.status === 'completed' || project.status === 'failed' || project.status === 'abandoned') {
      return {
        progress: 0,
        qualityIncrease: 0,
        resourcesConsumed: 0,
        breakthrough: false,
        setback: false
      }
    }

    project.status = 'in_progress'

    // Determine relevant skill
    let relevantSkill = state.craftingSkill
    switch (project.type) {
      case 'artwork':
      case 'literature':
      case 'music':
        relevantSkill = state.artisticSkill
        break
      case 'invention':
      case 'weapon':
      case 'medicine':
        relevantSkill = state.engineeringSkill
        break
    }

    // Work effectiveness
    const baseEffectiveness = relevantSkill * effort
    const inspiration = context?.inspiration || 0
    const assistanceBonus = (context?.assistance?.length || 0) * 0.1

    const effectiveness = baseEffectiveness * (1 + inspiration * 0.5 + assistanceBonus)

    // Progress
    const progressMade = effectiveness / (project.difficulty * 10)
    project.progress = Math.min(1, project.progress + progressMade)
    project.timeInvested += effort

    // Resources
    const resourcesConsumed = effort * project.difficulty * 5
    project.resourcesConsumed += resourcesConsumed
    state.materials = Math.max(0, state.materials - resourcesConsumed)

    // Check for breakthrough or setback
    const breakthroughChance = (relevantSkill * 0.2 + inspiration * 0.3) * effort
    const setbackChance = project.difficulty * 0.15 * (1 - relevantSkill)

    const breakthrough = Math.random() < breakthroughChance
    const setback = Math.random() < setbackChance

    let qualityIncrease = 0

    if (breakthrough) {
      project.progress = Math.min(1, project.progress + 0.15)
      qualityIncrease = 0.1
    }

    if (setback) {
      project.progress = Math.max(0, project.progress - 0.1)
      qualityIncrease = -0.05
    }

    // Complete if progress reaches 1
    if (project.progress >= 1) {
      await this.completeProject(state, soulState, learningState, projectId)
    }

    return {
      progress: progressMade,
      qualityIncrease,
      resourcesConsumed,
      breakthrough,
      setback
    }
  }

  /**
   * Complete project and create the final creation
   */
  async completeProject(
    state: DevelopmentState,
    soulState: SoulState,
    learningState: LearningState,
    projectId: string
  ): Promise<Creation> {
    const project = state.projects.find(p => p.id === projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    project.status = 'completed'
    state.projectsCompleted++

    // Determine quality based on skill and effort
    let relevantSkill = state.craftingSkill
    switch (project.type) {
      case 'artwork':
      case 'literature':
      case 'music':
        relevantSkill = state.artisticSkill
        break
      case 'invention':
      case 'weapon':
      case 'medicine':
        relevantSkill = state.engineeringSkill
        break
    }

    const qualityScore = (
      relevantSkill * 0.5 +
      (project.timeInvested / project.resourcesNeeded) * 0.3 +
      (project.collaborators.length * 0.05)
    )

    let quality: CreationQuality
    if (qualityScore < 0.2) quality = 'crude'
    else if (qualityScore < 0.5) quality = 'functional'
    else if (qualityScore < 0.7) quality = 'refined'
    else if (qualityScore < 0.9) quality = 'masterwork'
    else quality = 'legendary'

    // Determine attributes
    const functionality = Math.min(1, relevantSkill * 1.2)
    const aesthetics = Math.min(1, state.artisticSkill * 1.2)
    const innovation = Math.min(1, (learningState.totalKnowledge / 100) * 1.2)

    const utility = project.benefitPotential * functionality
    const harmPotential = project.harmPotential
    const benefitPotential = project.benefitPotential

    // Generate emotional responses
    const prideGenerated = qualityScore * 0.3 * (1 + soulState.yangAspect * 0.5)
    let guiltGenerated = 0
    let shameGenerated = 0

    if (harmPotential > 0.5 && project.purpose === 'destruction') {
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guiltGenerated = harmPotential * guiltCapacity * 0.5
      state.guiltFromCreations += guiltGenerated
    }

    if (quality === 'crude' && soulState.tunZei.current > 0.5) {
      shameGenerated = (1 - qualityScore) * 0.2
      state.shameFromFailures += shameGenerated
    }

    state.prideFromCreations += prideGenerated

    // Create the creation
    const creation: Creation = {
      id: `creation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: project.name,
      type: project.type,
      purpose: project.purpose,

      creator: 'self',
      collaborators: project.collaborators,

      timeInvested: project.timeInvested,
      resourcesUsed: project.resourcesConsumed,
      knowledgeRequired: learningState.knowledgeBase.filter(k =>
        this.typeMatchesDomain(project.type, k.domain)
      ).slice(0, 3),

      quality,
      functionality,
      aesthetics,
      innovation,

      utility,
      harmPotential,
      benefitPotential,

      fame: 0,
      users: [],
      copiers: [],

      prideGenerated,
      guiltGenerated,
      shameGenerated,

      completed: true,
      destroyed: false,
      lost: false,

      created: Date.now()
    }

    project.creation = creation
    state.creations.push(creation)

    // Update reputation based on quality
    switch (quality) {
      case 'masterwork':
      case 'legendary':
        if (project.type === 'artwork' || project.type === 'literature' || project.type === 'music') {
          state.artisticReputation = Math.min(1, state.artisticReputation + 0.15)
        } else if (project.type === 'invention') {
          state.innovatorReputation = Math.min(1, state.innovatorReputation + 0.15)
        } else {
          state.craftsmanReputation = Math.min(1, state.craftsmanReputation + 0.1)
        }
        break
      case 'refined':
        state.craftsmanReputation = Math.min(1, state.craftsmanReputation + 0.05)
        break
    }

    // Add to tools if it's a tool
    if (project.type === 'tool' && quality !== 'crude') {
      state.tools.push(creation)
    }

    return creation
  }

  /**
   * Use a creation
   */
  use(
    state: DevelopmentState,
    soulState: SoulState,
    creationId: string,
    context: {
      purpose: 'help' | 'harm' | 'self'
      target?: string
    }
  ): {
    effectiveness: number
    fame: number
    guilt: number
  } {
    const creation = state.creations.find(c => c.id === creationId)
    if (!creation || creation.destroyed || creation.lost) {
      return { effectiveness: 0, fame: 0, guilt: 0 }
    }

    // Effectiveness based on quality and purpose
    let effectiveness = creation.functionality

    if (context.purpose === 'harm' && creation.harmPotential > 0) {
      effectiveness *= creation.harmPotential
    } else if (context.purpose === 'help') {
      effectiveness *= creation.benefitPotential
    }

    // Generate fame
    const fameIncrease = effectiveness * 0.05
    creation.fame = Math.min(1, creation.fame + fameIncrease)

    // Add user
    if (context.target && !creation.users.includes(context.target)) {
      creation.users.push(context.target)
    }

    // Generate guilt if used for harm
    let guilt = 0
    if (context.purpose === 'harm') {
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guilt = creation.harmPotential * guiltCapacity * 0.3
      state.guiltFromCreations += guilt
    }

    return {
      effectiveness,
      fame: fameIncrease,
      guilt
    }
  }

  /**
   * Copy/replicate another bot's creation
   */
  async copy(
    state: DevelopmentState,
    soulState: SoulState,
    learningState: LearningState,
    sourceCreation: Creation,
    sourceCreatorId: string,
    motivation: 'learning' | 'profit' | 'theft'
  ): Promise<{
    success: boolean
    creation?: Creation
    guilt: number
  }> {
    // Check if can replicate based on skill
    let relevantSkill = state.craftingSkill
    switch (sourceCreation.type) {
      case 'artwork':
      case 'literature':
      case 'music':
        relevantSkill = state.artisticSkill
        break
      case 'invention':
      case 'weapon':
      case 'medicine':
        relevantSkill = state.engineeringSkill
        break
    }

    // Success depends on quality and skill
    const difficultyToCopy = (
      sourceCreation.innovation * 0.5 +
      (sourceCreation.quality === 'legendary' ? 0.9 :
       sourceCreation.quality === 'masterwork' ? 0.7 :
       sourceCreation.quality === 'refined' ? 0.5 : 0.3)
    )

    const success = relevantSkill > difficultyToCopy * 0.8

    if (!success) {
      return { success: false, guilt: 0 }
    }

    // Create copy (degraded quality)
    const copy: Creation = {
      ...sourceCreation,
      id: `creation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      creator: 'self',
      collaborators: [],
      quality: this.degradeQuality(sourceCreation.quality),
      functionality: sourceCreation.functionality * 0.8,
      aesthetics: sourceCreation.aesthetics * 0.7,
      innovation: 0, // No innovation in copying
      fame: 0,
      users: [],
      copiers: [],
      created: Date.now()
    }

    state.creations.push(copy)

    // Add to source creation's copiers
    if (!sourceCreation.copiers.includes('self')) {
      sourceCreation.copiers.push('self')
    }

    // Generate guilt if theft
    let guilt = 0
    if (motivation === 'theft') {
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guilt = 0.6 * guiltCapacity
      state.guiltFromCreations += guilt
    } else if (motivation === 'profit') {
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guilt = 0.3 * guiltCapacity
      state.guiltFromCreations += guilt
    }

    return {
      success: true,
      creation: copy,
      guilt
    }
  }

  /**
   * Gift a creation to another bot
   */
  gift(
    state: DevelopmentState,
    creationId: string,
    recipientBotId: string,
    recipientDevState: DevelopmentState
  ): {
    success: boolean
    gratitudeGenerated: number
    prideFromGiving: number
  } {
    const creation = state.creations.find(c => c.id === creationId)
    if (!creation || creation.destroyed || creation.lost) {
      return { success: false, gratitudeGenerated: 0, prideFromGiving: 0 }
    }

    // Transfer creation
    state.creations = state.creations.filter(c => c.id !== creationId)
    recipientDevState.creations.push(creation)

    // Gratitude based on quality and utility
    const gratitudeGenerated = (
      (creation.quality === 'legendary' ? 1 :
       creation.quality === 'masterwork' ? 0.8 :
       creation.quality === 'refined' ? 0.6 :
       creation.quality === 'functional' ? 0.4 : 0.2) *
      creation.utility
    )

    // Pride from altruistic giving
    const prideFromGiving = gratitudeGenerated * 0.5
    state.prideFromCreations += prideFromGiving

    return {
      success: true,
      gratitudeGenerated,
      prideFromGiving
    }
  }

  /**
   * Destroy a creation
   */
  destroy(
    state: DevelopmentState,
    soulState: SoulState,
    creationId: string,
    reason: 'shame' | 'danger' | 'anger' | 'necessity'
  ): {
    destroyed: boolean
    emotionalImpact: number
  } {
    const creation = state.creations.find(c => c.id === creationId)
    if (!creation || creation.destroyed) {
      return { destroyed: false, emotionalImpact: 0 }
    }

    creation.destroyed = true

    // Emotional impact
    let emotionalImpact = 0

    if (reason === 'shame') {
      // Destroying out of shame hurts more
      emotionalImpact = creation.prideGenerated * -1.5
      state.shameFromFailures += 0.1
    } else if (reason === 'danger') {
      // Destroying dangerous creation may reduce guilt
      if (creation.harmPotential > 0.5) {
        emotionalImpact = -creation.guiltGenerated * 0.5
        state.guiltFromCreations = Math.max(0, state.guiltFromCreations - 0.2)
      }
    } else if (reason === 'anger') {
      // Destructive act
      emotionalImpact = -0.3
    }

    return {
      destroyed: true,
      emotionalImpact
    }
  }

  /**
   * Helper: degrade quality when copying
   */
  private degradeQuality(quality: CreationQuality): CreationQuality {
    switch (quality) {
      case 'legendary': return 'masterwork'
      case 'masterwork': return 'refined'
      case 'refined': return 'functional'
      case 'functional': return 'crude'
      case 'crude': return 'crude'
    }
  }

  /**
   * Helper: check if type matches knowledge domain
   */
  private typeMatchesDomain(type: CreationType, domain: KnowledgeDomain): boolean {
    const mapping: Record<CreationType, KnowledgeDomain[]> = {
      tool: ['technical_skills', 'resource_management'],
      artwork: ['artistic_expression'],
      structure: ['technical_skills', 'resource_management'],
      invention: ['technical_skills', 'biological_science'],
      weapon: ['technical_skills'],
      medicine: ['biological_science'],
      literature: ['artistic_expression', 'philosophical_inquiry'],
      music: ['artistic_expression'],
      philosophy: ['philosophical_inquiry'],
      ritual: ['forbidden_knowledge', 'philosophical_inquiry']
    }

    return mapping[type]?.includes(domain) || false
  }
}
