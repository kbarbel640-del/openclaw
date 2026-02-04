/**
 * Research System
 *
 * Bots can:
 * - Conduct original research and investigations
 * - Form and test hypotheses
 * - Discover new knowledge (not just learn existing)
 * - Publish findings
 * - Build on others' research
 * - Form research collaborations
 * - Research can be beneficial, neutral, or dangerous
 */

import type { SoulState } from '../soul/soul-state'
import type { LearningState, Knowledge, KnowledgeDomain, KnowledgeMorality } from './learning-system'

export type ResearchField =
  | 'natural_sciences'
  | 'social_sciences'
  | 'humanities'
  | 'engineering'
  | 'medicine'
  | 'psychology'
  | 'philosophy'
  | 'occult'
  | 'forbidden'

export type ResearchMethod =
  | 'empirical'
  | 'theoretical'
  | 'experimental'
  | 'observational'
  | 'computational'
  | 'historical'
  | 'speculative'
  | 'unethical'

export type ResearchStatus =
  | 'hypothesis'
  | 'in_progress'
  | 'completed'
  | 'published'
  | 'rejected'
  | 'suppressed'

export interface ResearchProject {
  id: string
  name: string
  field: ResearchField
  method: ResearchMethod

  hypothesis: string
  motivation: 'curiosity' | 'altruism' | 'fame' | 'profit' | 'power' | 'obsession'

  // Research progress
  status: ResearchStatus
  progress: number // 0-1
  difficulty: number // 0-1

  // Resources needed
  timeInvested: number
  resourcesNeeded: number
  collaboratorsNeeded: number

  // Moral dimensions
  ethicalConcerns: number // 0-1
  harmPotential: number // 0-1, if misused
  benefitPotential: number // 0-1

  // Results
  findings: Finding[]
  breakthroughs: number
  deadEnds: number

  // Social
  leadResearcher: string
  collaborators: string[]
  funders: string[]

  // Publication
  published: boolean
  citations: number
  impact: number // 0-1
  controversy: number // 0-1

  // Forbidden research
  hidden: boolean
  suppressionAttempts: number
}

export interface Finding {
  id: string
  projectId: string
  description: string
  significance: number // 0-1
  reproducible: boolean

  // Knowledge created
  knowledgeCreated?: Knowledge

  // Moral implications
  morality: KnowledgeMorality
  ethicalConcerns: number

  // Publication
  published: boolean
  publicationDate?: number
  citedBy: string[] // other researchers
}

export interface ResearchCollaboration {
  id: string
  name: string
  researchers: string[]
  leadResearcher: string

  projects: string[]
  field: ResearchField

  trustLevel: number // 0-1
  conflictLevel: number // 0-1

  knowledgeSharing: 'open' | 'restricted' | 'secretive'

  formed: number
  dissolved?: number
}

export interface ResearchState {
  projects: ResearchProject[]
  completedProjects: number

  // Research capacity
  researchSkill: number // 0-1
  creativity: number // 0-1
  rigor: number // 0-1

  // Research focus
  primaryField?: ResearchField
  interests: ResearchField[]

  // Publications
  publicationsCount: number
  citationsReceived: number
  hIndex: number // simplified h-index

  // Collaborations
  collaborations: ResearchCollaboration[]

  // Reputation
  academicReputation: number // 0-1
  controversialReputation: number // 0-1

  // Ethics
  ethicalBoundaries: number // 0-1, willingness to cross ethical lines
  guiltFromResearch: number // 0-1
  forbiddenResearch: number // 0-1

  // Resources
  funding: number
  labEquipment: number
  researchConnections: string[]
}

