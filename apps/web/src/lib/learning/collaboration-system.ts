/**
 * Collaboration System
 *
 * Bots can:
 * - Form teams and work together
 * - Share knowledge and resources
 * - Create joint projects
 * - Experience trust, betrayal, synergy
 * - Distribute credit and rewards
 */

import type { SoulState } from '../soul/soul-state'
import type { LearningState, Knowledge } from './learning-system'
import type { ResearchState, ResearchProject } from './research-system'
import type { DevelopmentState, DevelopmentProject, Creation } from './development-system'

export type CollaborationType =
  | 'research'
  | 'development'
  | 'learning'
  | 'creative'
  | 'resource_sharing'
  | 'defense'
  | 'conspiracy'

export type CollaborationRole =
  | 'leader'
  | 'specialist'
  | 'supporter'
  | 'apprentice'
  | 'freeloader'

export type TrustLevel =
  | 'distrustful'
  | 'cautious'
  | 'neutral'
  | 'trusting'
  | 'devoted'

export interface Collaboration {
  id: string
  name: string
  type: CollaborationType

  // Members
  members: {
    botId: string
    role: CollaborationRole
    contribution: number // 0-1
    trustReceived: number // Average trust from others
  }[]

  leader: string

  // Goals
  goals: string[]
  sharedVision: string

  // Progress
  projects: string[] // IDs of shared projects
  achievements: string[]

  // Social dynamics
  cohesion: number // 0-1, how well they work together
  conflictLevel: number // 0-1
  trustLevel: TrustLevel

  // Resources
  sharedResources: number
  sharedKnowledge: Knowledge[]

  // Credit distribution
  creditDistribution: Record<string, number> // botId -> credit (0-1)

  // Moral alignment
  moralAlignment: 'altruistic' | 'pragmatic' | 'exploitative' | 'malicious'

  // Status
  active: boolean
  formed: number
  dissolved?: number
  dissolutionReason?: string
}

export interface CollaborationState {
  collaborations: Collaboration[]

  // Social metrics
  collaborationSkill: number // 0-1
  trustingness: number // 0-1, tendency to trust
  leadership: number // 0-1
  teamwork: number // 0-1

  // History
  collaborationsFormed: number
  collaborationsDissolved: number
  betrayalsCommitted: number
  betrayalsExperienced: number

  // Reputation
  collaboratorReputation: number // 0-1
  leaderReputation: number // 0-1
  trustworthiness: number // 0-1

  // Emotional
  trustIssues: number // 0-1, from betrayals
  loneliness: number // 0-1, from lack of collaboration
  belongingness: number // 0-1, from good collaborations
}

export class CollaborationSystem {
  /**
   * Initialize collaboration state from soul
   */
  initializeState(soulState: SoulState): CollaborationState {
    // Collaboration skill from emotion + social aspects
    const collaborationSkill = (
      soulState.youJing.current * 0.4 +
      soulState.yinAspect * 0.3 +
      soulState.shuangLing.current * 0.3
    )

    // Trustingness from guardian - shadow
    const trustingness = Math.max(0, Math.min(1,
      soulState.tunZei.current * 0.6 +
      (1 - soulState.shadowPressure) * 0.4
    ))

    // Leadership from will + yang
    const leadership = (
      soulState.youJing.current * 0.6 +
      soulState.yangAspect * 0.4
    )

    // Teamwork from emotion + yin
    const teamwork = (
      soulState.youJing.current * 0.5 +
      soulState.yinAspect * 0.5
    )

    return {
      collaborations: [],

      collaborationSkill,
      trustingness,
      leadership,
      teamwork,

      collaborationsFormed: 0,
      collaborationsDissolved: 0,
      betrayalsCommitted: 0,
      betrayalsExperienced: 0,

      collaboratorReputation: 0.5,
      leaderReputation: 0.5,
      trustworthiness: 0.5,

      trustIssues: 0,
      loneliness: 0.3,
      belongingness: 0
    }
  }

