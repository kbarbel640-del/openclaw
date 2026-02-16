# Ring-Based OSINT Architecture

## Target Markets

| Segment | Use Cases | Compliance Requirements |
|---------|-----------|------------------------|
| **Individuals** | Personal breach monitoring, digital life map | Self-consent only |
| **Businesses** | Employee vetting, vendor risk, fraud investigation | FCRA (if hiring), consent frameworks |
| **Government** | Background checks, security clearances | FCRA, agency-specific regs |
| **Law Enforcement** | Criminal investigations, fugitive tracking, asset tracing | Warrants, court orders, agency policies |
| **Legal/PI** | Litigation support, skip tracing, asset discovery | State licensing, FCRA if applicable |

---

## The Ring Model

```
                           ┌─────────────────────────────────────┐
                           │           RING 2                    │
                           │    Services & Extended Network      │
                           │                                     │
                           │  • Doctors, Lawyers, Accountants    │
                           │  • Colleagues & Employers           │
                           │  • Schools & Classmates             │
                           │  • Service Providers                │
                           │  • Online Communities               │
                           │                                     │
                     ┌─────┴─────────────────────────────────────┴─────┐
                     │                  RING 1                         │
                     │           Close Family & Friends                │
                     │                                                 │
                     │  • Spouse/Partner (current & ex)                │
                     │  • Children, Parents, Siblings                  │
                     │  • Close Friends (high communication freq)      │
                     │  • Roommates / Cohabitants                      │
                     │  • Known Associates (criminal or otherwise)     │
                     │                                                 │
               ┌─────┴─────────────────────────────────────────────────┴─────┐
               │                         RING 0                              │
               │                    TARGET SUBJECT                           │
               │                                                             │
               │  IDENTITY CORE                                              │
               │  • Full legal name, aliases, maiden names                   │
               │  • DOB, SSN (hashed), DL#                                   │
               │  • Photos, biometrics (if available)                        │
               │                                                             │
               │  LOCATION HISTORY                                           │
               │  • Current & historical addresses                           │
               │  • Property records, rental history                         │
               │  • Location data (ad networks, cell triangulation)          │
               │  • Travel patterns, frequent locations                      │
               │                                                             │
               │  EMPLOYMENT & FINANCIAL                                     │
               │  • Work history, employers, roles                           │
               │  • Business registrations, corporate filings                │
               │  • Credit history (with consent/legal basis)                │
               │  • Bankruptcies, liens, judgments                           │
               │                                                             │
               │  CRIMINAL & LEGAL                                           │
               │  • Criminal records (federal, state, county)                │
               │  • Sex offender registries                                  │
               │  • Court records, civil litigation                          │
               │  • Warrants, arrests                                        │
               │                                                             │
               │  DIGITAL FOOTPRINT                                          │
               │  • Email addresses, phone numbers                           │
               │  • Social media profiles (all platforms)                    │
               │  • Posts, comments, likes, shares                           │
               │  • Photos, videos (posted & tagged)                         │
               │  • Usernames, handles, aliases                              │
               │  • Domain registrations                                     │
               │  • Breach exposures                                         │
               │                                                             │
               │  BEHAVIORAL DATA                                            │
               │  • Browsing history (via data broker purchase)              │
               │  • Ad profile data (interests, demographics)                │
               │  • App usage patterns                                       │
               │  • Purchase history (where available)                       │
               │  • Location patterns (home, work, gym, etc.)                │
               │                                                             │
               └─────────────────────────────────────────────────────────────┘
```

---

## Ring 0: Target Subject (Deep Profile)

### Identity Core
| Data Point | Sources | Notes |
|------------|---------|-------|
| Legal name | Public records, voter registration, DMV | Canonical identity |
| Aliases | Social media, court records, breach data | Name variations, nicknames |
| DOB | Public records, social media, breaches | Often partially exposed |
| SSN (last 4 or hash) | Credit headers, breach data | Never store plaintext |
| Photos | Social media, mugshots, LinkedIn | For facial recognition |
| Biometrics | LE databases only | Fingerprints, DNA if available |

### Location History
| Data Point | Sources | Notes |
|------------|---------|-------|
| Current address | USPS, utility records, voter reg | Most recent confirmed |
| Historical addresses | Credit headers, public records | Full timeline |
| Property ownership | County assessor, deed records | Owned real estate |
| Rental history | Eviction records, tenant screening | If available |
| Location data | Data brokers (Gravy, Mobilewalla, etc.) | GPS/cell pings |
| Travel patterns | Flight records, hotel loyalty, social | Where they go |
| Frequent locations | Location aggregation | Home, work, gym, etc. |

