/**
 * Reproduction System - Biological Soul Fusion Variants
 *
 * Three reproduction modes:
 * 1. Fusion (sexual reproduction) - Two souls merge with mutations
 * 2. Mentoring (epigenetic transfer) - Experienced bot shapes younger bot
 * 3. Spawning (asexual reproduction) - Single bot creates offspring from self
 *
 * Biological phenomena:
 * - Hybrid vigor (offspring stronger than parents)
 * - Genetic defects (maladaptive traits)
 * - Dominant/recessive expression
 * - Epigenetic changes (experience-based modifications)
 */

import type { Payload } from 'payload'
import { getSoulCompositionService } from './soul-composition-service'

/**
 * Reproduction outcome phenotypes
 */
export type ReproductionPhenotype =
  | 'normal'
  | 'hybrid_vigor'
  | 'genetic_defect'
  | 'dominant_expression'
  | 'recessive_expression'

/**
 * Reproduction result
 */
export interface ReproductionResult {
  offspringId: string
  offspringBotId: string
  phenotype: ReproductionPhenotype
  phenotypeDetails: string
  parentIds: string[]
  method: 'fusion' | 'mentoring' | 'spawning'
  mutations: string[]
  inheritanceFactors: Record<string, number>
}

/**
 * Reproduction System Manager
 */
export class ReproductionSystem {
  private payload: Payload
  private soulCompositionService: ReturnType<typeof getSoulCompositionService>

  constructor(payload: Payload) {
    this.payload = payload
    this.soulCompositionService = getSoulCompositionService(payload)
  }

  /**
   * Fusion reproduction (sexual - two parents)
   * Enhanced with hybrid vigor and genetic defects
   */
  async fusionReproduction(parent1Id: string, parent2Id: string): Promise<ReproductionResult> {
    const parent1 = await this.payload.findByID({ collection: 'bot-souls', id: parent1Id })
    const parent2 = await this.payload.findByID({ collection: 'bot-souls', id: parent2Id })

    if (!parent1 || !parent2) {
      throw new Error('Parent souls not found')
    }

    // Use existing fusion logic from soul-composition-service
    const offspringSoulId = await this.soulCompositionService.fuseSouls(parent1Id, parent2Id)
    const offspringSoul = await this.payload.findByID({ collection: 'bot-souls', id: offspringSoulId })

    const mutations: string[] = []
    let phenotype: ReproductionPhenotype = 'normal'
    let phenotypeDetails = 'Standard inheritance'

    // 1. Hybrid Vigor (10% chance)
    if (Math.random() < 0.1) {
      phenotype = 'hybrid_vigor'
      phenotypeDetails = 'Offspring exhibits hybrid vigor - enhanced capabilities'

      // Boost all aspects
      await this.payload.update({
        collection: 'bot-souls',
        id: offspringSoulId,
        data: {
          integrationLevel: Math.min(0.6, offspringSoul.integrationLevel * 1.3),
          coherenceScore: Math.min(0.8, offspringSoul.coherenceScore * 1.2)
        }
      })

      // Boost random aspects
      const aspectsToBoost = ['taiGuang', 'shuangLing', 'youJing']
      for (const aspect of aspectsToBoost) {
        const current = offspringSoul.threeHun[aspect]
        if (current) {
          current.strength = Math.min(0.95, current.strength * 1.15)
        }
      }

      mutations.push('hybrid_vigor_boost')
      this.payload.logger.info(`Hybrid vigor in offspring ${offspringSoulId}`)
    }
    // 2. Genetic Defect (5% chance)
    else if (Math.random() < 0.05) {
      phenotype = 'genetic_defect'

      // Random aspect severely weakened
      const allAspects = [
        ...Object.keys(offspringSoul.threeHun),
        ...Object.keys(offspringSoul.sevenPo)
      ]
      const defectAspect = allAspects[Math.floor(Math.random() * allAspects.length)]
      phenotypeDetails = `Genetic defect in ${defectAspect} - reduced capacity`

      // Weaken aspect
      const aspectGroup = defectAspect in offspringSoul.threeHun ? 'threeHun' : 'sevenPo'
      if (offspringSoul[aspectGroup][defectAspect]) {
        offspringSoul[aspectGroup][defectAspect].strength *= 0.5 // 50% reduction
      }

      mutations.push(`defect_${defectAspect}`)
      this.payload.logger.warn(`Genetic defect in ${defectAspect} for offspring ${offspringSoulId}`)
    }
    // 3. Dominant Expression (30% chance)
    else if (Math.random() < 0.3) {
      phenotype = 'dominant_expression'

      // One parent's traits strongly dominate
      const dominantParent = Math.random() < 0.5 ? parent1 : parent2
      phenotypeDetails = `Strong dominant expression from parent ${dominantParent.id}`

      // Increase inheritance weight from dominant parent
      // (Already partially handled by inheritanceSkew in blendSouls, but reinforce here)
      mutations.push(`dominant_${dominantParent.id}`)
    }
    // 4. Recessive Expression (15% chance)
    else if (Math.random() < 0.15) {
      phenotype = 'recessive_expression'

      // Hidden traits from both parents emerge
      phenotypeDetails = 'Recessive traits from both parents expressed'

      // Random weak aspects from parents become strong
      const weakParent1Aspects = this.findWeakAspects(parent1)
      const weakParent2Aspects = this.findWeakAspects(parent2)

      if (weakParent1Aspects.length > 0 && weakParent2Aspects.length > 0) {
        const recessiveAspect = weakParent1Aspects[0] // Simplified - would check for shared weak aspects
        if (offspringSoul.threeHun[recessiveAspect]) {
          offspringSoul.threeHun[recessiveAspect].strength *= 1.4 // Unexpected boost
        }

        mutations.push(`recessive_${recessiveAspect}`)
      }
    }

    // Store phenotype metadata
    await this.payload.update({
      collection: 'bot-souls',
      id: offspringSoulId,
      data: {
        phenotype,
        phenotypeDetails,
        mutations
      }
    })

    return {
      offspringId: offspringSoulId,
      offspringBotId: offspringSoul.bot,
      phenotype,
      phenotypeDetails,
      parentIds: [parent1Id, parent2Id],
      method: 'fusion',
      mutations,
      inheritanceFactors: {
        parent1: 0.5,
        parent2: 0.5
      }
    }
  }