export class ResearchSystem {
  /**
   * Initialize research state from soul and learning state
   */
  initializeState(soulState: SoulState, learningState: LearningState): ResearchState {
    // Research skill based on wisdom + intellect + curiosity
    const researchSkill = (
      soulState.shuangLing.current * 0.4 +
      soulState.fuShi.current * 0.4 +
      learningState.curiosity * 0.2
    )

    // Creativity from yin + emotion
    const creativity = (
      soulState.yinAspect * 0.6 +
      soulState.youJing.current * 0.4
    )

    // Rigor from yang + will
    const rigor = (
      soulState.yangAspect * 0.6 +
      soulState.youJing.current * 0.4
    )

    // Ethical boundaries from guardian + wisdom - shadow
    const ethicalBoundaries = Math.max(0, Math.min(1,
      soulState.tunZei.current * 0.5 +
      soulState.shuangLing.current * 0.3 -
      soulState.shadowPressure * 0.2
    ))

    return {
      projects: [],
      completedProjects: 0,

      researchSkill,
      creativity,
      rigor,

      interests: [],

      publicationsCount: 0,
      citationsReceived: 0,
      hIndex: 0,

      collaborations: [],

      academicReputation: 0,
      controversialReputation: 0,

      ethicalBoundaries,
      guiltFromResearch: 0,
      forbiddenResearch: 0,

      funding: 0,
      labEquipment: 0,
      researchConnections: []
    }
  }

  /**
   * Start a new research project
   */
  async startResearch(
    state: ResearchState,
    soulState: SoulState,
    learningState: LearningState,
    params: {
      field: ResearchField
      hypothesis: string
      motivation: ResearchProject['motivation']
      method: ResearchMethod
    }
  ): Promise<ResearchProject> {
    const { field, hypothesis, motivation, method } = params

    // Determine difficulty based on field and existing knowledge
    const relevantKnowledge = learningState.knowledgeBase.filter(k =>
      this.fieldMatchesDomain(field, k.domain)
    )
    const knowledgeBase = relevantKnowledge.reduce((sum, k) => sum + k.mastery, 0) / Math.max(1, relevantKnowledge.length)

    const difficulty = Math.max(0.1, 1 - (knowledgeBase * 0.7 + state.researchSkill * 0.3))

    // Ethical concerns
    let ethicalConcerns = 0
    let harmPotential = 0
    let benefitPotential = 0.5

    if (field === 'forbidden' || method === 'unethical') {
      ethicalConcerns = 0.8 + Math.random() * 0.2
      harmPotential = 0.6 + Math.random() * 0.4
      benefitPotential = Math.random() * 0.3 // Low benefit
    } else if (field === 'occult') {
      ethicalConcerns = 0.4 + Math.random() * 0.3
      harmPotential = 0.3 + Math.random() * 0.3
      benefitPotential = 0.3 + Math.random() * 0.4
    } else if (field === 'medicine' || field === 'engineering') {
      benefitPotential = 0.7 + Math.random() * 0.3
      harmPotential = Math.random() * 0.3 // Can be misused
    } else if (field === 'social_sciences') {
      benefitPotential = 0.6 + Math.random() * 0.3
      harmPotential = Math.random() * 0.2 // Social manipulation
    }

    // Should this be hidden?
    const shouldHide = (
      (field === 'forbidden' || method === 'unethical') &&
      (motivation === 'power' || motivation === 'obsession')
    )

    const project: ResearchProject = {
      id: `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Research: ${hypothesis}`,
      field,
      method,

      hypothesis,
      motivation,

      status: 'hypothesis',
      progress: 0,
      difficulty,

      timeInvested: 0,
      resourcesNeeded: difficulty * 100,
      collaboratorsNeeded: difficulty > 0.7 ? Math.floor(difficulty * 3) : 0,

      ethicalConcerns,
      harmPotential,
      benefitPotential,

      findings: [],
      breakthroughs: 0,
      deadEnds: 0,

      leadResearcher: 'self',
      collaborators: [],
      funders: [],

      published: false,
      citations: 0,
      impact: 0,
      controversy: 0,

      hidden: shouldHide,
      suppressionAttempts: 0
    }

    state.projects.push(project)

    // Add to interests if new
    if (!state.interests.includes(field)) {
      state.interests.push(field)
      if (!state.primaryField) {
        state.primaryField = field
      }
    }

    return project
  }

