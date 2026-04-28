import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Map, Globe2, BarChart2, Users, Box, AlertTriangle, MessageSquare, Bot } from 'lucide-react';
import { useDisasterStore } from '../store/disaster';
import type { Database } from '../lib/database.types';

const AIChat = lazy(() => import('./AIChat'));

interface DockProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface Communication {
  id: string;
  type: 'message' | 'alert' | 'update';
  sender: string;
  content: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

type Disaster = Database['public']['Tables']['disasters']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Alert = Database['public']['Tables']['alerts']['Row'];
type IncidentItem = Disaster | Report;
type CommunicationItem = Communication | Alert;

function isAlertCommunication(item: CommunicationItem): item is Alert {
  return 'message' in item;
}

const mockCommunications: Communication[] = [
  { id: '1', type: 'alert', sender: 'Emergency Ops', content: 'Immediate evacuation required in coastal areas', timestamp: '2025-02-15T10:45:00Z', priority: 'high' },
  { id: '2', type: 'message', sender: 'Field Team Alpha', content: 'Rescue operation completed successfully', timestamp: '2025-02-15T10:30:00Z', priority: 'medium' },
  { id: '3', type: 'update', sender: 'Weather Service', content: 'Storm expected to intensify in next 6 hours', timestamp: '2025-02-15T10:15:00Z', priority: 'high' }
];

export default function Dock({ activeView, onViewChange }: DockProps) {
  const { teams, resources, disasters, reports, alerts } = useDisasterStore();
  const [showPanel, setShowPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [panelContent, setPanelContent] = useState<ReactNode | null>(null);

  const menuItems = [
    { id: 'chat', icon: Bot, label: 'AI Assistant' },
    { id: 'map', icon: Map, label: 'Map View' },
    { id: 'globe', icon: Globe2, label: 'Globe' },
    { id: 'analytics', icon: BarChart2, label: 'Analytics' },
    { id: 'teams', icon: Users, label: 'Teams' },
    { id: 'resources', icon: Box, label: 'Resources' },
    { id: 'incidents', icon: AlertTriangle, label: 'Incidents' },
    { id: 'communications', icon: MessageSquare, label: 'Comms' }
  ];

  const handleViewChange = (view: string) => {
    if (view === 'chat') {
      setShowChat(!showChat);
      if (showPanel) setShowPanel(false);
    } else {
      onViewChange(view);
      if (['teams', 'resources', 'incidents', 'communications'].includes(view)) {
        setShowPanel(true);
        setPanelContent(renderPanelContent(view));
        if (showChat) setShowChat(false);
      } else {
        setShowPanel(false);
      }
    }
  };

  const renderPanelContent = (view: string) => {
    const incidents: IncidentItem[] = [...reports, ...disasters].slice(0, 6);
    const communications: CommunicationItem[] = [...alerts.slice(0, 3), ...mockCommunications];

    switch (view) {
      case 'teams':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Emergency Response Teams</h2>
            <div className="space-y-4">
              {teams.map(member => (
                <div key={member.id} className="glass p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">{member.name}</h3>
                      <p className="text-sm text-gray-300 capitalize">{member.type} team</p>
                      <p className="text-sm text-gray-400">{member.location_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.status === 'available' ? 'bg-green-500/20 text-green-300' :
                      member.status === 'responding' || member.status === 'on-site' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Resource Management</h2>
            <div className="space-y-4">
              {resources.map(resource => (
                <div key={resource.id} className="glass p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">{resource.name}</h3>
                      <p className="text-sm text-gray-300 capitalize">{resource.type}</p>
                      <p className="text-sm text-gray-400">
                        {resource.quantity} {resource.unit} at {resource.location_name}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      resource.status === 'available' ? 'bg-green-500/20 text-green-300' :
                      resource.status === 'deployed' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {resource.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'incidents':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Incident Reports</h2>
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className="glass p-4 rounded-lg">
                  {(() => {
                    const severity = incident.severity ?? 0;

                    return (
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-white">{incident.title}</h3>
                      <p className="text-sm text-gray-300">{incident.location_name}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(incident.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        severity >= 4 ? 'bg-red-500/20 text-red-300' :
                        severity >= 3 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        Severity {severity}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        incident.status === 'pending' || incident.status === 'active' ? 'bg-red-500/20 text-red-300' :
                        incident.status === 'verified' || incident.status === 'responding' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-green-500/20 text-green-300'
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        );

      case 'communications':
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Communications Center</h2>
            <div className="space-y-4">
              {communications.map((comm) => (
                <div key={comm.id} className="glass p-4 rounded-lg">
                  {(() => {
                    const priority = isAlertCommunication(comm)
                      ? (comm.severity ?? 0) >= 4
                        ? 'high'
                        : (comm.severity ?? 0) >= 2
                          ? 'medium'
                          : 'low'
                      : comm.priority;
                    const sender = isAlertCommunication(comm) ? 'Emergency Ops' : comm.sender;
                    const body = isAlertCommunication(comm) ? comm.message : comm.content;
                    const timestamp = isAlertCommunication(comm) ? comm.created_at : comm.timestamp;
                    const communicationType = isAlertCommunication(comm) ? 'alert' : comm.type;

                    return (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${
                          priority === 'high' ? 'bg-red-500' :
                          priority === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}></span>
                        <h3 className="font-semibold text-white">{sender}</h3>
                      </div>
                      <p className="text-sm text-gray-300 mt-2">{body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      communicationType === 'alert' ? 'bg-red-500/20 text-red-300' :
                      communicationType === 'message' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {communicationType}
                    </span>
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-lg rounded-full p-2 border border-white/10 shadow-lg">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'chat' ? showChat : activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`relative group p-3 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-black/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Chat Panel */}
      {showChat && (
        <div className="fixed bottom-32 right-8 w-96 z-40 shadow-2xl">
          <Suspense fallback={null}>
            <AIChat />
          </Suspense>
        </div>
      )}

      {/* Other Panels */}
      {showPanel && panelContent && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-40">
          <div className="glass rounded-xl shadow-xl max-h-[60vh] overflow-y-auto">
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
}
