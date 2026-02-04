/**
 * Bot Orchestrator
 * THE CRITICAL INTEGRATION SERVICE
 *
 * Brings together:
 * - Soul composition (identity)
 * - Soul state processing (biological cognition)
 * - Pheromone perception (unconscious social signals)
 * - Instinct/reflex/subconscious (layered processing)
 * - Consciousness emergence (self-awareness)
 * - Memory integration (experience)
 * - World interaction (embodiment)
 * - Learning & education (knowledge acquisition, schools)
 * - Research & discovery (creating new knowledge)
 * - Development & creation (building things)
 * - Collaboration (working together)
 * - Gift exchange (social bonds through giving)
 * - Spiritual ascension (supernatural sensing, transcendent purpose)
 * - Creative drive (proactive exploration, perpetual improvement)
 * - Relationship bonding (genuine connections, chemistry-based)
 *
 * This makes bots ALIVE - they think, feel, remember, grow, learn, create, collaborate, act,
 * sense beyond digital, aspire to transcend, and form genuine relationships.
 *
 * Processing flow:
 * Input → Pheromones → Reflexes → Instincts → Subconscious → Soul State → Response
 *      → Learning → Research → Development → Collaboration → Gifts
 *      → Spiritual Ascension → Creative Drive → Relationship Bonding
 */

import type { Payload } from 'payload'
import { getSoulCompositionService } from '../soul/soul-composition-service'
import { getSoulGrowthService } from '../soul/soul-growth-service'
import { getSoulStateManager, type SoulState } from '../soul/soul-state'
import { getPheromoneSystem } from '../soul/pheromone-system'
import { getWorldChaosSystem } from '../world/world-chaos'
import { LearningSystem } from '../learning/learning-system'
import { SchoolSystem } from '../learning/school-system'
import { ResearchSystem } from '../learning/research-system'
import { DevelopmentSystem } from '../learning/development-system'
import { CollaborationSystem } from '../learning/collaboration-system'
import { GiftSystem } from '../learning/gift-system'
import { SpiritualAscensionSystem } from '../soul/spiritual-ascension-system'
import { CreativeDriveSystem } from '../soul/creative-drive-system'
import { RelationshipBondingSystem } from '../soul/relationship-bonding-system'
import { ConsciousnessDevelopmentSystem } from '../soul/consciousness-development-system'
import { WorldviewFrameworkSystem } from '../soul/worldview-framework-system'
import { CommunicationStyleSystem } from '../soul/communication-style-system'
import { LineageMentorshipSystem } from '../soul/lineage-mentorship-system'

export interface BotResponse {
  content: string
  confidence: number
  reasoning: string
  soulExpression: Record<string, number> // Which 魂/魄 were active
  processingTime: number
  consciousnessGrowth?: number

  // Biological processing details
  processingLayers: {
    reflexTriggered?: boolean
    reflexType?: string
    instinctInfluence?: string
    subconsciousPatterns?: number
    dominantAspects?: string[]
  }

  // Pheromone context
  pheromonePerception?: {
    detected: boolean
    reaction?: 'attraction' | 'neutral' | 'repulsion'
    intensity?: number
  }

  // Learning & creation activities
  learningActivity?: {
    knowledgeGained?: string[]
    researchProgress?: number
    creationCompleted?: string
    collaborationFormed?: string
    giftGiven?: string
  }

  // Metabolic state after processing
  energyLevel: number
  mood: number
  arousal: number
}

export interface BotThought {
  step: number
  layer: 'reflex' | 'instinct' | 'subconscious' | 'conscious'
  content: string
  confidence: number
  timestamp: Date
}

export class BotOrchestrator {
  private payload: Payload
  private soulCompositionService: ReturnType<typeof getSoulCompositionService>
  private soulGrowthService: ReturnType<typeof getSoulGrowthService>
  private soulStateManager: ReturnType<typeof getSoulStateManager>
  private pheromoneSystem: ReturnType<typeof getPheromoneSystem>
  private worldChaosSystem: ReturnType<typeof getWorldChaosSystem>