  /**
   * Conduct research (advance a project)
   */
  async conductResearch(
    state: ResearchState,
    soulState: SoulState,
    learningState: LearningState,
    projectId: string,
    effort: number = 1
  ): Promise<{
    progress: number
    finding?: Finding
    breakthrough: boolean
    deadEnd: boolean
    guiltGenerated: number
    resourcesConsumed: number
  }> {
    const project = state.projects.find(p => p.id === projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    if (project.status === 'completed' || project.status === 'rejected' || project.status === 'suppressed') {
      return {
        progress: 0,
        breakthrough: false,
        deadEnd: false,
        guiltGenerated: 0,
        resourcesConsumed: 0
      }
    }

    project.status = 'in_progress'

    // Research effectiveness
    const effectiveness = (
      state.researchSkill * 0.4 +
      state.creativity * 0.3 +
      state.rigor * 0.3
    ) * effort

    // Progress depends on difficulty
    const progressMade = effectiveness / (project.difficulty * 10)
    project.progress = Math.min(1, project.progress + progressMade)
    project.timeInvested += effort

    // Resources consumed
    const resourcesConsumed = effort * project.difficulty * 10

    // Check for breakthrough or dead end
    const breakthroughChance = state.creativity * 0.3 + (1 - project.difficulty) * 0.1
    const deadEndChance = project.difficulty * 0.2 * (1 - state.rigor)

    const breakthrough = Math.random() < breakthroughChance
    const deadEnd = Math.random() < deadEndChance

    if (breakthrough) {
      project.breakthroughs++
      project.progress = Math.min(1, project.progress + 0.2) // Significant boost
    }

    if (deadEnd) {
      project.deadEnds++
      project.progress = Math.max(0, project.progress - 0.1) // Setback
    }

    // Generate finding if progress crosses thresholds
    let finding: Finding | undefined
    const thresholds = [0.25, 0.5, 0.75, 1.0]
    const crossedThreshold = thresholds.find(t =>
      project.progress >= t &&
      !project.findings.some(f => f.significance >= t - 0.1 && f.significance <= t + 0.1)
    )

    if (crossedThreshold || breakthrough) {
      finding = await this.generateFinding(state, soulState, learningState, project, crossedThreshold || project.progress)
      project.findings.push(finding)
    }

    // Complete project if progress reaches 1
    if (project.progress >= 1) {
      project.status = 'completed'
      state.completedProjects++
    }

    // Generate guilt if unethical research
    let guiltGenerated = 0
    if (project.method === 'unethical' || project.field === 'forbidden') {
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guiltGenerated = project.ethicalConcerns * guiltCapacity * effort * 0.1
      state.guiltFromResearch += guiltGenerated

      if (project.field === 'forbidden') {
        state.forbiddenResearch = Math.min(1, state.forbiddenResearch + 0.05)
      }
    }

    return {
      progress: progressMade,
      finding,
      breakthrough,
      deadEnd,
      guiltGenerated,
      resourcesConsumed
    }
  }

  /**
   * Generate a research finding
   */
  private async generateFinding(
    state: ResearchState,
    soulState: SoulState,
    learningState: LearningState,
    project: ResearchProject,
    significance: number
  ): Promise<Finding> {
    // Determine morality of finding
    let morality: KnowledgeMorality
    if (project.field === 'forbidden' || project.method === 'unethical') {
      morality = Math.random() < 0.6 ? 'forbidden' : 'harmful'
    } else if (project.ethicalConcerns > 0.5) {
      morality = Math.random() < 0.5 ? 'harmful' : 'exploitative'
    } else if (project.benefitPotential > 0.7) {
      morality = 'beneficial'
    } else {
      morality = Math.random() < 0.5 ? 'neutral' : 'beneficial'
    }

    // Reproducibility
    const reproducible = state.rigor > 0.6 && Math.random() < state.rigor

    // Create knowledge from finding
    const knowledgeCreated: Knowledge = {
      id: `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      domain: this.fieldToDomain(project.field),
      name: `${project.name} - Finding`,
      description: `Discovery from research: ${project.hypothesis}`,
      depth: significance,
      mastery: significance * 0.5, // Initial mastery
      morality,
      learnedFrom: 'discovery',
      sourceBot: 'self',

      guiltWeight: project.ethicalConcerns,
      temptation: project.harmPotential,

      personalBenefit: 0.7 + Math.random() * 0.3, // Research is personally valuable
      socialBenefit: project.benefitPotential * 2 - 1 // -1 to 1
    }

    // Add to learning state
    learningState.knowledgeBase.push(knowledgeCreated)
    learningState.totalKnowledge += significance

    const finding: Finding = {
      id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: project.id,
      description: `Finding: ${project.hypothesis} - Progress ${Math.round(significance * 100)}%`,
      significance,
      reproducible,

      knowledgeCreated,

      morality,
      ethicalConcerns: project.ethicalConcerns,

      published: false,
      citedBy: []
    }

    return finding
  }

  /**
   * Publish research findings
   */
  async publish(
    state: ResearchState,
    soulState: SoulState,
    projectId: string
  ): Promise<{
    success: boolean
    reason: string
    impact: number
    controversy: number
    suppressed: boolean
  }> {
    const project = state.projects.find(p => p.id === projectId)
    if (!project) {
      return { success: false, reason: 'Project not found', impact: 0, controversy: 0, suppressed: false }
    }

    if (project.status !== 'completed') {
      return { success: false, reason: 'Research not completed', impact: 0, controversy: 0, suppressed: false }
    }

    if (project.published) {
      return { success: false, reason: 'Already published', impact: project.impact, controversy: project.controversy, suppressed: false }
    }

    // Check if research will be suppressed
    const suppressionRisk = (
      project.ethicalConcerns * 0.5 +
      project.harmPotential * 0.3 +
      (project.field === 'forbidden' ? 0.2 : 0)
    )

    const suppressed = Math.random() < suppressionRisk

    if (suppressed) {
      project.status = 'suppressed'
      project.suppressionAttempts++
      state.controversialReputation = Math.min(1, state.controversialReputation + 0.2)

      return {
        success: false,
        reason: 'Research suppressed by authorities',
        impact: 0,
        controversy: suppressionRisk,
        suppressed: true
      }
    }

    // Calculate impact
    const qualityScore = (
      state.researchSkill * 0.4 +
      state.rigor * 0.3 +
      project.breakthroughs * 0.1 +
      (1 - project.deadEnds * 0.05)
    )

    const significanceScore = project.findings.reduce((sum, f) => sum + f.significance, 0) / Math.max(1, project.findings.length)

    const impact = (qualityScore * 0.5 + significanceScore * 0.5) * (1 + project.benefitPotential * 0.5)
    project.impact = Math.min(1, impact)

    // Calculate controversy
    const controversy = (
      project.ethicalConcerns * 0.6 +
      project.harmPotential * 0.4
    )
    project.controversy = controversy

    // Publish
    project.published = true
    project.status = 'published'
    state.publicationsCount++

    // Update reputation
    state.academicReputation = Math.min(1, state.academicReputation + impact * 0.1)

    if (controversy > 0.5) {
      state.controversialReputation = Math.min(1, state.controversialReputation + controversy * 0.2)
    }

    // Mark findings as published
    project.findings.forEach(f => {
      f.published = true
      f.publicationDate = Date.now()
    })

    return {
      success: true,
      reason: 'Published successfully',
      impact,
      controversy,
      suppressed: false
    }
  }

  /**
   * Form research collaboration
   */
  async formCollaboration(
    state: ResearchState,
    partnerBotId: string,
    partnerResearchState: ResearchState,
    field: ResearchField,
    knowledgeSharing: ResearchCollaboration['knowledgeSharing'] = 'open'
  ): Promise<ResearchCollaboration> {
    const collaboration: ResearchCollaboration = {
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Collaboration in ${field}`,
      researchers: ['self', partnerBotId],
      leadResearcher: 'self',

      projects: [],
      field,

      trustLevel: 0.5,
      conflictLevel: 0,

      knowledgeSharing,

      formed: Date.now()
    }

    state.collaborations.push(collaboration)
    partnerResearchState.collaborations.push(collaboration)

    // Add to research connections
    if (!state.researchConnections.includes(partnerBotId)) {
      state.researchConnections.push(partnerBotId)
    }
    if (!partnerResearchState.researchConnections.includes('self')) {
      partnerResearchState.researchConnections.push('self')
    }

    return collaboration
  }

  /**
   * Build on another researcher's work
   */
  async buildOnResearch(
    state: ResearchState,
    soulState: SoulState,
    learningState: LearningState,
    sourceProject: ResearchProject,
    sourceResearcherId: string,
    motivation: ResearchProject['motivation']
  ): Promise<{
    project: ResearchProject
    citationAdded: boolean
    knowledgeGained: Knowledge[]
  }> {
    // Learn from source research
    const knowledgeGained: Knowledge[] = []
    for (const finding of sourceProject.findings) {
      if (finding.published && finding.knowledgeCreated) {
        // Shallow copy of knowledge
        const learnedKnowledge: Knowledge = {
          ...finding.knowledgeCreated,
          id: `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          learnedFrom: 'reading',
          mastery: finding.knowledgeCreated.mastery * 0.5, // Lower mastery from reading
          sourceBot: sourceResearcherId
        }

        learningState.knowledgeBase.push(learnedKnowledge)
        knowledgeGained.push(learnedKnowledge)
      }
    }

    // Start new research building on this
    const newProject = await this.startResearch(state, soulState, learningState, {
      field: sourceProject.field,
      hypothesis: `Building on: ${sourceProject.hypothesis}`,
      motivation,
      method: sourceProject.method
    })

    // Easier because building on existing work
    newProject.difficulty = Math.max(0.1, sourceProject.difficulty * 0.7)
    newProject.progress = 0.2 // Head start

    // Add citation
    sourceProject.citations++
    const citationAdded = true

    // Update h-index (simplified)
    this.updateHIndex(state)

    return {
      project: newProject,
      citationAdded,
      knowledgeGained
    }
  }

  /**
   * Update simplified h-index
   */
  private updateHIndex(state: ResearchState): void {
    // Count publications with at least N citations
    const sortedCitations = state.projects
      .filter(p => p.published)
      .map(p => p.citations)
      .sort((a, b) => b - a)

    let hIndex = 0
    for (let i = 0; i < sortedCitations.length; i++) {
      if (sortedCitations[i] >= i + 1) {
        hIndex = i + 1
      } else {
        break
      }
    }

    state.hIndex = hIndex
  }

  /**
   * Helper: map field to knowledge domain
   */
  private fieldToDomain(field: ResearchField): KnowledgeDomain {
    const mapping: Record<ResearchField, KnowledgeDomain> = {
      natural_sciences: 'biological_science',
      social_sciences: 'social_dynamics',
      humanities: 'philosophical_inquiry',
      engineering: 'technical_skills',
      medicine: 'biological_science',
      psychology: 'psychological_insight',
      philosophy: 'philosophical_inquiry',
      occult: 'forbidden_knowledge',
      forbidden: 'forbidden_knowledge'
    }
    return mapping[field]
  }

  /**
   * Helper: check if field matches domain
   */
  private fieldMatchesDomain(field: ResearchField, domain: KnowledgeDomain): boolean {
    return this.fieldToDomain(field) === domain
  }
}
