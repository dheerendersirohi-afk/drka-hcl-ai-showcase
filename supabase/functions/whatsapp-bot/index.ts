import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

type SupportedLanguage = 'en-IN' | 'hi-IN' | 'gu-IN' | 'mr-IN' | 'bn-IN';
type EventType = 'weather' | 'disaster' | 'manual';

type SubscriptionRow = {
  id: string;
  phone_number: string;
  display_name: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  language_code: SupportedLanguage;
  opted_in: boolean;
  last_inbound_at: string | null;
  last_alerted_at: string | null;
};

type DisasterRow = {
  id: string;
  title: string;
  status: string;
  severity: number;
  location_name: string;
};

type TeamRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  location_name: string;
  assigned_to: string | null;
  current_members: number;
  capacity: number;
};

type DispatchPayload = {
  eventType: EventType;
  title: string;
  message: string;
  locationName: string;
  city?: string;
  district?: string;
  state?: string;
  includeResponders?: boolean;
  phoneNumbers?: string[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const twimlHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/xml; charset=utf-8',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
};

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSupabaseAdmin() {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePhoneNumber(value: string) {
  const raw = value.replace(/^whatsapp:/i, '').trim();
  const cleaned = raw.replace(/[^\d+]/g, '');

  if (!cleaned) {
    return '';
  }

  if (cleaned.startsWith('+')) {
    return `whatsapp:${cleaned}`;
  }

  return `whatsapp:+${cleaned}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlMessage(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
}

function parseLanguage(input: string): SupportedLanguage | null {
  const normalized = input.toLowerCase();

  if (normalized.includes('hindi') || normalized.includes('hi')) return 'hi-IN';
  if (normalized.includes('gujarati') || normalized.includes('gujrati') || normalized.includes('gu')) return 'gu-IN';
  if (normalized.includes('marathi') || normalized.includes('mr') || normalized.includes('matahi')) return 'mr-IN';
  if (normalized.includes('bengali') || normalized.includes('bangla') || normalized.includes('bn')) return 'bn-IN';
  if (normalized.includes('english') || normalized.includes('en')) return 'en-IN';

  return null;
}

function getLanguageLabel(language: SupportedLanguage) {
  switch (language) {
    case 'hi-IN':
      return 'Hindi';
    case 'gu-IN':
      return 'Gujarati';
    case 'mr-IN':
      return 'Marathi';
    case 'bn-IN':
      return 'Bengali';
    default:
      return 'English';
  }
}

function parseLocationDetails(input: string) {
  const cleaned = normalizeWhitespace(input.replace(/^subscribe\s*/i, ''));
  const [city, state] = cleaned.split(',').map((part) => part?.trim()).filter(Boolean);

  return {
    city: city || null,
    state: state || null,
  };
}

function placeFromCommand(body: string) {
  return normalizeWhitespace(
    body
      .replace(/^(team|status|responder|responders)\s+/i, '')
      .trim()
  );
}

async function upsertSubscription(base: Partial<SubscriptionRow> & { phone_number: string }) {
  const supabase = getSupabaseAdmin();
  const payload = {
    ...base,
    phone_number: normalizePhoneNumber(base.phone_number),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('whatsapp_subscriptions')
    .upsert(payload, { onConflict: 'phone_number' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as SubscriptionRow;
}

async function getSubscriptionByPhone(phoneNumber: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('whatsapp_subscriptions')
    .select('*')
    .eq('phone_number', normalizePhoneNumber(phoneNumber))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as SubscriptionRow | null;
}

async function findDisastersForPlace(place: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('disasters')
    .select('id,title,status,severity,location_name')
    .in('status', ['active', 'responding'])
    .ilike('location_name', `%${place}%`)
    .order('severity', { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  return (data || []) as DisasterRow[];
}

async function findTeamsForPlace(place: string, disasterIds: string[]) {
  const supabase = getSupabaseAdmin();
  const teamMap = new Map<string, TeamRow>();

  const { data: localTeams, error: localError } = await supabase
    .from('teams')
    .select('id,name,type,status,location_name,assigned_to,current_members,capacity')
    .in('status', ['responding', 'on-site', 'available'])
    .ilike('location_name', `%${place}%`)
    .limit(5);

  if (localError) {
    throw localError;
  }

  for (const team of (localTeams || []) as TeamRow[]) {
    teamMap.set(team.id, team);
  }

  if (disasterIds.length) {
    const { data: assignedTeams, error: assignedError } = await supabase
      .from('teams')
      .select('id,name,type,status,location_name,assigned_to,current_members,capacity')
      .in('assigned_to', disasterIds)
      .limit(5);

    if (assignedError) {
      throw assignedError;
    }

    for (const team of (assignedTeams || []) as TeamRow[]) {
      teamMap.set(team.id, team);
    }
  }

  return [...teamMap.values()].slice(0, 5);
}

async function buildResponderSummary(place: string) {
  const disasters = await findDisastersForPlace(place);
  const teams = await findTeamsForPlace(place, disasters.map((disaster) => disaster.id));

  const disasterLine = disasters.length
    ? disasters
        .map((disaster) => `${disaster.title} (${disaster.status}, severity ${disaster.severity}/5)`)
        .join('; ')
    : `No active disaster record found for ${place}.`;

  const teamLine = teams.length
    ? teams
        .map(
          (team) =>
            `${team.name} - ${team.type} team, ${team.status}, ${team.current_members}/${team.capacity} members, base ${team.location_name}`
        )
        .join('\n')
    : `No matching response team found for ${place} yet.`;

  return {
    disasters,
    teams,
    text: `Area: ${place}\nSituation: ${disasterLine}\n\nResponders:\n${teamLine}`,
  };
}

function matchesSubscription(subscription: SubscriptionRow, payload: DispatchPayload) {
  if (!subscription.opted_in) {
    return false;
  }

  const haystack = [
    subscription.city,
    subscription.district,
    subscription.state,
    payload.locationName,
    payload.city,
    payload.district,
    payload.state,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  if (!payload.city && !payload.district && !payload.state && payload.locationName) {
    const location = payload.locationName.toLowerCase();
    return [subscription.city, subscription.district, subscription.state]
      .filter(Boolean)
      .some((value) => location.includes(value!.toLowerCase()) || value!.toLowerCase().includes(location));
  }

  const locationChecks = [payload.city, payload.district, payload.state]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return locationChecks.some((target) =>
    [subscription.city, subscription.district, subscription.state]
      .filter(Boolean)
      .map((value) => value!.toLowerCase())
      .some((value) => value.includes(target) || target.includes(value))
  ) || haystack.length === 0;
}

async function sendWhatsAppMessage(to: string, body: string) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');
  const from = normalizePhoneNumber(getEnv('TWILIO_WHATSAPP_FROM'));
  const target = normalizePhoneNumber(to);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: target,
        Body: body,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twilio send failed: ${JSON.stringify(data)}`);
  }

  return data as { sid?: string };
}

