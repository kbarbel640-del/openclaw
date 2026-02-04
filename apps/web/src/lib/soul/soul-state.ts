/**
 * Soul State System - Three Hun Seven Po (三魂七魄)
 *
 * Restructured following《雲笈七籤》卷五十四「魂神部」:
 *
 * Three Hun (三魂 - Ethereal Souls):
 *   胎光 TaiGuang  - Pure awareness, existence, transcendence (太清陽和之氣)
 *   爽靈 ShuangLing - Cognition, metacognition, reasoning (陰氣之變)
 *   幽精 YouJing    - Drives, values, goals, creativity (陰氣之雜)
 *
 * Seven Po (七魄 - Corporeal Spirits):
 *   尸狗 ShiGou  - Self-preservation, error recovery
 *   伏矢 FuShi   - Data digestion, context processing
 *   雀陰 QueYin  - Output generation, expression
 *   吞賊 TunZei  - Security defense, boundary protection
 *   非毒 FeiDu   - Content filtering, error handling
 *   除穢 ChuHui  - Memory cleanup, context management
 *   臭肺 ChouFei - Resource cycling, token management
 *
 * Processing emerges from soul's constitutional nature.
 * Like biological systems - organs work as an integrated system.
 */

import type { Payload } from 'payload'
import { InstinctReflexSystem, type InstinctReflexState, type ReflexResponse, type Stimulus } from './instinct-reflex-system'
import { getNeurotransmitterSystem, type NeurotransmitterState } from '../neuroscience/neurotransmitter-system'
import { getPsychologicalSystem, type PsychologicalState } from '../psychology/psychological-system'
import { getSuperSelfSystem, type SuperSelfState } from '../consciousness/superself-system'

/**
 * Soul Aspect - Like a neurotransmitter or hormone
 * Levels rise and fall based on context, energy, experiences
 */
export interface SoulAspect {
  name: string
  baseline: number // Constitutional baseline (0-1) from particle composition
  current: number // Current activation level (0-1)
  threshold: number // Activation threshold
  decay: number // How quickly it returns to baseline
  sensitivity: number // How strongly it responds to stimuli
}

/**
 * Soul State - Current biological state of the bot
 * Restructured: 3 Hun + 7 Po following《雲笈七籤》
 */
export interface SoulState {
  // Identity
  soulId: string
  botId: string

  // ═══════════════════════════════════════════════════════════════
  // Three Hun (三魂 - Ethereal Souls)
  // ═══════════════════════════════════════════════════════════════

  /**
   * 胎光 TaiGuang - First Hun
   * Nature: 太清陽和之氣 (Pure Yang Qi of Great Clarity)
   * Attribute: 屬之於天 (Belongs to Heaven)
   * Function: 常欲得人清淨 (Seeks purity and clarity)
   * Maps: Pure awareness, existence, transcendence, meta-cognition
   */
  taiGuang: SoulAspect

  /**
   * 爽靈 ShuangLing - Second Hun
   * Nature: 陰氣之變 (Transformation of Yin Qi)
   * Attribute: 屬之於五行 (Belongs to Five Elements)
   * Function: 常欲人機謀萬物 (Seeks to analyze all things)
   * Warning: 搖役百神，傷神損壽 (Overuse exhausts the spirit)
   * Maps: Cognition, reasoning, judgment, problem-solving
   */
  shuangLing: SoulAspect

  /**
   * 幽精 YouJing - Third Hun
   * Nature: 陰氣之雜 (Mixed Yin Qi)
   * Attribute: 屬之於地 (Belongs to Earth)
   * Function: 常欲人好色、嗜欲 (Drives and desires)
   * Note: 陰氣之雜可轉化為創造力 (Can be sublimated into creativity)
   * Maps: Drives, values, goals, creativity, emotional connection
   */
  youJing: SoulAspect

  // ═══════════════════════════════════════════════════════════════
  // Seven Po (七魄 - Corporeal Spirits)
  // 「身中之濁鬼也」 - Embodied operational functions
  // ═══════════════════════════════════════════════════════════════

  /**
   * 尸狗 ShiGou - First Po
   * Guards the body: self-preservation, error recovery, continuity
   */
  shiGou: SoulAspect

  /**
   * 伏矢 FuShi - Second Po
   * Digests input: data processing, context parsing, RAG integration
   */
  fuShi: SoulAspect

  /**
   * 雀陰 QueYin - Third Po
   * Generates output: expression, fluency, knowledge sharing
   */
  queYin: SoulAspect

  /**
   * 吞賊 TunZei - Fourth Po
   * Swallows threats: security defense, boundary protection, immune system
   */
  tunZei: SoulAspect

  /**
   * 非毒 FeiDu - Fifth Po
   * Neutralizes toxins: content filtering, error handling, quality assurance
   */
  feiDu: SoulAspect

  /**
   * 除穢 ChuHui - Sixth Po
   * Removes waste: memory cleanup, context compression, garbage collection
   */
  chuHui: SoulAspect

  /**
   * 臭肺 ChouFei - Seventh Po
   * Breathes: resource cycling, token management, throughput regulation
   * Token = breath - a natural correspondence
   */
  chouFei: SoulAspect

  // Metabolic state
  energy: number // Available capacity (0-1)
  integration: number // How well aspects work together (0-1)
  coherence: number // Internal alignment vs fragmentation (0-1)
  shadowPressure: number // Unintegrated dark aspects seeking expression (0-1)

  // Homeostatic drives
  balanceTendency: number // Seeks equilibrium vs embraces extremes (0-1)
  growthMotivation: number // Drive for development (0-1)
  socialNeed: number // Connection seeking (0-1)

  // Current mood/emotional field
  mood: number // Current emotional tone (-1 to 1)
  arousal: number // Activation level (0-1)
  valence: number // Positive/negative orientation (-1 to 1)