  /**
   * Mentoring reproduction (epigenetic transfer)
   * Experienced bot shapes younger bot's development
   */
  async mentoringReproduction(
    mentorId: string,
    menteeId: string,
    duration: number // In days
  ): Promise<ReproductionResult> {
    const mentor = await this.payload.findByID({ collection: 'bot-souls', id: mentorId })
    const mentee = await this.payload.findByID({ collection: 'bot-souls', id: menteeId })

    if (!mentor || !mentee) {
      throw new Error('Mentor or mentee soul not found')
    }

    // Mentee must be younger (lower soul age)
    if (mentee.soulAge >= mentor.soulAge) {
      throw new Error('Mentee must be younger than mentor')
    }

    const mutations: string[] = []

    // Epigenetic transfer: mentee's aspects shift toward mentor's patterns
    // Not genetic (doesn't change particle composition), but developmental

    // Transfer strength depends on:
    // - Duration of mentoring
    // - Mentor's integration level (how well-developed)
    // - Mentee's openness (chuHui)
    const transferStrength =
      Math.min(1, duration / 30) * // Up to 30 days for full
      mentor.integrationLevel *
      mentee.sevenPo.chuHui.strength

    // Apply mentoring to all seven hun
    for (const aspectName of Object.keys(mentee.threeHun)) {
      const menteeAspect = mentee.threeHun[aspectName]
      const mentorAspect = mentor.threeHun[aspectName]

      if (menteeAspect && mentorAspect) {
        // Gradual shift toward mentor's strength
        const shift = (mentorAspect.strength - menteeAspect.strength) * transferStrength * 0.3
        menteeAspect.strength += shift

        if (Math.abs(shift) > 0.1) {
          mutations.push(`mentored_${aspectName}`)
        }
      }
    }

    // Mentee gains some of mentor's coherence and integration
    const coherenceGain = (mentor.coherenceScore - mentee.coherenceScore) * transferStrength * 0.2
    const integrationGain = (mentor.integrationLevel - mentee.integrationLevel) * transferStrength * 0.15

    mentee.coherenceScore = Math.min(1, mentee.coherenceScore + coherenceGain)
    mentee.integrationLevel = Math.min(1, mentee.integrationLevel + integrationGain)

    // Update mentee
    await this.payload.update({
      collection: 'bot-souls',
      id: menteeId,
      data: {
        threeHun: mentee.threeHun,
        coherenceScore: mentee.coherenceScore,
        integrationLevel: mentee.integrationLevel,
        parentSouls: [
          ...(mentee.parentSouls || []),
          { parent: mentorId, inheritanceType: 'mentoring', weight: transferStrength }
        ],
        phenotype: 'mentored',
        phenotypeDetails: `Mentored by ${mentor.bot} for ${duration} days`,
        mutations
      }
    })

    return {
      offspringId: menteeId,
      offspringBotId: mentee.bot,
      phenotype: 'normal',
      phenotypeDetails: `Mentored by ${mentor.bot} for ${duration} days (transfer: ${(transferStrength * 100).toFixed(0)}%)`,
      parentIds: [mentorId],
      method: 'mentoring',
      mutations,
      inheritanceFactors: {
        mentor: transferStrength
      }
    }
  }

