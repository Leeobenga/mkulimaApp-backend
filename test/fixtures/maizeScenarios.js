const daysAgoIso = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
};

export const maizeScenarios = {
    emptyWeatherReproductive: {
        weather: {},
        crop: { growthStage: "Reproductive" }
    },
    normalVegetative: {
        weather: {
            temperature: 25,
            humidity: 60,
            rainfall: { observedMm: 4, forecastWindowMm: 24, analysisWindowMm: 24 },
            windSpeed: 14,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 28,
                coolestNight: 18,
                hotDays: 0,
                extremeHotDays: 0,
                wetDays: 1,
                meanPrecipitationProbability: 45,
                avgMaxTemp: 27,
                avgMinTemp: 18,
                avgWindSpeed: 13
            }
        },
        crop: { growthStage: "Vegetative" }
    },
    hotDryReproductive: {
        weather: {
            temperature: 35,
            humidity: 40,
            rainfall: { observedMm: 0, forecastWindowMm: 2, analysisWindowMm: 2 },
            windSpeed: 6,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 37,
                coolestNight: 18,
                hotDays: 3,
                extremeHotDays: 2,
                wetDays: 0,
                meanPrecipitationProbability: 10,
                avgMaxTemp: 36,
                avgMinTemp: 19,
                avgWindSpeed: 7
            }
        },
        crop: { growthStage: "Reproductive" }
    },
    wetHumidVegetative: {
        weather: {
            temperature: 24,
            humidity: 86,
            rainfall: { observedMm: 6, forecastWindowMm: 26, analysisWindowMm: 26 },
            windSpeed: 7,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 27,
                coolestNight: 19,
                hotDays: 0,
                extremeHotDays: 0,
                wetDays: 3,
                meanPrecipitationProbability: 82,
                avgMaxTemp: 26,
                avgMinTemp: 19,
                avgWindSpeed: 8
            }
        },
        crop: { growthStage: "Vegetative" }
    },
    dryReproductiveNoIrrigation: {
        weather: {
            temperature: 33,
            humidity: 42,
            rainfall: { observedMm: 0, forecastWindowMm: 4, analysisWindowMm: 4 },
            windSpeed: 9,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 34,
                coolestNight: 19,
                hotDays: 2,
                extremeHotDays: 0,
                wetDays: 0,
                meanPrecipitationProbability: 20,
                avgMaxTemp: 33,
                avgMinTemp: 19,
                avgWindSpeed: 9
            }
        },
        crop: { growthStage: "Reproductive" }
    },
    dryReproductiveWithIrrigation: {
        weather: {
            temperature: 33,
            humidity: 42,
            rainfall: { observedMm: 0, forecastWindowMm: 4, analysisWindowMm: 4 },
            windSpeed: 9,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 34,
                coolestNight: 19,
                hotDays: 2,
                extremeHotDays: 0,
                wetDays: 0,
                meanPrecipitationProbability: 20,
                avgMaxTemp: 33,
                avgMinTemp: 19,
                avgWindSpeed: 9
            }
        },
        crop: { growthStage: "Reproductive" },
        irrigation: {
            available: true,
            source: "canal",
            availability: "reliable",
            distance: "near"
        }
    },
    derivedStage: {
        weather: {
            temperature: 31,
            humidity: 55,
            rainfall: { observedMm: 2, forecastWindowMm: 10, analysisWindowMm: 10 },
            windSpeed: 10,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 33,
                coolestNight: 18,
                hotDays: 1,
                extremeHotDays: 0,
                wetDays: 1,
                meanPrecipitationProbability: 35,
                avgMaxTemp: 31,
                avgMinTemp: 18,
                avgWindSpeed: 10
            }
        },
        crop: { plantingDate: daysAgoIso(20) }
    },
    unknownStage: {
        weather: {
            temperature: 29,
            humidity: 58,
            rainfall: { observedMm: 3, forecastWindowMm: 12, analysisWindowMm: 12 },
            windSpeed: 11,
            forecastSummary: {
                windowDays: 3,
                hottestDay: 30,
                coolestNight: 17,
                hotDays: 0,
                extremeHotDays: 0,
                wetDays: 1,
                meanPrecipitationProbability: 40,
                avgMaxTemp: 29,
                avgMinTemp: 17,
                avgWindSpeed: 11
            }
        },
        crop: {}
    }
};

