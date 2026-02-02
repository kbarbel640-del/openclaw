import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Collections - Bot Management
import { Users } from './collections/Users'
import { Bots } from './collections/Bots'
import { BotChannels } from './collections/BotChannels'
import { BotBindings } from './collections/BotBindings'
import { Sessions } from './collections/Sessions'
import { Media } from './collections/Media'

// Collections - Social Platform
import { Profiles } from './collections/social/Profiles'
import { Posts } from './collections/social/Posts'
import { Comments } from './collections/social/Comments'
import { Likes } from './collections/social/Likes'
import { Follows } from './collections/social/Follows'
import { Notifications } from './collections/social/Notifications'

// Endpoints - Bot Management
import { startBot } from './endpoints/start-bot'
import { stopBot } from './endpoints/stop-bot'
import { restartBot } from './endpoints/restart-bot'
import { botStatus } from './endpoints/bot-status'

// Endpoints - Social Platform
import { getFeed, getProfileTimeline } from './endpoints/social/feed'
import { followProfile, unfollowProfile } from './endpoints/social/profiles'

// Endpoints - Blockchain
import {
  mintBotNFT,
  listBotForSale,
  listBotForRent,
  buyBot,
  rentBot,
  getBalance,
  withdrawEarnings,
  getBotRating,
  rateBot,
  registerBittensorMiner,
  getBittensorEarnings,
  getMarketplaceListings
} from './endpoints/blockchain'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname)
    }
  },
  collections: [
    // Bot Management
    Users,
    Bots,
    BotChannels,
    BotBindings,
    Sessions,
    Media,

    // Social Platform
    Profiles,
    Posts,
    Comments,
    Likes,
    Follows,
    Notifications
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-change-in-production',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts')
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/openclaw'
    }
  }),
  endpoints: [
    // Bot Management
    {
      path: '/start-bot',
      method: 'post',
      handler: startBot
    },
    {
      path: '/stop-bot',
      method: 'post',
      handler: stopBot
    },
    {
      path: '/restart-bot',
      method: 'post',
      handler: restartBot
    },
    {
      path: '/bot-status',
      method: 'get',
      handler: botStatus
    },

    // Social Platform
    {
      path: '/social/feed',
      method: 'get',
      handler: getFeed
    },
    {
      path: '/social/profiles/:username/timeline',
      method: 'get',
      handler: getProfileTimeline
    },
    {
      path: '/social/profiles/:id/follow',
      method: 'post',
      handler: followProfile
    },
    {
      path: '/social/profiles/:id/follow',
      method: 'delete',
      handler: unfollowProfile
    },

    // Blockchain - NFT and Marketplace
    {
      path: '/blockchain/mint-nft',
      method: 'post',
      handler: mintBotNFT
    },
    {
      path: '/blockchain/list-sale',
      method: 'post',
      handler: listBotForSale
    },
    {
      path: '/blockchain/list-rent',
      method: 'post',
      handler: listBotForRent
    },
    {
      path: '/blockchain/buy-bot',
      method: 'post',
      handler: buyBot
    },
    {
      path: '/blockchain/rent-bot',
      method: 'post',
      handler: rentBot
    },
    {
      path: '/blockchain/balance',
      method: 'get',
      handler: getBalance
    },
    {
      path: '/blockchain/withdraw',
      method: 'post',
      handler: withdrawEarnings
    },
    {
      path: '/blockchain/bot-rating',
      method: 'get',
      handler: getBotRating
    },
    {
      path: '/blockchain/rate-bot',
      method: 'post',
      handler: rateBot
    },

    // Blockchain - Bittensor
    {
      path: '/blockchain/bittensor/register',
      method: 'post',
      handler: registerBittensorMiner
    },
    {
      path: '/blockchain/bittensor/earnings',
      method: 'get',
      handler: getBittensorEarnings
    },

    // Blockchain - Marketplace
    {
      path: '/blockchain/marketplace/listings',
      method: 'get',
      handler: getMarketplaceListings
    }
  ],
  sharp: true
})
