import { describe, expect, it, vi } from 'vitest';
import { fetchDailyWeatherSummary } from './weather';

describe('fetchDailyWeatherSummary', () => {
  it('geocodes the home location and returns today weather summary', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                latitude: 49.247,
                longitude: -124.082,
                name: 'Lantzville',
                timezone: 'America/Vancouver',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            daily: {
              precipitation_probability_max: [45],
              temperature_2m_max: [14.2],
              weather_code: [3],
            },
            daily_units: {
              precipitation_probability_max: '%',
              temperature_2m_max: '°C',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    const weather = await fetchDailyWeatherSummary({
      fetchImplementation: fetchMock,
      locationQuery: 'Lantzville, British Columbia, Canada',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(weather).toMatchObject({
      conditionSummary: 'Overcast',
      locationName: 'Lantzville',
      precipitationProbabilityMax: 45,
      temperatureHighC: 14.2,
      timezone: 'America/Vancouver',
    });
  });
});