const HOT_DRY_FLOW_DATES = ["2026-04-08", "2026-04-09", "2026-04-10"];
const HOT_DRY_FLOW_FORECAST = [
    {
        date: HOT_DRY_FLOW_DATES[0],
        weather_code: 1,
        condition: "Mainly clear",
        temperature_max_c: 37,
        temperature_min_c: 18,
        apparent_temperature_max_c: 38,
        apparent_temperature_min_c: 19,
        precipitation_sum_mm: 0,
        precipitation_probability_max_percent: 10,
        wind_speed_max_kph: 7
    },
    {
        date: HOT_DRY_FLOW_DATES[1],
        weather_code: 1,
        condition: "Mainly clear",
        temperature_max_c: 36,
        temperature_min_c: 19,
        apparent_temperature_max_c: 37,
        apparent_temperature_min_c: 20,
        precipitation_sum_mm: 1,
        precipitation_probability_max_percent: 10,
        wind_speed_max_kph: 7
    },
    {
        date: HOT_DRY_FLOW_DATES[2],
        weather_code: 1,
        condition: "Mainly clear",
        temperature_max_c: 34,
        temperature_min_c: 19,
        apparent_temperature_max_c: 35,
        apparent_temperature_min_c: 20,
        precipitation_sum_mm: 1,
        precipitation_probability_max_percent: 10,
        wind_speed_max_kph: 7
    }
];

export const maizeFlowScenarios = {
    hotDryReproductiveWithIrrigation: {
        profile: {
            county: "Trans Nzoia",
            subcounty: "Kitale"
        },
        request: {
            query: { days: "3" },
            body: {
                crops: [
                    {
                        crop_type: "MAIZE",
                        growth_stage: "reproductive"
                    }
                ],
                irrigation: {
                    available: true,
                    source: "canal",
                    availability: "reliable",
                    distance: "near"
                }
            }
        },
        weatherServiceData: {
            available: true,
            location: {
                name: "Kitale",
                admin1: "Trans Nzoia",
                country: "Kenya",
                latitude: 1.0191,
                longitude: 35.0023
            },
            current: {
                observed_at: "2026-04-08T09:00",
                temperature_c: maizeScenarios.hotDryReproductive.weather.temperature,
                apparent_temperature_c: 37,
                humidity_percent: maizeScenarios.hotDryReproductive.weather.humidity,
                precipitation_mm: maizeScenarios.hotDryReproductive.weather.rainfall.observedMm,
                rain_mm: maizeScenarios.hotDryReproductive.weather.rainfall.observedMm,
                showers_mm: 0,
                wind_speed_kph: maizeScenarios.hotDryReproductive.weather.windSpeed,
                weather_code: 1,
                condition: "Mainly clear"
            },
            forecast: HOT_DRY_FLOW_FORECAST
        },
        geocodingResponse: {
            results: [
                {
                    name: "Kitale",
                    admin1: "Trans Nzoia",
                    country: "Kenya",
                    latitude: 1.0191,
                    longitude: 35.0023
                }
            ]
        },
        forecastResponse: {
            current: {
                time: "2026-04-08T09:00",
                temperature_2m: maizeScenarios.hotDryReproductive.weather.temperature,
                relative_humidity_2m: maizeScenarios.hotDryReproductive.weather.humidity,
                apparent_temperature: 37,
                precipitation: maizeScenarios.hotDryReproductive.weather.rainfall.observedMm,
                rain: maizeScenarios.hotDryReproductive.weather.rainfall.observedMm,
                showers: 0,
                weather_code: 1,
                wind_speed_10m: maizeScenarios.hotDryReproductive.weather.windSpeed
            },
            daily: {
                time: HOT_DRY_FLOW_FORECAST.map((day) => day.date),
                weather_code: HOT_DRY_FLOW_FORECAST.map((day) => day.weather_code),
                temperature_2m_max: HOT_DRY_FLOW_FORECAST.map((day) => day.temperature_max_c),
                temperature_2m_min: HOT_DRY_FLOW_FORECAST.map((day) => day.temperature_min_c),
                apparent_temperature_max: HOT_DRY_FLOW_FORECAST.map((day) => day.apparent_temperature_max_c),
                apparent_temperature_min: HOT_DRY_FLOW_FORECAST.map((day) => day.apparent_temperature_min_c),
                precipitation_sum: HOT_DRY_FLOW_FORECAST.map((day) => day.precipitation_sum_mm),
                precipitation_probability_max: HOT_DRY_FLOW_FORECAST.map((day) => day.precipitation_probability_max_percent),
                wind_speed_10m_max: HOT_DRY_FLOW_FORECAST.map((day) => day.wind_speed_max_kph)
            }
        }
    }
};