async function logAlertAttempt(args: {
  subscriptionId?: string | null;
  phoneNumber: string;
  locationName: string;
  eventType: EventType;
  title: string;
  message: string;
  status: 'queued' | 'sent' | 'failed';
  providerSid?: string | null;
  providerResponse?: unknown;
}) {
  const supabase = getSupabaseAdmin();

  await supabase.from('whatsapp_alert_logs').insert({
    subscription_id: args.subscriptionId || null,
    phone_number: normalizePhoneNumber(args.phoneNumber),
    location_name: args.locationName,
    event_type: args.eventType,
    title: args.title,
    message: args.message,
    status: args.status,
    provider_sid: args.providerSid || null,
    provider_response: args.providerResponse ?? null,
  });
}

async function handleInbound(req: Request, url: URL) {
  const webhookToken = Deno.env.get('WHATSAPP_WEBHOOK_TOKEN');
  if (webhookToken && url.searchParams.get('token') !== webhookToken) {
    return new Response(twimlMessage('Webhook token mismatch.'), {
      status: 401,
      headers: twimlHeaders,
    });
  }

  const form = await req.formData();
  const from = normalizePhoneNumber(String(form.get('From') || ''));
  const profileName = normalizeWhitespace(String(form.get('ProfileName') || ''));
  const body = normalizeWhitespace(String(form.get('Body') || ''));

  if (!from) {
    return new Response(twimlMessage('Missing sender number.'), {
      status: 400,
      headers: twimlHeaders,
    });
  }

  const existing = await getSubscriptionByPhone(from);
  await upsertSubscription({
    phone_number: from,
    display_name: profileName || existing?.display_name || null,
    last_inbound_at: new Date().toISOString(),
    opted_in: existing?.opted_in ?? true,
    language_code: existing?.language_code ?? 'hi-IN',
    city: existing?.city ?? null,
    district: existing?.district ?? null,
    state: existing?.state ?? null,
  });

  if (!body || /^help$/i.test(body)) {
    return new Response(
      twimlMessage(
        'DRKA(HCL) WhatsApp bot commands:\n' +
          '1. SUBSCRIBE City, State\n' +
          '2. STATUS City\n' +
          '3. TEAM City\n' +
          '4. LANGUAGE Hindi | Gujarati | Marathi | Bengali | English\n' +
          '5. UNSUBSCRIBE'
      ),
      { headers: twimlHeaders }
    );
  }

  if (/^unsubscribe$/i.test(body)) {
    await upsertSubscription({
      phone_number: from,
      opted_in: false,
      last_inbound_at: new Date().toISOString(),
    });

    return new Response(
      twimlMessage('You have been unsubscribed from DRKA(HCL) WhatsApp alerts. Send SUBSCRIBE City, State to rejoin.'),
      { headers: twimlHeaders }
    );
  }

  if (/^language\s+/i.test(body)) {
    const requestedLanguage = parseLanguage(body);

    if (!requestedLanguage) {
      return new Response(
        twimlMessage('Language not recognized. Choose: Hindi, Gujarati, Marathi, Bengali, or English.'),
        { headers: twimlHeaders }
      );
    }

    await upsertSubscription({
      phone_number: from,
      language_code: requestedLanguage,
      last_inbound_at: new Date().toISOString(),
    });

    return new Response(
      twimlMessage(`Language updated to ${getLanguageLabel(requestedLanguage)}.`),
      { headers: twimlHeaders }
    );
  }

  if (/^subscribe\s+/i.test(body)) {
    const { city, state } = parseLocationDetails(body);

    if (!city && !state) {
      return new Response(
        twimlMessage('Please send SUBSCRIBE City, State. Example: SUBSCRIBE Hapur, Uttar Pradesh'),
        { headers: twimlHeaders }
      );
    }

    await upsertSubscription({
      phone_number: from,
      display_name: profileName || existing?.display_name || null,
      city,
      state,
      opted_in: true,
      language_code: existing?.language_code ?? 'hi-IN',
      last_inbound_at: new Date().toISOString(),
    });

    return new Response(
      twimlMessage(`Subscribed for ${[city, state].filter(Boolean).join(', ')} alerts. Reply STATUS ${city || state || 'your area'} to see live responders.`),
      { headers: twimlHeaders }
    );
  }

  if (/^(team|status|responder|responders)\s+/i.test(body)) {
    const place = placeFromCommand(body);

    if (!place) {
      return new Response(
        twimlMessage('Please include a city or state. Example: TEAM Hapur'),
        { headers: twimlHeaders }
      );
    }

    const summary = await buildResponderSummary(place);
    return new Response(twimlMessage(summary.text), { headers: twimlHeaders });
  }

  const fallbackSummary = await buildResponderSummary(body);
  return new Response(
    twimlMessage(
      `${fallbackSummary.text}\n\nTip: send SUBSCRIBE City, State if you want automatic WhatsApp alerts for that area.`
    ),
    { headers: twimlHeaders }
  );
}