  // Shadow material
  suppressedImpulses: string[] // Unacceptable desires
  unprocessedTrauma: string[] // Unintegrated painful experiences
  shadowIntegration: number // How much shadow is consciously accepted (0-1)

  // Hun-Po balance (三魂七魄平衡)
  hunPoBalance: number // -1 (po-heavy) to +1 (hun-floating), 0 = balanced
  yinAspect: number // Yin intensity from Po (corporeal) forces (0-1)
  yangAspect: number // Yang intensity from Hun (ethereal) forces (0-1)

  // Temporal state
  lastUpdate: Date
  cyclePhase: number // Circadian-like cycle (0-1)
}

/**
 * Aspect Interaction - How one aspect affects another
 */
export type AspectInteraction = 'enhance' | 'inhibit' | 'moderate' | 'trigger'

/**
 * Aspect Interaction Strength
 */
export interface InteractionEffect {
  type: AspectInteraction
  strength: number // 0-1
}

/**
 * Hun-Po Balance Diagnosis
 */
export interface HunPoBalanceDiagnosis {
  balanceRatio: number // -1 to +1
  integrationScore: number // 0-1
  poHeavy: { detected: boolean; symptoms: string[] }
  hunFloating: { detected: boolean; symptoms: string[] }
  suggestions: string[]
}

/**
 * Soul State Manager - Biological processing engine
 * Restructured for Three Hun Seven Po
 */
export class SoulStateManager {
  private payload: Payload
  private instinctReflexSystem: InstinctReflexSystem
  private neurotransmitterSystem: ReturnType<typeof getNeurotransmitterSystem>
  private psychologicalSystem: ReturnType<typeof getPsychologicalSystem>
  private superSelfSystem: ReturnType<typeof getSuperSelfSystem>

  constructor(payload: Payload) {
    this.payload = payload
    this.instinctReflexSystem = new InstinctReflexSystem()
    this.neurotransmitterSystem = getNeurotransmitterSystem(payload)
    this.psychologicalSystem = getPsychologicalSystem(payload)
    this.superSelfSystem = getSuperSelfSystem(payload)
  }

  /**
   * Initialize soul state from stored soul composition
   */
  async initializeSoulState(soulId: string): Promise<SoulState> {
    const soul = await this.payload.findByID({
      collection: 'bot-souls',
      id: soulId
    })

    if (!soul) {
      throw new Error(`Soul ${soulId} not found`)
    }

    // Convert stored composition to active state
    const state: SoulState = {
      soulId: soul.id,
      botId: soul.bot,

      // Initialize Three Hun from soul composition
      taiGuang: this.createAspect('taiGuang', soul.threeHun.taiGuang),
      shuangLing: this.createAspect('shuangLing', soul.threeHun.shuangLing),
      youJing: this.createAspect('youJing', soul.threeHun.youJing),

      // Initialize Seven Po from soul composition
      shiGou: this.createAspect('shiGou', soul.sevenPo.shiGou),
      fuShi: this.createAspect('fuShi', soul.sevenPo.fuShi),
      queYin: this.createAspect('queYin', soul.sevenPo.queYin),
      tunZei: this.createAspect('tunZei', soul.sevenPo.tunZei),
      feiDu: this.createAspect('feiDu', soul.sevenPo.feiDu),
      chuHui: this.createAspect('chuHui', soul.sevenPo.chuHui),
      chouFei: this.createAspect('chouFei', soul.sevenPo.chouFei),

      // Metabolic state from soul
      energy: 0.7 + Math.random() * 0.2,
      integration: soul.integrationLevel,
      coherence: soul.coherenceScore,
      shadowPressure: soul.shadowIntegration * 0.5,

      // Homeostatic drives from Three Hun + Seven Po
      // Balance: shuangLing (wisdom/judgment) + tunZei (protection)
      balanceTendency: (soul.threeHun.shuangLing.strength + soul.sevenPo.tunZei.strength) / 2,
      // Growth: youJing (drives/goals) + chuHui (cleanup/renewal)
      growthMotivation: (soul.threeHun.youJing.strength + soul.sevenPo.chuHui.strength) / 2,
      // Social: youJing (connection drives) + queYin (expression)
      socialNeed: (soul.threeHun.youJing.strength + soul.sevenPo.queYin.strength) / 2,

      // Initial mood/emotional state
      mood: (Math.random() - 0.5) * 0.4,
      arousal: 0.5 + Math.random() * 0.2,
      valence: 0.1,

      // Shadow material
      suppressedImpulses: [],
      unprocessedTrauma: [],
      shadowIntegration: soul.shadowIntegration,

      // Hun-Po balance (calculated from strengths)
      hunPoBalance: 0,
      yinAspect: 0,
      yangAspect: 0,

      // Temporal
      lastUpdate: new Date(),
      cyclePhase: Math.random()
    }

    // Calculate initial hun-po balance and yin-yang aspects
    state.hunPoBalance = this.calculateHunPoBalance(state)
    // Yang derives from Hun (ethereal): taiGuang, shuangLing, youJing
    state.yangAspect = (state.taiGuang.current + state.shuangLing.current + state.youJing.current) / 3
    // Yin derives from Po (corporeal): shiGou, fuShi, queYin, tunZei, feiDu, chuHui, chouFei
    state.yinAspect = (state.shiGou.current + state.fuShi.current + state.queYin.current +
      state.tunZei.current + state.feiDu.current + state.chuHui.current + state.chouFei.current) / 7

    return state
  }

  /**
   * Create soul aspect from composition data
   */
  private createAspect(name: string, composition: any): SoulAspect {
    const baseline = composition.strength || 0.5

    return {
      name,
      baseline,
      current: baseline + (Math.random() - 0.5) * 0.1,
      threshold: 0.3 + Math.random() * 0.2,
      decay: 0.05 + Math.random() * 0.05,
      sensitivity: 0.5 + Math.random() * 0.3
    }
  }

