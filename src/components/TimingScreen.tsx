// Main Timing Screen - Live race dashboard

import { useEffect, useState } from 'react';
import { useEventsStore, useSessionStore, useUIStore } from '../store';
import { TimingTable } from './TimingTable';
import { FlagDisplay } from './FlagDisplay';
import { SessionInfo } from './SessionInfo';
import { ControlLog } from './ControlLog';
import { CarDetails } from './CarDetails';
import { StrategyPanel } from './StrategyPanel';
import { CarStrategyDashboard } from './CarStrategyDashboard';
import { CriticalAlertModal } from './CriticalAlertModal';
import { RaceReplay } from './RaceReplay';
import { 
  ArrowLeft, 
  Radio, 
  List, 
  FileText, 
  Car,
  Target,
  Maximize2,
  Settings,
  ChevronDown,
  Rewind,
} from 'lucide-react';

interface TimingScreenProps {
  eventId: number;
  onBack: () => void;
}

export function TimingScreen({ eventId, onBack }: TimingScreenProps) {
  const { selectedEvent, selectEvent, sessions, isLoading: eventLoading } = useEventsStore();
  const { 
    sessionState, 
    carPositions, 
    controlLog,
    selectedCar,
    isConnected,
    connectionState,
    error,
    selectedSessionId,
    connectToLive,
    disconnect,
    selectCar,
    clearSelectedCar,
    fetchSpecificSession,
  } = useSessionStore();
  const { viewMode, setViewMode, myCar } = useUIStore();
  const [, setIsFullscreen] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [showStrategyDashboard, setShowStrategyDashboard] = useState(false);
  const [strategyCarNumber, setStrategyCarNumber] = useState<string | null>(null);
  const [showRaceReplay, setShowRaceReplay] = useState(false);

  // Handler to open the strategy dashboard
  const handleOpenStrategyDashboard = (carNumber: string) => {
    setStrategyCarNumber(carNumber);
    setShowStrategyDashboard(true);
  };

  // Handler to open race replay
  const handleOpenRaceReplay = () => {
    setShowRaceReplay(true);
  };

  // Handler to close race replay
  const handleCloseRaceReplay = () => {
    setShowRaceReplay(false);
  };

  // Handler to close the strategy dashboard
  const handleCloseStrategyDashboard = () => {
    setShowStrategyDashboard(false);
    setStrategyCarNumber(null);
  };

  // Load event and connect to live data
  useEffect(() => {
    selectEvent(eventId);
    connectToLive(eventId);

    return () => {
      disconnect();
    };
  }, [eventId, selectEvent, connectToLive, disconnect]);

  const handleCarSelect = (carNumber: string) => {
    if (selectedCar === carNumber) {
      clearSelectedCar();
    } else {
      selectCar(eventId, carNumber);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (eventLoading && !selectedEvent) {
    return (
      <div className="empty-state" style={{ height: '50vh' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
        <p style={{ marginTop: '1rem' }}>Loading event...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={18} />
            Events
          </button>
          
          {selectedEvent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
                {selectedEvent.n}
              </h2>
              {selectedEvent.il && (
                <span className="badge badge-live">LIVE</span>
              )}
            </div>
          )}

          {/* Session selector dropdown */}
          {sessions.length > 1 && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {sessions.find(s => s.sid === selectedSessionId)?.n || 'Select Session'}
                <ChevronDown size={16} />
              </button>
              {showSessionDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.25rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    minWidth: '250px',
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  {sessions.map((session) => (
                    <button
                      key={session.sid}
                      onClick={() => {
                        fetchSpecificSession(eventId, session.sid);
                        setShowSessionDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: session.sid === selectedSessionId ? 'var(--bg-secondary)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ fontWeight: session.sid === selectedSessionId ? 600 : 400 }}>
                        {session.n || `Session ${session.sid}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {session.il ? '🟢 Live' : session.et ? '✓ Completed' : '⏳ Scheduled'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* View mode tabs */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            background: 'var(--bg-tertiary)',
            padding: '0.25rem',
            borderRadius: '8px',
          }}
        >
          <ViewTab 
            icon={<List size={16} />} 
            label="Timing" 
            active={viewMode === 'timing'}
            onClick={() => setViewMode('timing')}
          />
          <ViewTab 
            icon={<Target size={16} />} 
            label="Strategy" 
            active={viewMode === 'strategy'}
            onClick={() => setViewMode('strategy')}
          />
          <ViewTab 
            icon={<FileText size={16} />} 
            label="Control Log" 
            active={viewMode === 'control-log'}
            onClick={() => setViewMode('control-log')}
          />
          <ViewTab 
            icon={<Car size={16} />} 
            label="In-Car" 
            active={viewMode === 'in-car'}
            onClick={() => setViewMode('in-car')}
          />
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={toggleFullscreen} title="Toggle Fullscreen">
            <Maximize2 size={18} />
          </button>
          <button className="btn btn-ghost" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255, 59, 59, 0.1)',
            borderBottom: '1px solid rgba(255, 59, 59, 0.3)',
            color: 'var(--accent-red)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Primary panel */}
        <div 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Session info bar */}
          {sessionState && (
            <SessionInfo session={sessionState} />
          )}

          {/* Flag display */}
          {sessionState && (
            <FlagDisplay flag={sessionState.currentFlag} />
          )}

          {/* Main view content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {viewMode === 'timing' && (
              <TimingTable 
                cars={carPositions}
                sessionState={sessionState}
                selectedCar={selectedCar}
                onCarSelect={handleCarSelect}
              />
            )}
            {viewMode === 'strategy' && (
              showRaceReplay && selectedSessionId ? (
                <RaceReplay
                  eventId={eventId}
                  sessionId={selectedSessionId}
                  onClose={handleCloseRaceReplay}
                />
              ) : showStrategyDashboard && strategyCarNumber ? (
                <CarStrategyDashboard 
                  eventId={eventId}
                  carNumber={strategyCarNumber}
                  onBack={handleCloseStrategyDashboard}
                />
              ) : (
                <div style={{ display: 'flex', height: '100%' }}>
                  {/* Strategy panel on left */}
                  <div style={{ width: '400px', borderRight: '1px solid var(--border-color)', overflow: 'auto' }}>
                    <StrategyPanel 
                      eventId={eventId} 
                      onOpenStrategyDashboard={handleOpenStrategyDashboard}
                      onOpenRaceReplay={handleOpenRaceReplay}
                    />
                  </div>
                  {/* Timing table on right */}
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <TimingTable 
                      cars={carPositions}
                      sessionState={sessionState}
                      selectedCar={selectedCar}
                      onCarSelect={handleCarSelect}
                    />
                  </div>
                </div>
              )
            )}
            {viewMode === 'control-log' && (
              <ControlLog entries={controlLog} />
            )}
            {viewMode === 'in-car' && (
              <div className="empty-state" style={{ padding: '3rem' }}>
                <Car size={48} />
                <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>In-Car Mode</h3>
                <p style={{ marginBottom: '1rem' }}>Select a car from the timing screen to view in-car data</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setViewMode('timing')}
                >
                  Go to Timing
                </button>
              </div>
            )}
          </div>

          {/* Connection status bar */}
          {!isConnected && connectionState !== 'disconnected' && (
            <div
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 215, 0, 0.1)',
                borderTop: '1px solid rgba(255, 215, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8125rem',
                color: 'var(--accent-yellow)',
              }}
            >
              <Radio size={14} />
              {connectionState === 'connecting' && 'Connecting to live timing...'}
              {connectionState === 'reconnecting' && 'Reconnecting...'}
            </div>
          )}
        </div>

        {/* Side panel - Car details */}
        {selectedCar && (
          <CarDetails 
            eventId={eventId}
            carNumber={selectedCar}
            onClose={clearSelectedCar}
          />
        )}
      </div>

      {/* Critical Alert Modal - watches for team incidents */}
      {myCar && (
        <CriticalAlertModal 
          carNumber={myCar}
          teamKeywords={[]} // Add team name keywords here if needed
        />
      )}
    </div>
  );
}

interface ViewTabProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ViewTab({ icon, label, active, onClick }: ViewTabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.5rem 0.75rem',
        background: active ? 'var(--bg-card)' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: '0.8125rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