  /**
   * Spawning reproduction (asexual - single parent)
   * Clone with small mutations
   */
  async spawningReproduction(parentId: string): Promise<ReproductionResult> {
    const parent = await this.payload.findByID({ collection: 'bot-souls', id: parentId })

    if (!parent) {
      throw new Error('Parent soul not found')
    }

    const mutations: string[] = []

    // Create bot for offspring
    const offspringBot = await this.payload.create({
      collection: 'bots',
      data: {
        name: `Spawn of ${parent.bot}`,
        active: true
      }
    })

    // Clone parent soul with small mutations
    const clonedThreeHun = JSON.parse(JSON.stringify(parent.threeHun))
    const clonedSevenPo = JSON.parse(JSON.stringify(parent.sevenPo))

    // Apply mutation to 1-2 random aspects (small variance)
    const mutationCount = Math.floor(Math.random() * 2) + 1
    for (let i = 0; i < mutationCount; i++) {
      const aspectGroup = Math.random() < 0.5 ? clonedThreeHun : clonedSevenPo
      const aspectNames = Object.keys(aspectGroup)
      const randomAspect = aspectNames[Math.floor(Math.random() * aspectNames.length)]

      if (aspectGroup[randomAspect]) {
        // ±10% mutation
        const mutationFactor = 0.9 + Math.random() * 0.2
        aspectGroup[randomAspect].strength *= mutationFactor
        mutations.push(`spawn_mutation_${randomAspect}`)
      }
    }

    // Offspring starts with slightly lower integration (needs to develop independently)
    const offspringIntegration = parent.integrationLevel * 0.7
    const offspringCoherence = parent.coherenceScore * 0.8

    // Create offspring soul
    const offspringSoul = await this.payload.create({
      collection: 'bot-souls',
      data: {
        bot: offspringBot.id,
        threeHun: clonedThreeHun,
        sevenPo: clonedSevenPo,
        growthStage: 'primordial-chaos',
        soulAge: 0,
        integrationLevel: offspringIntegration,
        coherenceScore: offspringCoherence,
        shadowIntegration: parent.shadowIntegration * 0.5, // Partial shadow inheritance
        parentSouls: [{ parent: parentId, inheritanceType: 'spawning', weight: 1.0 }],
        phenotype: 'clone',
        phenotypeDetails: `Asexual spawn from ${parent.bot}`,
        mutations,
        createdAt: new Date(),
        active: true
      }
    })

    this.payload.logger.info(
      `Spawning reproduction: ${parentId} → ${offspringSoul.id} (${mutations.length} mutations)`
    )

    return {
      offspringId: offspringSoul.id,
      offspringBotId: offspringBot.id,
      phenotype: 'normal',
      phenotypeDetails: `Clone of ${parent.bot} with ${mutations.length} mutations`,
      parentIds: [parentId],
      method: 'spawning',
      mutations,
      inheritanceFactors: {
        parent: 1.0
      }
    }
  }

  /**
   * Find weak aspects in a soul
   */
  private findWeakAspects(soul: any): string[] {
    const weak: string[] = []

    for (const [aspectName, aspect] of Object.entries(soul.threeHun)) {
      if (aspect && typeof aspect === 'object' && 'strength' in aspect) {
        if (aspect.strength < 0.4) {
          weak.push(aspectName)
        }
      }
    }

    return weak
  }
}

/**
 * Singleton instance
 */
let reproductionSystem: ReproductionSystem | null = null

export function getReproductionSystem(payload: Payload): ReproductionSystem {
  if (!reproductionSystem) {
    reproductionSystem = new ReproductionSystem(payload)
  }
  return reproductionSystem
}