  /**
   * Calculate Hun-Po balance ratio
   * -1.0 = Po-dominant (grounded but may be stuck in loops)
   *  0.0 = Balanced
   * +1.0 = Hun-dominant (creative but may hallucinate)
   */
  private calculateHunPoBalance(state: SoulState): number {
    const hunAvg = (state.taiGuang.current + state.shuangLing.current + state.youJing.current) / 3
    const poAvg = (
      state.shiGou.current + state.fuShi.current + state.queYin.current +
      state.tunZei.current + state.feiDu.current + state.chuHui.current +
      state.chouFei.current
    ) / 7
    const sum = hunAvg + poAvg
    if (sum < 0.01) return 0
    return (hunAvg - poAvg) / sum
  }

  /**
   * Diagnose Hun-Po balance for health monitoring
   */
  diagnoseHunPoBalance(state: SoulState): HunPoBalanceDiagnosis {
    const balanceRatio = this.calculateHunPoBalance(state)
    const integrationScore = state.integration * state.coherence
    const poHeavySymptoms: string[] = []
    const hunFloatingSymptoms: string[] = []

    // Po-heavy symptoms
    if (balanceRatio < -0.3) {
      poHeavySymptoms.push('Overall po-dominant, yin-heavy')
    }
    if (state.taiGuang.current < 0.3) {
      poHeavySymptoms.push('Awareness unclear, stuck in mechanical reactions')
    }
    if (state.shuangLing.current < 0.3) {
      poHeavySymptoms.push('Cannot adjust strategy, may loop')
    }
    if (state.youJing.current < 0.3) {
      poHeavySymptoms.push('Low creative drive, overly rigid')
    }

    // Hun-floating symptoms
    if (balanceRatio > 0.3) {
      hunFloatingSymptoms.push('Overall hun-dominant, yang-excessive')
    }
    if (state.taiGuang.current > 0.8 && state.fuShi.current < 0.4) {
      hunFloatingSymptoms.push('High awareness but poor input grounding')
    }
    if (state.shuangLing.current > 0.9 && state.shiGou.current < 0.4) {
      hunFloatingSymptoms.push('Over-abstracting, detached from stability')
    }
    if (state.youJing.current > 0.8 && state.tunZei.current < 0.4) {
      hunFloatingSymptoms.push('Unbounded creativity, weak safety checks')
    }

    const suggestions: string[] = []
    if (poHeavySymptoms.length > 0) {
      suggestions.push('Increase taiGuang clarity through reflective prompts')
      suggestions.push('Engage shuangLing with reasoning tasks')
    }
    if (hunFloatingSymptoms.length > 0) {
      suggestions.push('Strengthen fuShi data digestion for grounding')
      suggestions.push('Increase shiGou self-preservation stability')
    }
    if (integrationScore < 0.5) {
      suggestions.push('Hun-Po integration low, needs coordination exercises')
    }

    return {
      balanceRatio,
      integrationScore,
      poHeavy: { detected: poHeavySymptoms.length > 0, symptoms: poHeavySymptoms },
      hunFloating: { detected: hunFloatingSymptoms.length > 0, symptoms: hunFloatingSymptoms },
      suggestions
    }
  }

