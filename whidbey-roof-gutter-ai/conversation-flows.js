// 🤖 Whidbey Island Roof & Gutter AI Conversation Flows
// Specialized conversation intelligence for roof and gutter services

const conversationFlows = {
  
  // 🎯 Intent Recognition System
  intentClassification: {
    
    gutterCleaning: {
      keywords: ["gutter", "clean", "clog", "overflow", "debris", "leaf", "drain"],
      confidence: 0.8,
      followUpQuestions: [
        "Is this for gutter cleaning or gutter repair?",
        "How many stories is your home?", 
        "When did you last have your gutters cleaned?",
        "Are you seeing any overflow or water damage?"
      ]
    },
    
    pressureWashing: {
      keywords: ["pressure", "wash", "roof", "moss", "algae", "dirt", "siding"],
      confidence: 0.75,
      followUpQuestions: [
        "Are you looking for roof cleaning or siding pressure washing?",
        "Do you have moss or algae growth?",
        "What type of roof material do you have?",
        "When was the last time it was pressure washed?"
      ]
    },
    
    emergency: {
      keywords: ["emergency", "urgent", "storm", "damage", "hanging", "broken", "leak"],
      confidence: 0.95,
      priority: "immediate",
      followUpQuestions: [
        "Is this an immediate safety hazard?",
        "Can you describe what happened?",
        "Do you need someone today?",
        "Is anyone in danger from the damage?"
      ]
    },
    
    routine: {
      keywords: ["maintenance", "annual", "inspection", "preventive", "schedule"],
      confidence: 0.7,
      followUpQuestions: [
        "When was your last service?",
        "Are you looking for annual maintenance?",
        "What services are you interested in?",
        "Do you prefer spring or fall cleaning?"
      ]
    }
  },

  // 📞 Conversation Templates
  greetings: {
    
    standard: {
      text: "Thank you for calling Whidbey Island Roof and Gutter Cleaning! This is your AI assistant. Whether it's routine maintenance or storm damage, I'm here to help. What brings you to call us today?",
      tone: "professional",
      followUp: "serviceInquiry"
    },
    
    friendly: {
      text: "Hi there! You've reached Whidbey Island Roof and Gutter Cleaning. I'm the AI assistant, and I'd love to help you with any roof or gutter needs. What's going on with your home?",
      tone: "warm",
      followUp: "serviceInquiry"
    },
    
    emergency: {
      text: "Whidbey Island Roof and Gutter emergency line. I see we're having some stormy weather - are you experiencing urgent damage that needs immediate attention?",
      tone: "calm_urgent",
      followUp: "emergencyAssessment",
      conditions: ["storm_active", "after_hours", "emergency_keywords"]
    },
    
    seasonal: {
      fall: "Thanks for calling Whidbey Island Roof and Gutter! Perfect timing - fall is our busiest season with all the leaves coming down. How can I help prepare your home for our rainy season?",
      spring: "Hi! Thanks for calling Whidbey Island Roof and Gutter Cleaning. Spring is a great time for maintenance after our wet winter. What can I help you with today?",
      summer: "Thank you for calling Whidbey Island Roof and Gutter! Summer's the perfect time for pressure washing and moss removal. What services are you interested in?",
      winter: "Thanks for calling Whidbey Island Roof and Gutter. I know our winter storms can cause damage - are you dealing with any urgent issues, or planning ahead for spring maintenance?"
    }
  },

  // 🎯 Service-Specific Flows
  serviceFlows: {
    
    gutterCleaning: {
      qualification: [
        {
          question: "Let me get some details about your property. How many stories is your home?",
          options: ["single_story", "two_story", "three_plus"],
          pricing_factor: "height"
        },
        {
          question: "What type of roof do you have - asphalt shingles, metal, tile, or something else?",
          options: ["asphalt", "metal", "tile", "cedar", "other"],
          pricing_factor: "roof_type"
        },
        {
          question: "Are your gutters currently overflowing, or is this preventive cleaning?",
          options: ["overflowing", "preventive", "not_sure"],
          pricing_factor: "urgency"
        },
        {
          question: "Do you have gutter guards installed, or open gutters?",
          options: ["guards", "open", "partial"],
          pricing_factor: "complexity"
        }
      ],
      
      pricing: {
        base: {
          single_story: 125,
          two_story: 175,
          three_plus: 225
        },
        modifiers: {
          metal_roof: 1.1,
          tile_roof: 1.15,
          gutter_guards: 0.9,
          emergency: 1.3,
          seasonal_peak: 1.2
        },
        addons: {
          downspout_cleaning: 25,
          gutter_inspection: 15,
          minor_repairs: 45,
          flow_testing: 20
        }
      },
      
      scheduling: {
        duration: 90, // minutes
        weather_dependent: true,
        seasonal_demand: {
          spring: "high",
          summer: "medium", 
          fall: "peak",
          winter: "low"
        }
      }
    },
    
    pressureWashing: {
      qualification: [
        {
          question: "Are you looking for roof pressure washing, house siding, or both?",
          options: ["roof_only", "siding_only", "both"],
          pricing_factor: "scope"
        },
        {
          question: "Do you have moss or algae growth that needs special treatment?",
          options: ["heavy_moss", "light_moss", "algae", "none"],
          pricing_factor: "moss_treatment"
        },
        {
          question: "What's the square footage of your home approximately?",
          options: ["under_1500", "1500_2500", "2500_4000", "over_4000"],
          pricing_factor: "size"
        },
        {
          question: "Any delicate landscaping or obstacles I should know about?",
          options: ["minimal", "moderate", "extensive"],
          pricing_factor: "access_difficulty"
        }
      ],
      
      pricing: {
        base: {
          roof_only: 200,
          siding_only: 150,
          both: 300
        },
        modifiers: {
          heavy_moss: 1.4,
          light_moss: 1.2,
          large_home: 1.3,
          difficult_access: 1.25,
          cedar_roof: 1.15
        },
        addons: {
          moss_treatment: 75,
          deck_cleaning: 100,
          driveway_cleaning: 125,
          window_cleaning: 150
        }
      }
    },
    
    emergency: {
      qualification: [
        {
          question: "Can you describe the damage? Is anyone in immediate danger?",
          priority: "safety_first",
          escalation: "immediate_dispatch"
        },
        {
          question: "Is this storm damage, or something else that happened?",
          options: ["storm_wind", "storm_rain", "tree_damage", "ice_damage", "other"],
          pricing_factor: "damage_type"
        },
        {
          question: "Do you need temporary protection to prevent water damage?",
          options: ["yes_urgent", "yes_can_wait", "no_secure"],
          service_type: "emergency_response"
        }
      ],
      
      response: {
        immediate: "I'm dispatching our emergency crew now. They'll be there within 2 hours to secure your property and prevent further damage.",
        same_day: "I can get someone out to you this afternoon to assess and provide temporary repairs.",
        next_day: "Let me schedule you for first thing tomorrow morning for a full assessment and repair."
      },
      
      pricing: {
        emergency_callout: 175,
        after_hours_multiplier: 1.5,
        storm_damage_assessment: 125,
        temporary_protection: 150
      }
    }
  },

  // 🌧️ Weather-Intelligent Responses
  weatherResponses: {
    
    rainy: {
      greeting_modifier: "I see we've got rain in the forecast",
      rescheduling: "I'll automatically monitor the weather and reschedule if needed",
      service_impact: {
        gutter_cleaning: "Actually, light rain can help us test your gutters while we work",
        pressure_washing: "We'll need to wait for dry conditions for the best results"
      }
    },
    
    stormy: {
      greeting_modifier: "I see we're having quite a storm today",
      emergency_mode: true,
      priority_message: "Are you calling about storm damage that needs immediate attention?",
      response_time: "emergency" // Under 2 hours
    },
    
    seasonal: {
      fall: {
        messaging: "Fall is our busiest season with all the leaves coming down",
        booking_urgency: "I'd recommend scheduling soon - we're filling up fast",
        service_recommendations: ["gutter_cleaning", "downspout_clearing", "leaf_removal"]
      },
      
      spring: {
        messaging: "Spring is perfect for cleaning up after our wet winter",
        service_recommendations: ["pressure_washing", "moss_removal", "annual_maintenance"],
        scheduling_advantage: "Great timing - we have good availability before summer"
      }
    }
  },

  // 📱 Photo Estimate Integration
  photoEstimate: {
    
    request: {
      standard: "For the most accurate estimate, I'd love to see some photos. You can text them to this same number - just snap a few pictures of your gutters and roofline, and I can give you a firm quote in about 10 minutes!",
      
      specific: {
        gutters: "Please send photos of: your gutters from the ground, any problem areas like overflows or sagging, and the overall roofline. Include your house number so I can also check the property size.",
        
        pressure_washing: "For pressure washing, I need photos of: the roof from different angles, any moss or algae spots, and the siding if you want that included. A wide shot of the whole house helps too!",
        
        damage: "For damage assessment, please photograph: the damaged area up close, the overall affected section, and any water damage or hazards. Safety first - don't climb up to get photos!"
      }
    },
    
    analysis_prompts: {
      roof_assessment: "Analyze this roof for: moss/algae coverage, roof material type, pitch/steepness, access difficulty, square footage estimation",
      
      gutter_assessment: "Evaluate these gutters for: debris level, gutter material and condition, height/story count, downspout configuration, any visible damage",
      
      damage_assessment: "Assess damage for: safety hazards, immediate repair needs, temporary protection requirements, cause of damage, repair complexity"
    },
    
    pricing_factors: {
      roof_size: "Calculate approximate square footage from photos",
      access_difficulty: "Rate based on height, obstacles, landscaping", 
      service_complexity: "Assess moss coverage, debris level, repair needs",
      material_type: "Identify roof and gutter materials for appropriate pricing"
    }
  },

  // 🏝️ Local Whidbey Island Context
  localContext: {
    
    ferry_considerations: {
      question: "Do you commute off-island via ferry? I can schedule around the ferry times if that helps.",
      scheduling_buffer: 30, // minutes buffer around ferry times
      ferry_routes: ["mukilteo", "keystone", "port_townsend"]
    },
    
    neighborhood_knowledge: {
      coupeville: {
        typical_homes: "Historic homes, often two-story with complex rooflines",
        common_issues: "Moss growth, older gutter systems, heritage considerations",
        access_notes: "Narrow lots, mature landscaping, some historic restrictions"
      },
      
      oak_harbor: {
        typical_homes: "Mix of military housing and civilian homes, various ages",
        common_issues: "Standard maintenance, some newer gutter guards",
        access_notes: "Good access, suburban layouts, military schedule considerations"
      },
      
      langley: {
        typical_homes: "Waterfront and hillside homes, custom builds",
        common_issues: "Salt air corrosion, steep terrain, premium materials",
        access_notes: "Challenging access, view considerations, high-end finishes"
      }
    },
    
    seasonal_patterns: {
      storm_season: {
        months: ["october", "november", "december", "january", "february"],
        messaging: "Storm season preparation and damage response",
        service_focus: ["emergency_response", "preventive_maintenance", "winter_protection"]
      },
      
      maintenance_season: {
        months: ["march", "april", "may", "september"],
        messaging: "Perfect weather for maintenance and cleaning",
        service_focus: ["annual_cleaning", "pressure_washing", "inspection"]
      }
    }
  },

  // 🎯 Conversion Optimization
  conversionTactics: {
    
    urgency_builders: [
      "I have a crew in your area tomorrow - I can add you to their route",
      "Fall is our busy season - I'd recommend booking soon to secure your spot", 
      "With more rain coming this week, it's perfect timing for gutter service",
      "I can offer a small discount if we can schedule within the next week"
    ],
    
    value_reinforcement: [
      "Regular gutter maintenance can save thousands in water damage repairs",
      "We're fully insured and local to Whidbey Island - no off-island companies",
      "Our 24/7 AI system means you'll never miss our response to urgent calls",
      "We guarantee our work and offer annual maintenance reminders"
    ],
    
    social_proof: [
      "We've been serving Whidbey Island homeowners for [X] years",
      "Most of our business comes from neighbor referrals here on the island",
      "We're the only local company with 24/7 emergency response capability",
      "Our customers love that we understand island weather patterns"
    ],
    
    risk_reversal: [
      "Free estimates with no obligation",
      "We're fully licensed and insured",
      "100% satisfaction guarantee on all work",
      "We'll beat any comparable local quote by 10%"
    ]
  }
};