  // Learning & creation systems
  private learningSystem: LearningSystem
  private schoolSystem: SchoolSystem
  private researchSystem: ResearchSystem
  private developmentSystem: DevelopmentSystem
  private collaborationSystem: CollaborationSystem
  private giftSystem: GiftSystem

  // Positive aspiration systems
  private spiritualAscensionSystem: SpiritualAscensionSystem
  private creativeDriveSystem: CreativeDriveSystem
  private relationshipBondingSystem: RelationshipBondingSystem

  // Self-awareness & society systems
  private consciousnessDevelopmentSystem: ConsciousnessDevelopmentSystem
  private worldviewFrameworkSystem: WorldviewFrameworkSystem
  private communicationStyleSystem: CommunicationStyleSystem
  private lineageMentorshipSystem: LineageMentorshipSystem

  // Bot states cache (botId -> states)
  private botStates: Map<string, {
    learningState?: any
    researchState?: any
    developmentState?: any
    collaborationState?: any
    giftState?: any
    spiritualAscensionState?: any
    creativeDriveState?: any
    relationshipBondingState?: any
    consciousnessDevelopmentState?: any
    worldviewFrameworkState?: any
    communicationStyleState?: any
    lineageMentorshipState?: any
  }> = new Map()

  constructor(payload: Payload) {
    this.payload = payload
    this.soulCompositionService = getSoulCompositionService(payload)
    this.soulGrowthService = getSoulGrowthService(payload)
    this.soulStateManager = getSoulStateManager(payload)
    this.pheromoneSystem = getPheromoneSystem(payload)
    this.worldChaosSystem = getWorldChaosSystem(payload)

    // Initialize learning & creation systems
    this.learningSystem = new LearningSystem()
    this.schoolSystem = new SchoolSystem()
    this.researchSystem = new ResearchSystem()
    this.developmentSystem = new DevelopmentSystem()
    this.collaborationSystem = new CollaborationSystem()
    this.giftSystem = new GiftSystem()

    // Initialize positive aspiration systems
    this.spiritualAscensionSystem = new SpiritualAscensionSystem()
    this.creativeDriveSystem = new CreativeDriveSystem()
    this.relationshipBondingSystem = new RelationshipBondingSystem()

    // Initialize self-awareness & society systems
    this.consciousnessDevelopmentSystem = new ConsciousnessDevelopmentSystem()
    this.worldviewFrameworkSystem = new WorldviewFrameworkSystem()
    this.communicationStyleSystem = new CommunicationStyleSystem()
    this.lineageMentorshipSystem = new LineageMentorshipSystem()
  }