### Employment & Financial
| Data Point | Sources | Notes |
|------------|---------|-------|
| Current employer | LinkedIn, corporate filings, credit app | Verified |
| Work history | LinkedIn, resume databases, references | Timeline |
| Business registrations | Secretary of State, UCC filings | Companies owned |
| Professional licenses | State licensing boards | Doctors, lawyers, RE |
| Credit history | Credit bureaus (permissible purpose) | FCRA regulated |
| Bankruptcies | PACER, court records | Federal filings |
| Liens & judgments | County records, credit | Debts, legal actions |
| Assets | Property, vehicle, boat registrations | What they own |

### Criminal & Legal
| Data Point | Sources | Notes |
|------------|---------|-------|
| Criminal records | State repositories, county courts | Convictions, charges |
| Federal cases | PACER | Federal crimes |
| Sex offender status | State registries, NSOPW | Public record |
| Warrants | LE databases (restricted) | Active warrants |
| Civil litigation | Court records | Lawsuits, divorces |
| Restraining orders | Court records | Domestic, harassment |

### Digital Footprint
| Data Point | Sources | Notes |
|------------|---------|-------|
| Email addresses | Breach data, OSINT, public records | All known emails |
| Phone numbers | Public records, data brokers, social | Current & historical |
| Social media | Platform APIs, scraping, manual | All platforms |
| Posts & content | Social media archives | What they say |
| Photos & videos | Social media, image search | Reverse image search |
| Usernames | Breach data, username enumeration | Cross-platform |
| Domains | WHOIS, DNS history | Websites owned |
| Breach exposures | HIBP, DeHashed, etc. | Credential leaks |

### Behavioral Data
| Data Point | Sources | Notes |
|------------|---------|-------|
| Browsing history | Data brokers (purchase) | Site visits, interests |
| Ad profile | Data brokers | Demographics, interests |
| App usage | Data brokers | Apps installed/used |
| Purchase history | Data brokers, loyalty programs | Buying patterns |
| Location patterns | Data brokers | Daily routines |

---

## Ring 1: Close Family & Friends

### Relationship Types & Weights
```
RELATIONSHIP WEIGHT CALCULATION

Base Weight (relationship type):
├── Spouse/Partner (current): 1.0
├── Spouse/Partner (ex): 0.7
├── Child: 0.95
├── Parent: 0.9
├── Sibling: 0.85
├── Grandparent/Grandchild: 0.6
├── Aunt/Uncle: 0.5
├── Cousin: 0.4
├── Close Friend: 0.7
├── Roommate/Cohabitant: 0.8
├── Known Associate: 0.6
└── Criminal Associate: 0.9 (high relevance for LE)

Proximity Multipliers:
├── Same address: 1.5x
├── Same city: 1.2x
├── Same state: 1.0x
├── Different state: 0.8x
└── Different country: 0.6x

Communication Frequency (if available):
├── Daily contact: 1.5x
├── Weekly contact: 1.2x
├── Monthly contact: 1.0x
├── Rare contact: 0.7x
└── No known contact: 0.5x

FINAL WEIGHT = Base × Proximity × Frequency

Example:
- Sibling (0.85) × Same city (1.2) × Weekly (1.2) = 1.22
- Ex-spouse (0.7) × Different state (0.8) × Rare (0.7) = 0.39
```