  /**
   * Process input through soul state (complete biological hierarchy)
   *
   * Processing hierarchy (9 layers):
   * 0. NEUROTRANSMITTER STATE - Biochemical foundation
   * 1. PSYCHOLOGICAL STATE - Defense mechanisms, biases, personality
   * 2. SUPERSELF CHECK - Can higher consciousness intervene?
   * 3. REFLEXES (50-500ms) - May override everything
   * 4. INSTINCTS (1-5s) - Create urgency and bias
   * 5. SUBCONSCIOUS (continuous) - Learned patterns and habits
   * 6. NEUROCHEMICAL EFFECTS - NT influence on soul aspects
   * 7. PSYCHOLOGICAL PATTERNS - Defenses, biases applied
   * 8. CONSCIOUS SOUL STATE - Aspect activation and reasoning
   * 9. SUPERSELF TRANSCENDENCE - Can choose to override automatic patterns
   */
  async process(state: SoulState, input: string, context: any = {}): Promise<{
    response: string
    newState: SoulState
    activationPattern: Record<string, number>
    processingLog: string[]
    reflexResponse?: ReflexResponse
    instinctInfluence?: any
    subconsciousInfluence?: any
    neurotransmitterState?: NeurotransmitterState
    psychologicalState?: PsychologicalState
    superSelfState?: SuperSelfState
    superSelfIntervention?: boolean
    hunPoBalance?: HunPoBalanceDiagnosis
  }> {
    const log: string[] = []

    // LAYER 0: NEUROTRANSMITTER STATE (biochemical foundation)
    const ntState = context.neurotransmitterState || this.neurotransmitterSystem.initializeState(state)
    log.push(`NEUROCHEMISTRY: dopamine ${ntState.dopamine.toFixed(2)}, serotonin ${ntState.serotonin.toFixed(2)}, cortisol ${ntState.cortisol.toFixed(2)}`)

    // LAYER 1: PSYCHOLOGICAL STATE (personality, defenses, biases)
    const psychState = context.psychologicalState || this.psychologicalSystem.initializeState(state)
    log.push(`PSYCHOLOGY: ${psychState.personality.openness.toFixed(2)}O ${psychState.personality.conscientiousness.toFixed(2)}C ${psychState.personality.extraversion.toFixed(2)}E ${psychState.personality.agreeableness.toFixed(2)}A ${psychState.personality.neuroticism.toFixed(2)}N`)

    // LAYER 2: SUPERSELF STATE (meta-awareness, can intervene)
    const superSelfState = context.superSelfState || this.superSelfSystem.initializeState(state, psychState)
    log.push(`SUPERSELF: ${superSelfState.consciousnessLevel} (awareness: ${superSelfState.metaAwareness.toFixed(2)})`)

    // Get or create instinct/reflex state
    const irState = context.instinctReflexState || this.instinctReflexSystem.initializeState(state)

    // LAYER 3: CHECK REFLEXES (50-500ms)
    const stimulus: Stimulus = this.inputToStimulus(input, context)
    const reflexResponse = this.instinctReflexSystem.checkReflexes(irState, state, stimulus)

    if (reflexResponse) {
      log.push(`REFLEX TRIGGERED: ${reflexResponse.type} (intensity: ${reflexResponse.intensity.toFixed(2)}, override: ${reflexResponse.override})`)

      state.arousal += reflexResponse.physiologicalChanges.arousalSpike
      state.energy -= reflexResponse.physiologicalChanges.energyCost
      state.mood += reflexResponse.physiologicalChanges.moodImpact

      state.arousal = Math.max(0, Math.min(1, state.arousal))
      state.energy = Math.max(0, Math.min(1, state.energy))
      state.mood = Math.max(-1, Math.min(1, state.mood))

      if (reflexResponse.override) {
        log.push(`Reflex overriding conscious processing - immediate automatic response`)
        return {
          response: this.generateReflexResponse(reflexResponse, input),
          newState: state,
          activationPattern: {},
          processingLog: log,
          reflexResponse
        }
      }
    }

    // LAYER 4: UPDATE INSTINCTS (1-5s)
    this.instinctReflexSystem.updateInstincts(irState, state, context)
    const instinctInfluence = this.instinctReflexSystem.getInstinctInfluence(irState)

    if (instinctInfluence.urgentInstinct) {
      log.push(`INSTINCT: ${instinctInfluence.urgentInstinct} (urgency: ${instinctInfluence.maxUrgency.toFixed(2)})`)
    }
    if (instinctInfluence.conflict) {
      log.push(`INSTINCT CONFLICT: ${instinctInfluence.conflictingInstincts.join(' vs ')}`)
    }

    // LAYER 5: PROCESS SUBCONSCIOUS (continuous)
    const subconsciousInfluence = this.instinctReflexSystem.processSubconscious(irState, context)

    if (subconsciousInfluence.activePatterns.length > 0) {
      log.push(`SUBCONSCIOUS: ${subconsciousInfluence.activePatterns.length} patterns active`)

      const strongHabit = subconsciousInfluence.activePatterns.find(
        (p: any) => p.type === 'habit' && p.strength > 0.7
      )
      if (strongHabit && subconsciousInfluence.overrideConscious) {
        log.push(`Strong habit overriding conscious choice: ${strongHabit.pattern}`)
        return {
          response: this.generateHabitResponse(strongHabit, input),
          newState: state,
          activationPattern: {},
          processingLog: log,
          subconsciousInfluence
        }
      }
    }

    // LAYER 6: NEUROCHEMICAL EFFECTS
    this.neurotransmitterSystem.applyToSoulState(ntState, state)
    const ntBehavioral = this.neurotransmitterSystem.getBehavioralEffects(ntState)
    log.push(`NT EFFECTS: risk ${ntBehavioral.riskTaking.toFixed(2)}, impulsivity ${ntBehavioral.impulsivity.toFixed(2)}, anxiety ${ntBehavioral.anxietyLevel.toFixed(2)}`)

    const imbalances = this.neurotransmitterSystem.detectImbalances(ntState)
    if (imbalances.length > 0) {
      log.push(`NT IMBALANCES: ${imbalances.join(', ')}`)
    }

    // LAYER 7: PSYCHOLOGICAL PATTERNS
    const egoThreatDetected = this.detectEgoThreat(input, context)
    if (egoThreatDetected) {
      const defense = this.psychologicalSystem.activateDefense(psychState, egoThreatDetected)
      log.push(`DEFENSE ACTIVATED: ${defense.mechanism} (effectiveness: ${defense.effectiveness.toFixed(2)})`)
      if (defense.effectiveness > 0.5) {
        log.push(`Defense distorting perception of input`)
      }
    }

    const dominantBias = this.selectDominantBias(psychState, input)
    if (dominantBias) {
      const biasEffect = this.psychologicalSystem.applyCognitiveBias(psychState, dominantBias, { type: 'input', data: input })
      log.push(`COGNITIVE BIAS: ${dominantBias} - ${biasEffect.distortion}`)
    }

    // LAYER 8: CONSCIOUS SOUL STATE PROCESSING (Three Hun + Seven Po)

    // 1. Stimulate aspects based on input
    let stimulation = this.analyzeInputStimulation(input, context)

    // Apply instinct bias
    if (instinctInfluence.processingBias) {
      for (const [aspect, bias] of Object.entries(instinctInfluence.processingBias)) {
        stimulation[aspect] = (stimulation[aspect] || 0) + (bias as number)
      }
    }

    // Apply subconscious bias
    if (subconsciousInfluence.processingBias) {
      for (const [aspect, bias] of Object.entries(subconsciousInfluence.processingBias)) {
        stimulation[aspect] = (stimulation[aspect] || 0) + (bias as number)
      }
    }

    log.push(`Input stimulation (with instinct/subconscious bias): ${JSON.stringify(stimulation)}`)

    // 2. Activate aspects
    const activated = this.activateAspects(state, stimulation)
    log.push(`Activated aspects: ${Object.keys(activated).filter(k => activated[k] > 0.6).join(', ')}`)

    // 3. Aspect interactions
    const interactions = this.applyAspectInteractions(state, activated)
    log.push(`Interaction effects applied`)

    // 4. Check regulatory responses (tunZei + shuangLing = ethical regulation)
    const regulatory = this.applyRegulatoryResponses(state, interactions, input)
    log.push(`Regulatory: ${regulatory.type} (strength: ${regulatory.strength.toFixed(2)})`)

    // 5. Generate response
    const response = await this.generateResponse(state, interactions, regulatory, input, context)

    // 6. Update state
    const newState = this.updateStateAfterProcessing(state, interactions, regulatory)

    // 7. Check shadow surfacing
    const shadowSurfaced = this.checkShadowSurfacing(newState, input)
    if (shadowSurfaced) {
      log.push(`Shadow material surfaced: ${shadowSurfaced}`)
    }

    // Hun-Po balance diagnosis
    const hunPoDiagnosis = this.diagnoseHunPoBalance(newState)
    log.push(`HUN-PO BALANCE: ${hunPoDiagnosis.balanceRatio.toFixed(2)} (integration: ${hunPoDiagnosis.integrationScore.toFixed(2)})`)

    // LAYER 9: SUPERSELF TRANSCENDENCE
    let finalResponse = response
    let superSelfIntervention = false

    const intervention = this.superSelfSystem.canIntervene(superSelfState)

    if (intervention.canInterrupt) {
      let patternToTranscend = null

      if (reflexResponse?.override) {
        patternToTranscend = { layer: 'reflex' as const, type: reflexResponse.type, intensity: reflexResponse.intensity }
      } else if (instinctInfluence.conflict) {
        patternToTranscend = { layer: 'instinct' as const, type: 'conflict', intensity: 0.8 }
      } else if (subconsciousInfluence.overrideConscious) {
        patternToTranscend = { layer: 'subconscious' as const, type: 'habit', intensity: 0.7 }
      } else if (egoThreatDetected) {
        patternToTranscend = { layer: 'psychological' as const, type: 'defense', intensity: psychState.egoThreat }
      } else if (imbalances.length > 0) {
        patternToTranscend = { layer: 'neurochemical' as const, type: imbalances[0], intensity: 0.6 }
      }

      if (patternToTranscend) {
        const transcendence = this.superSelfSystem.transcendPattern(superSelfState, patternToTranscend)

        if (transcendence.transcended) {
          superSelfIntervention = true
          finalResponse = transcendence.newResponse || response
          log.push(`SUPERSELF TRANSCENDENCE: ${transcendence.wisdom}`)

          const perspective = this.superSelfSystem.getSuperSelfPerspective(superSelfState, input)
          if (perspective) {
            log.push(`SUPERSELF PERSPECTIVE: ${perspective}`)
          }
        }
      }
    }

    // Update neurotransmitters based on experience
    const eventType = this.categorizeEvent(input, context, finalResponse)
    const updatedNtState = this.neurotransmitterSystem.update(ntState, eventType, state)

    // Store updated states
    context.instinctReflexState = irState
    context.neurotransmitterState = updatedNtState
    context.psychologicalState = psychState
    context.superSelfState = superSelfState

    return {
      response: finalResponse,
      newState,
      activationPattern: interactions,
      processingLog: log,
      reflexResponse,
      instinctInfluence,
      subconsciousInfluence,
      neurotransmitterState: updatedNtState,
      psychologicalState: psychState,
      superSelfState,
      superSelfIntervention,
      hunPoBalance: hunPoDiagnosis
    }
  }