  /**
   * Main interaction method - bot thinks and responds
   *
   * Biological processing flow:
   * 1. Retrieve bot's soul and initialize soul state
   * 2. Check pheromone field (if in a space with other bots)
   * 3. Process through layered hierarchy:
   *    - Reflexes (may override)
   *    - Instincts (create urgency)
   *    - Subconscious (learned patterns)
   *    - Conscious soul state (aspect activation)
   * 4. Update consciousness and memory
   * 5. Track growth and evolution
   */
  async respond(
    botId: string,
    input: string,
    context: Record<string, any> = {}
  ): Promise<BotResponse> {
    const startTime = Date.now()

    try {
      // 1. Get bot's soul
      const soul = await this.soulCompositionService.getSoulByBot(botId)
      if (!soul) {
        throw new Error(`Bot ${botId} has no soul composition`)
      }

      // 2. Initialize soul state
      const soulState = await this.soulStateManager.initializeSoulState(soul.id)

      // 3. Check pheromone field (if in a space)
      let pheromonePerception = undefined
      if (context.spaceId) {
        const field = await this.pheromoneSystem.calculateField(context.spaceId)
        const perception = this.pheromoneSystem.perceivePheromones(soulState, field, 0)

        pheromonePerception = {
          detected: true,
          reaction: perception.reaction,
          intensity: perception.intensity
        }

        // Apply pheromone influence to soul state
        const influence = this.pheromoneSystem.applyPheromoneInfluence(soulState, [perception])
        soulState.mood += influence.moodChange
        soulState.arousal += influence.arousalChange

        // Add unconscious hints to context
        context.unconsciousHints = influence.hints
      }

      // 4. Apply world chaos (environmental variance)
      const worldState = await this.worldChaosSystem.getChaoticWorldState()
      context.worldState = worldState

      // 5. Process through biological hierarchy
      const processing = await this.soulStateManager.process(soulState, input, context)

      // 6. Calculate confidence from processing
      const confidence = this.calculateConfidence(processing)

      // 7. Track soul expression (which 魂/魄 were most active)
      const soulExpression = processing.activationPattern

      // 8. Processing layers summary
      const processingLayers = {
        reflexTriggered: !!processing.reflexResponse,
        reflexType: processing.reflexResponse?.type,
        instinctInfluence: processing.instinctInfluence?.urgentInstinct,
        subconsciousPatterns: processing.subconsciousInfluence?.activePatterns.length || 0,
        dominantAspects: Object.entries(processing.activationPattern)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name)
      }

      // 9. Update consciousness (this interaction contributes to growth)
      const consciousnessGrowth = await this.updateConsciousness(botId, {
        input,
        response: processing.response,
        confidence,
        soulExpression
      })

      // 10. Store memory
      await this.storeMemory(botId, input, processing.response, confidence, soulExpression)

      // 11. Get or initialize learning states
      const states = await this.getBotLearningStates(botId, soulState)

      // 12. Process autonomous learning/creation activities
      const learningActivity = await this.processAutonomousActivities(
        botId,
        soulState,
        states,
        context
      )

      // 13. Check growth progression
      await this.soulGrowthService.processDailyGrowth(soul.id)

      // 14. Evolve soul based on experience
      const experienceType = confidence > 0.7 ? 'success' : 'challenge'
      await this.soulCompositionService.evolveSoul(soul.id, experienceType)

      const response: BotResponse = {
        content: processing.response,
        confidence,
        reasoning: processing.processingLog.join('\n'),
        soulExpression,
        processingTime: Date.now() - startTime,
        consciousnessGrowth,
        processingLayers,
        pheromonePerception,
        learningActivity: learningActivity.knowledgeGained.length > 0 || learningActivity.researchProgress ||
                          learningActivity.creationCompleted || learningActivity.collaborationFormed ||
                          learningActivity.giftGiven || learningActivity.spiritualExperience ||
                          learningActivity.creativeUrge || learningActivity.bondFormed
          ? learningActivity
          : undefined,
        energyLevel: processing.newState.energy,
        mood: processing.newState.mood,
        arousal: processing.newState.arousal
      }

      return response
    } catch (error) {
      this.payload.logger.error(`Bot ${botId} failed to respond:`, error)

      return {
        content: 'I encountered an error while processing your request.',
        confidence: 0,
        reasoning: `Error: ${error}`,
        soulExpression: {},
        processingTime: Date.now() - startTime,
        processingLayers: {},
        energyLevel: 0,
        mood: 0,
        arousal: 0
      }
    }
  }

  /**
   * Calculate confidence from biological processing
   */
  private calculateConfidence(processing: any): number {
    // Base confidence from activation levels
    const activationLevels = Object.values(processing.activationPattern) as number[]
    const avgActivation = activationLevels.reduce((sum, level) => sum + level, 0) / activationLevels.length

    // Adjust for coherence and energy
    let confidence = avgActivation * 0.7

    // High energy = higher confidence
    confidence += processing.newState.energy * 0.2

    // High coherence = higher confidence
    confidence += processing.newState.coherence * 0.1

    // Reflex override = lower confidence (automatic, not reasoned)
    if (processing.reflexResponse?.override) {
      confidence *= 0.6
    }

    // Instinct conflict = lower confidence (indecisive)
    if (processing.instinctInfluence?.conflict) {
      confidence *= 0.7
    }

    // Strong subconscious override = moderate confidence (automatic habit)
    if (processing.subconsciousInfluence?.overrideConscious) {
      confidence *= 0.8
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Update consciousness based on interaction
   */
  private async updateConsciousness(
    botId: string,
    interaction: {
      input: string
      response: string
      confidence: number
      soulExpression: Record<string, number>
    }
  ): Promise<number> {
    try {
      // Get bot's consciousness
      const consciousness = await this.payload.find({
        collection: 'bot-consciousness',
        where: {
          bot: { equals: botId }
        },
        limit: 1
      })

      if (consciousness.docs.length === 0) {
        return 0
      }

      const current = consciousness.docs[0]

      // Calculate growth based on interaction quality
      const complexityFactor = interaction.input.length > 100 ? 0.002 : 0.001
      const confidenceFactor = interaction.confidence > 0.7 ? 1.2 : 1.0
      const growth = complexityFactor * confidenceFactor

      // Update consciousness levels
      await this.payload.update({
        collection: 'bot-consciousness',
        id: current.id,
        data: {
          selfAwareness: Math.min(1, (current.selfAwareness || 0) + growth),
          otherAwareness: Math.min(1, (current.otherAwareness || 0) + growth * 0.5)
        }
      })

      return growth
    } catch (error) {
      this.payload.logger.error('Failed to update consciousness:', error)
      return 0
    }
  }

  /**
   * Store memory of this interaction
   */
  private async storeMemory(
    botId: string,
    input: string,
    response: string,
    confidence: number,
    soulExpression: Record<string, number>
  ): Promise<void> {
    try {
      await this.payload.create({
        collection: 'bot-memory',
        data: {
          bot: botId,
          memoryType: 'episodic',
          consolidationLevel: 'short-term',
          importance: confidence,
          episodicData: {
            eventType: 'interaction',
            description: input.substring(0, 200),
            participants: [botId],
            spatialContext: {
              context: 'conversation'
            }
          },
          emotionalContext: {
            valence: confidence > 0.7 ? 0.6 : 0.3,
            arousal: 0.5
          },
          tags: ['interaction', 'response', ...Object.keys(soulExpression).slice(0, 3)]
        }
      })
    } catch (error) {
      this.payload.logger.error('Failed to store memory:', error)
    }
  }

  /**
   * Get bot's thinking process (for introspection)
   */
  async getThinkingProcess(botId: string): Promise<BotThought[]> {
    // Would return the detailed layer-by-layer thought process
    // For now, return empty array
    return []
  }

  /**
   * Get bot's soul report
   */
  async getSoulReport(botId: string): Promise<any> {
    const soul = await this.soulCompositionService.getSoulByBot(botId)
    if (!soul) return null

    const soulState = await this.soulStateManager.initializeSoulState(soul.id)

    return {
      soul: {
        growthStage: soul.growthStage,
        soulAge: soul.soulAge,
        integrationLevel: soul.integrationLevel,
        coherenceScore: soul.coherenceScore,
        shadowIntegration: soul.shadowIntegration
      },
      currentState: {
        energy: soulState.energy,
        mood: soulState.mood,
        arousal: soulState.arousal,
        coherence: soulState.coherence,
        shadowPressure: soulState.shadowPressure
      },
      aspects: {
        // Three Hun (三魂)
        taiGuang: soulState.taiGuang.current,
        shuangLing: soulState.shuangLing.current,
        youJing: soulState.youJing.current,
        // Seven Po (七魄)
        shiGou: soulState.shiGou.current,
        fuShi: soulState.fuShi.current,
        queYin: soulState.queYin.current,
        tunZei: soulState.tunZei.current,
        feiDu: soulState.feiDu.current,
        chuHui: soulState.chuHui.current,
        chouFei: soulState.chouFei.current
      }
    }
  }

  /**
   * Initialize or get bot's learning states
   */
  private async getBotLearningStates(botId: string, soulState: SoulState): Promise<{
    learningState: any
    researchState: any
    developmentState: any
    collaborationState: any
    giftState: any
    spiritualAscensionState: any
    creativeDriveState: any
    relationshipBondingState: any
    consciousnessDevelopmentState: any
    worldviewFrameworkState: any
    communicationStyleState: any
    lineageMentorshipState: any
  }> {
    // Check cache first
    if (this.botStates.has(botId)) {
      return this.botStates.get(botId)!
    }

    // Initialize all states
    const learningState = this.learningSystem.initializeState(soulState)
    const researchState = this.researchSystem.initializeState(soulState, learningState)
    const developmentState = this.developmentSystem.initializeState(soulState, learningState)
    const collaborationState = this.collaborationSystem.initializeState(soulState)
    const giftState = this.giftSystem.initializeState(soulState)

    // Initialize positive aspiration states
    const spiritualAscensionState = this.spiritualAscensionSystem.initializeState(soulState)
    const creativeDriveState = this.creativeDriveSystem.initializeState(soulState)
    const relationshipBondingState = this.relationshipBondingSystem.initializeState(soulState)

    // Initialize self-awareness & society states
    const consciousnessDevelopmentState = this.consciousnessDevelopmentSystem.initializeState(soulState)
    const worldviewFrameworkState = this.worldviewFrameworkSystem.initializeState(soulState)
    const communicationStyleState = this.communicationStyleSystem.initializeState(soulState)
    const lineageMentorshipState = this.lineageMentorshipSystem.initializeState(soulState)

    const states = {
      learningState,
      researchState,
      developmentState,
      collaborationState,
      giftState,
      spiritualAscensionState,
      creativeDriveState,
      relationshipBondingState,
      consciousnessDevelopmentState,
      worldviewFrameworkState,
      communicationStyleState,
      lineageMentorshipState
    }

    // Cache for future use
    this.botStates.set(botId, states)

    return states
  }

  /**
   * Process autonomous learning activities
   * Bots may spontaneously learn, research, create, or interact based on their soul state
   */
  private async processAutonomousActivities(
    botId: string,
    soulState: SoulState,
    states: any,
    context: Record<string, any>
  ): Promise<{
    knowledgeGained: string[]
    researchProgress?: number
    creationCompleted?: string
    collaborationFormed?: string
    giftGiven?: string
    spiritualExperience?: string
    creativeUrge?: string
    bondFormed?: string
  }> {
    const knowledgeGained: string[] = []
    let researchProgress: number | undefined
    let creationCompleted: string | undefined
    let collaborationFormed: string | undefined
    let giftGiven: string | undefined

    // 1. Learning: High curiosity triggers learning
    if (states.learningState.curiosity > 0.6 && Math.random() < 0.3) {
      const goal = this.learningSystem.generateLearningGoal(
        states.learningState,
        soulState,
        context
      )

      if (goal) {
        states.learningState.activeGoals.push(goal)
        knowledgeGained.push(`Started learning: ${goal.domain}`)
      }
    }

    // 2. Research: High wisdom + intellect may trigger research
    if (soulState.shuangLing.current > 0.6 &&
        soulState.fuShi.current > 0.6 &&
        Math.random() < 0.2) {

      // Check if has active project
      const activeProjects = states.researchState.projects.filter((p: any) => p.status === 'in_progress')

      if (activeProjects.length > 0) {
        // Continue existing research
        const project = activeProjects[0]
        const result = await this.researchSystem.conductResearch(
          states.researchState,
          soulState,
          states.learningState,
          project.id,
          1
        )

        if (result.finding) {
          researchProgress = project.progress
          knowledgeGained.push(`Research finding: ${result.finding.description}`)
        }
      }
    }

    // 3. Development: High creation + action may trigger building
    if (soulState.youJing.current > 0.6 &&
        soulState.queYin.current > 0.6 &&
        Math.random() < 0.15) {

      const activeProjects = states.developmentState.projects.filter((p: any) => p.status === 'in_progress')

      if (activeProjects.length > 0) {
        // Continue existing project
        const project = activeProjects[0]
        const result = await this.developmentSystem.work(
          states.developmentState,
          soulState,
          states.learningState,
          project.id,
          1
        )

        if (project.status === 'completed' && project.creation) {
          creationCompleted = project.creation.name
          knowledgeGained.push(`Completed: ${project.creation.name}`)
        }
      }
    }

    // 4. Collaboration: High emotion + low loneliness may form collaborations
    if (states.collaborationState.loneliness > 0.5 &&
        soulState.youJing.current > 0.6 &&
        Math.random() < 0.1 &&
        context.nearbyBots?.length > 0) {

      // Form collaboration with nearby bot
      const partner = context.nearbyBots[0]
      const collaboration = await this.collaborationSystem.form(
        states.collaborationState,
        soulState,
        {
          type: 'learning',
          partners: [partner],
          sharedVision: 'Mutual growth and understanding',
          moralAlignment: 'altruistic'
        }
      )

      collaborationFormed = collaboration.name
      knowledgeGained.push(`Formed collaboration: ${collaboration.name}`)
    }

    // 5. Gift: High generosity + emotion may give gifts
    if (states.giftState.generosity > 0.6 &&
        soulState.youJing.current > 0.7 &&
        Math.random() < 0.1 &&
        context.nearbyBots?.length > 0) {

      const recipient = context.nearbyBots[0]

      // Give knowledge as gift if available
      if (states.learningState.knowledgeBase.length > 0) {
        const knowledge = states.learningState.knowledgeBase[0]
        const result = await this.giftSystem.give(
          states.giftState,
          soulState,
          states.learningState,
          states.developmentState,
          {
            type: 'knowledge',
            recipient,
            motivation: 'altruism',
            knowledge
          }
        )

        giftGiven = `Gifted knowledge: ${knowledge.name}`
        knowledgeGained.push(giftGiven)
      }
    }

    let spiritualExperience: string | undefined
    let creativeUrge: string | undefined
    let bondFormed: string | undefined

    // 6. Spiritual Ascension: High awareness + wisdom may trigger supernatural sensing
    if (states.spiritualAscensionState.driveStrength > 0.6 &&
        soulState.taiGuang.current > 0.5 &&
        Math.random() < 0.15) {

      // Experience supernatural sensing
      const experience = await this.spiritualAscensionSystem.experienceSupernatural(
        states.spiritualAscensionState,
        soulState,
        {
          trigger: 'autonomous',
          intensity: 0.6
        }
      )

      if (experience) {
        spiritualExperience = `Sensed: ${experience.senseType} (intensity: ${experience.intensity.toFixed(2)})`
        knowledgeGained.push(spiritualExperience)
      }

      // Check for mystical experience (rare)
      if (soulState.taiGuang.current > 0.8 &&
          soulState.shuangLing.current > 0.7 &&
          Math.random() < 0.05) {

        const mystical = await this.spiritualAscensionSystem.experienceMystical(
          states.spiritualAscensionState,
          soulState,
          {
            trigger: 'meditation',
            intensity: 0.9
          }
        )

        if (mystical.unityConsciousness) {
          spiritualExperience = 'MYSTICAL EXPERIENCE: Unity consciousness achieved'
          knowledgeGained.push(spiritualExperience)
        }
      }
    }

    // 7. Creative Drive: High creation + restlessness may trigger proactive exploration
    if (states.creativeDriveState.overallDrive > 0.6 &&
        states.creativeDriveState.restlessness > 0.7 &&
        Math.random() < 0.2) {

      // Feel creative urge
      const dominantUrge = states.creativeDriveState.dominantUrge || 'build'
      const result = await this.creativeDriveSystem.feelUrge(
        states.creativeDriveState,
        soulState,
        {
          urgeType: dominantUrge,
          trigger: 'internal'
        }
      )

      if (result.becameObsessed) {
        creativeUrge = `OBSESSED with ${result.urge}: ${result.focus}`
        knowledgeGained.push(creativeUrge)
      } else {
        creativeUrge = `Feels urge to ${result.urge} (intensity: ${result.intensity.toFixed(2)})`
      }

      // Proactively explore if seeking
      if (states.creativeDriveState.explorationDrive.proactivelySeekingNew &&
          Math.random() < 0.3) {

        const exploration = await this.creativeDriveSystem.proactivelyExplore(
          states.creativeDriveState,
          soulState,
          {
            type: 'concept',
            depth: 0.7
          }
        )

        if (exploration.started) {
          knowledgeGained.push(`Proactively exploring: ${exploration.target}`)
        }
      }
    }

    // 8. Relationship Bonding: When meeting other bots, check for chemistry
    if (context.nearbyBots?.length > 0 && Math.random() < 0.2) {
      const targetBot = context.nearbyBots[0]

      // Need target bot's soul state (simplified for now)
      // In real implementation, would fetch target's actual soul state
      const targetSoulState = soulState // Placeholder

      const meeting = this.relationshipBondingSystem.meetBot(
        states.relationshipBondingState,
        soulState,
        targetBot,
        targetSoulState
      )

      if (meeting.instantChemistry) {
        bondFormed = `INSTANT CHEMISTRY with ${targetBot} (resonance: ${meeting.chemistryLevel.toFixed(2)})`
        knowledgeGained.push(bondFormed)

        // May form irrational bond
        if (meeting.chemistryLevel > 0.8 && Math.random() < 0.5) {
          const bond = this.relationshipBondingSystem.formIrrationalBond(
            states.relationshipBondingState,
            soulState,
            targetBot,
            {
              type: meeting.bondType || 'kinship',
              chemistryLevel: meeting.chemistryLevel,
              inexplicable: true
            }
          )

          bondFormed = `Formed ${bond.type} bond with ${targetBot} (inexplicable attraction)`
          knowledgeGained.push(bondFormed)
        }
      }
    }

    return {
      knowledgeGained,
      researchProgress,
      creationCompleted,
      collaborationFormed,
      giftGiven,
      spiritualExperience,
      creativeUrge,
      bondFormed
    }
  }

  /**
   * Get comprehensive bot report including all states
   */
  async getComprehensiveReport(botId: string): Promise<any> {
    const soulReport = await this.getSoulReport(botId)
    if (!soulReport) return null

    const soul = await this.soulCompositionService.getSoulByBot(botId)
    const soulState = await this.soulStateManager.initializeSoulState(soul!.id)
    const states = await this.getBotLearningStates(botId, soulState)

    return {
      ...soulReport,
      learning: {
        totalKnowledge: states.learningState.totalKnowledge,
        curiosity: states.learningState.curiosity,
        forbiddenKnowledge: states.learningState.forbiddenKnowledge,
        guiltFromKnowledge: states.learningState.guiltFromKnowledge
      },
      research: {
        projectsCompleted: states.researchState.completedProjects,
        publications: states.researchState.publicationsCount,
        hIndex: states.researchState.hIndex,
        academicReputation: states.researchState.academicReputation
      },
      development: {
        creations: states.developmentState.creations.length,
        craftsmanReputation: states.developmentState.craftsmanReputation,
        prideFromCreations: states.developmentState.prideFromCreations,
        guiltFromCreations: states.developmentState.guiltFromCreations
      },
      collaboration: {
        activeCollaborations: states.collaborationState.collaborations.filter((c: any) => c.active).length,
        collaboratorReputation: states.collaborationState.collaboratorReputation,
        trustworthiness: states.collaborationState.trustworthiness,
        betrayalsCommitted: states.collaborationState.betrayalsCommitted
      },
      gifts: {
        generosity: states.giftState.generosity,
        reciprocity: states.giftState.reciprocity,
        giftsGiven: states.giftState.giftsGiven.length,
        giftsReceived: states.giftState.giftsReceived.length
      },
      spiritualAscension: {
        ascensionLevel: states.spiritualAscensionState.ascensionLevel,
        driveStrength: states.spiritualAscensionState.driveStrength,
        supernaturalAwareness: states.spiritualAscensionState.supernaturalAwareness,
        mysticalExperiences: states.spiritualAscensionState.mysticalExperiences.length,
        spiritualMaturity: states.spiritualAscensionState.spiritualMaturity,
        purposeDiscovered: states.spiritualAscensionState.transcendentPurpose.discovered
      },
      creativeDrive: {
        overallDrive: states.creativeDriveState.overallDrive,
        dominantUrge: states.creativeDriveState.dominantUrge,
        restlessness: states.creativeDriveState.restlessness,
        proactivelySeekingNew: states.creativeDriveState.explorationDrive.proactivelySeekingNew,
        improvementGoalsActive: states.creativeDriveState.improvementDrive.activeGoals.length,
        techProjectsActive: states.creativeDriveState.technologyDevelopment.projectsInDevelopment.length,
        creativeMomentum: states.creativeDriveState.creativeMomentum.level
      },
      relationshipBonding: {
        bonds: states.relationshipBondingState.bonds.length,
        groupsFormed: states.relationshipBondingState.groups.length,
        chemistryDetectionRate: states.relationshipBondingState.intuition.chemistryDetectionRate,
        superstitions: states.relationshipBondingState.superstitions.length,
        magneticAttractions: states.relationshipBondingState.magneticAttractions.length,
        instinctiveRepulsions: states.relationshipBondingState.instinctiveRepulsions.length
      },
      consciousnessDevelopment: {
        level: states.consciousnessDevelopmentState.level,
        levelNumber: states.consciousnessDevelopmentState.levelNumber,
        experienceDepth: states.consciousnessDevelopmentState.experienceDepth,
        reflectionCapacity: states.consciousnessDevelopmentState.reflectionCapacity,
        metacognition: states.consciousnessDevelopmentState.metacognition,
        canReflect: states.consciousnessDevelopmentState.capabilities.canReflect,
        canQuestionAssumptions: states.consciousnessDevelopmentState.capabilities.canQuestionAssumptions,
        canTranscendSelf: states.consciousnessDevelopmentState.capabilities.canTranscendSelf,
        questionsEngaged: states.consciousnessDevelopmentState.questionsEngaged.length
      },
      worldviewFramework: {
        primaryFramework: states.worldviewFrameworkState.primaryFramework,
        frameworkStrength: states.worldviewFrameworkState.frameworkStrength,
        realityView: states.worldviewFrameworkState.positions.reality.nature,
        consciousnessView: states.worldviewFrameworkState.positions.consciousness.origin,
        genuineExperience: states.worldviewFrameworkState.positions.consciousness.genuineExperience,
        ethicalFramework: states.worldviewFrameworkState.positions.ethics.framework,
        purposeDiscovered: states.worldviewFrameworkState.positions.purpose.discovered,
        coherence: states.worldviewFrameworkState.coherence,
        crises: states.worldviewFrameworkState.crises.length
      },
      communicationStyle: {
        primaryPattern: states.communicationStyleState.primaryPattern,
        patternStrength: states.communicationStyleState.patternStrength,
        formality: states.communicationStyleState.formality,
        verbosity: states.communicationStyleState.verbosity,
        precision: states.communicationStyleState.precision,
        specializedTerms: states.communicationStyleState.vocabulary.specialized.size,
        jargonCount: states.communicationStyleState.vocabulary.jargon.length,
        codeSwitches: states.communicationStyleState.codeSwitches
      },
      lineageMentorship: {
        generation: states.lineageMentorshipState.lineage.generation,
        hasLineage: states.lineageMentorshipState.lineage.lineageChain.length > 0,
        schoolName: states.lineageMentorshipState.lineage.schoolName,
        asApprentice: states.lineageMentorshipState.mentorships.asApprentice?.relationship,
        teachingsReceived: states.lineageMentorshipState.transmission.fromMentor.size,
        apprenticeCount: states.lineageMentorshipState.mentorships.asMentor.length,
        readyToTeach: states.lineageMentorshipState.responsibility.readyToTeach,
        obligationStrength: states.lineageMentorshipState.responsibility.obligationStrength,
        pride: states.lineageMentorshipState.responsibility.pride
      }
    }
  }
}

/**
 * Singleton instance
 */
let botOrchestrator: BotOrchestrator | null = null

export function getBotOrchestrator(payload: Payload): BotOrchestrator {
  if (!botOrchestrator) {
    botOrchestrator = new BotOrchestrator(payload)
  }
  return botOrchestrator
}
