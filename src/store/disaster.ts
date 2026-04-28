import { create } from 'zustand';
import { isSupabaseEnabled, supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { logger } from '../lib/logger';

type Disaster = Database['public']['Tables']['disasters']['Row'];
type Resource = Database['public']['Tables']['resources']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Alert = Database['public']['Tables']['alerts']['Row'];
type DemoChannel = ReturnType<typeof supabase.channel>;

interface DisasterStore {
  disasters: Disaster[];
  resources: Resource[];
  teams: Team[];
  reports: Report[];
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
  fetchInitialData: () => Promise<void>;
  createDisaster: (disaster: Partial<Disaster>) => Promise<void>;
  updateDisaster: (id: string, updates: Partial<Disaster>) => Promise<void>;
  createReport: (report: Partial<Report>) => Promise<void>;
  createResource: (resource: Partial<Resource>) => Promise<void>;
  updateResource: (id: string, updates: Partial<Resource>) => Promise<void>;
  deployTeam: (teamId: string, disasterId: string) => Promise<void>;
  allocateResources: (resourceId: string, disasterId: string, quantity: number) => Promise<void>;
  broadcastAlert: (alert: Partial<Alert>) => Promise<void>;
}

const initialDisasters: Disaster[] = [
  {
    id: '1',
    type: 'flood',
    severity: 4,
    title: 'Kerala Monsoon Flooding',
    description: 'Severe flooding in Kerala due to intense monsoon rainfall',
    location: { type: 'Point', coordinates: [76.2711, 10.8505] },
    location_name: 'Kochi, Kerala',
    affected_radius_km: 50,
    affected_population: 150000,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    predicted_path: null,
    weather_conditions: { rainfall_mm: 350, wind_speed_kmh: 45, humidity: 95 },
    evacuation_zones: null,
  },
  {
    id: '2',
    type: 'tornado',
    severity: 5,
    title: 'Severe Cyclonic Storm',
    description: 'Category 5 cyclonic storm approaching Tamil Nadu coast',
    location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    location_name: 'Chennai, Tamil Nadu',
    affected_radius_km: 100,
    affected_population: 500000,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    predicted_path: null,
    weather_conditions: { wind_speed_kmh: 180, pressure_mb: 950, storm_surge_m: 4 },
    evacuation_zones: null,
  },
  {
    id: '3',
    type: 'earthquake',
    severity: 3,
    title: 'Gujarat Seismic Activity',
    description: 'Moderate earthquake in Kutch region',
    location: { type: 'Point', coordinates: [70.2196, 23.2420] },
    location_name: 'Bhuj, Gujarat',
    affected_radius_km: 30,
    affected_population: 75000,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    predicted_path: null,
    weather_conditions: { magnitude: 5.8, depth_km: 10, aftershocks: true },
    evacuation_zones: null,
  },
  {
    id: '4',
    type: 'wildfire',
    severity: 4,
    title: 'Uttarakhand Forest Fire',
    description: 'Massive forest fire spreading in Uttarakhand hills',
    location: { type: 'Point', coordinates: [79.0193, 30.0668] },
    location_name: 'Dehradun, Uttarakhand',
    affected_radius_km: 45,
    affected_population: 25000,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    predicted_path: null,
    weather_conditions: { temperature: 38, humidity: 15, wind_speed_kmh: 25 },
    evacuation_zones: null,
  }
];

const initialResources: Resource[] = [
  {
    id: '1',
    type: 'medical',
    name: 'Emergency Medical Camp',
    description: 'Fully equipped medical camp with trauma care facilities',
    quantity: 50,
    unit: 'beds',
    location: { type: 'Point', coordinates: [76.2711, 10.8505] },
    location_name: 'Ernakulam Medical Center',
    status: 'deployed',
    assigned_to: null,
    expiry_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tracking_data: null,
  },
  {
    id: '2',
    type: 'food',
    name: 'Relief Food Supplies',
    description: 'Emergency food and water supplies',
    quantity: 10000,
    unit: 'meals',
    location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    location_name: 'Chennai Central Warehouse',
    status: 'deployed',
    assigned_to: null,
    expiry_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tracking_data: null,
  },
  {
    id: '3',
    type: 'shelter',
    name: 'Emergency Shelter Kits',
    description: 'Temporary shelter materials and basic amenities',
    quantity: 500,
    unit: 'kits',
    location: { type: 'Point', coordinates: [72.8777, 19.0760] },
    location_name: 'Mumbai Disaster Response Center',
    status: 'deployed',
    assigned_to: null,
    expiry_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tracking_data: null,
  }
];

const initialTeams: Team[] = [
  {
    id: '1',
    name: 'Kerala Rapid Response Team',
    type: 'rescue',
    capacity: 50,
    current_members: 45,
    location: { type: 'Point', coordinates: [76.2711, 10.8505] },
    location_name: 'Kochi Emergency Center',
    status: 'available',
    assigned_to: null,
    specializations: ['water_rescue', 'medical_first_response', 'evacuation'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Tamil Nadu Medical Corps',
    type: 'medical',
    capacity: 30,
    current_members: 28,
    location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    location_name: 'Chennai General Hospital',
    status: 'available',
    assigned_to: null,
    specializations: ['trauma_care', 'emergency_medicine', 'public_health'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Gujarat Search & Rescue',
    type: 'rescue',
    capacity: 40,
    current_members: 35,
    location: { type: 'Point', coordinates: [70.2196, 23.2420] },
    location_name: 'Bhuj Response Center',
    status: 'available',
    assigned_to: null,
    specializations: ['urban_rescue', 'structural_assessment', 'heavy_equipment'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  }
];

const initialAlerts: Alert[] = [
  {
    id: '1',
    disaster_id: null,
    type: 'warning',
    title: 'Urgent: Kerala Flood Warning',
    message: 'Severe flooding expected in Ernakulam district. Please evacuate to designated centers immediately.',
    severity: 4,
    affected_area: { type: 'Polygon', coordinates: [[[76.2, 10.8], [76.4, 10.8], [76.4, 11.0], [76.2, 11.0], [76.2, 10.8]]] },
    channels: ['sms', 'email', 'emergency-broadcast'],
    status: 'sent',
    sent_at: new Date().toISOString(),
    expires_at: null,
    created_at: new Date().toISOString(),
    created_by: null,
  },
  {
    id: '2',
    disaster_id: null,
    type: 'evacuation',
    title: 'Cyclone Warning: Immediate Evacuation',
    message: 'Severe cyclonic storm approaching Chennai coast. Mandatory evacuation for coastal areas.',
    severity: 5,
    affected_area: { type: 'Polygon', coordinates: [[[80.2, 13.0], [80.4, 13.0], [80.4, 13.2], [80.2, 13.2], [80.2, 13.0]]] },
    channels: ['sms', 'emergency-broadcast', 'social-media'],
    status: 'sent',
    sent_at: new Date().toISOString(),
    expires_at: null,
    created_at: new Date().toISOString(),
    created_by: null,
  },
  {
    id: '3',
    disaster_id: null,
    type: 'update',
    title: 'Bhuj Earthquake Update',
    message: 'Moderate earthquake recorded in Kutch region. Emergency services deployed. Stay in open areas.',
    severity: 3,
    affected_area: { type: 'Polygon', coordinates: [[[70.1, 23.1], [70.3, 23.1], [70.3, 23.3], [70.1, 23.3], [70.1, 23.1]]] },
    channels: ['sms', 'app'],
    status: 'sent',
    sent_at: new Date().toISOString(),
    expires_at: null,
    created_at: new Date().toISOString(),
    created_by: null,
  }
];

let activeChannels: DemoChannel[] = [];

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const useDisasterStore = create<DisasterStore>((set, get) => ({
  disasters: initialDisasters,
  resources: initialResources,
  teams: initialTeams,
  reports: [],
  alerts: initialAlerts,
  loading: false,
  error: null,

  subscribeToUpdates: () => {
    if (!isSupabaseEnabled || activeChannels.length > 0) {
      return;
    }

    activeChannels = [
      supabase
        .channel('disasters')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'disasters' }, 
          payload => {
            const { disasters } = get();
            if (payload.eventType === 'INSERT') {
              set({ disasters: [...disasters, payload.new as Disaster] });
            } else if (payload.eventType === 'UPDATE') {
              set({
                disasters: disasters.map(d => 
                  d.id === payload.new.id ? { ...d, ...payload.new } : d
                )
              });
            }
          }
        ),
      supabase
        .channel('resources')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' },
          payload => {
            const { resources } = get();
            if (payload.eventType === 'INSERT') {
              set({ resources: [...resources, payload.new as Resource] });
            } else if (payload.eventType === 'UPDATE') {
              set({
                resources: resources.map(r => 
                  r.id === payload.new.id ? { ...r, ...payload.new } : r
                )
              });
            }
          }
        ),
      supabase
        .channel('teams')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' },
          payload => {
            const { teams } = get();
            if (payload.eventType === 'INSERT') {
              set({ teams: [...teams, payload.new as Team] });
            } else if (payload.eventType === 'UPDATE') {
              set({
                teams: teams.map(t => 
                  t.id === payload.new.id ? { ...t, ...payload.new } : t
                )
              });
            }
          }
        ),
      supabase
        .channel('alerts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' },
          payload => {
            const { alerts } = get();
            if (payload.eventType === 'INSERT') {
              set({ alerts: [...alerts, payload.new as Alert] });
            } else if (payload.eventType === 'UPDATE') {
              set({
                alerts: alerts.map(a => 
                  a.id === payload.new.id ? { ...a, ...payload.new } : a
                )
              });
            }
          }
        )
    ];

    activeChannels.forEach(channel => channel.subscribe());
  },

  unsubscribeFromUpdates: () => {
    activeChannels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    activeChannels = [];
  },

  fetchInitialData: async () => {
    set({ loading: true, error: null });

    if (!isSupabaseEnabled) {
      set({
        disasters: initialDisasters,
        resources: initialResources,
        teams: initialTeams,
        reports: [],
        alerts: initialAlerts,
        error: null,
        loading: false
      });
      return;
    }

    try {
      const results = await Promise.allSettled([
        supabase.from('disasters').select('*'),
        supabase.from('resources').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('alerts').select('*')
      ]);

      const [disastersResult, resourcesResult, teamsResult, reportsResult, alertsResult] = results;

      const nextState = {
        disasters: initialDisasters,
        resources: initialResources,
        teams: initialTeams,
        reports: [] as Report[],
        alerts: initialAlerts,
        loading: false,
        error: null as string | null
      };

      const failedTables: string[] = [];

      if (disastersResult.status === 'fulfilled' && !disastersResult.value.error) {
        nextState.disasters = disastersResult.value.data || [];
      } else {
        failedTables.push('disasters');
      }

      if (resourcesResult.status === 'fulfilled' && !resourcesResult.value.error) {
        nextState.resources = resourcesResult.value.data || [];
      } else {
        failedTables.push('resources');
      }

      if (teamsResult.status === 'fulfilled' && !teamsResult.value.error) {
        nextState.teams = teamsResult.value.data || [];
      } else {
        failedTables.push('teams');
      }

      if (reportsResult.status === 'fulfilled' && !reportsResult.value.error) {
        nextState.reports = reportsResult.value.data || [];
      } else {
        failedTables.push('reports');
      }

      if (alertsResult.status === 'fulfilled' && !alertsResult.value.error) {
        nextState.alerts = alertsResult.value.data || [];
      } else {
        failedTables.push('alerts');
      }

      if (failedTables.length > 0) {
        logger.warn(`Supabase unavailable for: ${failedTables.join(', ')}. Using demo data where needed.`);
      }

      set(nextState);
    } catch (error) {
      logger.error('Error fetching data, falling back to demo data', error);
      set({
        disasters: initialDisasters,
        resources: initialResources,
        teams: initialTeams,
        reports: [],
        alerts: initialAlerts,
        error: null,
        loading: false
      });
    }
  },

  createDisaster: async (disaster) => {
    if (!isSupabaseEnabled) {
      const localDisaster = {
        ...disaster,
        id: createLocalId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Disaster;

      const { disasters } = get();
      set({ disasters: [...disasters, localDisaster] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('disasters')
        .insert([disaster])
        .select()
        .single();

      if (error) throw error;
      const { disasters } = get();
      set({ disasters: [...disasters, data] });
    } catch (error) {
      logger.error('Error creating disaster', error);
      throw error;
    }
  },

  updateDisaster: async (id, updates) => {
    if (!isSupabaseEnabled) {
      const { disasters } = get();
      set({
        disasters: disasters.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d)
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('disasters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const { disasters } = get();
      set({
        disasters: disasters.map(d => d.id === id ? { ...d, ...data } : d)
      });
    } catch (error) {
      logger.error('Error updating disaster', error);
      throw error;
    }
  },

  createReport: async (report) => {
    if (!isSupabaseEnabled) {
      const localReport = {
        ...report,
        id: createLocalId(),
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Report;

      const { reports } = get();
      set({ reports: [...reports, localReport] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reports')
        .insert([{
          ...report,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      const { reports } = get();
      set({ reports: [...reports, data] });
    } catch (error) {
      logger.error('Error creating report', error);
      throw error;
    }
  },

  createResource: async (resource) => {
    if (!isSupabaseEnabled) {
      const localResource = {
        ...resource,
        id: createLocalId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Resource;

      const { resources } = get();
      set({ resources: [...resources, localResource] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .insert([{
          ...resource,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      const { resources } = get();
      set({ resources: [...resources, data] });
    } catch (error) {
      logger.error('Error creating resource', error);
      throw error;
    }
  },

  updateResource: async (id, updates) => {
    if (!isSupabaseEnabled) {
      const { resources } = get();
      set({
        resources: resources.map(r => r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r)
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const { resources } = get();
      set({
        resources: resources.map(r => r.id === id ? { ...r, ...data } : r)
      });
    } catch (error) {
      logger.error('Error updating resource', error);
      throw error;
    }
  },

  deployTeam: async (teamId, disasterId) => {
    if (!isSupabaseEnabled) {
      const { teams } = get();
      set({
        teams: teams.map(t => t.id === teamId ? {
          ...t,
          status: 'responding',
          assigned_to: disasterId,
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString()
        } : t)
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('teams')
        .update({
          status: 'responding',
          assigned_to: disasterId,
          updated_at: new Date().toISOString(),
          last_active: new Date().toISOString()
        })
        .eq('id', teamId)
        .select()
        .single();

      if (error) throw error;
      const { teams } = get();
      set({
        teams: teams.map(t => t.id === teamId ? { ...t, ...data } : t)
      });
    } catch (error) {
      logger.error('Error deploying team', error);
      throw error;
    }
  },

  allocateResources: async (resourceId, disasterId, quantity) => {
    if (!isSupabaseEnabled) {
      const { resources } = get();
      set({
        resources: resources.map(r => r.id === resourceId ? {
          ...r,
          status: 'deployed',
          assigned_to: disasterId,
          quantity,
          updated_at: new Date().toISOString()
        } : r)
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('resources')
        .update({
          status: 'deployed',
          assigned_to: disasterId,
          quantity: quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) throw error;
      const { resources } = get();
      set({
        resources: resources.map(r => r.id === resourceId ? { ...r, ...data } : r)
      });
    } catch (error) {
      logger.error('Error allocating resources', error);
      throw error;
    }
  },

  broadcastAlert: async (alert) => {
    if (!isSupabaseEnabled) {
      const localAlert = {
        ...alert,
        id: createLocalId(),
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      } as Alert;

      const { alerts } = get();
      set({ alerts: [...alerts, localAlert] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert([{
          ...alert,
          status: 'sent',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      const { alerts } = get();
      set({ alerts: [...alerts, data] });
    } catch (error) {
      logger.error('Error broadcasting alert', error);
      throw error;
    }
  }
}));