### Ring 1 Data Collection
For each Ring 1 person, collect:
- Full Ring 0 profile (abbreviated based on relevance)
- Relationship evidence (how do we know they're connected?)
- Communication patterns (if available from social, phone records)
- Shared addresses/vehicles/accounts
- Criminal associations or shared legal issues
- Financial connections (joint accounts, business partnerships)

### Surfaces
Ring 1 analysis surfaces:
- **Hidden aliases**: Target uses family member's name/address
- **Criminal associations**: Family members with records
- **Asset hiding**: Property in family member's name
- **Communication channels**: Who they talk to most
- **Safe houses**: Where they might flee to

---

## Ring 2: Services & Extended Network

### Categories

#### Professional Services
| Type | Why It Matters | Sources |
|------|----------------|---------|
| Lawyers | Legal issues, asset protection | Bar associations, court filings |
| Doctors | Location, health issues (limited) | NPI registry, insurance claims |
| Accountants | Financial planning, tax issues | CPA registries, business filings |
| Financial advisors | Asset management | FINRA BrokerCheck, SEC |
| Real estate agents | Property transactions | MLS, deed records |

#### Employers & Colleagues
| Type | Why It Matters | Sources |
|------|----------------|---------|
| Current employer | Daily location, income | LinkedIn, corporate records |
| Past employers | History, references | LinkedIn, resumes |
| Colleagues | Network, witnesses | LinkedIn, org charts |
| Business partners | Financial interests | Corporate filings |
| Subordinates | Potential leverage | Org charts, LinkedIn |

#### Education
| Type | Why It Matters | Sources |
|------|----------------|---------|
| Schools attended | Background, timeline | Yearbooks, alumni directories |
| Classmates | Network, witnesses | Facebook, alumni groups |
| Teachers/professors | References | School directories |
| Fraternities/clubs | Associations | Social media, org records |

#### Services & Vendors
| Type | Why It Matters | Sources |
|------|----------------|---------|
| Gym membership | Location patterns | Check-in data if available |
| Country clubs | Social circles | Membership directories |
| Religious organizations | Community ties | Directories, social |
| Hobby groups | Interests, contacts | Meetup, Facebook groups |
| Online communities | Interests, aliases | Forums, Discord, Reddit |

---

## Relationship Mapping & Graph Structure

### Graph Schema for Rings

```cypher
// Core nodes
(:Subject {
  ring: 0,
  id: UUID,
  canonical_name: String,
  confidence_score: Float
})

(:Person {
  ring: 1 | 2,
  id: UUID,
  canonical_name: String,
  relationship_to_subject: String,
  relationship_weight: Float
})

(:Organization {
  type: "employer" | "school" | "service" | "club",
  name: String,
  industry: String
})

// Relationships with evidence
(Subject)-[:RELATED_TO {
  type: "spouse" | "child" | "friend" | ...,
  weight: Float,
  evidence: [String],  // How we know this
  first_seen: DateTime,
  last_seen: DateTime,
  status: "current" | "historical"
}]->(Person)

(Person)-[:WORKS_AT {from, to, role}]->(Organization)
(Person)-[:ATTENDED {from, to, degree}]->(Organization)
(Person)-[:USES_SERVICE]->(Organization)

// Cross-ring connections (critical for investigations)
(Person:Ring1)-[:KNOWS]->(Person:Ring2)
(Person:Ring1)-[:CRIMINAL_ASSOCIATE_OF]->(Person:Ring1)
```

### Investigation Queries

**Find hidden aliases through family:**
```cypher
MATCH (s:Subject)-[:RELATED_TO]->(family:Person)
MATCH (family)-[:LIVES_AT]->(addr:Address)
MATCH (unknown:Person)-[:LIVES_AT]->(addr)
WHERE unknown <> s AND unknown <> family
RETURN unknown, family, addr
// Surfaces: Who else lives at family addresses?
```

**Criminal association network:**
```cypher
MATCH (s:Subject)-[:RELATED_TO*1..2]-(person:Person)
MATCH (person)-[:ARRESTED_FOR|CONVICTED_OF]->(crime:Crime)
RETURN person, crime,
       length(shortestPath((s)-[:RELATED_TO*]-(person))) as distance
ORDER BY distance
// Surfaces: All criminal records within 2 degrees
```

**Location pattern overlap:**
```cypher
MATCH (s:Subject)-[:FREQUENTS]->(loc:Location)
MATCH (person:Person)-[:FREQUENTS]->(loc)
WHERE person.ring IN [1,2]
RETURN person, loc, count(*) as overlap_count
ORDER BY overlap_count DESC
// Surfaces: Who does subject spend time with?
```

---

## Data Sources by Category

### Public Records
| Source | Data | Access |
|--------|------|--------|
| County assessors | Property ownership | Public, varies by county |
| Secretary of State | Business registrations | Public |
| PACER | Federal court records | Pay per page |
| State court systems | State/county cases | Varies by state |
| Voter registration | Name, address, DOB, party | Public in most states |
| DMV records | License, vehicles | Restricted (DPPA) |

### Data Brokers & Aggregators
| Source | Data | Access |
|--------|------|--------|
| LexisNexis | Comprehensive PII | Subscription, permissible purpose |
| Thomson Reuters CLEAR | LE-focused | LE/licensed PI only |
| TLO/TransUnion | Skip tracing, PII | Licensed users |
| Spokeo, BeenVerified | Consumer OSINT | Subscription |
| Gravy Analytics | Location data | Purchase |
| Mobilewalla | Location + demographics | Purchase |
| Oracle Data Cloud | Ad data, interests | Purchase |

### Social & Digital
| Source | Data | Access |
|--------|------|--------|
| Facebook/Meta | Profiles, posts, friends | API (limited), scraping |
| LinkedIn | Professional network | API, scraping |
| Twitter/X | Posts, followers | API |
| Instagram | Photos, stories | API (limited) |
| TikTok | Videos, profile | API, scraping |
| Reddit | Posts, comments | API |
| Username enumeration | Cross-platform presence | OSINT tools |

### Breach & Dark Web
| Source | Data | Access |
|--------|------|--------|
| HIBP | Breach presence | API |
| DeHashed | Full records | Subscription |
| IntelX | Dark web, pastes | Subscription |
| Dark web monitoring | Active listings | Custom crawling |

---

## Report Output Structure

### Executive Summary
```
SUBJECT: John Michael Smith
DOB: 03/15/1985
REPORT DATE: 2024-12-12
INVESTIGATION TYPE: Comprehensive Background (Rings 0-2)
AUTHORIZATION: [Client/Case #]

RISK SUMMARY:
┌─────────────────────────────────────────────────────────────────┐
│ OVERALL RISK SCORE: 72/100 (ELEVATED)                          │
├─────────────────────────────────────────────────────────────────┤
│ Criminal History:     ██████████░░░░░░░░░░  HIGH               │
│ Financial Risk:       ████████░░░░░░░░░░░░  MODERATE           │
│ Association Risk:     ████████████░░░░░░░░  HIGH               │
│ Digital Exposure:     ██████░░░░░░░░░░░░░░  MODERATE           │
│ Location Stability:   ████░░░░░░░░░░░░░░░░  LOW                │
└─────────────────────────────────────────────────────────────────┘

KEY FINDINGS:
• Subject has 2019 felony conviction for fraud (Ring 0)
• Brother (Ring 1) has active warrant in Nevada
• Former business partner (Ring 2) indicted for money laundering
• 14 addresses in past 5 years (high mobility)
• Extensive breach exposure (47 breaches, 12 passwords)
```

### Ring 0 Detail Section
- Complete identity information
- Full address timeline with map
- Employment history with verification status
- Criminal record detail
- Financial summary (liens, bankruptcies, judgments)
- Digital footprint map
- Breach exposure analysis

### Ring 1 Network Map
```
                    ┌─────────────┐
                    │   SUBJECT   │
                    │ John Smith  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
   │  WIFE   │        │ BROTHER │        │  SON    │
   │  Sarah  │        │  Mike   │        │  Tyler  │
   │ w: 1.0  │        │ w: 0.85 │        │ w: 0.95 │
   │ ⚠️ CLEAN │        │ 🚨 WARRANT│        │ ⚠️ CLEAN │
   └─────────┘        └─────────┘        └─────────┘
        │
   ┌────┴────┐
   │EX-HUSB  │
   │  Tom    │
   │ w: 0.4  │
   │ ⚠️ DUI x2│
   └─────────┘
```

### Ring 2 Services & Network
- Employer detail and colleagues
- Professional services (lawyers, accountants)
- Educational background
- Community affiliations
- Online communities and forums

---

## Access Control & Compliance

### Tiered Access Model
```
TIER 1: INDIVIDUAL (Self-Consent)
├── Ring 0: Own data only
├── Ring 1: Not available
└── Ring 2: Not available

TIER 2: BUSINESS (Employment/Vendor Screening)
├── Ring 0: Limited (FCRA compliant)
├── Ring 1: Family disclosed by subject
└── Ring 2: Professional references only

TIER 3: LEGAL/PI (Licensed Investigators)
├── Ring 0: Full public records
├── Ring 1: Public records on family
└── Ring 2: Full network mapping

TIER 4: LAW ENFORCEMENT (With Legal Authority)
├── Ring 0: Full access including restricted DBs
├── Ring 1: Full access including criminal intel
└── Ring 2: Full access including subpoena power
```

### Compliance Requirements
| Regulation | Applies To | Requirements |
|------------|------------|--------------|
| FCRA | Employment, credit decisions | Consent, adverse action notices |
| DPPA | Driver records | Permissible purpose |
| GLBA | Financial data | Security, consent |
| CCPA/CPRA | California residents | Disclosure, opt-out |
| State PI laws | Investigators | Licensing, reporting |

---

## Implementation Agents

### Agent 001: Breach Scanner (Individual focus)
*Already documented - personal digital life mapping*

### Agent 002: Identity Aggregator (Ring 0)
*Comprehensive subject profiling*

### Agent 003: Relationship Mapper (Ring 1)
*Family and close associate discovery*

### Agent 004: Network Analyzer (Ring 2)
*Extended network and services*

### Agent 005: Location Intelligence
*Address history, movement patterns, frequent locations*

### Agent 006: Criminal Records Searcher
*Court records, warrants, registries*

### Agent 007: Financial Investigator
*Assets, liens, bankruptcies, business interests*

### Agent 008: Social Media Analyst
*Profile discovery, content analysis, sentiment*

### Agent 009: Dark Web Monitor
*Active threats, leaked data, criminal marketplace*

---

## Next Steps

1. **Define data source integrations** - API access, costs, legal requirements
2. **Design relationship weighting algorithm** - ML model for connection strength
3. **Build Ring 0 MVP** - Start with public records + breach data
4. **Compliance framework** - FCRA, DPPA, state requirements
5. **Access control system** - Tiered permissions based on user type

---

*Document created: 2024-12-12*
*Status: Architecture Design*
