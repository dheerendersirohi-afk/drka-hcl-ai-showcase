import type { Database } from './database.types';
import { logger } from './logger';

const apiKey = import.meta.env.VITE_SARVAM_API_KEY;
const apiUrl = 'https://api.sarvam.ai/v1/chat/completions';
const model = 'sarvam-30b';

type SarvamMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type Disaster = Database['public']['Tables']['disasters']['Row'];
type Resource = Database['public']['Tables']['resources']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];
type Alert = Database['public']['Tables']['alerts']['Row'];

type OperationalContext = {
  disasters: Disaster[];
  resources: Resource[];
  teams: Team[];
  alerts: Alert[];
};

function buildLocalChatFallback(prompt: string, context: OperationalContext) {
  const activeDisasters = context.disasters.filter(d => d.status === 'active');
  const availableTeams = context.teams.filter(t => t.status === 'available');
  const deployedResources = context.resources.filter(r => r.status === 'deployed');
  const sentAlerts = context.alerts.filter(a => a.status === 'sent');

  const keywords = prompt.toLowerCase();

  if (keywords.includes('resource')) {
    return [
      `Resource summary: ${context.resources.length} total resources tracked, ${deployedResources.length} currently deployed.`,
      ...context.resources.slice(0, 4).map(
        resource => `- ${resource.name}: ${resource.quantity} ${resource.unit} at ${resource.location_name} (${resource.status})`
      )
    ].join('\n');
  }

  if (keywords.includes('team')) {
    return [
      `Team summary: ${context.teams.length} teams tracked, ${availableTeams.length} available for dispatch.`,
      ...context.teams.slice(0, 4).map(
        team => `- ${team.name}: ${team.type} team in ${team.location_name} (${team.status})`
      )
    ].join('\n');
  }

  if (keywords.includes('alert')) {
    return [
      `Alert summary: ${sentAlerts.length} alerts have been sent recently.`,
      ...sentAlerts.slice(0, 4).map(
        alert => `- ${alert.title}: severity ${alert.severity}/5 via ${alert.channels?.join(', ')}`
      )
    ].join('\n');
  }

  return [
    `Current situation summary: ${activeDisasters.length} active disasters, ${availableTeams.length} available teams, ${deployedResources.length} deployed resources, and ${sentAlerts.length} sent alerts.`,
    ...activeDisasters.slice(0, 4).map(
      disaster => `- ${disaster.title} in ${disaster.location_name}: severity ${disaster.severity}/5 affecting about ${disaster.affected_population?.toLocaleString() || 'unknown'} people`
    )
  ].join('\n');
}

function buildSeverityFallback(disasterData: {
  type: string;
  description: string;
  location: string;
  affectedPopulation?: number;
}) {
  const estimatedSeverity = disasterData.affectedPopulation && disasterData.affectedPopulation > 100000 ? 4 : 3;

  return [
    `Severity level: ${estimatedSeverity}/5`,
    `Immediate actions: establish field command near ${disasterData.location}, verify casualties, and secure evacuation routes.`,
    `Resource allocation: prioritize medical support, transport, shelter, and communications backup.`,
    `Evacuation focus: densely populated and high-risk areas mentioned in the incident description.`
  ].join('\n');
}

function buildResourceFallback(disasterData: {
  type: string;
  severity: number;
  affectedPopulation?: number;
  location: string;
}) {
  const affectedPopulation = disasterData.affectedPopulation || 1000;
  const medicalUnits = Math.max(10, Math.ceil(affectedPopulation / 500));
  const meals = Math.max(500, affectedPopulation * 2);

  return [
    `Medical supplies: at least ${medicalUnits} trauma-care units and first-aid kits.`,
    `Food and water: approximately ${meals.toLocaleString()} meal portions and equivalent drinking water reserves.`,
    `Shelter: temporary shelter support for the most exposed households near ${disasterData.location}.`,
    `Response teams: ${Math.max(2, disasterData.severity)} multi-disciplinary teams recommended.`,
    `Equipment: transport vehicles, communications kits, and incident-specific rescue gear.`
  ].join('\n');
}

function buildMisinformationFallback(report: {
  title: string;
  description: string;
  source?: string;
}) {
  return [
    `Credibility score: 60%`,
    `Potential red flags: confirm the source, verify the location and time, and compare the "${report.title}" report against field reports.`,
    `Verification suggestions: cross-check with responders, local authorities, and recent incident logs.`,
    `Similar confirmed incidents: review nearby disasters with matching type and timing before escalation.`
  ].join('\n');
}

type SarvamResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
    request_id?: string;
  };
};

