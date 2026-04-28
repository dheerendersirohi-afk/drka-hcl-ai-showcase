import type { WeatherSummary } from './weather';

export type ForecastPoint = {
  hourLabel: string;
  tempC: number;
  precipitationChance: number;
  windRisk: number;
};

export type ForecastRisk = {
  label: string;
  level: 'Low' | 'Moderate' | 'High';
  score: number;
};

export type ForecastDemo = {
  headline: string;
  next12HourAverageC: number;
  confidence: 'Demo' | 'Stable';
  trend: 'Rising' | 'Cooling' | 'Steady';
  summary: string;
  points: ForecastPoint[];
  risks: ForecastRisk[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseWindKph(wind: string) {
  const match = wind.match(/(\d+)\s?(km\/h|kph)/i);
  if (match) {
    return Number(match[1]);
  }

  const mphMatch = wind.match(/(\d+)\s?mph/i);
  if (mphMatch) {
    return Math.round(Number(mphMatch[1]) * 1.60934);
  }

  return 0;
}

function getHourLabel(offsetHours: number) {
  const next = new Date();
  next.setHours(next.getHours() + offsetHours);
  return next.toLocaleTimeString([], { hour: 'numeric' });
}

function getConditionBias(summary: WeatherSummary) {
  const condition = summary.condition.toLowerCase();

  return {
    rainBoost: /rain|storm|thunder|shower/.test(condition) ? 28 : /cloud|haze|overcast/.test(condition) ? 14 : 6,
    heatBoost: /hot|sunny|clear/.test(condition) ? 16 : 6,
    severeBoost: /cyclone|tornado|squall/.test(condition) ? 38 : /storm|thunder/.test(condition) ? 24 : 6,
  };
}

export function buildForecastDemo(summary: WeatherSummary): ForecastDemo {
  const windKph = parseWindKph(summary.wind);
  const tempSwing = summary.tomorrowHighC - summary.tonightLowC;
  const currentToPeak = summary.tomorrowHighC - summary.currentTempC;
  const conditionBias = getConditionBias(summary);
  const trend: ForecastDemo['trend'] =
    currentToPeak >= 3 ? 'Rising' : currentToPeak <= -3 ? 'Cooling' : 'Steady';

  const points: ForecastPoint[] = Array.from({ length: 6 }, (_, index) => {
    const progress = index / 5;
    const targetTemp = summary.currentTempC + currentToPeak * progress - (trend === 'Cooling' ? progress * 1.5 : 0);
    const precipitationChance = clamp(
      Math.round(conditionBias.rainBoost + progress * 12 + Math.max(tempSwing, 0) * 0.6),
      5,
      95
    );
    const windRisk = clamp(Math.round((windKph / 2) * 0.9 + conditionBias.severeBoost * 0.55), 5, 95);

    return {
      hourLabel: getHourLabel(index * 2),
      tempC: Math.round(targetTemp),
      precipitationChance,
      windRisk,
    };
  });

  const next12HourAverageC = Math.round(points.reduce((sum, point) => sum + point.tempC, 0) / points.length);
  const heatScore = clamp(
    Math.round(((summary.realFeelC + summary.tomorrowHighC) / 2) * 1.8 + conditionBias.heatBoost),
    5,
    100
  );
  const rainScore = clamp(
    Math.round(points.reduce((sum, point) => sum + point.precipitationChance, 0) / points.length),
    5,
    100
  );
  const severeScore = clamp(
    Math.round((windKph || 8) * 1.6 + conditionBias.severeBoost + Math.max(tempSwing, 0) * 0.9),
    5,
    100
  );

  const risks: ForecastRisk[] = [
    {
      label: 'Heat',
      score: heatScore,
      level: heatScore >= 75 ? 'High' : heatScore >= 45 ? 'Moderate' : 'Low',
    },
    {
      label: 'Rain',
      score: rainScore,
      level: rainScore >= 75 ? 'High' : rainScore >= 45 ? 'Moderate' : 'Low',
    },
    {
      label: 'Severe wind',
      score: severeScore,
      level: severeScore >= 75 ? 'High' : severeScore >= 45 ? 'Moderate' : 'Low',
    },
  ];

  const topRisk = [...risks].sort((left, right) => right.score - left.score)[0];
  const summaryLine =
    topRisk.level === 'High'
      ? `${topRisk.label} risk is elevated over the next 12 hours.`
      : `${summary.location} is trending ${trend.toLowerCase()} with no extreme trigger dominant right now.`;

  return {
    headline: `${summary.location} 12-hour forecast demo`,
    next12HourAverageC,
    confidence: summary.source === 'live' ? 'Stable' : 'Demo',
    trend,
    summary: summaryLine,
    points,
    risks,
  };
}

export function buildForecastContext(forecast: ForecastDemo) {
  return [
    `Forecast headline: ${forecast.headline}`,
    `Trend: ${forecast.trend}`,
    `Confidence: ${forecast.confidence}`,
    `Average next 12 hours: ${forecast.next12HourAverageC}°C`,
    `Forecast summary: ${forecast.summary}`,
    `Risk scores: ${forecast.risks.map((risk) => `${risk.label} ${risk.score}/100 (${risk.level})`).join(', ')}`,
    `Timeline: ${forecast.points
      .map(
        (point) =>
          `${point.hourLabel} temp ${point.tempC}°C, precipitation ${point.precipitationChance}%, wind risk ${point.windRisk}%`
      )
      .join('; ')}`,
  ].join('\n');
}