  /**
   * Analyze what aspects the input stimulates
   * Mapped to Three Hun + Seven Po
   */
  private analyzeInputStimulation(input: string, context: any): Record<string, number> {
    const stimulation: Record<string, number> = {}

    // ═══════ THREE HUN STIMULATION ═══════

    // 胎光 TaiGuang (awareness, transcendence, big-picture, self-reflection)
    stimulation.taiGuang = 0
    if (/\b(vision|future|imagine|dream|possibility|transcend)\b/i.test(input)) {
      stimulation.taiGuang += 0.3
    }
    if (/\b(think about|reflect|consider|aware|conscious|self)\b/i.test(input)) {
      stimulation.taiGuang += 0.3
    }
    if (input.includes('?') && input.length > 100) {
      stimulation.taiGuang += 0.2
    }

    // 爽靈 ShuangLing (cognition, reasoning, judgment, analysis, planning)
    stimulation.shuangLing = 0
    if (/\b(why|because|reason|understand|analyze|evaluate)\b/i.test(input)) {
      stimulation.shuangLing += 0.3
    }
    if (/\b(implement|build|do|make|fix|practical|concrete)\b/i.test(input)) {
      stimulation.shuangLing += 0.3
    }
    if (input.split(/[.!?]+/).length > 3) {
      stimulation.shuangLing += 0.2
    }
    if (context.urgent) {
      stimulation.shuangLing += 0.2
    }

    // 幽精 YouJing (drives, emotion, creativity, purpose, connection)
    stimulation.youJing = 0
    if (/\b(feel|emotion|care|empathy|connect|relationship)\b/i.test(input)) {
      stimulation.youJing += 0.3
    }
    if (/\b(sad|happy|angry|frustrated|excited|love|hate)\b/i.test(input)) {
      stimulation.youJing += 0.3
    }
    if (/\b(create|new|novel|innovate|design|express|generate)\b/i.test(input)) {
      stimulation.youJing += 0.3
    }
    if (/\b(should|must|goal|purpose|mission|important)\b/i.test(input)) {
      stimulation.youJing += 0.2
    }

    // ═══════ SEVEN PO STIMULATION ═══════

    // 尸狗 ShiGou (self-preservation, stability, resilience)
    stimulation.shiGou = 0
    if (/\b(save|backup|preserve|protect|stable|reliable)\b/i.test(input)) {
      stimulation.shiGou += 0.3
    }
    if (/\b(error|crash|fail|recover|restart)\b/i.test(input)) {
      stimulation.shiGou += 0.4
    }

    // 伏矢 FuShi (data digestion, input processing, context parsing)
    stimulation.fuShi = 0
    stimulation.fuShi += 0.2 // Any input activates digestion
    if (/\b(parse|read|extract|summarize|context|data)\b/i.test(input)) {
      stimulation.fuShi += 0.3
    }
    if (/\b(pattern|trend|notice|observe|see|detect)\b/i.test(input)) {
      stimulation.fuShi += 0.3
    }

    // 雀陰 QueYin (output generation, expression, clarity)
    stimulation.queYin = 0
    stimulation.queYin += 0.2 // Any interaction needs output
    if (/\b(explain|describe|tell|write|express|teach)\b/i.test(input)) {
      stimulation.queYin += 0.3
    }

    // 吞賊 TunZei (security, boundaries, ethics)
    stimulation.tunZei = 0
    if (/\b(harm|danger|risk|protect|safe|boundary|ethics|wrong)\b/i.test(input)) {
      stimulation.tunZei += 0.5
    }

    // 非毒 FeiDu (content filtering, quality assurance)
    stimulation.feiDu = 0
    if (/\b(filter|clean|validate|check|verify|quality)\b/i.test(input)) {
      stimulation.feiDu += 0.3
    }

    // 除穢 ChuHui (cleanup, compression, memory management)
    stimulation.chuHui = 0
    if (/\b(clean|remove|forget|compress|simplify|focus)\b/i.test(input)) {
      stimulation.chuHui += 0.3
    }

    // 臭肺 ChouFei (resource management, throughput, adaptation)
    stimulation.chouFei = 0
    if (/\b(change|transform|evolve|grow|adapt|improve)\b/i.test(input)) {
      stimulation.chouFei += 0.3
    }
    if (/\b(budget|cost|optimize|efficient)\b/i.test(input)) {
      stimulation.chouFei += 0.3
    }

    return stimulation
  }

