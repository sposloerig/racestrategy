# RedMist Racing Dashboard

A comprehensive real-time racing dashboard that integrates with the [RedMist Timing & Scoring](https://docs.redmist.racing) platform.

![Dashboard Preview](docs/preview.png)

## Features

### 🏎️ Live Timing
- Real-time position updates via SignalR WebSocket connection
- Live timing data with lap times, gaps, and intervals
- Position change indicators (+/- from start)
- Best lap highlighting with fastest overall indicator
- Pit stop tracking and in-pit status
- Class position sorting

### 🚩 Flag Status
- Visual flag indicators (Green, Yellow, Red, White, Checkered, Black, Blue)
- Animated flag displays for caution/red flag conditions
- Session state tracking

### 📊 Session Information
- Time/laps remaining
- Running race time
- Green/Yellow lap counts
- Lead changes counter
- Average race speed

### 📋 Control Log
- Race control decisions
- Penalties and warnings
- Incident reports
- Car-specific filtering

### 🚗 Car Details
- Detailed competitor information
- Lap history with times and positions
- In-car mode subscription
- Driver and team data

## Getting Started

### Prerequisites

- Node.js 18+ 
- RedMist API credentials (Client ID and Client Secret)

### Installation

```bash
# Clone or navigate to the project
cd racing-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. Obtain your API credentials from your RedMist organization settings
2. Enter your Client ID and Client Secret in the login screen
3. Credentials are securely stored in localStorage

## API Integration

This dashboard integrates with the following RedMist APIs:

### REST API (Status API v2)
- `GET /v2/Events/LoadLiveEvents` - Get live events
- `GET /v2/Events/LoadEvent` - Get event details
- `GET /v2/Events/LoadSessions` - Get event sessions
- `GET /v2/Events/GetCurrentSessionState` - Get real-time session state (MessagePack)
- `GET /v2/Events/LoadCarLaps` - Get lap history
- `GET /v2/Events/LoadControlLog` - Get control log
- `GET /v2/Events/LoadCompetitorMetadata` - Get driver/car info

### SignalR Hub
- `wss://api.redmist.racing/status/event-status`
- Real-time session updates
- Car position patches
- Control log updates
- In-car driver mode

### Authentication
- OAuth 2.0 Client Credentials Flow
- Token auto-refresh (tokens expire in 5 minutes)
- Keycloak-based identity provider

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **@microsoft/signalr** - Real-time communication
- **@msgpack/msgpack** - MessagePack deserialization
- **pako** - Gzip decompression
- **lucide-react** - Icons

## Project Structure

```
src/
├── components/          # React components
│   ├── AuthForm.tsx     # Login form
│   ├── CarDetails.tsx   # Car detail panel
│   ├── ControlLog.tsx   # Race control log
│   ├── EventList.tsx    # Event browser
│   ├── FlagDisplay.tsx  # Flag indicators
│   ├── Layout.tsx       # Main layout
│   ├── SessionInfo.tsx  # Session info bar
│   ├── TimingScreen.tsx # Main timing view
│   └── TimingTable.tsx  # Live timing table
├── lib/                 # Core libraries
│   ├── api.ts           # REST API client
│   ├── auth.ts          # OAuth token management
│   └── signalr.ts       # SignalR connection
├── store/               # Zustand stores
│   └── index.ts         # Global state
├── types/               # TypeScript definitions
│   └── redmist.ts       # API types
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck
```

## Documentation

- [RedMist API Documentation](https://docs.redmist.racing)
- [Authentication Guide](https://docs.redmist.racing/articles/authentication.html)
- [SignalR Hubs](https://docs.redmist.racing/articles/signalr-hubs.html)
- [Swagger UI](https://api.redmist.racing/status/swagger)

## License

MIT License - Built for Red Mist Timing & Scoring

## Credits

Powered by [RedMist Timing & Scoring](https://redmist.racing) - Real-time race timing platform by Big Mission Motorsports, LLC.