function extractSarvamText(data: SarvamResponse) {
  const choice = data.choices?.[0];
  const message = choice?.message;

  if (!message) {
    return null;
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const combined = message.content
      .map((part) => part?.text?.trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    if (combined) {
      return combined;
    }
  }

  if (message.reasoning_content?.trim()) {
    return message.reasoning_content.trim();
  }

  return null;
}

function buildSituationReportFallback(data: {
  incidents: Array<{ type: string; description: string; timestamp: string }>;
  location: string;
  timeframe: string;
}) {
  return [
    `Executive summary: ${data.incidents.length} incidents were logged for ${data.location} in the last ${data.timeframe}.`,
    `Key developments: incident activity remains concentrated around the reported locations and timestamps provided.`,
    `Current challenges: field verification, resource coordination, and public communications remain the top priorities.`,
    `Resource status: maintain flexible deployment until more verified updates arrive.`,
    `Recommended actions: validate incoming reports, prioritize severe incidents first, and issue clear public guidance.`
  ].join('\n');
}

async function generateSarvamResponse(messages: SarvamMessage[]) {
  if (!apiKey) {
    throw new Error('Missing Sarvam API key. Set VITE_SARVAM_API_KEY in your .env file.');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      reasoning_effort: 'medium',
      max_tokens: 1200
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sarvam API request failed: ${response.status} ${errorText}`);
  }

  const data: SarvamResponse = await response.json();
  if (data.error?.message) {
    throw new Error(`Sarvam API error: ${data.error.message}`);
  }

  const text = extractSarvamText(data);

  if (!text) {
    throw new Error('Sarvam returned a successful response without readable message content.');
  }

  return text;
}

export async function generateChatResponse({
  prompt,
  context,
  languageCode,
  languageLabel,
}: {
  prompt: string;
  context: OperationalContext;
  languageCode: string;
  languageLabel: string;
}) {
  try {
    const formattedContext = `
      You are an AI assistant for a disaster management system. Use only the provided operational data.
      Give clear, practical answers for emergency coordination teams.
      Prefer bullet points for summaries and include specific counts when available.
      Respond entirely in ${languageLabel} using language code ${languageCode}.

      Current situation:

      Active Disasters (${context.disasters.length}):
      ${context.disasters.map(d => `
        - ${d.title}
        - Severity: ${d.severity}/5
        - Location: ${d.location_name}
        - Status: ${d.status}
        - Affected: ${d.affected_population?.toLocaleString() || 'Unknown'} people
      `).join('\n')}

      Resources (${context.resources.length}):
      ${context.resources.map(r => `
        - ${r.name}
        - ${r.quantity} ${r.unit}
        - Status: ${r.status}
        - Location: ${r.location_name}
      `).join('\n')}

      Teams (${context.teams.length}):
      ${context.teams.map(t => `
        - ${t.name}
        - Type: ${t.type}
        - Status: ${t.status}
        - Location: ${t.location_name}
      `).join('\n')}

      Recent Alerts:
      ${context.alerts.filter(a => a.status === 'sent').slice(0, 3).map(a => `
        - ${a.title}
        - Type: ${a.type}
        - Severity: ${a.severity}/5
      `).join('\n')}

      User Question: ${prompt}

      Please provide a clear, concise response based on this data. Include specific numbers and details when relevant.
    `;

    return await generateSarvamResponse([
      {
        role: 'system',
        content: 'You are a disaster response coordination assistant.'
      },
      {
        role: 'user',
        content: formattedContext
      }
    ]);
  } catch (error) {
    logger.error('Sarvam API Error', error);
    return buildLocalChatFallback(prompt, context);
  }
}

export async function analyzeSeverity(disasterData: {
  type: string;
  description: string;
  location: string;
  affectedPopulation?: number;
}) {
  const prompt = `
    Analyze this disaster situation and provide:
    1. Severity level (1-5)
    2. Recommended immediate actions
    3. Resource allocation suggestions
    4. Evacuation priority areas

    Disaster details:
    Type: ${disasterData.type}
    Location: ${disasterData.location}
    Description: ${disasterData.description}
    Affected population: ${disasterData.affectedPopulation || 'Unknown'}
  `;

  try {
    return await generateSarvamResponse([
      {
        role: 'system',
        content: 'You analyze disasters and return practical emergency response guidance.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
  } catch (error) {
    logger.error('Sarvam severity analysis error', error);
    return buildSeverityFallback(disasterData);
  }
}

export async function predictResourceNeeds(disasterData: {
  type: string;
  severity: number;
  affectedPopulation?: number;
  location: string;
}) {
  const prompt = `
    Based on this disaster scenario, predict and suggest:
    1. Required medical supplies (quantity and type)
    2. Food and water requirements
    3. Shelter needs
    4. Emergency response team size
    5. Equipment requirements

    Disaster details:
    Type: ${disasterData.type}
    Severity: ${disasterData.severity}
    Location: ${disasterData.location}
    Affected population: ${disasterData.affectedPopulation || 'Unknown'}
  `;

  try {
    return await generateSarvamResponse([
      {
        role: 'system',
        content: 'You estimate emergency resource requirements for disaster response teams.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
  } catch (error) {
    logger.error('Sarvam resource prediction error', error);
    return buildResourceFallback(disasterData);
  }
}

export async function detectMisinformation(report: {
  title: string;
  description: string;
  source?: string;
}) {
  const prompt = `
    Analyze this disaster report for potential misinformation:
    Title: ${report.title}
    Description: ${report.description}
    Source: ${report.source || 'Unknown'}

    Please provide:
    1. Credibility score (0-100%)
    2. Potential red flags
    3. Verification suggestions
    4. Similar confirmed incidents
  `;

  try {
    return await generateSarvamResponse([
      {
        role: 'system',
        content: 'You review crisis reports and identify credibility risks without overstating certainty.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
  } catch (error) {
    logger.error('Sarvam misinformation analysis error', error);
    return buildMisinformationFallback(report);
  }
}

export async function generateSituationReport(data: {
  incidents: Array<{ type: string; description: string; timestamp: string }>;
  location: string;
  timeframe: string;
}) {
  const prompt = `
    Generate a comprehensive situation report based on these incidents:
    Location: ${data.location}
    Timeframe: ${data.timeframe}

    Incidents:
    ${data.incidents.map(i => `
      Type: ${i.type}
      Time: ${i.timestamp}
      Description: ${i.description}
    `).join('\n')}

    Please provide:
    1. Executive summary
    2. Key developments
    3. Current challenges
    4. Resource status
    5. Recommended actions
  `;

  try {
    return await generateSarvamResponse([
      {
        role: 'system',
        content: 'You produce concise incident situation reports for emergency operations teams.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
  } catch (error) {
    logger.error('Sarvam situation report error', error);
    return buildSituationReportFallback(data);
  }
}