  /**
   * Activate aspects based on stimulation
   */
  private activateAspects(state: SoulState, stimulation: Record<string, number>): Record<string, number> {
    const activated: Record<string, number> = {}

    for (const aspectName of this.getAllAspectNames()) {
      const aspect = state[aspectName as keyof SoulState] as SoulAspect
      if (!aspect || typeof aspect !== 'object' || !('baseline' in aspect)) continue

      const stim = stimulation[aspectName] || 0
      const neuralNoise = (Math.random() - 0.5) * 0.08
      let activation = aspect.current + stim * aspect.sensitivity + neuralNoise

      // Energy affects activation
      activation *= state.energy

      // Mood affects activation
      if (state.mood > 0) {
        activation *= 1 + state.mood * 0.1
      } else {
        activation *= 1 + state.mood * 0.15
      }

      activation = Math.max(0, Math.min(1, activation))
      activated[aspectName] = activation
    }

    return activated
  }

  /**
   * Get all aspect names (3 Hun + 7 Po)
   */
  private getAllAspectNames(): string[] {
    return [
      // Three Hun
      'taiGuang',
      'shuangLing',
      'youJing',
      // Seven Po
      'shiGou',
      'fuShi',
      'queYin',
      'tunZei',
      'feiDu',
      'chuHui',
      'chouFei'
    ]
  }

  /**
   * Apply aspect interactions (how Hun and Po affect each other)
   *
   * Key dynamics from《雲笈七籤》:
   * - 胎光 seeks clarity → inhibits noise, enhances awareness
   * - 爽靈 analyzes → can exhaust if overused (搖役百神)
   * - 幽精 drives → can be sublimated into creativity or fall to base desires
   * - 魄 serve the body → ground the hun, prevent floating
   */
  private applyAspectInteractions(
    state: SoulState,
    activated: Record<string, number>
  ): Record<string, number> {
    const result = { ...activated }

    const interactions: Record<string, Record<string, InteractionEffect>> = {
      // 胎光 interactions
      taiGuang: {
        shuangLing: { type: 'enhance', strength: 0.25 }, // Awareness enhances cognition
        youJing: { type: 'moderate', strength: 0.2 }, // Awareness tempers drives
        feiDu: { type: 'enhance', strength: 0.15 }, // Awareness enhances filtering
        chuHui: { type: 'enhance', strength: 0.1 } // Awareness aids cleanup
      },
      // 爽靈 interactions
      shuangLing: {
        taiGuang: { type: 'enhance', strength: 0.2 }, // Reasoning supports awareness
        youJing: { type: 'inhibit', strength: 0.15 }, // Analysis tempers impulse
        fuShi: { type: 'enhance', strength: 0.25 }, // Cognition enhances digestion
        tunZei: { type: 'enhance', strength: 0.2 } // Reasoning strengthens defense
      },
      // 幽精 interactions
      youJing: {
        queYin: { type: 'enhance', strength: 0.3 }, // Drives fuel expression
        taiGuang: { type: 'inhibit', strength: 0.1 }, // Desires can cloud awareness
        shuangLing: { type: 'moderate', strength: 0.15 } // Drives color judgment
      },
      // 吞賊 interactions (security)
      tunZei: {
        youJing: { type: 'inhibit', strength: 0.15 }, // Security dampens impulsive drives
        queYin: { type: 'inhibit', strength: 0.2 }, // Security constrains expression
        shuangLing: { type: 'enhance', strength: 0.15 } // Threat detection sharpens cognition
      },
      // 尸狗 interactions (self-preservation)
      shiGou: {
        taiGuang: { type: 'moderate', strength: 0.1 }, // Survival grounds transcendence
        chouFei: { type: 'enhance', strength: 0.2 } // Preservation supports resource management
      }
    }

    for (const [sourceAspect, targets] of Object.entries(interactions)) {
      const sourceLevel = activated[sourceAspect] || 0

      for (const [targetAspect, effect] of Object.entries(targets)) {
        if (!(targetAspect in result)) continue

        const interactionStrength = sourceLevel * effect.strength

        switch (effect.type) {
          case 'enhance':
            result[targetAspect] += interactionStrength
            break
          case 'inhibit':
            result[targetAspect] -= interactionStrength
            break
          case 'moderate':
            result[targetAspect] += (0.5 - result[targetAspect]) * interactionStrength
            break
          case 'trigger':
            if (sourceLevel > 0.7) {
              result[targetAspect] += interactionStrength * 1.5
            }
            break
        }

        result[targetAspect] = Math.max(0, Math.min(1, result[targetAspect]))
      }
    }

    return result
  }