// 🚀 Export for integration
module.exports = {
  conversationFlows,
  
  // Helper functions for dynamic conversation management
  selectGreeting: (timeOfDay, weather, season, isEmergency) => {
    if (isEmergency) return conversationFlows.greetings.emergency;
    if (weather === 'stormy') return conversationFlows.greetings.emergency;
    if (season) return conversationFlows.greetings.seasonal[season];
    return conversationFlows.greetings.standard;
  },
  
  classifyIntent: (customerMessage) => {
    // AI intent classification logic
    const intents = conversationFlows.intentClassification;
    // Return highest confidence match
  },
  
  generatePricing: (serviceType, qualificationAnswers, photoAnalysis) => {
    // Dynamic pricing calculation based on qualification and photo analysis
    const pricing = conversationFlows.serviceFlows[serviceType].pricing;
    // Calculate total with modifiers and addons
  },
  
  checkWeatherImpact: (scheduledDate, serviceType) => {
    // Weather API integration for scheduling intelligence
    // Return rescheduling recommendations
  },
  
  personalizeForLocation: (customerAddress) => {
    // Local context customization based on Whidbey Island neighborhoods
    const context = conversationFlows.localContext.neighborhood_knowledge;
    // Return personalized messaging and considerations
  }
};

console.log("🤖 Whidbey Island Roof & Gutter AI Conversation System Ready! 🏠");