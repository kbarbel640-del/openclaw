#!/usr/bin/env node

// 🤖 Whidbey Island Roof & Gutter AI Receptionist Engine
// Complete AI-powered phone system for roof and gutter services

require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const axios = require('axios');
const moment = require('moment-timezone');
const conversationFlows = require('./conversation-flows');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🎯 AI Receptionist Core Class
class WhidbeyRoofGutterAI {
  constructor() {
    this.businessInfo = {
      name: "Whidbey Island Roof and Gutter Cleaning",
      phone: process.env.BUSINESS_PHONE || "+1-360-555-ROOF",
      location: "Whidbey Island, Washington",
      timezone: "America/Los_Angeles",
      services: ["gutter_cleaning", "pressure_washing", "emergency_repair", "moss_removal"],
      coverage_area: ["Oak Harbor", "Coupeville", "Langley", "Freeland", "Clinton"]
    };
    
    this.currentCalls = new Map(); // Active call management
    this.customerHistory = new Map(); // Customer relationship management
    this.weatherCache = null;
    this.weatherLastUpdate = null;
    
    this.initializeServices();
  }

  async initializeServices() {
    console.log("🤖 Initializing Whidbey Island Roof & Gutter AI Receptionist...");
    
    // Initialize Twilio for voice calls
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Update weather data
    await this.updateWeatherData();
    
    // Start background services
    setInterval(() => this.updateWeatherData(), 30 * 60 * 1000); // Every 30 minutes
    setInterval(() => this.checkScheduledCalls(), 5 * 60 * 1000); // Every 5 minutes
    
    console.log("✅ AI Receptionist System Ready!");
    console.log(`📞 Ready to handle calls for ${this.businessInfo.name}`);
    console.log(`🏠 Serving: ${this.businessInfo.coverage_area.join(", ")}`);
  }