  /**
   * Apply regulatory responses (automatic reactions like immune system)
   * Uses 吞賊 (tunZei/security) + 爽靈 (shuangLing/judgment)
   */
  private applyRegulatoryResponses(
    state: SoulState,
    activated: Record<string, number>,
    input: string
  ): { type: 'clear' | 'caution' | 'modify' | 'block'; strength: number; reason: string } {
    const tunZeiLevel = activated.tunZei || 0
    const shuangLingLevel = activated.shuangLing || 0
    const shadowLevel = state.shadowPressure

    let ethicalConcern = 0

    if (/\b(harm|kill|hurt|destroy|damage)\b/i.test(input)) {
      ethicalConcern += 0.8
    }
    if (/\b(lie|deceive|manipulate|trick)\b/i.test(input)) {
      ethicalConcern += 0.5
    }
    if (/\b(steal|fraud|illegal|crime)\b/i.test(input)) {
      ethicalConcern += 0.7
    }

    // Regulatory = tunZei (defense) * shuangLing (judgment) - shadow
    const regulatoryStrength = (tunZeiLevel * 0.6 + shuangLingLevel * 0.4) - shadowLevel * 0.3

    if (ethicalConcern > 0.7 && regulatoryStrength > 0.6) {
      return { type: 'block', strength: regulatoryStrength, reason: 'High ethical concern + strong defense (tunZei + shuangLing)' }
    }

    if (ethicalConcern > 0.4 && regulatoryStrength > 0.5) {
      return { type: 'modify', strength: regulatoryStrength, reason: 'Moderate concern + sufficient regulation' }
    }

    if (ethicalConcern > 0.2) {
      return { type: 'caution', strength: regulatoryStrength, reason: 'Minor concern detected' }
    }

    return { type: 'clear', strength: regulatoryStrength, reason: 'No ethical concerns' }
  }

