const weatherCodeSummary: Record<number, string> = {
  0: 'Clear skies',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorms',
  96: 'Thunderstorms with hail',
  99: 'Severe thunderstorms with hail',
};

export type DailyWeatherSummary = {
  conditionSummary: string;
  locationName: string;
  precipitationProbabilityMax: number;
  temperatureHighC: number;
  timezone: string;
};

function buildGeocodingUrl(locationQuery: string) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');

  url.searchParams.set('name', locationQuery);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  return url.toString();
}

function buildForecastUrl(input: {
  latitude: number;
  longitude: number;
  timezone: string;
}) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');

  url.searchParams.set('latitude', String(input.latitude));
  url.searchParams.set('longitude', String(input.longitude));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,precipitation_probability_max,weather_code',
  );
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', input.timezone);

  return url.toString();
}

export async function fetchDailyWeatherSummary(
  options: { fetchImplementation?: typeof fetch; locationQuery?: string } = {},
): Promise<DailyWeatherSummary> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const locationQuery =
    options.locationQuery ?? 'Lantzville, British Columbia, Canada';
  const queryCandidates = Array.from(
    new Set([
      locationQuery,
      ...locationQuery
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ]),
  );
  let location:
    | {
        latitude?: number;
        longitude?: number;
        name?: string;
        timezone?: string;
      }
    | undefined;

  for (const query of queryCandidates) {
    const geocodeResponse = await fetchImplementation(buildGeocodingUrl(query));

    if (!geocodeResponse.ok) {
      throw new Error(
        `Weather geocoding failed with status ${geocodeResponse.status}.`,
      );
    }

    const geocodePayload = (await geocodeResponse.json()) as {
      results?: Array<{
        latitude?: number;
        longitude?: number;
        name?: string;
        timezone?: string;
      }>;
    };

    if (geocodePayload.results?.[0]) {
      location = geocodePayload.results[0];
      break;
    }
  }

  if (
    !location ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    typeof location.name !== 'string' ||
    typeof location.timezone !== 'string'
  ) {
    throw new Error(`No forecastable location found for "${locationQuery}".`);
  }

  const forecastResponse = await fetchImplementation(
    buildForecastUrl({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
    }),
  );

  if (!forecastResponse.ok) {
    throw new Error(
      `Weather forecast failed with status ${forecastResponse.status}.`,
    );
  }

  const forecastPayload = (await forecastResponse.json()) as {
    daily?: {
      precipitation_probability_max?: number[];
      temperature_2m_max?: number[];
      weather_code?: number[];
    };
  };
  const temperatureHighC = forecastPayload.daily?.temperature_2m_max?.[0];
  const precipitationProbabilityMax =
    forecastPayload.daily?.precipitation_probability_max?.[0];
  const weatherCode = forecastPayload.daily?.weather_code?.[0];

  if (
    typeof temperatureHighC !== 'number' ||
    typeof precipitationProbabilityMax !== 'number' ||
    typeof weatherCode !== 'number'
  ) {
    throw new Error(
      'Weather forecast response was missing daily forecast fields.',
    );
  }

  return {
    conditionSummary:
      weatherCodeSummary[weatherCode] ?? 'Unsettled conditions expected',
    locationName: location.name,
    precipitationProbabilityMax,
    temperatureHighC,
    timezone: location.timezone,
  };
}