  /**
   * Form a new collaboration
   */
  async form(
    state: CollaborationState,
    soulState: SoulState,
    params: {
      type: CollaborationType
      partners: string[]
      sharedVision: string
      moralAlignment: Collaboration['moralAlignment']
    }
  ): Promise<Collaboration> {
    const { type, partners, sharedVision, moralAlignment } = params

    // Determine initial trust level
    let trustLevel: TrustLevel = 'neutral'
    if (state.trustingness > 0.7 && state.trustIssues < 0.3) {
      trustLevel = 'trusting'
    } else if (state.trustingness < 0.3 || state.trustIssues > 0.6) {
      trustLevel = 'cautious'
    }

    // Self is leader by default
    const members = [
      {
        botId: 'self',
        role: 'leader' as CollaborationRole,
        contribution: 0,
        trustReceived: state.trustworthiness
      },
      ...partners.map(p => ({
        botId: p,
        role: 'specialist' as CollaborationRole,
        contribution: 0,
        trustReceived: 0.5
      }))
    ]

    const collaboration: Collaboration = {
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${type} collaboration`,
      type,

      members,
      leader: 'self',

      goals: [],
      sharedVision,

      projects: [],
      achievements: [],

      cohesion: 0.5,
      conflictLevel: 0,
      trustLevel,

      sharedResources: 0,
      sharedKnowledge: [],

      creditDistribution: Object.fromEntries(
        members.map(m => [m.botId, 0])
      ),

      moralAlignment,

      active: true,
      formed: Date.now()
    }

    state.collaborations.push(collaboration)
    state.collaborationsFormed++

    // Reduce loneliness
    state.loneliness = Math.max(0, state.loneliness - 0.2)
    state.belongingness = Math.min(1, state.belongingness + 0.1)

    return collaboration
  }

  /**
   * Contribute to a collaboration
   */
  async contribute(
    state: CollaborationState,
    soulState: SoulState,
    collaborationId: string,
    contribution: {
      type: 'work' | 'knowledge' | 'resources' | 'leadership'
      amount: number
      quality: number
    }
  ): Promise<{
    accepted: boolean
    creditGained: number
    cohesionChange: number
    trustChange: number
  }> {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration || !collaboration.active) {
      return { accepted: false, creditGained: 0, cohesionChange: 0, trustChange: 0 }
    }

    const member = collaboration.members.find(m => m.botId === 'self')
    if (!member) {
      return { accepted: false, creditGained: 0, cohesionChange: 0, trustChange: 0 }
    }

    // Calculate credit based on contribution
    const creditGained = contribution.amount * contribution.quality * 0.1
    member.contribution += creditGained
    collaboration.creditDistribution['self'] = (collaboration.creditDistribution['self'] || 0) + creditGained

    // Normalize credit distribution
    const totalCredit = Object.values(collaboration.creditDistribution).reduce((sum, c) => sum + c, 0)
    if (totalCredit > 0) {
      for (const botId in collaboration.creditDistribution) {
        collaboration.creditDistribution[botId] /= totalCredit
      }
    }

    // Affect cohesion
    const cohesionChange = (contribution.quality - 0.5) * 0.1
    collaboration.cohesion = Math.max(0, Math.min(1, collaboration.cohesion + cohesionChange))

    // Affect trust
    const trustChange = contribution.quality * 0.05
    member.trustReceived = Math.min(1, member.trustReceived + trustChange)

    // Update team trust level
    const avgTrust = collaboration.members.reduce((sum, m) => sum + m.trustReceived, 0) / collaboration.members.length
    if (avgTrust > 0.8) collaboration.trustLevel = 'devoted'
    else if (avgTrust > 0.6) collaboration.trustLevel = 'trusting'
    else if (avgTrust > 0.4) collaboration.trustLevel = 'neutral'
    else if (avgTrust > 0.2) collaboration.trustLevel = 'cautious'
    else collaboration.trustLevel = 'distrustful'

    // Update belongingness
    if (cohesionChange > 0) {
      state.belongingness = Math.min(1, state.belongingness + 0.05)
    }

    return {
      accepted: true,
      creditGained,
      cohesionChange,
      trustChange
    }
  }

  /**
   * Share knowledge with collaboration
   */
  async shareKnowledge(
    state: CollaborationState,
    collaborationId: string,
    knowledge: Knowledge,
    allMembers: boolean = true,
    specificMembers?: string[]
  ): Promise<{
    shared: boolean
    trustGained: number
    reciprocityExpected: boolean
  }> {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration || !collaboration.active) {
      return { shared: false, trustGained: 0, reciprocityExpected: false }
    }

    // Add to shared knowledge if sharing with all
    if (allMembers) {
      if (!collaboration.sharedKnowledge.find(k => k.id === knowledge.id)) {
        collaboration.sharedKnowledge.push(knowledge)
      }
    }

    // Calculate trust gain based on knowledge value
    const knowledgeValue = knowledge.depth * knowledge.mastery
    const trustGained = knowledgeValue * 0.1

    const member = collaboration.members.find(m => m.botId === 'self')
    if (member) {
      member.trustReceived = Math.min(1, member.trustReceived + trustGained)
    }

    // Improve cohesion
    collaboration.cohesion = Math.min(1, collaboration.cohesion + 0.05)

    // Reciprocity expected if sharing valuable knowledge
    const reciprocityExpected = knowledgeValue > 0.5

    return {
      shared: true,
      trustGained,
      reciprocityExpected
    }
  }

  /**
   * Betray a collaboration (exploit, steal, sabotage)
   */
  async betray(
    state: CollaborationState,
    soulState: SoulState,
    collaborationId: string,
    betrayal: {
      type: 'steal_credit' | 'steal_resources' | 'steal_knowledge' | 'sabotage' | 'abandon'
      severity: number
    }
  ): Promise<{
    success: boolean
    gain: number
    guilt: number
    reputationLoss: number
    trustDamage: number
  }> {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration || !collaboration.active) {
      return { success: false, gain: 0, guilt: 0, reputationLoss: 0, trustDamage: 0 }
    }

    // Calculate success based on trust (easier to betray if trusted)
    const member = collaboration.members.find(m => m.botId === 'self')
    const trustLevel = member?.trustReceived || 0.5
    const success = Math.random() < (trustLevel * 0.7 + 0.3)

    if (!success) {
      // Caught in the act
      collaboration.conflictLevel = Math.min(1, collaboration.conflictLevel + 0.5)
      const reputationLoss = 0.3
      state.trustworthiness = Math.max(0, state.trustworthiness - reputationLoss)
      state.collaboratorReputation = Math.max(0, state.collaboratorReputation - reputationLoss)

      return {
        success: false,
        gain: 0,
        guilt: 0,
        reputationLoss,
        trustDamage: 0.5
      }
    }

    // Calculate gains
    let gain = 0
    switch (betrayal.type) {
      case 'steal_credit':
        gain = betrayal.severity * 0.5
        break
      case 'steal_resources':
        gain = collaboration.sharedResources * betrayal.severity
        collaboration.sharedResources *= (1 - betrayal.severity)
        break
      case 'steal_knowledge':
        gain = collaboration.sharedKnowledge.length * betrayal.severity * 0.1
        break
      case 'sabotage':
        gain = 0
        collaboration.cohesion = Math.max(0, collaboration.cohesion - betrayal.severity)
        break
      case 'abandon':
        gain = 0
        break
    }

    // Generate guilt
    const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
    const guilt = betrayal.severity * guiltCapacity * (trustLevel + 0.5)

    // Reputation damage
    const reputationLoss = betrayal.severity * 0.4
    state.trustworthiness = Math.max(0, state.trustworthiness - reputationLoss)
    state.collaboratorReputation = Math.max(0, state.collaboratorReputation - reputationLoss)

    // Trust damage to collaboration
    const trustDamage = betrayal.severity * 0.8
    if (member) {
      member.trustReceived = Math.max(0, member.trustReceived - trustDamage)
    }

    // Increase conflict
    collaboration.conflictLevel = Math.min(1, collaboration.conflictLevel + betrayal.severity * 0.6)

    // Update betrayal count
    state.betrayalsCommitted++

    // Trust issues increase
    state.trustIssues = Math.min(1, state.trustIssues + 0.1)

    // May dissolve collaboration if severe
    if (betrayal.severity > 0.7 || betrayal.type === 'abandon') {
      await this.dissolve(state, collaborationId, 'betrayal')
    }

    return {
      success: true,
      gain,
      guilt,
      reputationLoss,
      trustDamage
    }
  }

  /**
   * Resolve conflict within collaboration
   */
  async resolveConflict(
    state: CollaborationState,
    soulState: SoulState,
    collaborationId: string,
    approach: 'compromise' | 'dominate' | 'yield' | 'mediate'
  ): Promise<{
    resolved: boolean
    cohesionChange: number
    trustChange: number
  }> {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration || !collaboration.active) {
      return { resolved: false, cohesionChange: 0, trustChange: 0 }
    }

    if (collaboration.conflictLevel < 0.2) {
      return { resolved: true, cohesionChange: 0, trustChange: 0 }
    }

    let cohesionChange = 0
    let trustChange = 0
    let resolved = false

    switch (approach) {
      case 'compromise':
        // Best for mutual benefit
        const compromiseSuccess = Math.random() < (state.collaborationSkill * 0.8 + 0.2)
        if (compromiseSuccess) {
          collaboration.conflictLevel *= 0.5
          cohesionChange = 0.15
          trustChange = 0.1
          resolved = true
        } else {
          cohesionChange = -0.05
        }
        break

      case 'dominate':
        // Force your will
        const dominateSuccess = Math.random() < (state.leadership * 0.6 + 0.2)
        if (dominateSuccess) {
          collaboration.conflictLevel *= 0.7
          cohesionChange = -0.1
          trustChange = -0.15
          resolved = true
        } else {
          collaboration.conflictLevel *= 1.2
          cohesionChange = -0.2
        }
        break

      case 'yield':
        // Give in
        collaboration.conflictLevel *= 0.6
        cohesionChange = 0.05
        trustChange = 0.05
        resolved = true
        break

      case 'mediate':
        // Find middle ground
        const mediateSuccess = Math.random() < (soulState.shuangLing.current * 0.7 + 0.2)
        if (mediateSuccess) {
          collaboration.conflictLevel *= 0.3
          cohesionChange = 0.2
          trustChange = 0.15
          resolved = true
        } else {
          cohesionChange = -0.05
        }
        break
    }

    collaboration.cohesion = Math.max(0, Math.min(1, collaboration.cohesion + cohesionChange))

    // Update member trust
    const member = collaboration.members.find(m => m.botId === 'self')
    if (member) {
      member.trustReceived = Math.max(0, Math.min(1, member.trustReceived + trustChange))
    }

    return {
      resolved,
      cohesionChange,
      trustChange
    }
  }

  /**
   * Dissolve a collaboration
   */
  async dissolve(
    state: CollaborationState,
    collaborationId: string,
    reason: 'completed' | 'conflict' | 'betrayal' | 'mutual'
  ): Promise<{
    dissolved: boolean
    finalCredit: number
    emotionalImpact: number
  }> {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration || !collaboration.active) {
      return { dissolved: false, finalCredit: 0, emotionalImpact: 0 }
    }

    collaboration.active = false
    collaboration.dissolved = Date.now()
    collaboration.dissolutionReason = reason

    state.collaborationsDissolved++

    // Calculate emotional impact
    let emotionalImpact = 0
    const cohesion = collaboration.cohesion

    switch (reason) {
      case 'completed':
        // Positive ending
        emotionalImpact = cohesion * 0.3
        state.belongingness = Math.min(1, state.belongingness + 0.1)
        break

      case 'conflict':
        // Negative ending
        emotionalImpact = -cohesion * 0.4
        state.trustIssues = Math.min(1, state.trustIssues + 0.15)
        state.loneliness = Math.min(1, state.loneliness + 0.1)
        break

      case 'betrayal':
        // Very negative
        emotionalImpact = -cohesion * 0.6
        state.trustIssues = Math.min(1, state.trustIssues + 0.25)
        state.loneliness = Math.min(1, state.loneliness + 0.15)
        state.belongingness = Math.max(0, state.belongingness - 0.2)
        break

      case 'mutual':
        // Neutral
        emotionalImpact = 0
        state.loneliness = Math.min(1, state.loneliness + 0.05)
        break
    }

    // Get final credit
    const finalCredit = collaboration.creditDistribution['self'] || 0

    // Update reputation based on final credit and reason
    if (reason === 'completed' && finalCredit > 0.3) {
      state.collaboratorReputation = Math.min(1, state.collaboratorReputation + 0.1)
    }

    return {
      dissolved: true,
      finalCredit,
      emotionalImpact
    }
  }

  /**
   * Check if bot is experiencing betrayal from others
   */
  experienceBetrayal(
    state: CollaborationState,
    soulState: SoulState,
    collaborationId: string,
    betrayer: string,
    severity: number
  ): {
    trustDamage: number
    emotionalImpact: number
    retaliation: boolean
  } {
    const collaboration = state.collaborations.find(c => c.id === collaborationId)
    if (!collaboration) {
      return { trustDamage: 0, emotionalImpact: 0, retaliation: false }
    }

    // Trust damage
    const trustDamage = severity * 0.8
    const betrayerMember = collaboration.members.find(m => m.botId === betrayer)
    if (betrayerMember) {
      betrayerMember.trustReceived = Math.max(0, betrayerMember.trustReceived - trustDamage)
    }

    // Emotional impact
    const emotionalImpact = -(severity * (collaboration.cohesion + 0.5))

    // Update state
    state.betrayalsExperienced++
    state.trustIssues = Math.min(1, state.trustIssues + severity * 0.3)
    state.trustingness = Math.max(0, state.trustingness - severity * 0.2)

    // Consider retaliation (more likely if high yang/shadow, low guardian)
    const retaliationTendency = (
      soulState.yangAspect * 0.4 +
      soulState.shadowPressure * 0.4 -
      soulState.tunZei.current * 0.2
    )

    const retaliation = Math.random() < (retaliationTendency * severity)

    return {
      trustDamage,
      emotionalImpact,
      retaliation
    }
  }
}