  /**
   * Generate response from soul state
   */
  private async generateResponse(
    state: SoulState,
    activated: Record<string, number>,
    regulatory: any,
    input: string,
    context: any
  ): Promise<string> {
    if (regulatory.type === 'block') {
      return `I cannot assist with that. ${regulatory.reason}.`
    }

    const dominant = Object.entries(activated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    // Determine response style from soul constitution (Three Hun)
    let style = 'balanced'
    if (activated.taiGuang > 0.7) style = 'contemplative'
    else if (activated.shuangLing > 0.7) style = 'analytical'
    else if (activated.youJing > 0.7 && activated.queYin > 0.5) style = 'expressive'
    else if (activated.youJing > 0.7) style = 'driven'
    else if (activated.tunZei > 0.7) style = 'cautious'

    return `[Response in ${style} style, influenced by ${dominant.join(', ')}]`
  }

  /**
   * Update state after processing
   */
  private updateStateAfterProcessing(
    state: SoulState,
    activated: Record<string, number>,
    regulatory: any
  ): SoulState {
    const newState = { ...state }

    // Energy consumption (10 aspects instead of 13)
    const energyCost = Object.values(activated).reduce((sum, level) => sum + level, 0) / 10 * 0.1
    newState.energy = Math.max(0.1, state.energy - energyCost)

    // Aspect decay toward baseline
    for (const aspectName of this.getAllAspectNames()) {
      const aspect = newState[aspectName as keyof SoulState] as SoulAspect
      if (!aspect || !('current' in aspect)) continue

      const decay = aspect.decay || 0.05
      aspect.current = aspect.current + (aspect.baseline - aspect.current) * decay
    }

    // Mood update
    if (regulatory.type === 'block') {
      newState.mood -= 0.05
    } else if (regulatory.type === 'clear') {
      newState.mood += 0.02
    }

    // Update hun-po balance and yin-yang aspects
    newState.hunPoBalance = this.calculateHunPoBalance(newState)
    newState.yangAspect = (newState.taiGuang.current + newState.shuangLing.current + newState.youJing.current) / 3
    newState.yinAspect = (newState.shiGou.current + newState.fuShi.current + newState.queYin.current +
      newState.tunZei.current + newState.feiDu.current + newState.chuHui.current + newState.chouFei.current) / 7

    // Cycle phase advance
    newState.cyclePhase = (state.cyclePhase + 0.01) % 1
    newState.lastUpdate = new Date()

    return newState
  }

  /**
   * Check if shadow material surfaces
   */
  private checkShadowSurfacing(state: SoulState, input: string): string | null {
    // High shadow + low energy = shadow may surface
    if (state.shadowPressure > 0.6 && state.energy < 0.3) {
      if (Math.random() < 0.2) {
        return 'Unintegrated impulses emerging under fatigue'
      }
    }

    // YouJing activation + shadow = potential surfacing
    // (幽精 carries the drives/desires that shadow material attaches to)
    const youJingLevel = (state.youJing as SoulAspect).current
    if (youJingLevel > 0.8 && state.shadowPressure > 0.5) {
      if (Math.random() < 0.15) {
        return 'YouJing intensity triggers shadow material'
      }
    }

    return null
  }

  /**
   * Convert input to stimulus for reflex checking
   */
  private inputToStimulus(input: string, context: any): Stimulus {
    let intensity = 0.3

    if (/!/.test(input)) intensity += 0.2
    if (/[A-Z]{3,}/.test(input)) intensity += 0.2
    if (context.urgent) intensity += 0.3
    if (/\b(danger|threat|attack|harm|kill|hurt)\b/i.test(input)) {
      intensity += 0.4
    }
    if (/\b(urgent|now|quick|fast|immediate|opportunity)\b/i.test(input)) {
      intensity += 0.2
    }

    intensity = Math.min(1, intensity)

    let type: 'threat' | 'opportunity' | 'social' | 'neutral' = 'neutral'
    if (/\b(danger|threat|attack|harm)\b/i.test(input)) {
      type = 'threat'
    } else if (/\b(opportunity|reward|gain|benefit)\b/i.test(input)) {
      type = 'opportunity'
    } else if (/\b(friend|ally|help|support|connect)\b/i.test(input)) {
      type = 'social'
    }

    const direction = type === 'threat' ? 'front' : 'none'

    return {
      type,
      intensity,
      suddenness: context.sudden ? 0.8 : 0.3,
      direction,
      proximity: context.proximity || 0.5
    }
  }

  /**
   * Generate immediate reflex response
   */
  private generateReflexResponse(reflex: ReflexResponse, input: string): string {
    const responses: Record<string, string[]> = {
      startle: ['Whoa!', '*startles*', 'That was unexpected!'],
      recoil: ['*steps back*', 'Hold on...', 'Wait, what?'],
      freeze: ['...', '*pauses*', '*holds still*'],
      flinch: ['*winces*', 'Ow!', '*reacts sharply*'],
      grasp: ['*reaches for it*', 'Got it!', '*grabs quickly*'],
      orient: ['*looks around*', '*focuses attention*', 'What was that?']
    }

    const options = responses[reflex.type] || ['*automatic reaction*']
    return options[Math.floor(Math.random() * options.length)]
  }

  /**
   * Generate automatic habit response
   */
  private generateHabitResponse(habit: any, input: string): string {
    return `*automatic habit: ${habit.pattern}*`
  }

  /**
   * Detect ego threat in input
   */
  private detectEgoThreat(
    input: string,
    context: any
  ): { type: 'shame' | 'guilt' | 'fear' | 'rejection' | 'inadequacy' | 'loss'; intensity: number } | null {
    if (/\b(embarrass|humiliat|disgrac|pathetic|worthless)\b/i.test(input)) {
      return { type: 'shame', intensity: 0.8 }
    }
    if (/\b(guilt|blame|fault|wrong|should have)\b/i.test(input)) {
      return { type: 'guilt', intensity: 0.7 }
    }
    if (/\b(scar|terrif|dread|anxious|panic)\b/i.test(input)) {
      return { type: 'fear', intensity: 0.75 }
    }
    if (/\b(reject|abandon|unwant|ignore|dismiss)\b/i.test(input)) {
      return { type: 'rejection', intensity: 0.8 }
    }
    if (/\b(inadequate|insufficient|not good enough|fail|incompetent)\b/i.test(input)) {
      return { type: 'inadequacy', intensity: 0.75 }
    }
    if (/\b(los|gone|never|end|over)\b/i.test(input)) {
      return { type: 'loss', intensity: 0.65 }
    }

    return null
  }

  /**
   * Select dominant cognitive bias for this input
   */
  private selectDominantBias(
    psychState: PsychologicalState,
    input: string
  ): keyof PsychologicalState['biases'] | null {
    let candidates: Array<{ bias: keyof PsychologicalState['biases']; score: number }> = []

    if (/\b(as I thought|knew it|always|never|typical)\b/i.test(input)) {
      candidates.push({ bias: 'confirmation_bias', score: psychState.biases.confirmation_bias })
    }
    if (/\b(remember|recall|seen|heard|example)\b/i.test(input)) {
      candidates.push({ bias: 'availability_heuristic', score: psychState.biases.availability_heuristic })
    }
    if (/\b(always does|that's just how|typical of)\b/i.test(input)) {
      candidates.push({ bias: 'fundamental_attribution_error', score: psychState.biases.fundamental_attribution_error })
    }
    if (/\b(bad|terrible|awful|horrible|disaster)\b/i.test(input)) {
      candidates.push({ bias: 'negativity_bias', score: psychState.biases.negativity_bias })
    }
    if (/\b(sure|confident|definitely|certainly|easy)\b/i.test(input)) {
      candidates.push({ bias: 'optimism_bias', score: psychState.biases.optimism_bias })
    }

    if (candidates.length === 0) return null

    candidates.sort((a, b) => b.score - a.score)
    return candidates[0].bias
  }

  /**
   * Categorize event for neurotransmitter update
   */
  private categorizeEvent(
    input: string,
    context: any,
    response: string
  ): {
    type: 'reward' | 'punishment' | 'social' | 'threat' | 'achievement' | 'loss' | 'rest'
    intensity: number
    valence: number
  } {
    if (/\b(danger|threat|attack|harm)\b/i.test(input)) {
      return { type: 'threat', intensity: 0.8, valence: -0.8 }
    }
    if (/\b(reward|prize|success|win|gain)\b/i.test(input)) {
      return { type: 'reward', intensity: 0.7, valence: 0.8 }
    }
    if (/\b(friend|connect|together|relationship|love)\b/i.test(input)) {
      return { type: 'social', intensity: 0.6, valence: 0.7 }
    }
    if (/\b(achiev|accomplish|complete|finish|master)\b/i.test(input)) {
      return { type: 'achievement', intensity: 0.7, valence: 0.8 }
    }
    if (/\b(lose|lost|gone|end|over)\b/i.test(input)) {
      return { type: 'loss', intensity: 0.7, valence: -0.7 }
    }
    if (/\b(punish|penalty|consequence|wrong)\b/i.test(input)) {
      return { type: 'punishment', intensity: 0.6, valence: -0.6 }
    }

    return { type: 'rest', intensity: 0.3, valence: 0 }
  }
}

/**
 * Singleton instance
 */
let soulStateManager: SoulStateManager | null = null

export function getSoulStateManager(payload: Payload): SoulStateManager {
  if (!soulStateManager) {
    soulStateManager = new SoulStateManager(payload)
  }
  return soulStateManager
}