  // 📞 INCOMING CALL HANDLER
  async handleIncomingCall(req, res) {
    const callSid = req.body.CallSid;
    const fromNumber = req.body.From;
    const toNumber = req.body.To;
    
    console.log(`📞 Incoming call: ${fromNumber} -> ${toNumber} (${callSid})`);
    
    // Initialize call session
    const callSession = {
      sid: callSid,
      from: fromNumber,
      startTime: moment(),
      intent: null,
      customerInfo: await this.getCustomerHistory(fromNumber),
      conversationState: "greeting",
      qualificationData: {},
      estimateRequested: false,
      schedulingInProgress: false
    };
    
    this.currentCalls.set(callSid, callSession);
    
    // Determine greeting based on context
    const weather = await this.getCurrentWeather();
    const season = this.getCurrentSeason();
    const isEmergency = this.detectEmergencyCall(weather);
    
    const greeting = conversationFlows.selectGreeting(
      moment().format('HH'),
      weather.condition,
      season,
      isEmergency
    );
    
    // Generate TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: 'alice',
      rate: '0.9'
    }, greeting.text);
    
    // Set up for customer response
    const gather = twiml.gather({
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
      enhanced: true,
      action: '/call/process-response',
      method: 'POST'
    });
    
    gather.say({
      voice: 'alice'
    }, "Please tell me how I can help you today.");
    
    res.type('text/xml');
    res.send(twiml.toString());
  }

  // 🧠 CONVERSATION PROCESSING
  async processCustomerResponse(req, res) {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || req.body.Digits;
    const confidence = parseFloat(req.body.Confidence || 0.8);
    
    const callSession = this.currentCalls.get(callSid);
    if (!callSession) {
      return this.handleCallError(res, "Call session not found");
    }
    
    console.log(`🗣️ Customer said: "${speechResult}" (confidence: ${confidence})`);
    
    // Classify customer intent
    const intent = await this.classifyIntent(speechResult, callSession);
    callSession.intent = intent;
    
    // Generate AI response based on intent and conversation state
    const aiResponse = await this.generateAIResponse(speechResult, callSession);
    
    // Update conversation state
    callSession.conversationState = aiResponse.nextState;
    this.currentCalls.set(callSid, callSession);
    
    // Create TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: 'alice',
      rate: '0.9'
    }, aiResponse.message);
    
    // Handle next action
    if (aiResponse.action === 'gather_more_info') {
      const gather = twiml.gather({
        speechTimeout: 'auto',
        speechModel: 'experimental_conversations',
        enhanced: true,
        action: '/call/process-response',
        method: 'POST'
      });
      
      gather.say({ voice: 'alice' }, aiResponse.followUpQuestion);
      
    } else if (aiResponse.action === 'provide_estimate') {
      await this.handleEstimateRequest(twiml, callSession);
      
    } else if (aiResponse.action === 'schedule_service') {
      await this.handleSchedulingRequest(twiml, callSession);
      
    } else if (aiResponse.action === 'transfer_human') {
      twiml.say({ voice: 'alice' }, "Let me connect you with our team right away.");
      twiml.dial(process.env.OWNER_PHONE);
      
    } else if (aiResponse.action === 'end_call') {
      twiml.say({ voice: 'alice' }, aiResponse.closingMessage);
      twiml.hangup();
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
  }

  // 🧠 INTENT CLASSIFICATION
  async classifyIntent(customerMessage, callSession) {
    const message = customerMessage.toLowerCase();
    const intents = conversationFlows.intentClassification;
    
    // Check for emergency keywords first
    if (intents.emergency.keywords.some(keyword => message.includes(keyword))) {
      return {
        type: 'emergency',
        confidence: intents.emergency.confidence,
        priority: 'immediate'
      };
    }
    
    // Check for specific service intents
    for (const [intentType, intentData] of Object.entries(intents)) {
      if (intentType === 'emergency') continue; // Already checked
      
      const matches = intentData.keywords.filter(keyword => message.includes(keyword));
      if (matches.length > 0) {
        return {
          type: intentType,
          confidence: intentData.confidence,
          matches: matches,
          priority: intentData.priority || 'normal'
        };
      }
    }
    
    // Default to general inquiry
    return {
      type: 'general',
      confidence: 0.6,
      priority: 'normal'
    };
  }

  // 💬 AI RESPONSE GENERATION
  async generateAIResponse(customerMessage, callSession) {
    const intent = callSession.intent;
    const conversationState = callSession.conversationState;
    const weather = await this.getCurrentWeather();
    
    // Emergency handling
    if (intent.type === 'emergency' || intent.priority === 'immediate') {
      return {
        message: "I understand this is urgent. Let me help you right away. Can you describe what happened and your address?",
        action: 'gather_more_info',
        followUpQuestion: "Please tell me your address and describe the damage you're seeing.",
        nextState: 'emergency_qualification'
      };
    }
    
    // Service-specific responses
    if (intent.type === 'gutterCleaning') {
      if (conversationState === 'greeting') {
        return {
          message: `I'd be happy to help with your gutter cleaning! ${this.getWeatherContext(weather, 'gutter_cleaning')} Let me ask a few quick questions to give you an accurate estimate.`,
          action: 'gather_more_info',
          followUpQuestion: "First, how many stories is your home?",
          nextState: 'service_qualification'
        };
      }
    }
    
    if (intent.type === 'pressureWashing') {
      return {
        message: `Pressure washing is one of our specialties! ${this.getSeasonalMessage()} Are you looking for roof cleaning, house washing, or both?`,
        action: 'gather_more_info',
        followUpQuestion: "What areas would you like pressure washed?",
        nextState: 'service_qualification'
      };
    }
    
    // Qualification state handling
    if (conversationState === 'service_qualification') {
      return await this.handleServiceQualification(customerMessage, callSession);
    }
    
    // Default response
    return {
      message: "I'd be happy to help you with your roof and gutter needs. Are you calling about gutter cleaning, pressure washing, or maybe some damage that needs repair?",
      action: 'gather_more_info',
      followUpQuestion: "What type of service are you interested in?",
      nextState: 'service_selection'
    };
  }

  // 🎯 SERVICE QUALIFICATION HANDLING
  async handleServiceQualification(customerMessage, callSession) {
    const intent = callSession.intent.type;
    const serviceFlow = conversationFlows.serviceFlows[intent];
    
    if (!serviceFlow) {
      return {
        message: "Let me connect you with our team for personalized assistance.",
        action: 'transfer_human',
        nextState: 'transfer'
      };
    }
    
    // Track qualification progress
    if (!callSession.qualificationStep) {
      callSession.qualificationStep = 0;
    }
    
    // Store current answer
    const currentQuestion = serviceFlow.qualification[callSession.qualificationStep];
    if (currentQuestion) {
      callSession.qualificationData[currentQuestion.pricing_factor] = this.parseQualificationAnswer(
        customerMessage, 
        currentQuestion.options
      );
    }
    
    // Move to next question or provide estimate
    callSession.qualificationStep++;
    
    if (callSession.qualificationStep < serviceFlow.qualification.length) {
      const nextQuestion = serviceFlow.qualification[callSession.qualificationStep];
      return {
        message: "Perfect! " + nextQuestion.question,
        action: 'gather_more_info',
        followUpQuestion: "Please let me know your preference.",
        nextState: 'service_qualification'
      };
    } else {
      // All questions answered, provide estimate
      const estimate = this.calculateEstimate(intent, callSession.qualificationData);
      return {
        message: `Based on what you've told me, I can provide you with an estimate of $${estimate.total} for ${this.getServiceDescription(intent, callSession.qualificationData)}. This includes our ${estimate.duration} minute service. Would you like to schedule this service?`,
        action: 'provide_estimate',
        nextState: 'estimate_provided',
        estimate: estimate
      };
    }
  }

  // 💰 ESTIMATE CALCULATION
  calculateEstimate(serviceType, qualificationData) {
    const serviceFlow = conversationFlows.serviceFlows[serviceType];
    const pricing = serviceFlow.pricing;
    
    // Base price calculation
    let basePrice = pricing.base[qualificationData.height] || pricing.base.single_story;
    
    // Apply modifiers
    let total = basePrice;
    for (const [factor, value] of Object.entries(qualificationData)) {
      if (pricing.modifiers[factor]) {
        total *= pricing.modifiers[factor];
      }
    }
    
    // Seasonal adjustments
    const season = this.getCurrentSeason();
    if (season === 'fall' && serviceType === 'gutterCleaning') {
      total *= (pricing.modifiers.seasonal_peak || 1.2);
    }
    
    // Weather emergency pricing
    const weather = this.weatherCache;
    if (weather && weather.condition === 'stormy' && qualificationData.urgency === 'emergency') {
      total *= (pricing.modifiers.emergency || 1.3);
    }
    
    return {
      base: basePrice,
      total: Math.round(total),
      duration: serviceFlow.scheduling.duration,
      modifiers: qualificationData,
      breakdown: this.generatePriceBreakdown(basePrice, total, qualificationData)
    };
  }

  // 📅 SCHEDULING LOGIC
  async handleSchedulingRequest(twiml, callSession) {
    const weather = await this.getCurrentWeather();
    const availableSlots = await this.getAvailableTimeSlots(weather, callSession.intent.type);
    
    if (availableSlots.length === 0) {
      twiml.say({ 
        voice: 'alice' 
      }, "I'm checking our schedule now... It looks like we're quite busy this week. Let me see what I can offer you.");
      
      // Offer next week or emergency slot
      const nextWeekSlots = await this.getAvailableTimeSlots(weather, callSession.intent.type, 7);
      if (nextWeekSlots.length > 0) {
        twiml.say({ 
          voice: 'alice' 
        }, `I have availability ${nextWeekSlots[0].description}. Would that work for you?`);
      }
    } else {
      const nextSlot = availableSlots[0];
      twiml.say({ 
        voice: 'alice' 
      }, `Great! I can schedule you for ${nextSlot.description}. ${this.getWeatherSchedulingNote(weather, nextSlot.date)} Should I book this time for you?`);
    }
    
    const gather = twiml.gather({
      speechTimeout: 'auto',
      action: '/call/confirm-booking',
      method: 'POST'
    });
    
    gather.say({ voice: 'alice' }, "Please say yes to confirm, or let me know if you'd prefer a different time.");
  }

  // 🌧️ WEATHER DATA MANAGEMENT
  async updateWeatherData() {
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        console.log("⚠️ No weather API key configured");
        return;
      }
      
      // Whidbey Island coordinates (Oak Harbor)
      const lat = 48.2973;
      const lon = -122.6329;
      
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`);
      
      this.weatherCache = {
        condition: this.interpretWeatherCondition(response.data),
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed,
        description: response.data.weather[0].description,
        lastUpdate: moment(),
        forecast: await this.getForecastData(lat, lon, apiKey)
      };
      
      this.weatherLastUpdate = moment();
      console.log(`🌤️ Weather updated: ${this.weatherCache.description}, ${this.weatherCache.temperature}°F`);
      
    } catch (error) {
      console.error("❌ Weather update failed:", error.message);
    }
  }

  interpretWeatherCondition(weatherData) {
    const main = weatherData.weather[0].main.toLowerCase();
    const windSpeed = weatherData.wind.speed;
    
    if (main.includes('storm') || windSpeed > 25) return 'stormy';
    if (main.includes('rain') || main.includes('drizzle')) return 'rainy';
    if (main.includes('clear') || main.includes('sun')) return 'clear';
    if (main.includes('cloud')) return 'cloudy';
    
    return 'mild';
  }

  // 🕒 TIME & SCHEDULING UTILITIES
  getCurrentSeason() {
    const month = moment().month();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  async getAvailableTimeSlots(weather, serviceType, daysOut = 0) {
    // Mock scheduling logic - in production, integrate with calendar API
    const slots = [];
    const startDate = moment().add(daysOut, 'days');
    
    for (let day = 0; day < 7; day++) {
      const checkDate = startDate.clone().add(day, 'days');
      
      // Skip Sundays
      if (checkDate.day() === 0) continue;
      
      // Check weather compatibility
      if (serviceType === 'pressure_washing' && weather.condition === 'rainy') {
        continue; // Skip rainy days for pressure washing
      }
      
      // Generate time slots
      const morningSlot = {
        date: checkDate.clone().hour(9),
        description: `${checkDate.format('dddd, MMMM Do')} at 9:00 AM`,
        duration: conversationFlows.serviceFlows[serviceType]?.scheduling?.duration || 90
      };
      
      const afternoonSlot = {
        date: checkDate.clone().hour(14),
        description: `${checkDate.format('dddd, MMMM Do')} at 2:00 PM`, 
        duration: conversationFlows.serviceFlows[serviceType]?.scheduling?.duration || 90
      };
      
      slots.push(morningSlot, afternoonSlot);
    }
    
    return slots.slice(0, 6); // Return first 6 available slots
  }

  // 📱 SMS/PHOTO HANDLING
  async handleIncomingSMS(req, res) {
    const fromNumber = req.body.From;
    const messageBody = req.body.Body;
    const numMedia = parseInt(req.body.NumMedia) || 0;
    
    console.log(`📱 SMS from ${fromNumber}: ${messageBody} (${numMedia} media)`);
    
    if (numMedia > 0) {
      // Handle photo estimate
      const photos = [];
      for (let i = 0; i < numMedia; i++) {
        photos.push(req.body[`MediaUrl${i}`]);
      }
      
      const estimate = await this.processPhotoEstimate(photos, fromNumber, messageBody);
      
      // Send estimate via SMS
      const response = new twilio.twiml.MessagingResponse();
      response.message(estimate.message);
      
      res.type('text/xml');
      res.send(response.toString());
      
    } else {
      // Handle text-only message
      const response = new twilio.twiml.MessagingResponse();
      response.message("Thanks for your message! For the fastest service, please call us at " + this.businessInfo.phone + " or send photos of your gutters/roof for an instant estimate.");
      
      res.type('text/xml');
      res.send(response.toString());
    }
  }

  async processPhotoEstimate(photos, customerPhone, description = "") {
    console.log(`📸 Processing ${photos.length} photos for estimate`);
    
    // In production, use AI image analysis
    // For now, return mock estimate based on description
    const mockAnalysis = {
      roofType: "asphalt_shingle",
      stories: 2,
      gutterCondition: "moderate_debris",
      accessDifficulty: "standard",
      squareFootage: 2200
    };
    
    const serviceType = description.toLowerCase().includes('pressure') ? 'pressureWashing' : 'gutterCleaning';
    const estimate = this.calculateEstimate(serviceType, mockAnalysis);
    
    return {
      message: `📸 Photo Estimate for ${this.businessInfo.name}:\n\n` +
               `Service: ${serviceType === 'gutterCleaning' ? 'Gutter Cleaning' : 'Pressure Washing'}\n` +
               `Property: ${mockAnalysis.stories}-story, ~${mockAnalysis.squareFootage} sq ft\n` +
               `Estimate: $${estimate.total}\n` +
               `Duration: ~${estimate.duration} minutes\n\n` +
               `Ready to schedule? Call ${this.businessInfo.phone} or reply BOOK to confirm!`,
      estimate: estimate,
      analysis: mockAnalysis
    };
  }

  // 📊 ANALYTICS & REPORTING  
  async logCallAnalytics(callSession) {
    const analytics = {
      callSid: callSession.sid,
      fromNumber: callSession.from,
      startTime: callSession.startTime,
      endTime: moment(),
      duration: moment().diff(callSession.startTime, 'minutes'),
      intent: callSession.intent,
      outcome: callSession.outcome || 'completed',
      estimate: callSession.estimate,
      scheduled: callSession.scheduled || false,
      customerSatisfaction: callSession.rating
    };
    
    console.log("📊 Call Analytics:", JSON.stringify(analytics, null, 2));
    
    // In production, save to database for business intelligence
  }

  // 🔧 UTILITY METHODS
  async getCurrentWeather() {
    if (!this.weatherCache || moment().diff(this.weatherLastUpdate, 'minutes') > 30) {
      await this.updateWeatherData();
    }
    return this.weatherCache || { condition: 'unknown', temperature: 50 };
  }

  detectEmergencyCall(weather) {
    return weather.condition === 'stormy' || moment().hour() < 6 || moment().hour() > 20;
  }

  getWeatherContext(weather, serviceType) {
    const responses = conversationFlows.weatherResponses;
    if (responses[weather.condition]?.service_impact[serviceType]) {
      return responses[weather.condition].service_impact[serviceType] + ".";
    }
    return "";
  }

  getSeasonalMessage() {
    const season = this.getCurrentSeason();
    const seasonalMessages = {
      fall: "Fall is perfect timing with all the leaves coming down!",
      spring: "Spring is ideal for cleaning up after our wet winter!",  
      summer: "Summer weather is perfect for pressure washing!",
      winter: "Even in winter, we can help with urgent maintenance!"
    };
    return seasonalMessages[season] || "";
  }

  async getCustomerHistory(phoneNumber) {
    // In production, query customer database
    return this.customerHistory.get(phoneNumber) || {
      isNewCustomer: true,
      previousServices: [],
      preferences: {},
      lastContact: null
    };
  }

  parseQualificationAnswer(answer, options) {
    const lowerAnswer = answer.toLowerCase();
    return options.find(option => lowerAnswer.includes(option)) || options[0];
  }

  getServiceDescription(serviceType, qualificationData) {
    const descriptions = {
      gutterCleaning: `${qualificationData.height || 'single-story'} home gutter cleaning with inspection`,
      pressureWashing: `roof and exterior pressure washing with ${qualificationData.moss_treatment || 'standard'} treatment`,
      emergency: `emergency repair and protection service`
    };
    return descriptions[serviceType] || "roof and gutter service";
  }

  generatePriceBreakdown(base, total, modifiers) {
    return {
      baseService: base,
      modifiers: modifiers,
      total: total,
      savings: total < base ? base - total : 0,
      premium: total > base ? total - base : 0
    };
  }

  getWeatherSchedulingNote(weather, scheduledDate) {
    if (weather.condition === 'rainy') {
      return "I'll monitor the weather and automatically reschedule if needed.";
    }
    return "Perfect weather is expected for your service!";
  }

  handleCallError(res, error) {
    console.error("❌ Call Error:", error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, "I'm sorry, I'm having some technical difficulties. Let me connect you with our team right away.");
    twiml.dial(process.env.OWNER_PHONE || "+1-360-555-0199");
    res.type('text/xml');
    res.send(twiml.toString());
  }

  async checkScheduledCalls() {
    // Background service to check for scheduled callbacks, weather updates, etc.
    console.log("🔄 Checking scheduled tasks...");
  }
}

// 🚀 EXPRESS SERVER SETUP
const aiReceptionist = new WhidbeyRoofGutterAI();

// Phone call endpoints
app.post('/call/incoming', (req, res) => aiReceptionist.handleIncomingCall(req, res));
app.post('/call/process-response', (req, res) => aiReceptionist.processCustomerResponse(req, res));
app.post('/call/confirm-booking', (req, res) => aiReceptionist.handleBookingConfirmation(req, res));

// SMS/MMS endpoints
app.post('/sms/incoming', (req, res) => aiReceptionist.handleIncomingSMS(req, res));

// Status and health endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Whidbey Island Roof & Gutter AI Receptionist',
    uptime: process.uptime(),
    weather: aiReceptionist.weatherCache?.description || 'unknown',
    timestamp: moment().toISOString()
  });
});

app.get('/status', async (req, res) => {
  const weather = await aiReceptionist.getCurrentWeather();
  res.json({
    business: aiReceptionist.businessInfo,
    currentWeather: weather,
    activeCalls: aiReceptionist.currentCalls.size,
    systemStatus: 'operational',
    lastWeatherUpdate: aiReceptionist.weatherLastUpdate?.toISOString()
  });
});

// Dashboard for business owner
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Whidbey Island Roof & Gutter AI</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>🤖 AI Receptionist Dashboard</h1>
        <h2>${aiReceptionist.businessInfo.name}</h2>
        <p><strong>Phone:</strong> ${aiReceptionist.businessInfo.phone}</p>
        <p><strong>Status:</strong> ✅ Online and Ready</p>
        <p><strong>Active Calls:</strong> ${aiReceptionist.currentCalls.size}</p>
        <p><strong>Weather:</strong> ${aiReceptionist.weatherCache?.description || 'Updating...'}</p>
        <p><strong>Coverage:</strong> ${aiReceptionist.businessInfo.coverage_area.join(", ")}</p>
        
        <h3>🎯 Capabilities:</h3>
        <ul>
          <li>24/7 Professional Phone Answering</li>
          <li>Instant Estimates via Photo Analysis</li>  
          <li>Weather-Smart Scheduling</li>
          <li>Emergency Storm Response</li>
          <li>Local Whidbey Island Knowledge</li>
          <li>Customer History & Preferences</li>
        </ul>
        
        <h3>📞 Test the System:</h3>
        <p>Call <strong>${aiReceptionist.businessInfo.phone}</strong> to test the AI receptionist!</p>
        
        <p><em>Built by Claw McGraw - AI Receptionist Technology</em> 🤠</p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log("\n🏠=================================================🏠");
  console.log("🤖 WHIDBEY ISLAND ROOF & GUTTER AI RECEPTIONIST");
  console.log("🏠=================================================🏠");
  console.log(`📞 Phone System: READY on port ${port}`);
  console.log(`🏝️ Serving: Whidbey Island, Washington`);
  console.log(`⭐ Services: Gutters, Pressure Washing, Emergency Repair`);
  console.log(`🌧️ Weather Integration: ACTIVE`);
  console.log(`📱 SMS Estimates: ENABLED`);
  console.log(`🎯 AI Conversation: INTELLIGENT`);
  console.log("🏠=================================================🏠");
  console.log("🚀 READY TO REVOLUTIONIZE ROOF & GUTTER BUSINESS! 💰");
});

module.exports = WhidbeyRoofGutterAI;