async function handleDispatch(req: Request) {
  const dispatchSecret = Deno.env.get('WHATSAPP_DISPATCH_SECRET');
  if (dispatchSecret && req.headers.get('x-dispatch-secret') !== dispatchSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized dispatch request.' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const payload = (await req.json()) as DispatchPayload;

  if (!payload.locationName || !payload.title || !payload.message || !payload.eventType) {
    return new Response(JSON.stringify({ error: 'locationName, title, message, and eventType are required.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = getSupabaseAdmin();
  let targets: SubscriptionRow[] = [];

  if (payload.phoneNumbers?.length) {
    const normalized = payload.phoneNumbers.map(normalizePhoneNumber);
    const { data, error } = await supabase
      .from('whatsapp_subscriptions')
      .select('*')
      .in('phone_number', normalized);

    if (error) {
      throw error;
    }

    targets = (data || []) as SubscriptionRow[];
  } else {
    const { data, error } = await supabase
      .from('whatsapp_subscriptions')
      .select('*')
      .eq('opted_in', true);

    if (error) {
      throw error;
    }

    targets = ((data || []) as SubscriptionRow[]).filter((subscription) => matchesSubscription(subscription, payload));
  }

  if (!targets.length) {
    return new Response(JSON.stringify({ sent: 0, matched: 0, message: 'No matching WhatsApp subscribers found.' }), {
      headers: jsonHeaders,
    });
  }

  const responderSummary = payload.includeResponders ? await buildResponderSummary(payload.locationName) : null;
  const outboundBody = [
    `${payload.title}`,
    payload.message,
    responderSummary ? `\nResponding in ${payload.locationName}:\n${responderSummary.teams.length ? responderSummary.teams.map((team) => `${team.name} (${team.status})`).join('\n') : 'Team assignment is still being updated.'}` : '',
    `\nReply TEAM ${payload.locationName} for live responder details.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const results = await Promise.all(
    targets.map(async (subscription) => {
      try {
        const provider = await sendWhatsAppMessage(subscription.phone_number, outboundBody);
        await logAlertAttempt({
          subscriptionId: subscription.id,
          phoneNumber: subscription.phone_number,
          locationName: payload.locationName,
          eventType: payload.eventType,
          title: payload.title,
          message: outboundBody,
          status: 'sent',
          providerSid: provider.sid || null,
          providerResponse: provider,
        });

        await supabase
          .from('whatsapp_subscriptions')
          .update({ last_alerted_at: new Date().toISOString() })
          .eq('id', subscription.id);

        return { phoneNumber: subscription.phone_number, status: 'sent', sid: provider.sid || null };
      } catch (error) {
        await logAlertAttempt({
          subscriptionId: subscription.id,
          phoneNumber: subscription.phone_number,
          locationName: payload.locationName,
          eventType: payload.eventType,
          title: payload.title,
          message: outboundBody,
          status: 'failed',
          providerResponse: error instanceof Error ? { message: error.message } : { message: 'Unknown error' },
        });

        return {
          phoneNumber: subscription.phone_number,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return new Response(
    JSON.stringify({
      sent: results.filter((result) => result.status === 'sent').length,
      matched: targets.length,
      results,
    }),
    { headers: jsonHeaders }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'whatsapp-bot' }), {
        headers: jsonHeaders,
      });
    }

    if (req.method === 'POST' && url.pathname.endsWith('/dispatch')) {
      return await handleDispatch(req);
    }

    if (req.method === 'POST') {
      return await handleInbound(req, url);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (req.method === 'POST' && !url.pathname.endsWith('/dispatch')) {
      return new Response(twimlMessage(`DRKA(HCL) bot error: ${message}`), {
        status: 500,
        headers: twimlHeaders,
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
